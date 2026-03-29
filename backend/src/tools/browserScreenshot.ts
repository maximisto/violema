import fs from 'fs';
import path from 'path';
import dns from 'dns/promises';
import { chromium } from 'playwright';

const SCREENSHOT_DIR = path.join(process.cwd(), 'generated-screenshots');
const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^0\./,
];

function isPrivateIPv4(address: string): boolean {
  if (PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(address))) return true;

  const match = address.match(/^172\.(\d{1,3})\./);
  if (!match) return false;

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

async function assertPublicUrl(targetUrl: string): Promise<URL> {
  const parsedUrl = new URL(targetUrl);

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only http and https URLs are supported.');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error('Localhost targets are blocked.');
  }

  const lookupResults = await dns.lookup(hostname, { all: true });
  for (const result of lookupResults) {
    if (
      (result.family === 4 && isPrivateIPv4(result.address)) ||
      (result.family === 6 && isPrivateIPv6(result.address))
    ) {
      throw new Error('Private network targets are blocked.');
    }
  }

  return parsedUrl;
}

export interface BrowserScreenshotInput {
  url: string;
  full_page?: boolean;
  width?: number;
  height?: number;
  wait_until?: 'load' | 'domcontentloaded' | 'networkidle';
}

export async function takeBrowserScreenshot(input: BrowserScreenshotInput) {
  const parsedUrl = await assertPublicUrl(input.url);
  const width = Math.min(Math.max(Number(input.width) || 1440, 320), 2400);
  const height = Math.min(Math.max(Number(input.height) || 900, 320), 2400);
  const fullPage = input.full_page !== false;
  const waitUntil = input.wait_until || 'networkidle';

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const fileName = `shot-${Date.now()}.png`;
  const filePath = path.join(SCREENSHOT_DIR, fileName);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(parsedUrl.toString(), {
      waitUntil,
      timeout: 30_000,
    });

    await page.screenshot({
      path: filePath,
      fullPage,
      type: 'png',
    });

    return {
      success: true,
      url: parsedUrl.toString(),
      title: await page.title(),
      width,
      height,
      full_page: fullPage,
      screenshot_path: filePath,
      screenshot_url: `/api/generated-screenshots/${fileName}`,
      captured_at: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}
