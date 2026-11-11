# October 18 home-psychdoc-ai-logo release: activated

Home, section 03 (Applications): the first-application card shows the PsychDoc.AI wordmark instead of the large typed
"PsychDoc." name, switching between the light and dark files with the theme, as About section 02 does. The product is
named PsychDoc.AI in page copy: the nav link on every page, the hero trace caption, the evidence map text, and the
section 03 button and label. Pinned provenance records keep their recorded wording. Max merged PR #37 and asked for the
deploy on 2026-10-18. Activated the same day from this session with `activate.sh` beside this file.

## Source

The built tree is main `e2ae6e5` (the merge of PR #37). Main equals production after this release. Against the previous
release ten files change: every HTML page (the nav link) and `company-assets/browser/evidence-map-render.mjs`. The file
count stays 58 and the vhost did not change.

## Pins

| What | Value |
| --- | --- |
| Release | `20261018-e2ae6e5-home-psychdoc-ai-logo` |
| Previous release | `20261018-61ab5e0-about-psychdoc-logo` |
| `index.html` SHA-256 | `9195aec8e48871f0afd67fc5c31d8c52792018b13a3c92c871fc67619e6f2ffd` |
| `about/index.html` SHA-256 | `b6e7e381cc86362098736b8eb16683515f2fc785a461ef26a7ba007a97eae7d8` |
| `404.html` SHA-256 | `53fe81fb5059e4baeec99c875c615813b5d669091e6820949f1f94ce4351c8aa` |
| `public-dist.tar.gz` SHA-256 | `f9e1cd7e2893487c6a409fa03a843026c3f6f1143be0db6482a634fa21cb9d33` |
| Files | 58, each hash in `SHA256SUMS` beside this file |

## How it was activated

`activate.sh root@<vps>` checks the tarball hash, copies it and `SHA256SUMS` to `/root/home-psychdoc-ai-logo-20261018/`,
then in one guarded `bash -s` heredoc with `set -euo pipefail`: refuse unless the live `index.html` equals the previous
release (`4da095c9…`) and the new release directory does not exist; unpack with `--no-same-owner`; `sha256sum -c`; require
58 files; directories 755 and files 644; sibling symlink renamed over `current` with `mv -T`; `nginx -t`; reload nginx.

Public checks: all 58 live files match `SHA256SUMS` (the 404 body checked through an unknown path, since nginx answers it
with status 404); `/api/health` answers 200; `/login`, `/dashboard` and an unknown path answer 404.

## Rollback

Point `/var/www/violema-science/current` back at `releases/20261018-61ab5e0-about-psychdoc-logo` (sibling symlink, then
rename over `current`), run `nginx -t`, then reload nginx. The vhost needs no change.

## Notes for the next packet

- When checking pins with curl, drop `-f` for `404.html`, or fetch an unknown path: the body is served with status 404.
