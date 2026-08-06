/**
 * SSRF-guarded URL fetch.
 *
 * A "paste a URL" ingestion feature is a confused-deputy machine by default:
 * whatever address the URL's host resolves to, THIS SERVER makes the
 * request, from inside the network the operator's browser cannot reach.
 * Without a guard, an operator (or an attacker who tricks one into pasting a
 * link) can point the app at `http://169.254.169.254/latest/meta-data/` — a
 * cloud metadata endpoint — or at `http://10.0.0.5:6379/` — an internal
 * service with no auth because it was never meant to be internet-facing —
 * and get the response back rendered as "extracted page content".
 *
 * THE GUARD, IN ORDER
 *
 *  1. Scheme allow-list: only `http:`/`https:`. Everything else (`ftp:`,
 *     `javascript:`, `file:`, ...) is `invalid_url` before any network call.
 *  2. DNS resolution BEFORE connecting: `lookup(host)` (real default:
 *     `dns.promises.lookup(host, { all: true })`) resolves every address a
 *     name could answer with, and EVERY one of them must be public — one
 *     private/loopback/link-local/ULA hit anywhere in the answer set refuses
 *     the whole request. This also transparently covers a bare IP literal in
 *     the URL (`http://127.0.0.1/`): Node's resolver hands a literal
 *     straight back without a real lookup, so the same check catches it.
 *  3. `redirect: 'manual'`: fetch never follows a redirect on its own. Each
 *     3xx hop re-enters this same two checks from step 1, so a public host
 *     that 302s to a private address is caught on the SECOND hop, not
 *     silently followed.
 *  4. A hop budget (`maxRedirects`, default 3) bounds the chain length.
 *  5. A running byte count against `maxBytes` (default 500,000) while
 *     streaming the body, so an attacker-controlled endpoint cannot exhaust
 *     memory by never closing the connection.
 *  6. `AbortSignal.timeout` bounds how long any single hop can hang.
 *
 * KNOWN RESIDUAL RISK — TOCTOU / DNS rebinding
 *
 * Step 2 validates the addresses `lookup` returns; step 3's actual `fetch`
 * performs its OWN resolution when it connects. A DNS server that answers
 * differently a few milliseconds apart (rebinding) could in principle slip
 * a private address past validation and into the real connection. Closing
 * this fully needs connecting to the validated IP directly (a custom
 * `dispatcher`/socket layer) rather than handing a hostname to `fetch` — out
 * of scope for this task's interface, which is deliberately just
 * `lookup(host)` then `fetch(url)`. Worth hardening if this endpoint ever
 * takes a target the operator does not already trust more than an internal
 * service.
 */

import * as dns from 'node:dns';

export type SafeUrlFetchResult =
  | { ok: true; finalUrl: string; contentType: string; body: string }
  | {
      ok: false;
      reason: 'invalid_url' | 'blocked_address' | 'too_many_redirects' | 'too_large' | 'fetch_failed';
    };

export type SafeUrlFetchLookup = (
  host: string,
) => Promise<Array<{ address: string; family: number }>>;

export interface SafeUrlFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  lookup?: SafeUrlFetchLookup;
}

export const DEFAULT_SAFE_URL_FETCH_MAX_BYTES = 500_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 3;

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

async function defaultLookup(host: string): Promise<Array<{ address: string; family: number }>> {
  return dns.promises.lookup(host, { all: true });
}

// --- address classification ---------------------------------------------------

/** Loopback (127.0.0.0/8), private (10/8, 172.16/12, 192.168/16), link-local (169.254/16). */
function isBlockedIPv4(address: string): boolean {
  const octets = address.split('.');
  if (octets.length !== 4) return true; // unparseable as dotted-quad: fail closed.
  const parts = octets.map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;

  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local
  return false;
}

/** Parses a dotted-quad IPv4 tail (e.g. the "127.0.0.1" in "::ffff:127.0.0.1") into two 16-bit groups. */
function ipv4TextToGroups(ipv4: string): [number, number] | null {
  const octets = ipv4.split('.');
  if (octets.length !== 4) return null;
  const values = octets.map((part) => Number(part));
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return [(values[0] << 8) | values[1], (values[2] << 8) | values[3]];
}

/** Parses a (possibly `::`-compressed) IPv6 literal into 8 16-bit groups, or null if malformed. */
function parseIPv6Groups(address: string): number[] | null {
  const clean = address.split('%')[0]; // drop a zone id, e.g. "fe80::1%eth0"

  // An embedded IPv4 dotted-quad tail (e.g. "::ffff:127.0.0.1") is valid IPv6
  // textual form, distinct from the fully-hex form ("::ffff:7f00:1") that
  // `new URL(...).hostname` normalizes to. Rewrite the dotted tail to two hex
  // groups BEFORE the "::" expansion below, so both spellings of the same
  // address parse to the identical group array.
  const lastColon = clean.lastIndexOf(':');
  let normalized = clean;
  if (lastColon !== -1 && clean.includes('.', lastColon)) {
    const embedded = ipv4TextToGroups(clean.slice(lastColon + 1));
    if (!embedded) return null;
    normalized = `${clean.slice(0, lastColon + 1)}${embedded[0].toString(16)}:${embedded[1].toString(16)}`;
  }

  const doubleColonAt = normalized.indexOf('::');

  let groupStrings: string[];
  if (doubleColonAt !== -1) {
    if (normalized.indexOf('::', doubleColonAt + 1) !== -1) return null; // more than one "::"
    const left = normalized.slice(0, doubleColonAt).split(':').filter(Boolean);
    const right = normalized.slice(doubleColonAt + 2).split(':').filter(Boolean);
    const missing = 8 - (left.length + right.length);
    if (missing < 0) return null;
    groupStrings = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    groupStrings = normalized.split(':');
  }

  if (groupStrings.length !== 8) return null;
  const groups = groupStrings.map((group) => parseInt(group, 16));
  if (groups.some((value) => Number.isNaN(value) || value < 0 || value > 0xffff)) return null;
  return groups;
}

/** Loopback (::1), link-local (fe80::/10), unique local / ULA (fc00::/7), IPv4-mapped (::ffff:0:0/96). */
function isBlockedIPv6(address: string): boolean {
  const groups = parseIPv6Groups(address);
  if (!groups) return true; // unparseable: fail closed.

  const isLoopback = groups.slice(0, 7).every((value) => value === 0) && groups[7] === 1;
  if (isLoopback) return true;

  // IPv4-mapped IPv6 (::ffff:0:0/96): the last 32 bits ARE an IPv4 address
  // wearing an IPv6 costume. Without this unwrap, a host literal like
  // "[::ffff:169.254.169.254]" — the cloud metadata endpoint this guard
  // exists to stop — reads as an unremarkable IPv6 address that matches none
  // of the IPv6-only ranges below, and sails straight through. Re-running
  // the IPv4 guard on the unwrapped address (rather than adding a second,
  // easily-out-of-sync IPv4 range table here) means every IPv4 rule is
  // defined in exactly one place.
  const isIPv4Mapped = groups.slice(0, 5).every((value) => value === 0) && groups[5] === 0xffff;
  if (isIPv4Mapped) {
    const [high, low] = [groups[6], groups[7]];
    const embeddedIPv4 = [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join('.');
    return isBlockedIPv4(embeddedIPv4);
  }

  const firstGroup = groups[0];
  const isLinkLocal = firstGroup >= 0xfe80 && firstGroup <= 0xfebf; // fe80::/10
  if (isLinkLocal) return true;

  const isUla = firstGroup >= 0xfc00 && firstGroup <= 0xfdff; // fc00::/7
  if (isUla) return true;

  return false;
}

function isBlockedAddress(address: string, family: number): boolean {
  return family === 4 ? isBlockedIPv4(address) : isBlockedIPv6(address);
}

async function validateHostIsPublic(
  hostname: string,
  lookup: SafeUrlFetchLookup,
): Promise<{ ok: true } | { ok: false; reason: 'blocked_address' | 'fetch_failed' }> {
  const cleanHost = hostname.replace(/^\[/, '').replace(/\]$/, ''); // strip IPv6 URL brackets

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(cleanHost);
  } catch {
    return { ok: false, reason: 'fetch_failed' };
  }

  if (!addresses || addresses.length === 0) {
    return { ok: false, reason: 'fetch_failed' };
  }

  // EVERY resolved address must be public — one private hit anywhere in the
  // answer set refuses the whole host, since we cannot know which address
  // the real connection will actually use.
  for (const { address, family } of addresses) {
    if (isBlockedAddress(address, family)) {
      return { ok: false, reason: 'blocked_address' };
    }
  }

  return { ok: true };
}

// --- fetch ----------------------------------------------------------------------

export async function safeUrlFetch(
  rawUrl: string,
  options: SafeUrlFetchOptions = {},
): Promise<SafeUrlFetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_SAFE_URL_FETCH_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const lookup = options.lookup ?? defaultLookup;

  let currentUrl = rawUrl;
  let redirectCount = 0;

  while (true) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return { ok: false, reason: 'invalid_url' };
    }
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return { ok: false, reason: 'invalid_url' };
    }

    const validation = await validateHostIsPublic(parsed.hostname, lookup);
    if (!validation.ok) {
      return { ok: false, reason: validation.reason };
    }

    let response: Response;
    try {
      response = await fetch(parsed.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return { ok: false, reason: 'fetch_failed' };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { ok: false, reason: 'fetch_failed' };
      }
      redirectCount += 1;
      if (redirectCount > maxRedirects) {
        return { ok: false, reason: 'too_many_redirects' };
      }
      try {
        currentUrl = new URL(location, parsed).toString();
      } catch {
        return { ok: false, reason: 'fetch_failed' };
      }
      continue;
    }

    if (!response.ok) {
      return { ok: false, reason: 'fetch_failed' };
    }

    const contentType = response.headers.get('content-type') || '';
    const declaredLength = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return { ok: false, reason: 'too_large' };
    }

    if (!response.body) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > maxBytes) {
        return { ok: false, reason: 'too_large' };
      }
      return { ok: true, finalUrl: parsed.toString(), contentType, body: buffer.toString('utf8') };
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        total += chunk.byteLength;
        if (total > maxBytes) {
          return { ok: false, reason: 'too_large' };
        }
        chunks.push(chunk);
      }
    } catch {
      return { ok: false, reason: 'fetch_failed' };
    } finally {
      reader.cancel().catch(() => {});
    }

    return { ok: true, finalUrl: parsed.toString(), contentType, body: Buffer.concat(chunks).toString('utf8') };
  }
}
