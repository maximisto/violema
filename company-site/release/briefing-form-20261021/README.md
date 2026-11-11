# October 21 briefing-form release: activated

The homepage gets the site's own briefing form in chapter 04, `id="briefing"`; every "Request a briefing" link (hero,
footer, About) points at it instead of the form on psychdoc.ai. The form posts JSON to `/api/briefing` on violema.com,
which nginx hands to the lead handler PsychDoc.AI already runs on the same VPS. The footer lists the company's own
profiles (LinkedIn, Instagram, X, YouTube, Reddit, Facebook, GitHub; unconfirmed rows link to `/` and say "page to
come"); the founder's LinkedIn and ORCID stay on /about/ only. Terms and Privacy describe the form. PR maximisto/violema#39.
Max asked for the packet on 2026-10-21 ("build the Violema packet") and for its activation the same evening ("Activate the
Violema packet on root@187.77.220.60"). Activated 2026-10-22 00:48 UTC from that session with `activate.sh` beside this file.

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

The live vhost's bytes were not read before preparing this packet (no server access from the preparing session), so the
packet carried no baseline vhost hash. `activate.sh` guarded the edit instead: it refuses unless the vhost has exactly one
`location ^~ /api/ {` line and no `/api/briefing` location yet, backs the file up to
`/var/backups/violema-science/20261021-eeb14bb-briefing-form/violema.conf` with its hash, inserts the block before that
line, and restores the backup if `nginx -t` or the reload fails. Hashes recorded at activation:

| Vhost `/etc/nginx/sites-available/violema.com` | SHA-256 |
| --- | --- |
| Before (backed up) | `676f96527f825d15e0f1fdf13802ec1bb2f367872a101d6ee265d4bf180f97bf` |
| After | `df1611c4437eaea600e0ca531bd9cb390a3b47c02a35ba544fd3600bdf5bcc69` |

`nginx -t` passed, with the pre-existing duplicate `text/html` MIME warning from the purpleorange.ai Umami snippet.

## How it was activated

Every guard passed on the first run: `current` pointed at the previous release, the live home page matched `9195aec8…`,
and the vhost had one legacy `/api/` block and no briefing location. Public checks after the reload: `/` equals the pin
`d74c6df0…`; all 59 live files match `SHA256SUMS` (the 404 body fetched through an unknown path); the form module answers
200; `POST /api/briefing` with `{}` answers 400 with `"Check the highlighted fields."` and the five field errors; a
`text/plain` post answers 415; `/api/health` answers 200; an unknown path answers 404. The live page loads with the submit
button enabled, the hero button at `#briefing`, the seven footer rows, and no console errors.

One labelled test request was sent through the endpoint end to end ("Activation check (Claude, 2026-10-21)",
`activation-check@violema.com`, intent briefing) and answered `{"ok":true}`: it is in the PsychDoc lead store and the
owner inbox, to be deleted. Its "Sent from" reads `/` because maximisto/psychdoc-ai#64 is merged but not yet deployed.

## How to activate (as prepared)

From a directory holding `public-dist.tar.gz`, `SHA256SUMS` and `briefing-api.nginx.conf.snippet` (the scratch copy the
preparing session left, or a fresh reproduction): `./activate.sh root@<vps>`. It checks the tarball hash, copies the three
files to `/root/briefing-form-20261021/`, then in one guarded `bash -s` heredoc with `set -euo pipefail`: refuse unless the
live `index.html` equals the previous release (`9195aec8…`) and the new release directory does not exist; unpack with
`--no-same-owner`; `sha256sum -c`; require 59 files; directories 755 and files 644; the vhost edit above; sibling symlink
renamed over `current` with `mv -T`; `nginx -t`; reload nginx. Then the public checks: `/` equals the pin, the form module
answers 200, the two `/api/briefing` posts answer 400 and 415, `/api/health` answers 200, an unknown path 404.

After activation, one request through the form confirmed the path to the PsychDoc lead store and the owner email (above).

## Rollback

Restore `/etc/nginx/sites-available/violema.com` from
`/var/backups/violema-science/20261021-eeb14bb-briefing-form/violema.conf`, point `/var/www/violema-science/current` back
at `releases/20261018-e2ae6e5-home-psychdoc-ai-logo` (sibling symlink, then rename over `current`), run `nginx -t`, then
reload nginx. With the vhost restored the form's posts answer 401 again, which the page shows as "Could not send your
request"; the previous release has no form, so nothing else is affected.
