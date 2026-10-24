# October 24 Fe4S4 record release: activated

Two unlisted pages join the site, in its shell and both themes:
- `/records/fe4s4-benchmark/`: the hypothesis record for one narrow quantum-advantage test on an iron-sulfur benchmark, with four instruments and the PsychDoc ledger;
- `/records/fe4s4-benchmark/record/`: the full record text.

Both pages carry `noindex,follow` and a canonical link. Neither is in `sitemap.xml` or `llms.txt`, and no navigation links to them; the link is shared directly. PR maximisto/violema#40. Max asked for the merge and deploy on 2026-10-24 ("looks good... do one brush up with design and merge and deploy"). Activated 2026-10-24 21:24 UTC with `activate.sh`; the record routes were added to the vhost at 21:27 UTC with `add-routes.sh`.

## Source

The built tree is `14aaa95` on `feat/fe4s4-record`: main `0ba3f65` plus the eight commits of PR #40. Main `0ba3f65` builds the live release.

Against the previous release, six files change:
- five are new: the two pages, `company-assets/records.css`, `company-assets/browser/fe4s4.mjs` and `company-assets/browser/fe4s4-figures.mjs`;
- `company-assets/browser/site.mjs` gains one line, which loads the instruments only where `[data-fe4s4]` is present.

The other 58 files are byte-identical. The file count grows from 59 to 64. **The vhost changes** (below): the packet was first staged as files only, which missed that the vhost serves an allowlist of exact routes.

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

Then, from a directory holding `records.nginx.conf.snippet` and `SHA256SUMS`, run `./add-routes.sh root@<vps>` for the vhost step below.

## The vhost change

`/etc/nginx/sites-available/violema.com` serves an allowlist: one exact location per route, then `location / { return 404; }`. On the first run, `activate.sh` put the files live and every guard passed. The two record pages still answered 404, with the company 404 page, because no location matched them. Every other file matched `SHA256SUMS`, so the site was never affected.

`records.nginx.conf.snippet` adds six exact locations:
- `/records/fe4s4-benchmark`, with and without the trailing slash, and its `index.html`;
- the same three for `/records/fe4s4-benchmark/record`.

Each location has the same method guard, root and headers as the About block. The block sits between `# BEGIN` and `# END VIOLEMA HYPOTHESIS RECORDS` markers, placed before `# END VIOLEMA SCIENCE COMPANY-ONLY OVERLAY`. The repo's model of the same allowlist, `deploy/scientific-site/routing.mjs`, and its two rendered templates gain the same six routes.

`add-routes.sh` refuses unless all of these hold:
- `current` points at this release;
- the vhost equals the hash recorded after the briefing-form release;
- the vhost has exactly one overlay end marker and no `/records/` location yet;
- the backup directory does not exist.

It backs the vhost up to `/var/backups/violema-science/20261024-14aaa95-fe4s4-record/violema.conf`, inserts the block, requires six record locations in the result, then runs `nginx -t` and a reload. It restores the backup if either fails. The insertion was rehearsed on a copy of the live vhost first, and it added exactly the 57-line block.

| Vhost `/etc/nginx/sites-available/violema.com` | SHA-256 |
| --- | --- |
| Before (backed up) | `df1611c4437eaea600e0ca531bd9cb390a3b47c02a35ba544fd3600bdf5bcc69` |
| After | `dfadb9960b8a7c23865d00aca148635b0058d460a860688127b0b04737bca5c5` |
| `records.nginx.conf.snippet` | `6cd48466babd624535e2f68f438a20c70fc58e34c603e0dfd75bb0549790b771` |

`nginx -t` passed, with the pre-existing duplicate `text/html` MIME warning from the purpleorange.ai Umami snippet.

## How it was activated

**`activate.sh`.** Every guard passed on the first run:
- `current` pointed at `releases/20261021-eeb14bb-briefing-form`;
- the live home page and `site.mjs` matched their pins;
- the release directory was new.

**`add-routes.sh`.** Every guard passed. Public checks after its reload:
- all 64 live files match `SHA256SUMS`;
- `/records/fe4s4-benchmark` and `/records/fe4s4-benchmark/record` answer 200, with and without the trailing slash;
- a POST to a record page answers 405;
- `/records/` alone answers 404, as does an unknown path;
- `/api/health` answers 200;
- `POST /api/briefing` with `{}` answers 400.

**In a browser.** The live page loads with no console messages and `noindex,follow`, with the visit-statistics tag present. The cluster canvas replaces the still image, the scale buttons show, all three outcome fieldsets are enabled, and the page has no horizontal overflow.

## Rollback

1. Restore `/etc/nginx/sites-available/violema.com` from `/var/backups/violema-science/20261024-14aaa95-fe4s4-record/violema.conf`.
2. Point `/var/www/violema-science/current` back at `releases/20261021-eeb14bb-briefing-form`: create a sibling symlink, then rename it over `current`.
3. Run `nginx -t`, then reload nginx.

The record routes then answer 404 again. Nothing else changes, because every other page is byte-identical.
