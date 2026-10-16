# October 16 hero-briefing release: activated

The home hero offers a second action. "Follow the evidence ↓" stays the primary button; "Request a scientific briefing ↗"
(secondary) points at the same briefing form the closing chapter uses, so the top and the bottom of the page make one offer. On a
phone the second button wraps under the first and lands on the hero artwork, so it keeps the surface colour and the control
shadow behind its label. Content only: the vhost did not change. Max approved the screenshots and asked for the release on
2026-10-16; Astra's review was waived because Codex was out of quota. Activated on 2026-10-16 as release
`20261016-f666490-hero-briefing`, by Max from his terminal with commands prepared in the launch session.

## Source

The built tree is main `91e6403` plus the not-found fix (PR #26, head `fdea830`) plus this change (PR #27, head `f666490`).
It was built from a local merge of those two heads; `npm --prefix company-site run build` on main after both merges yields the
same 53 files, because the build is deterministic and the merge is clean. `404.html` is byte-identical to the live not-found
release (same hash as its pin), so nothing about the 404 behaviour changed.

## Pins

| What | Value |
| --- | --- |
| Release | `20261016-f666490-hero-briefing` |
| Previous release | `20261016-d673fe0-not-found` |
| Vhost SHA-256 (unchanged, checked before activation by eye against the not-found pin) | `82a2aab48954e2e6c2aea08c05704cc4218654ad206c4554a53f4018f4f2dc7e` |
| `index.html` SHA-256 | `4976adb766e84c6bc55184066cb9ff66d3ac38688acc018b2c31074d02bd90bc` |
| `404.html` SHA-256 | `839e066828baa30bf43b70ae3ece496afb3af4ffb862d76e69a30c7a29bc5846` |
| Files | 53, each hash in `SHA256SUMS` beside this file |

## How it was activated

1. `public-dist.tar.gz` (the 53 built files) and `SHA256SUMS` were copied to `/root/hero-briefing-20261016/` on the VPS.
2. A guarded shell sequence, as root: refuse unless `current` pointed at the not-found release and the new release directory did
   not exist; unpack into `/var/www/violema-science/releases/20261016-f666490-hero-briefing`; `sha256sum -c` against
   `SHA256SUMS`; directories 755 and files 644; switch `current` by writing a sibling symlink and renaming it over the old one;
   `nginx -t`; reload nginx.
3. Public checks from two machines: the home page hash equals the pinned `index.html`; the hero holds both buttons with the
   primary first; no `/login` link; `/login`, `/dashboard`, unknown paths and old asset paths answer 404 with the pinned
   `404.html` and `Cache-Control: no-cache`; `/api/health` and `/stats/script.js` answer 200; `/method/` and the legal pages
   answer 200; the hero rule is present in `/company-assets/experience.css`.

The release was activated once, rolled back by running the rollback step out of order, and activated again with a single pointer
switch; the files on disk were the same both times.

## Rollback

Point `/var/www/violema-science/current` back at `releases/20261016-d673fe0-not-found` (sibling symlink, then rename over
`current`), run `nginx -t`, then reload nginx. The vhost needs no change.

## Lessons for the next packet

- Make the tarball with `COPYFILE_DISABLE=1 tar --no-xattrs` on macOS, or GNU tar on the server prints a warning per file about
  Apple extended attributes (harmless, but noisy).
- Give the rollback step its own section, clearly apart from the numbered sequence: a reader running the blocks in order ran it too.
- Check `/company-assets/experience.css`, not `/company-assets/browser/experience.css`: the build flattens the stylesheet path.
