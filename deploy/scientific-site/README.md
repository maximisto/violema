# Scientific site migration preparation

This directory is an **inert review packet**, not a deployment entry point. It does not change the existing `deploy/nginx.conf`, `deploy/deploy.sh`, backend, frontend, DNS, provider registrations, runtime data, or PM2. It needs a separate release request and the gates in [the migration handoff](../../docs/handoffs/2026-10-10-scientific-site-migration.md).

The company bundle uses `company-site/dist` and `/company-assets/`. Both HTTPS hosts use the one existing `127.0.0.1:3001` backend. The legacy frontend remains `frontend/dist`. No API is moved into a second application.

## Offline commands

```sh
node --test deploy/scientific-site/tests/*.test.mjs
node deploy/scientific-site/render.mjs
node deploy/scientific-site/render.mjs --mode cutover
git apply --check deploy/scientific-site/runtime-origin-changes.patch
```

The renderer prints to stdout and defaults to loopback preview. There is no `--apply`, `--install`, restart, environment-file reader, or network operation. To inspect a rendered file, redirect stdout to a new local temporary file. Paths must be absolute and contain only letters, digits, `/`, `_`, `-`, and `.`. For local checkouts containing spaces, use separately prepared static-only fixtures under `/private/tmp`; never symlink a repo root into a public root.

`preview.nginx.conf.template` binds `127.0.0.1:8088` (company) and `127.0.0.1:8089` (app). Its backend proxy is still port 3001: do not load it against a live sender; use a separately approved inert fixture for routing tests. Rendering does not start nginx or a backend. `cutover.nginx.conf.template` contains HTTP and TLS vhosts, with certificate paths that are prerequisites rather than verified resources. Install only after validating the **whole** active nginx configuration; map directives belong in `http` context. Neither file can be included beside the old overlapping Violema vhost.

Tests cover the offline route contract, generated configuration invariants, source-inventory drift, preserved provider/artifact paths and protection rules. **They do not parse nginx or establish live DNS/TLS/auth/provider validity.** No local nginx binary was available during preparation.

The optional drain is two inert snippets: `oauth-drain.http.nginx.conf.snippet` belongs once in `http` context; `oauth-drain.nginx.conf.snippet` belongs directly in every backend-facing `server`, before location blocks. Its URI map and server return catch Express's case-insensitive and optional-trailing-slash start routes before `^~ /api/` selection. Callbacks remain open. The independent Express-matcher test can use an existing dependency installation through `VIOLEMA_TEST_BACKEND_ROOT`; it skips explicitly if Express is unavailable. No package install or application startup is part of the check.

Selected GET/HEAD app routes redirect temporarily (302). Only a short, documented query allowlist crosses domains; unrecognized, callback, token and checkout-session queries stay on the original host. Redirects include an empty fragment to prevent browsers inheriting an old secret fragment. The original API route, body, query, Host and method reach the same backend. Old static assets, public articles and legal pages remain readable. Unknown company paths return 404 rather than the legacy SPA.
