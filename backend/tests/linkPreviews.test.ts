import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectLinkImageBlocks,
  extractBriefLinks,
  isFetchableHost,
  parseOgImageFromHtml,
} from '../src/linkPreviews';

const BRIEF = [
  'Acme cut pricing — see [Acme announcement](https://news.acme-example.com/pricing).',
  'Relay shipped review gates: [TechDaily coverage](https://techdaily-example.com/relay).',
  'Same-host duplicate: [Acme follow-up](https://news.acme-example.com/followup).',
  'Insecure: [http link](http://insecure-example.com/a).',
].join('\n');

function stubResponse(body: string, contentType = 'text/html'): Response {
  return new Response(body, { status: 200, headers: { 'content-type': contentType } });
}

test('extractBriefLinks takes https links, deduped by host, up to the limit', () => {
  const links = extractBriefLinks(BRIEF, 3);
  assert.deepEqual(links.map((link) => link.url), [
    'https://news.acme-example.com/pricing',
    'https://techdaily-example.com/relay',
  ]);
  assert.equal(links[0].label, 'Acme announcement');
});

test('isFetchableHost rejects local and IP-literal hosts', () => {
  assert.ok(isFetchableHost('news.acme-example.com'));
  assert.ok(!isFetchableHost('localhost'));
  assert.ok(!isFetchableHost('10.0.0.8'));
  assert.ok(!isFetchableHost('service.internal'));
  assert.ok(!isFetchableHost('shortname'));
});

test('parseOgImageFromHtml prefers og:image and requires https', () => {
  const html = [
    '<meta name="twitter:image" content="https://cdn.example.com/tw.png">',
    '<meta content="https://cdn.example.com/og.png" property="og:image">',
    '<meta property="og:image" content="http://cdn.example.com/insecure.png">',
  ].join('\n');
  assert.equal(parseOgImageFromHtml(html), 'https://cdn.example.com/og.png');
  assert.equal(parseOgImageFromHtml('<meta name="twitter:image" content="https://cdn.example.com/tw.png">'), 'https://cdn.example.com/tw.png');
  assert.equal(parseOgImageFromHtml('<meta property="og:image" content="http://cdn.example.com/x.png">'), null);
});

test('collectLinkImageBlocks returns divider plus image blocks from fetched pages', async () => {
  const blocks = await collectLinkImageBlocks(BRIEF, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('acme')) {
        return stubResponse('<meta property="og:image" content="https://cdn.acme-example.com/hero.png">');
      }
      return stubResponse('no previews here');
    },
  });

  assert.deepEqual(blocks, [
    { type: 'divider' },
    { type: 'image', image_url: 'https://cdn.acme-example.com/hero.png', alt_text: 'Acme announcement' },
  ]);
});

test('collectLinkImageBlocks returns nothing when fetches fail or pages lack images', async () => {
  const failing = await collectLinkImageBlocks(BRIEF, {
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });
  assert.deepEqual(failing, []);

  const nonHtml = await collectLinkImageBlocks(BRIEF, {
    fetchImpl: async () => stubResponse('{"api": true}', 'application/json'),
  });
  assert.deepEqual(nonHtml, []);

  const noLinks = await collectLinkImageBlocks('No links in this brief.', {
    fetchImpl: async () => stubResponse(''),
  });
  assert.deepEqual(noLinks, []);
});
