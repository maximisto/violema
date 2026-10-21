# October 21 briefing-form release: staged

The homepage gets the site's own briefing form in chapter 04, `id="briefing"`; every "Request a briefing" link (hero,
footer, About) points at it instead of the form on psychdoc.ai. The form posts JSON to `/api/briefing` on violema.com,
which nginx hands to the lead handler PsychDoc.AI already runs on the same VPS. The footer lists the company's own
profiles (LinkedIn, Instagram, X, YouTube, Reddit, Facebook, GitHub; unconfirmed rows link to `/` and say "page to
come"); the founder's LinkedIn and ORCID stay on /about/ only. Terms and Privacy describe the form. PR maximisto/violema#39.
Max asked for the packet on 2026-10-21 ("build the Violema packet"). Not activated.

## Source

The built tree is `eeb14bb` on `feat/violema-briefing-form`, which is main `e2ae6e5` (the live release) plus the one
commit of PR #39. Against the previous release eleven files change: every HTML page (the briefing links, the footer row and
the two policies), `company-assets/browser/site.mjs`, `company-assets/experience.css`, and the new
`company-assets/browser/briefing.mjs`. The file count grows from 58 to 59. **The vhost changes** (below).

## Pins

| What | Value |
| --- | --- |
| Release | `20261021-eeb14bb-briefing-form` |
| Previous release | `20261018-e2ae6e5-home-psychdoc-ai-logo` |
| `index.html` SHA-256 | `d74c6df025f781dac2a722d0f7bbf45987d0148f6d99e897ce0f0d8bf6cef558` |
| `about/index.html` SHA-256 | `b27ea6cedc8e3e4df5042b9019b9ea5a7346a7cae938d8d86399f2019b77f438` |
| `404.html` SHA-256 | `3b0b42aa1cd626449281f139ca111c050eb203d374e12df284b0439bd68a6619` |
| `company-assets/browser/briefing.mjs` SHA-256 | `ba38ba7f188feffaee5f40e4756bfc9ad2ffb6364fa60f4dfed62ed764a18c76` |
| `public-dist.tar.gz` SHA-256 | `9e58d707ed6c0bcd67a283afee4d91e35d6a8a69f063509f601b1586adf50168` |
| Files | 59, each hash in `SHA256SUMS` beside this file |
| Live baseline checked 2026-10-21 | `/` `9195aec8…`, `/about/` `b6e7e381…`, 404 `53fe81fb…` (all equal the previous release's pins) |

The tarball is a build output and is not committed. Reproduce it from the source revision with
`npm --prefix company-site run build`, then from `dist/`: `COPYFILE_DISABLE=1 tar --no-xattrs -czf public-dist.tar.gz`
over the 59 files in `SHA256SUMS` order (`find . -type f | sort`).

## The vhost change

`briefing-api.nginx.conf.snippet` (a copy of `deploy/scientific-site/briefing-api.nginx.conf.snippet`) adds one
exact-match location inside the company TLS server block:

```nginx
location = /api/briefing { proxy_pass http://127.0.0.1:3102/api/briefing; ... }
```

An exact match wins over the `location ^~ /api/` prefix that still proxies everything else under `/api/` to the legacy
backend on 3001, so the OAuth callback and the Stripe and Postmark webhooks are unchanged. The Host header stays
`violema.com`, which is how the handler labels the lead's site (maximisto/psychdoc-ai#64, merged, deploys with the next
PsychDoc release; until then the lead is stored and emailed without the label).

Before activation `POST /api/briefing` on violema.com answers 401 from the legacy backend ("Approved Violema beta session
required"); after it, `{}` answers 400 with `"Check the highlighted fields."` and a `text/plain` post answers 415.

The live vhost's bytes were not read before preparing this packet (no server access from the preparing session), so there
is no baseline vhost hash here. `activate.sh` guards the edit instead: it refuses unless the vhost has exactly one
`location ^~ /api/ {` line and no `/api/briefing` location yet, backs the file up to
`/var/backups/violema-science/20261021-eeb14bb-briefing-form/violema.conf` with its hash, inserts the block before that
line, and restores the backup if `nginx -t` or the reload fails. It prints the new vhost hash at the end: record it in
this file on activation.

## How to activate

From a directory holding `public-dist.tar.gz`, `SHA256SUMS` and `briefing-api.nginx.conf.snippet` (the scratch copy the
preparing session left, or a fresh reproduction): `./activate.sh root@<vps>`. It checks the tarball hash, copies the three
files to `/root/briefing-form-20261021/`, then in one guarded `bash -s` heredoc with `set -euo pipefail`: refuse unless the
live `index.html` equals the previous release (`9195aec8…`) and the new release directory does not exist; unpack with
`--no-same-owner`; `sha256sum -c`; require 59 files; directories 755 and files 644; the vhost edit above; sibling symlink
renamed over `current` with `mv -T`; `nginx -t`; reload nginx. Then the public checks: `/` equals the pin, the form module
answers 200, the two `/api/briefing` posts answer 400 and 415, `/api/health` answers 200, an unknown path 404.

After activation, send one real request through the form and confirm it arrives in the PsychDoc lead store and the owner
email (its "Sent from" reads `/` until #64 is deployed, then `violema.com/`).

## Rollback

Restore `/etc/nginx/sites-available/violema.com` from
`/var/backups/violema-science/20261021-eeb14bb-briefing-form/violema.conf`, point `/var/www/violema-science/current` back
at `releases/20261018-e2ae6e5-home-psychdoc-ai-logo` (sibling symlink, then rename over `current`), run `nginx -t`, then
reload nginx. With the vhost restored the form's posts answer 401 again, which the page shows as "Could not send your
request"; the previous release has no form, so nothing else is affected.
