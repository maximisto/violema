# October 24 Fe4S4 headers release: staged

The two unlisted record pages get a design and phone pass:
- every section opens with a numbered chapter label, as on the homepage, and a larger, heavier heading;
- a Fable review of both pages at 390 px found 17 phone problems, 16 of which are fixed.

PR maximisto/violema#41. Max asked for it on 2026-10-24: "Push feat/fe4s4-headers, open the PR, merge PR once CI is green, and deploy it to violema.com."

## Source

The built tree is `de4a746` on `feat/fe4s4-headers`: main `0821bb3`, which builds the live release `20261024-14aaa95-fe4s4-record`, plus three commits.

Against the live release, five files change:
- `records/fe4s4-benchmark/index.html`;
- `records/fe4s4-benchmark/record/index.html`;
- `company-assets/records.css`;
- `company-assets/browser/fe4s4.mjs`;
- `company-assets/browser/fe4s4-figures.mjs`.

The other 59 files are byte-identical, and the file count stays at 64. No route is added, so the vhost does not change. `activate.sh` checks its hash read-only.

## Pins

| What | Value |
| --- | --- |
| Release | `20261024-de4a746-fe4s4-headers` |
| Previous release | `20261024-14aaa95-fe4s4-record` |
| `index.html` SHA-256 (unchanged) | `d74c6df025f781dac2a722d0f7bbf45987d0148f6d99e897ce0f0d8bf6cef558` |
| `records/fe4s4-benchmark/index.html` SHA-256 | `ae3b7f5df96e02555e8caa1f5ee6815579f9924e0bdf098840de4e47601d2ce3` |
| `records/fe4s4-benchmark/record/index.html` SHA-256 | `aadb7c0a27c0b84cc35c64975cc312391f7e5601b9d3922180166dabd1072b2a` |
| `company-assets/records.css` SHA-256 | `26c5e5277a685404d120879a5120a3d3f6f90f75b24ed9d464e34f8e4be535f2` (was `99ad8d72…`) |
| `public-dist.tar.gz` SHA-256 | `698f5066e2c6843192bc74e8f02ff77e20c5c5744bb1c0b2e80eba77eda8dae1` |
| Vhost (read-only check) | `dfadb9960b8a7c23865d00aca148635b0058d460a860688127b0b04737bca5c5` |
| Files | 64, each hash in `SHA256SUMS` beside this file |

The tarball is a build output and is not committed. To reproduce it:
1. From the source revision, run `npm --prefix company-site run build`.
2. From `dist/`, run `COPYFILE_DISABLE=1 tar --no-xattrs -czf public-dist.tar.gz` over the 64 files in `SHA256SUMS` order (`find . -type f | sort`).

## How to activate

From a directory holding `public-dist.tar.gz` and `SHA256SUMS`, run `./activate.sh root@<vps>`.

1. It checks the tarball hash and copies both files to `/root/fe4s4-headers-20261024/`.
2. In one guarded `bash -s` heredoc, it refuses unless all of these hold:
   - `current` points at `releases/20261024-14aaa95-fe4s4-record`;
   - the live `index.html` equals `d74c6df0…`;
   - the live `records.css` equals `99ad8d72…`;
   - the vhost equals `dfadb996…`;
   - the new release directory does not exist.
3. It installs the files:
   - unpack;
   - `sha256sum -c`;
   - require 64 files;
   - directories 755 and files 644.
4. It swaps the release in: a sibling symlink renamed over `current` with `mv -T`, then `nginx -t` and a reload. If the reload fails, it restores the previous `current`.
5. It runs the public checks:
   - all 64 live files match `SHA256SUMS`;
   - both record routes answer 200;
   - `/api/health` answers 200;
   - `POST /api/briefing` with `{}` answers 400;
   - an unknown path answers 404.

## Rollback

1. Point `/var/www/violema-science/current` back at `releases/20261024-14aaa95-fe4s4-record`: create a sibling symlink, then rename it over `current`.
2. Run `nginx -t`, then reload nginx.

Only the record pages change back.
