import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  PARSEABLE_SOURCE_MIME_TYPES,
  isParseableSourceMime,
  parseSourceBuffer,
} from '../src/integrationGateway/sourceParsing';

/**
 * Hand-written, byte-exact minimal one-page PDF: catalog -> pages -> page ->
 * a Helvetica font resource -> a contents stream that draws the fixture
 * sentence, plus a correct xref table (every offset below points at the
 * literal start of its object) and a matching trailer/startxref. Generated
 * and offset-checked programmatically, then frozen here as a literal so the
 * fixture never depends on a PDF-writing library.
 */
const PDF_FIXTURE = Buffer.from(
  '%PDF-1.4\n' +
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
    '5 0 obj\n<< /Length 52 >>\nstream\nBT /F1 12 Tf 72 712 Td (Beandjinn pdf fixture) Tj ET\nendstream\nendobj\n' +
    'xref\n0 6\n' +
    '0000000000 65535 f \r\n' +
    '0000000009 00000 n \r\n' +
    '0000000058 00000 n \r\n' +
    '0000000115 00000 n \r\n' +
    '0000000241 00000 n \r\n' +
    '0000000311 00000 n \r\n' +
    'trailer\n<< /Size 6 /Root 1 0 R >>\n' +
    'startxref\n413\n' +
    '%%EOF',
  'latin1',
);

const DOCX_FIXTURE_PATH = path.join(__dirname, 'fixtures', 'minimal.docx');

const DEFAULT_MAX_BYTES = 1_000_000;

test('markdown and plain text pass through, byte-capped with a truncated flag', async () => {
  const markdown = '# Beandjinn roadmap\n\nSome plain markdown body text.';
  const mdResult = await parseSourceBuffer(
    { fileName: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from(markdown, 'utf8') },
    DEFAULT_MAX_BYTES,
  );
  assert.equal(mdResult.ok, true);
  if (mdResult.ok) {
    assert.equal(mdResult.text, markdown);
    assert.equal(mdResult.truncated, false);
  }

  const plain = 'Plain text body for the Beandjinn fixture.';
  const plainResult = await parseSourceBuffer(
    { fileName: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from(plain, 'utf8') },
    DEFAULT_MAX_BYTES,
  );
  assert.equal(plainResult.ok, true);
  if (plainResult.ok) {
    assert.equal(plainResult.text, plain);
    assert.equal(plainResult.truncated, false);
  }

  // Byte-capped: a small maxBytes truncates and flags it.
  const longText = 'a'.repeat(100);
  const cappedResult = await parseSourceBuffer(
    { fileName: 'long.txt', mimeType: 'text/plain', buffer: Buffer.from(longText, 'utf8') },
    10,
  );
  assert.equal(cappedResult.ok, true);
  if (cappedResult.ok) {
    assert.equal(Buffer.byteLength(cappedResult.text, 'utf8'), 10);
    assert.equal(cappedResult.truncated, true);
  }
});

test('pdf text extraction finds the fixture sentence', async () => {
  const result = await parseSourceBuffer(
    { fileName: 'fixture.pdf', mimeType: 'application/pdf', buffer: PDF_FIXTURE },
    DEFAULT_MAX_BYTES,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(
      result.text.includes('Beandjinn pdf fixture'),
      `expected extracted text to contain the fixture sentence, got: ${result.text}`,
    );
    assert.equal(result.truncated, false);
  }
});

test('docx extraction via the committed fixture', async () => {
  const buffer = fs.readFileSync(DOCX_FIXTURE_PATH);
  const result = await parseSourceBuffer(
    {
      fileName: 'minimal.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer,
    },
    DEFAULT_MAX_BYTES,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(
      result.text.includes('Beandjinn roadmap docx fixture'),
      `expected extracted text to contain the fixture sentence, got: ${result.text}`,
    );
    assert.equal(result.truncated, false);
  }
});

test('unknown mime -> unsupported_type', async () => {
  assert.equal(isParseableSourceMime('image/png'), false);
  assert.equal(isParseableSourceMime('text/plain'), true);
  assert.equal(PARSEABLE_SOURCE_MIME_TYPES['image/png'], undefined);

  const result = await parseSourceBuffer(
    { fileName: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    DEFAULT_MAX_BYTES,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unsupported_type');
  }
});

test('corrupt pdf bytes -> parse_failed, never a throw', async () => {
  const corrupt = Buffer.from('this is not a pdf at all, just garbage bytes', 'utf8');
  await assert.doesNotReject(async () => {
    const result = await parseSourceBuffer(
      { fileName: 'broken.pdf', mimeType: 'application/pdf', buffer: corrupt },
      DEFAULT_MAX_BYTES,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, 'parse_failed');
    }
  });
});

test('every ok result respects maxBytes', async () => {
  const markdownResult = await parseSourceBuffer(
    { fileName: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('x'.repeat(500), 'utf8') },
    50,
  );
  assert.equal(markdownResult.ok, true);
  if (markdownResult.ok) {
    assert.ok(Buffer.byteLength(markdownResult.text, 'utf8') <= 50);
    assert.equal(markdownResult.truncated, true);
  }

  const pdfResult = await parseSourceBuffer(
    { fileName: 'fixture.pdf', mimeType: 'application/pdf', buffer: PDF_FIXTURE },
    5,
  );
  assert.equal(pdfResult.ok, true);
  if (pdfResult.ok) {
    assert.ok(Buffer.byteLength(pdfResult.text, 'utf8') <= 5);
    assert.equal(pdfResult.truncated, true);
  }

  const docxBuffer = fs.readFileSync(DOCX_FIXTURE_PATH);
  const docxResult = await parseSourceBuffer(
    {
      fileName: 'minimal.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: docxBuffer,
    },
    5,
  );
  assert.equal(docxResult.ok, true);
  if (docxResult.ok) {
    assert.ok(Buffer.byteLength(docxResult.text, 'utf8') <= 5);
    assert.equal(docxResult.truncated, true);
  }
});
