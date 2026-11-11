# October 18 about-psychdoc-logo release: activated

About, section 02 (Divisions & roadmap): the division card shows the PsychDoc.AI wordmark instead of the large typed
"PsychDoc." name, switching between the light and dark files with the theme, as the homepage hero does. Max merged PR #35
and asked for the deploy on 2026-10-18. Activated the same day from this session with `activate.sh` beside this file.

## Source

The built tree is main `61ab5e0` (the merge of PR #35). Main equals production after this release. Against the previous
release only two files change: `about/index.html` and `company-assets/experience.css`. The file count stays 58 and the vhost
did not change.

## Pins

| What | Value |
| --- | --- |
| Release | `20261018-61ab5e0-about-psychdoc-logo` |
| Previous release | `20261017-c94e188-about-polish` |
| `index.html` SHA-256 | `4da095c9884385cfc743258257b045e442f56c0f726adf995703c374fc6e4f75` (unchanged) |
| `about/index.html` SHA-256 | `ad77c640d8fee07da350bef047aa59f41d06e8f58e7c73a8336ac133e3273eb6` |
| `404.html` SHA-256 | `c25fb1bdc0aae2b856f98678ca2b4741b4a3bde955ec5e349723f797bb5d11e6` (unchanged) |
| `public-dist.tar.gz` SHA-256 | `921202b81821b5d2452b0db6084018668c0e9ee6ad73b00409815ac641b4cc56` |
| Files | 58, each hash in `SHA256SUMS` beside this file |

## How it was activated

`activate.sh root@<vps>` checks the tarball hash, copies it and `SHA256SUMS` to `/root/about-psychdoc-logo-20261018/`, then
in one guarded `bash -s` heredoc with `set -euo pipefail`: refuse unless the live `about/index.html` equals the previous
release (`b7f257fb…`) and the new release directory does not exist; unpack with `--no-same-owner`; `sha256sum -c`; require
58 files; directories 755 and files 644; sibling symlink renamed over `current` with `mv -T`; `nginx -t`; reload nginx.

Public checks: `/about/` hash equals the pin and `/` is unchanged; both PsychDoc wordmark SVGs and `experience.css` answer 200;
`/method/`, `/demo/`, `/review/`, both legal pages and `/api/health` answer 200; `/login`, `/dashboard` and an unknown path
answer 404.

## Rollback

Point `/var/www/violema-science/current` back at `releases/20261017-c94e188-about-polish` (sibling symlink, then rename over
`current`), run `nginx -t`, then reload nginx. The vhost needs no change.

## Notes for the next packet

- `current` is now a relative link (`releases/…`); earlier releases used absolute paths. Both resolve the same way.
- `nginx -t` warns about a duplicate `text/html` MIME type in the purpleorange.ai Umami snippet. It predates this release
  and does not affect violema.com.
