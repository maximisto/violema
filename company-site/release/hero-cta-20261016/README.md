# October 16 hero-cta release: activated

The two hero buttons now share one size, set by the longer label: stacked on phones, side by side from 480px. "Request a
scientific briefing" becomes "Request a briefing" in the hero, the closing chapter and the footer, since the hero already says
"scientific" above it and one intent keeps one label. Content only: the vhost did not change. Max asked for the change, merged
PR #29 and asked for the release on 2026-10-16. Activated the same evening as release `20261016-b71f387-hero-cta`, by Max from his
terminal with commands prepared in the launch session.

## Source

The built tree is main `b71f387` (the merge of PR #29, head `4a83dcf`). Main equals production after this release, so no other
branch has to be merged in to rebuild it.

Against the previous release the file list is the same 53 files, and 8 hashes changed: `company-assets/experience.css` (the
sizing rule) and the seven HTML pages that carry the footer link. For each of those pages, putting the old label back gives the
previous release's exact hash, so the label is the only difference. `404.html` changed for that reason alone; its behaviour did not.

## Pins

| What | Value |
| --- | --- |
| Release | `20261016-b71f387-hero-cta` |
| Previous release | `20261016-f666490-hero-briefing` |
| Vhost SHA-256 (carried from the previous pin; this release does not touch the vhost, and it was not re-read on the server) | `82a2aab48954e2e6c2aea08c05704cc4218654ad206c4554a53f4018f4f2dc7e` |
| `index.html` SHA-256 | `b0388593fa9de5faa9e60e964c8bfb683fd3c6f89231c8dfc196de61e588f963` |
| `404.html` SHA-256 | `bc2c84654365530253c241f3e754b9974391483ed331328a8f9e7e3164b85e59` |
| `public-dist.tar.gz` SHA-256 | `498216d8850d6063d83845a6ba2d630a56a5a1f04808557697affc4f1b28d801` |
| Files | 53, each hash in `SHA256SUMS` beside this file |

## How it was activated

1. `public-dist.tar.gz` (made with `COPYFILE_DISABLE=1 tar --no-xattrs`) and `SHA256SUMS` were copied with `scp` to
   `/root/hero-cta-20261016/` on the VPS.
2. One guarded sequence, sent as `ssh root@… 'bash -s'` with a heredoc and `set -euo pipefail`: refuse unless `current` resolved
   to the hero-briefing release and the new release directory did not exist; unpack with `--no-same-owner` into
   `/var/www/violema-science/releases/20261016-b71f387-hero-cta`; `sha256sum -c` against `SHA256SUMS`; require 53 files;
   directories 755 and files 644; switch `current` by writing a sibling symlink in the same style as the old one and renaming it
   over `current` with `mv -T`; `nginx -t`; reload nginx. It printed `LIVE:` on the first run.
3. Public checks: the home page hash equals the pinned `index.html`; "Request a briefing" appears three times and the old label
   not at all; the sizing rule is in `/company-assets/experience.css`; `/`, `/method/`, `/demo/`, `/review/` and both legal pages
   answer 200; `/api/health` and `/stats/script.js` answer 200; `/login`, `/dashboard` and an unknown path answer 404 with the
   pinned `404.html` and `Cache-Control: no-cache`. In a real browser on the live site both hero buttons measure 218×44 at
   390px and 1280px wide.

## Rollback

Point `/var/www/violema-science/current` back at `releases/20261016-f666490-hero-briefing` (sibling symlink, then rename over
`current`), run `nginx -t`, then reload nginx. The vhost needs no change.

## Lessons for the next packet

- Running the whole activation as one `ssh 'bash -s'` heredoc from the Mac worked first time and leaves no script on the server.
- Check that production still serves the previous pin before preparing the activation; it makes the guard's first test a formality.
