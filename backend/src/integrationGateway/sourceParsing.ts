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
 * Byte-length check + slice, same ceiling convention as `accountLibrary`'s
 * `MAX_ENTRY_CONTENT_BYTES` handling. Slicing raw UTF-8 bytes rather than JS
 * characters means a multi-byte character straddling the cut point can come
 * back as a replacement character — an accepted, documented cost of a hard
 * byte ceiling, not a bug.
 */
function capToByteLimit(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.byteLength <= maxBytes) {
    return { text, truncated: false };
  }
  const safeMax = Math.max(0, maxBytes);
  return { text: bytes.subarray(0, safeMax).toString('utf8'), truncated: true };
}

/**
 * `pdf-parse` is required lazily, inside this branch only, rather than
 * imported at module scope. Its 1.x line had a documented quirk of running
 * debug/self-test code as a side effect of being `require`d directly; a
 * lazy require keeps that risk (present or future, across version bumps)
 * confined to the one call path that actually parses a PDF, instead of
 * firing every time any part of the server imports this module — including
 * the text/docx-only paths that never touch a PDF at all.
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
 * neither library handles — is `parse_failed`. Every `ok: true` result has
 * already been passed through `capToByteLimit`, so no caller needs to
 * re-check size before treating the text as safe to embed in a prompt.
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
