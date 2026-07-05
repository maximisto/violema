import fs from 'fs';
import path from 'path';

const CORRUPT_SUFFIX = '.corrupt.';

function backupPathFor(filePath: string) {
  return `${filePath}.bak`;
}

function corruptPathFor(filePath: string) {
  return `${filePath}${CORRUPT_SUFFIX}${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function quarantineCorruptFile(filePath: string, error: unknown) {
  const destination = corruptPathFor(filePath);
  try {
    fs.renameSync(filePath, destination);
    console.error(
      `[jsonStore] Corrupt JSON store moved to ${destination}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } catch (renameError) {
    console.error(
      `[jsonStore] Failed to quarantine corrupt JSON store ${filePath}: ${
        renameError instanceof Error ? renameError.message : String(renameError)
      }`,
    );
  }
}

function readBackupJsonFile<T>(filePath: string, fallback: T): T {
  const backupPath = backupPathFor(filePath);
  if (!fs.existsSync(backupPath)) return fallback;

  try {
    return parseJsonFile<T>(backupPath);
  } catch (error) {
    console.error(
      `[jsonStore] Backup JSON store is unreadable at ${backupPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return fallback;
  }
}

function copyCurrentFileToBackup(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  try {
    parseJsonFile<unknown>(filePath);
    fs.copyFileSync(filePath, backupPathFor(filePath));
  } catch (error) {
    quarantineCorruptFile(filePath, error);
  }
}

function writeFileDurably(filePath: string, contents: string) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const descriptor = fs.openSync(tempPath, 'w');

  try {
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }

  try {
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      // Best effort cleanup; the original rename error is the useful one.
    }
    throw error;
  }
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return parseJsonFile<T>(filePath);
  } catch (error) {
    quarantineCorruptFile(filePath, error);
    return readBackupJsonFile(filePath, fallback);
  }
}

export function writeJsonFile<T>(filePath: string, value: T) {
  copyCurrentFileToBackup(filePath);
  writeFileDurably(filePath, JSON.stringify(value, null, 2));
}

export function updateJsonFile<T>(filePath: string, fallback: T, updater: (current: T) => T): T {
  const next = updater(readJsonFile(filePath, fallback));
  writeJsonFile(filePath, next);
  return next;
}

export function upsertJsonRecord<T extends { id: string }>(items: T[], record: T): T[] {
  const index = items.findIndex((item) => item.id === record.id);
  if (index === -1) return [record, ...items];
  return items.map((item) => (item.id === record.id ? record : item));
}
