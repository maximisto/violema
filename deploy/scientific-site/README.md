# Scientific site migration preparation

This directory is an **inert review packet**, not a deployment entry point. It does not change the existing `deploy/nginx.conf`, `deploy/deploy.sh`, backend, frontend, DNS, provider registrations, runtime data, or PM2. It needs a separate release request and the gates in [the migration handoff](../../docs/handoffs/2026-10-10-scientific-site-migration.md).

The company bundle uses `company-site/dist` and `/company-assets/`. Both HTTPS hosts use the one existing `127.0.0.1:3001` backend. The legacy frontend remains `frontend/dist`, served only on agent.purpleorange.ai. No API is moved into a second application.

## Live routing on violema.com

Since release `20261016-d673fe0-not-found` (activated 2026-10-16, see [its packet](../../company-site/release/not-found-20261016/README.md)), violema.com serves only the company site:

- Company pages (`/`, `/index.html`, `/method`, `/demo`, `/review`, `/about`, `/legal/terms`, `/legal/privacy`, the unlisted `/records/fe4s4-benchmark` and `/records/fe4s4-benchmark/record`, each with and without a trailing slash or `index.html`), `robots.txt`, `sitemap.xml`, `llms.txt` and `/company-assets/` are GET/HEAD only.
- `/api/` is the only path that reaches the backend: OAuth callbacks, the Stripe and Postmark webhooks and every other API call, with route, body, query, Host and method unchanged.
- Everything else returns 404 with the company `404.html`: old workspace pages (`/login`, `/dashboard`, `/plans`, `/settings`, `/terms`, `/privacy`, `/faq` and the rest), old assets (`/assets/`, `/brand/`, `/fonts/`, `/seo/`, the blog and root icons), and unknown or scanner paths. Nothing redirects to agent.purpleorange.ai.

`routing.mjs` and the rendered templates model that contract. The live vhost also carries `/stats/` for visit statistics (see `company-site/README.md`); this packet does not model it. The live change was made as a marked overlay on the existing vhost, not by installing `cutover.nginx.conf.template`. The [migration handoff](../../docs/handoffs/2026-10-10-scientific-site-migration.md) predates it and still describes the earlier 302 plan.

## Offline commands

```sh
node --test deploy/scientific-site/tests/*.test.mjs
node deploy/scientific-site/render.mjs
node deploy/scientific-site/render.mjs --mode cutover
git apply --check deploy/scientific-site/runtime-origin-changes.patch
```

The renderer prints to stdout and defaults to loopback preview. There is no `--apply`, `--install`, restart, environment-file reader, or network operation. To inspect a rendered file, redirect stdout to a new local temporary file. Paths must be absolute and contain only letters, digits, `/`, `_`, `-`, and `.`. For local checkouts containing spaces, use separately prepared static-only fixtures under `/private/tmp`; never symlink a repo root into a public root.

`preview.nginx.conf.template` binds `127.0.0.1:8088` (company) and `127.0.0.1:8089` (app). Its backend proxy is still port 3001: do not load it against a live sender; use a separately approved inert fixture for routing tests. Rendering does not start nginx or a backend. `cutover.nginx.conf.template` contains HTTP and TLS vhosts, with certificate paths that are prerequisites rather than verified resources. Install only after validating the **whole** active nginx configuration; the protected-path map belongs in `http` context. Neither file can be included beside the old overlapping Violema vhost.

Tests cover the offline route contract, generated configuration invariants, source-inventory drift, preserved provider/artifact paths and protection rules. **They do not parse nginx or establish live DNS/TLS/auth/provider validity.** No local nginx binary was available during preparation.

The optional drain is two inert snippets: `oauth-drain.http.nginx.conf.snippet` belongs once in `http` context; `oauth-drain.nginx.conf.snippet` belongs directly in every backend-facing `server`, before location blocks. Its URI map and server return catch Express's case-insensitive and optional-trailing-slash start routes before `^~ /api/` selection. Callbacks remain open. The independent Express-matcher test can use an existing dependency installation through `VIOLEMA_TEST_BACKEND_ROOT`; it skips explicitly if Express is unavailable. No package install or application startup is part of the check.

Earlier drafts of this packet redirected selected app routes to agent.purpleorange.ai with a 302 and kept old static assets readable. That plan was dropped: no query or fragment crosses domains, because nothing on violema.com redirects. Old workspace users reach the app at agent.purpleorange.ai directly.
