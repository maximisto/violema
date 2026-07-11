import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  BETA_TERMS_PATH,
  CURRENT_BETA_TERMS_DIGEST,
  CURRENT_BETA_TERMS_VERSION,
  ParticipantType,
  normalizeParticipantType,
} from './betaProgram';
import { readJsonFile, writeJsonFile } from './platform/jsonStore';

export interface BetaConsentReceipt {
  id: string;
  email: string;
  participantType: ParticipantType;
  termsVersion: string;
  termsDigest: string;
  acceptedAt: string;
  authMethod: 'google' | 'microsoft' | 'email';
  acceptanceSource: 'signup' | 'oauth_callback' | 'reauthorization';
  termsPath: string;
}

const AUTH_METHODS = new Set<BetaConsentReceipt['authMethod']>(['google', 'microsoft', 'email']);
const ACCEPTANCE_SOURCES = new Set<BetaConsentReceipt['acceptanceSource']>([
  'signup',
  'oauth_callback',
  'reauthorization',
]);
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getConsentFile() {
  return path.join(process.cwd(), 'beta-consent-receipts.json');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') throw new Error('invalid email');
  const email = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error('invalid email');
  return email;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function validateReceipt(value: unknown, index: number): BetaConsentReceipt {
  if (!isPlainRecord(value)) throw new Error(`row ${index} must be an object`);
  if (typeof value.id !== 'string' || !value.id) throw new Error(`row ${index} has invalid id`);

  const email = normalizeEmail(value.email);
  if (value.email !== email) throw new Error(`row ${index} has invalid email normalization`);

  const participantType = normalizeParticipantType(value.participantType);
  if (!participantType) throw new Error(`row ${index} has invalid participant type`);
  if (typeof value.termsVersion !== 'string' || !value.termsVersion.trim()) {
    throw new Error(`row ${index} has invalid termsVersion`);
  }
  if (typeof value.termsDigest !== 'string' || !SHA_256_PATTERN.test(value.termsDigest)) {
    throw new Error(`row ${index} has invalid termsDigest`);
  }
  if (!isIsoTimestamp(value.acceptedAt)) throw new Error(`row ${index} has invalid acceptedAt`);
  if (!AUTH_METHODS.has(value.authMethod as BetaConsentReceipt['authMethod'])) {
    throw new Error(`row ${index} has invalid auth method`);
  }
  if (!ACCEPTANCE_SOURCES.has(value.acceptanceSource as BetaConsentReceipt['acceptanceSource'])) {
    throw new Error(`row ${index} has invalid acceptance source`);
  }
  if (value.termsPath !== BETA_TERMS_PATH) throw new Error(`row ${index} has invalid termsPath`);

  return {
    id: value.id,
    email,
    participantType,
    termsVersion: value.termsVersion,
    termsDigest: value.termsDigest,
    acceptedAt: value.acceptedAt,
    authMethod: value.authMethod as BetaConsentReceipt['authMethod'],
    acceptanceSource: value.acceptanceSource as BetaConsentReceipt['acceptanceSource'],
    termsPath: value.termsPath,
  };
}

function readConsentReceipts() {
  const filePath = getConsentFile();
  if (!fs.existsSync(filePath)) {
    return readJsonFile<BetaConsentReceipt[]>(filePath, []);
  }

  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
    if (!Array.isArray(value)) throw new Error('beta consent receipts must contain a JSON array');

    const seenIds = new Set<string>();
    return value.map((row, index) => {
      const receipt = validateReceipt(row, index);
      if (seenIds.has(receipt.id)) throw new Error(`row ${index} duplicates receipt id ${receipt.id}`);
      seenIds.add(receipt.id);
      return receipt;
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown read error';
    throw new Error(`Invalid beta consent receipts store at ${filePath}: ${detail}`);
  }
}

function validateInput(
  input: Omit<BetaConsentReceipt, 'id' | 'termsPath'>,
): Omit<BetaConsentReceipt, 'id' | 'termsPath'> {
  const email = normalizeEmail(input.email);
  const participantType = normalizeParticipantType(input.participantType);
  if (!participantType) throw new Error('invalid participant type');
  if (typeof input.termsVersion !== 'string' || !input.termsVersion.trim()) {
    throw new Error('invalid termsVersion');
  }
  if (typeof input.termsDigest !== 'string' || !SHA_256_PATTERN.test(input.termsDigest)) {
    throw new Error('invalid termsDigest');
  }
  if (!isIsoTimestamp(input.acceptedAt)) throw new Error('invalid acceptedAt');
  if (!AUTH_METHODS.has(input.authMethod)) throw new Error('invalid auth method');
  if (!ACCEPTANCE_SOURCES.has(input.acceptanceSource)) throw new Error('invalid acceptance source');

  return {
    ...input,
    email,
    participantType,
  };
}

function createReceiptId(existingIds: Set<string>) {
  let id = '';
  do {
    id = `beta_consent_${crypto.randomUUID()}`;
  } while (existingIds.has(id));
  return id;
}

export function recordBetaConsent(
  input: Omit<BetaConsentReceipt, 'id' | 'termsPath'>,
): BetaConsentReceipt {
  const validated = validateInput(input);
  const receipts = readConsentReceipts();
  const receipt: BetaConsentReceipt = {
    ...validated,
    id: createReceiptId(new Set(receipts.map((item) => item.id))),
    termsPath: BETA_TERMS_PATH,
  };
  writeJsonFile(getConsentFile(), [receipt, ...receipts]);
  return receipt;
}

export function listBetaConsentReceipts(email?: string): BetaConsentReceipt[] {
  const receipts = readConsentReceipts();
  if (email === undefined) return receipts;
  const normalized = normalizeEmail(email);
  return receipts.filter((receipt) => receipt.email === normalized);
}

export function getCurrentBetaConsent(email: string): BetaConsentReceipt | null {
  return listBetaConsentReceipts(email).find(
    (receipt) => receipt.termsVersion === CURRENT_BETA_TERMS_VERSION
      && receipt.termsDigest === CURRENT_BETA_TERMS_DIGEST,
  ) || null;
}

export function hasCurrentBetaConsent(email: string): boolean {
  return getCurrentBetaConsent(email) !== null;
}
