# October 26 privacy policy, section 3 People we contact: staged

The Website Privacy Policy gains section 3, **People we contact**, for the researchers Violema writes to about their published work: what we use and where it comes from, why and on what basis, who handles it, how long we keep it (12 months without a reply; while a related record is published plus 3 years), and an explicit right to object. Sections renumber to 1 to 8, and the effective date becomes 26 October 2026.

Outreach emails going out on Tuesday 27 October link to `/legal/privacy#people-we-contact`, so this release must be live first.

PR maximisto/violema#45 (draft). Max asked for it on 2026-10-26: "Approved as drafted, including 12-month and 3-year retention. Commit, open a draft PR, and deploy the privacy section to violema.com before Tuesday." Reviewed by Astra and a simulated EU data-protection lawyer; the log is in psychdoc-ai-starter `.superpowers/sdd/2026-10-25-violema-platform-plan/followups-2026-10-26/privacy/review-log.md`.

## The previous release

`20261025-61a8178-fe4s4-reference`, read from the VPS on 2026-10-26: `current` points at it, 64 files, and its tree matches a build of main `61a8178` byte for byte.

## Source

The built tree is `7c98a3e` on `docs/privacy-people-we-contact`: main `61a8178` plus one content commit. Against the live release, one file changes: `legal/privacy/index.html`. The other 63 files are byte-identical, the file count stays at 64, and no route is added. The vhost does not change; `activate.sh` checks its hash read-only.

## Pins

| What | Value |
| --- | --- |
| Release | `20261026-7c98a3e-privacy-contacts` |
| Previous release | `20261025-61a8178-fe4s4-reference` |
| `index.html` SHA-256 (unchanged) | `c65d9a53b5f95d40576a230b46a44a55fadad131eac43f2dbe6ed91f3fc8b8ac` |
| `legal/privacy/index.html` SHA-256 | `4fe20334c7966487ed7073e17596b4510c0a52a1201144f7567f6ae3bc5ce142` (was `e2f462c4…`) |
| `public-dist.tar.gz` SHA-256 | `54971c7d4d1672448747fa47062a830c338a33599d9c669db599e084092c4d87` |
| Vhost (read-only check) | `dfadb9960b8a7c23865d00aca148635b0058d460a860688127b0b04737bca5c5` |
| Files | 64, each hash in `SHA256SUMS` beside this file |

To reproduce the tarball:
1. From the source revision, run `npm --prefix company-site run build`.
2. From `dist/`, run `COPYFILE_DISABLE=1 tar --no-xattrs -czf public-dist.tar.gz` over the 64 files in `SHA256SUMS` order.

## How to activate

From a directory holding `public-dist.tar.gz` and `SHA256SUMS`, run `./activate.sh root@<vps>`.

The script refuses unless all of these hold:
- `current` points at `releases/20261025-61a8178-fe4s4-reference`;
- the live `index.html` equals `c65d9a53…`;
- the live `legal/privacy/index.html` equals `e2f462c4…`;
- the vhost equals `dfadb996…`;
- the new release directory does not exist.

It then unpacks the files, checks them against `SHA256SUMS`, requires 64 files and sets permissions. It moves `current` over with a sibling symlink and `mv -T`, then runs `nginx -t` and a reload; if the reload fails, it restores the previous `current`. Finally it fetches every file over the public site, checks the section 3 anchor, and runs the usual route checks.

## Rollback

1. Point `/var/www/violema-science/current` back at `releases/20261025-61a8178-fe4s4-reference`: create a sibling symlink, then rename it over `current`.
2. Run `nginx -t`, then reload nginx.

## After activation

Merge PR #45 before the next release. A release built from main without it would drop section 3.
