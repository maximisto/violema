# October 17 about-logos release: activated

The About page shows former clients as monochrome marks, as on purpleorange.ai (Unilever, Wrigley and Nestlé as SVGs under
`/company-assets/clients/`). Profile icons come from `company-site/lib/social.mjs` and appear in every footer. LinkedIn and a green
ORCID icon sit under the founder card, replacing the text badges, and Violema's Instagram (@violemaai) is in the footer. Max merged
PR #32 and asked for the deploy on 2026-10-17. Activated the same day by Max from his terminal with commands prepared in the session.

## Source

The built tree is main `dd128ab` (the merge of PR #32). Main equals production after this release. PR #31 (dependabot lockfiles)
is also in main but changes nothing under `company-site/`.

Against the previous release the file list grows from 55 to 58: the three client SVGs. The vhost did not change, because
`location ^~ /company-assets/` already serves the new files.

## Pins

| What | Value |
| --- | --- |
| Release | `20261017-dd128ab-about-logos` |
| Previous release | `20261016-7064747-about` |
| `index.html` SHA-256 | `4da095c9884385cfc743258257b045e442f56c0f726adf995703c374fc6e4f75` |
| `about/index.html` SHA-256 | `e741e4077898b7e3231d82951e006e7e87b9189f6b7178ced8112577270afb07` |
| `method/index.html` SHA-256 | `ce64647a1227ba8cf0350286a91f674c93dc6a8a0682cd84f2d4cc84b9b0a09a` |
| `404.html` SHA-256 | `c25fb1bdc0aae2b856f98678ca2b4741b4a3bde955ec5e349723f797bb5d11e6` |
| `public-dist.tar.gz` SHA-256 | `a88d9d5707fba18b2202bbb5930df9a7d02d3a7063df706fc8bf1ffcce228ebd` |
| Files | 58, each hash in `SHA256SUMS` beside this file |

## How it was activated

1. `public-dist.tar.gz` (made with `COPYFILE_DISABLE=1 tar --no-xattrs`) and `SHA256SUMS` were copied with `scp` to
   `/root/about-logos-20261017/` on the VPS.
2. One guarded `ssh root@… 'bash -s'` heredoc with `set -euo pipefail`: refuse unless `current` resolved to the previous release
   and the new release directory did not exist; unpack with `--no-same-owner`; `sha256sum -c`; require 58 files; directories 755
   and files 644; sibling symlink renamed over `current` with `mv -T`; `nginx -t`; reload nginx.
3. Public checks: `/` and `/about/` hashes equal the pins; the About page references three client SVGs, all three load and answer
   200; the founder-card ORCID icon computes to `rgb(166, 206, 57)` (ORCID green) while the footer icon stays ink; the footer links
   instagram.com/violemaai; `/method/`, `/demo/`, `/review/`, both legal pages and `/api/health` answer 200; `/login`, `/dashboard`
   and an unknown path answer 404.

## Rollback

Point `/var/www/violema-science/current` back at `releases/20261016-7064747-about` (sibling symlink, then rename over `current`),
run `nginx -t`, then reload nginx. The vhost needs no change.

## Lessons for the next packet

- `npm test` reads `dist/`, so run it after `npm run build`; before a build, 31 of the tests fail for that reason alone.
