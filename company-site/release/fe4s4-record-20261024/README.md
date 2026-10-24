# October 24 Fe4S4 record release: staged

Two unlisted pages join the site, in its shell and both themes:
- `/records/fe4s4-benchmark/`: the hypothesis record for one narrow quantum-advantage test on an iron-sulfur benchmark, with four instruments and the PsychDoc ledger;
- `/records/fe4s4-benchmark/record/`: the full record text.

Both pages carry `noindex,follow` and a canonical link. Neither is in `sitemap.xml` or `llms.txt`, and no navigation links to them; the link is shared directly. PR maximisto/violema#40. Max asked for the merge and deploy on 2026-10-24 ("looks good... do one brush up with design and merge and deploy").

## Source

The built tree is `14aaa95` on `feat/fe4s4-record`: main `0ba3f65` plus the eight commits of PR #40. Main `0ba3f65` builds the live release.

Against the previous release, six files change:
- five are new: the two pages, `company-assets/records.css`, `company-assets/browser/fe4s4.mjs` and `company-assets/browser/fe4s4-figures.mjs`;
- `company-assets/browser/site.mjs` gains one line, which loads the instruments only where `[data-fe4s4]` is present.

The other 58 files are byte-identical. The file count grows from 59 to 64, and the vhost does not change.

## Pins

| What | Value |
| --- | --- |
| Release | `20261024-14aaa95-fe4s4-record` |
| Previous release | `20261021-eeb14bb-briefing-form` |
| `index.html` SHA-256 (unchanged) | `d74c6df025f781dac2a722d0f7bbf45987d0148f6d99e897ce0f0d8bf6cef558` |
| `about/index.html` SHA-256 (unchanged) | `b27ea6cedc8e3e4df5042b9019b9ea5a7346a7cae938d8d86399f2019b77f438` |
| `404.html` SHA-256 (unchanged) | `3b0b42aa1cd626449281f139ca111c050eb203d374e12df284b0439bd68a6619` |
| `records/fe4s4-benchmark/index.html` SHA-256 | `1a63b5bd2f2cd2f0859a277a006927fc54fa6843bad64868b0f9777db51ac2c8` |
| `records/fe4s4-benchmark/record/index.html` SHA-256 | `995ad4292a099d48935911ee101270de625f0d1d28f0234a2a1a061fe5b17b0c` |
| `company-assets/browser/site.mjs` SHA-256 | `92f5937023ad8e7aa3ba7989adb5ff2f4e31a776a6248145a25891c6f1add544` (was `6ba2326a…`) |
| `public-dist.tar.gz` SHA-256 | `e949d335514942a7a37741be85d5631f346fda465894d51e813ad027ada07b5c` |
| Files | 64, each hash in `SHA256SUMS` beside this file |
| Live baseline checked 2026-10-24 | `/` `d74c6df0…` and `/about/` `b27ea6ce…` (both equal this build); `/records/fe4s4-benchmark/` answers 404 |

The tarball is a build output and is not committed. To reproduce it:
1. From the source revision, run `npm --prefix company-site run build`.
2. From `dist/`, run `COPYFILE_DISABLE=1 tar --no-xattrs -czf public-dist.tar.gz` over the 64 files in `SHA256SUMS` order (`find . -type f | sort`).

Pages are served with `cache-control: no-cache` and an ETag, so a returning visitor revalidates `site.mjs` and gets the new line.

## How to activate

From a directory holding `public-dist.tar.gz` and `SHA256SUMS`, run `./activate.sh root@<vps>`.

1. It checks the tarball hash and copies both files to `/root/fe4s4-record-20261024/`.
2. In one guarded `bash -s` heredoc with `set -euo pipefail`, it refuses unless all of these hold:
   - `current` points at `releases/20261021-eeb14bb-briefing-form`;
   - the live `index.html` equals `d74c6df0…`;
   - the live `site.mjs` equals `6ba2326a…`;
   - the new release directory does not exist.

   The home page alone cannot tell the two releases apart, which is why the symlink and `site.mjs` are pinned too.
3. It installs the files:
   - unpack with `--no-same-owner`;
   - `sha256sum -c`;
   - require 64 files;
   - directories 755 and files 644.
4. It swaps the release in: a sibling symlink renamed over `current` with `mv -T`, then `nginx -t` and a reload. If the reload fails, it restores the previous `current`.
5. It runs the public checks:
   - every one of the 64 files, fetched from violema.com, matches `SHA256SUMS`; the 404 body is fetched through an unknown path;
   - both record routes answer 200;
   - `/api/health` answers 200;
   - an unknown path answers 404.

## Rollback

1. Point `/var/www/violema-science/current` back at `releases/20261021-eeb14bb-briefing-form`: create a sibling symlink, then rename it over `current`.
2. Run `nginx -t`, then reload nginx.

The record routes then answer 404 again. Nothing else changes, because every other page is byte-identical.
