import fs from 'fs';

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile<T>(filePath: string, value: T) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function upsertJsonRecord<T extends { id: string }>(items: T[], record: T): T[] {
  const index = items.findIndex((item) => item.id === record.id);
  if (index === -1) return [record, ...items];
  return items.map((item) => (item.id === record.id ? record : item));
}
