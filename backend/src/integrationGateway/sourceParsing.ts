/**
 * Source parsing — bytes in, plain text out, bounded.
 *
 * Task 3's folder-drop sweep already downloaded a Buffer by the time it
 * reaches this module (Google Docs never do — they are exported to text
 * upstream, so this module only ever sees real files: markdown, plain text,
 * PDF, and Word). Its only job is to turn that Buffer into extracted text a
 * mission can reason over, without ever throwing and without ever handing
 * back more bytes than the caller asked for.
 *
 * FAILS CLOSED, NEVER THROWS
 *
 * `parseSourceBuffer` is called from a sweep over an entire folder of
 * customer-owned files. One corrupt PDF or a Word doc mammoth chokes on must
 * never take down the run that is ingesting everything else — it becomes a
 * `parse_failed` result for that one file, and the sweep moves on.
 *
 * BYTE CAP MIRRORS accountLibrary
 *
 * `capToByteLimit` is the same `Buffer.byteLength` check + slice +
 * `truncated` flag that `accountLibrary`'s read path uses for its content
 * ceilings. One truncation convention across the ingestion pipeline, not two.
 *
 * DEPLOY-TARGET CONSTRAINT (carry forward into Task 9's deploy runbook)
 *
 * `pdf-parse` declares `engines.node: ">=20.16.0 <21 || >=22.3.0"`. The VPS
 * deploy script (`deploy/deploy.sh`) provisions Node via NodeSource's
 * `setup_20.x`, which always tracks the latest 20.x point release — every
 * 20.x release since 20.16.0 (mid-2024) satisfies this, but that install
 * step only runs `if ! command -v node`, i.e. it is skipped on a host that
 * already has Node installed. Whoever runs the next deploy should confirm
 * the live VPS Node version explicitly rather than assume the nodesource
 * step reran.
 */

import mammoth from 'mammoth';

/** Google Docs are exported to text upstream and never reach this map. */
export const PARSEABLE_SOURCE_MIME_TYPES: Record<string, 'text' | 'pdf' | 'docx'> = {
  'text/markdown': 'text',
  'text/plain': 'text',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export function isParseableSourceMime(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(PARSEABLE_SOURCE_MIME_TYPES, mimeType);
}

export type ParseSourceResult =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; reason: 'unsupported_type' | 'parse_failed' };

/**
 * Byte-length check + bounded write, same ceiling convention as
 * `accountLibrary`'s `MAX_ENTRY_CONTENT_BYTES` handling.
 *
 * Deliberately uses `Buffer#write` into a fixed-size `maxBytes` buffer
 * rather than `Buffer.from(text).subarray(0, maxBytes).toString()`. The
 * subarray approach slices raw UTF-8 bytes at an arbitrary byte offset, and
 * if that offset lands mid multi-byte character, `.toString('utf8')`
 * replaces the truncated tail with a 3-byte U+FFFD replacement character —
 * which can push the decoded string back OVER maxBytes (e.g. cutting a
 * 4-byte emoji after its first byte yields a 3-byte replacement char, net
 * +2 bytes over the cap). `Buffer#write` never writes a partial multi-byte
 * sequence into the destination buffer in the first place, so the returned
 * text is always <= maxBytes, full stop — verified with emoji and
 * multi-byte punctuation (em dash, curly quote) landing exactly on the cut
 * boundary.
 */
function capToByteLimit(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const totalBytes = Buffer.byteLength(text, 'utf8');
  if (totalBytes <= maxBytes) {
    return { text, truncated: false };
  }
  const safeMax = Math.max(0, maxBytes);
  const bounded = Buffer.alloc(safeMax);
  const written = bounded.write(text, 0, safeMax, 'utf8');
  return { text: bounded.toString('utf8', 0, written), truncated: true };
}

/**
 * `pdf-parse` is required lazily, inside this branch only, rather than
 * imported at module scope. Its 1.x line had a documented quirk of running
 * debug/self-test code as a side effect of being `require`d directly; a
 * lazy require keeps that risk (present or future, across version bumps)
 * confined to the one call path that actually parses a PDF, instead of
 * firing every time any part of the server imports this module — including
 * the text/docx-only paths that never touch a PDF at all.
 *
 * NATIVE DEPENDENCY, VERIFIED DEGRADED-NOT-CRASHED: `pdf-parse` depends on
 * `@napi-rs/canvas` (a native binary, resolved per-platform through its own
 * `optionalDependencies`). Confirmed by reading `pdf-parse`'s source that
 * `getText()`/`getPageText()` never touch canvas directly — only
 * `getImage`/`getScreenshot`/`getTable` do — but also confirmed empirically
 * (by removing the installed `@napi-rs/canvas` package and re-running this
 * module's test suite) that `pdfjs-dist`'s internal DOMMatrix/ImageData/
 * Path2D polyfills still depend on it being loadable, so `getText()` itself
 * fails when canvas cannot load. The guarantee that matters for this module
 * is not "canvas is never needed" — it verifiably still is a runtime
 * requirement inside `getText()` on the tested version — it is that this
 * `require` and every call below it live inside `extractPdfText`, which is
 * only ever invoked from `parseSourceBuffer`'s single try/catch (see below):
 * a synchronous `require` failure, a missing native binary, or any getText
 * failure all surface as a rejected promise here, which that outer catch
 * turns into `{ ok: false, reason: 'parse_failed' }` for that one file —
 * never a crash of the sweep that called it. Verified directly: with
 * `@napi-rs/canvas` removed, every PDF in this module's test suite degrades
 * to `parse_failed` (not a throw) while the text/docx paths keep working.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParseModule = require('pdf-parse') as typeof import('pdf-parse');
  const parser = new pdfParseModule.PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Parse an already-downloaded Buffer into plain text, capped at `maxBytes`.
 *
 * Never throws: an unsupported mime type is `unsupported_type`; anything a
 * parser rejects — corrupt bytes, a truncated file, a format edge case
 * neither library handles, or `pdf-parse`'s lazy `require` itself failing
 * to load (missing module, missing native `@napi-rs/canvas` binary on an
 * unexpected host) — is `parse_failed`. The `try` below wraps the entire
 * switch, so every branch's failure mode, including a `require` throw,
 * collapses to the same `parse_failed` result rather than escaping as a
 * raw exception. Every `ok: true` result has already been passed through
 * `capToByteLimit`, so no caller needs to re-check size before treating the
 * text as safe to embed in a prompt.
 */
export async function parseSourceBuffer(
  input: { fileName: string; mimeType: string; buffer: Buffer },
  maxBytes: number,
): Promise<ParseSourceResult> {
  const kind = PARSEABLE_SOURCE_MIME_TYPES[input.mimeType];
  if (!kind) {
    return { ok: false, reason: 'unsupported_type' };
  }

  try {
    let text: string;
    switch (kind) {
      case 'text':
        text = input.buffer.toString('utf8');
        break;
      case 'pdf':
        text = await extractPdfText(input.buffer);
        break;
      case 'docx':
        text = await extractDocxText(input.buffer);
        break;
    }
    const capped = capToByteLimit(text, maxBytes);
    return { ok: true, text: capped.text, truncated: capped.truncated };
  } catch {
    return { ok: false, reason: 'parse_failed' };
  }
}
