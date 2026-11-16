// Film media are kept out of git. data/films.mjs pins each file by name, size and SHA-256; the build copies a file
// from the media folder into dist only when it matches its pin (README, "Films").
//
// To pin a new cut:  node scripts/film-media.mjs <file.mp4> zero-babies-wide
// prints the entry for data/films.mjs, named <name>-<first 8 hex of the SHA-256>.mp4 (ffprobe adds width, height
// and duration when it is installed). Without a name, the file's own name is used.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
// The default folder is git-ignored; VIOLEMA_MEDIA_DIR points the build anywhere else.
export const mediaDir = () => process.env.VIOLEMA_MEDIA_DIR || join(root, 'media', 'films');

export const sha256File = path => new Promise((done, fail) => {
  const hash = createHash('sha256');
  createReadStream(path).on('error', fail).on('data', chunk => hash.update(chunk)).on('end', () => done(hash.digest('hex')));
});

// Missing files are reported; a file that is present but differs from its pin is an error.
export async function checkFilmMedia(film, from = mediaDir()) {
  const missing = [];
  for (const cut of film.media.cuts) {
    const path = join(from, cut.file);
    let info;
    try { info = await stat(path); } catch { missing.push(cut.file); continue; }
    if (info.size !== cut.bytes) throw new Error(`${cut.file}: ${info.size} bytes, pinned ${cut.bytes}`);
    const digest = await sha256File(path);
    if (digest !== cut.sha256) throw new Error(`${cut.file}: SHA-256 ${digest}, pinned ${cut.sha256}`);
  }
  return { from, missing };
}

export async function stageFilmMedia(film, to, from = mediaDir()) {
  await mkdir(to, { recursive: true });
  for (const cut of film.media.cuts) await copyFile(join(from, cut.file), join(to, cut.file));
}

async function printEntry(path, name = basename(path).replace(/\.mp4$/i, '')) {
  const sha256 = await sha256File(path);
  const { size } = await stat(path);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', path], { encoding: 'utf8' });
  const info = probe.status === 0 ? JSON.parse(probe.stdout) : null;
  const stream = info?.streams?.[0] ?? {};
  console.log(JSON.stringify({ file: `${name}-${sha256.slice(0, 8)}.mp4`, sha256, bytes: size, width: stream.width ?? null, height: stream.height ?? null, duration: info ? Number(info.format.duration) : null }, null, 2));
  console.log(`Copy the file into ${mediaDir()} under that name.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, name] = process.argv.slice(2);
  if (!file || (name && !/^[a-z0-9-]+$/.test(name))) { console.error('Usage: node scripts/film-media.mjs <file.mp4> [name, e.g. zero-babies-wide]'); process.exit(2); }
  await printEntry(resolve(file), name);
}
