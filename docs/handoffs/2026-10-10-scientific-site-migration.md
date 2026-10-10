# Scientific company site and founder-app origin migration

Status: **local preparation only; not release-ready and not deployed**. Prepared against `91bd175c64a189c065db9843874387157812deee`. Production was not contacted, nginx was not installed/reloaded, no backend was started, and no env file or runtime ledger was read. The local architecture graph is absent in this worktree; the routing inventory below comes from source. The parent implementation owns the company build, integration review and vault writeback.

The intended result is `violema.com` serving scientific home/method/demo HTML, with the existing founder app at `agent.purpleorange.ai`. Both app origins must reach the **same** backend, data directories, integrations, workspaces, and one scheduler. This packet changes no company ownership, contract, pricing, provider identity or customer record.

## Source-grounded inventory

| Source | Observed behavior | Required release treatment |
| --- | --- | --- |
| `deploy/nginx.conf` | Root is `frontend/dist`, SPA fallback; `/api/` proxies port 3001 | Replace only the inventoried Violema vhost after full-config review; keep other vhosts untouched |
| `deploy/deploy.sh` | Resets source, builds backend and frontend, writes nginx, deletes/restarts PM2 | **Do not use for the company-only release**; it can ship unrelated backend work |
| `deploy/ecosystem.config.cjs` | `violema-backend`, one instance, cwd `/var/www/nexus/backend` | Keep the process identity/cwd and `instances: 1`; never launch another copy for the new domain |
| `backend/src/server.ts` | Hardcoded `ALLOWED_ORIGINS` omits the new host | Review/test the included narrow patch before cutover; no wildcard or credential-sharing CORS |
| `server.ts` auth helpers and routes | `AUTH_PUBLIC_URL` controls start and recomputed token-exchange callback; signed OAuth state lives 15 minutes | Register both exact new callbacks, drain old attempts before changing origin, restart login for expired attempts |
| `server.ts` cookies | `violema_session`, HttpOnly, SameSite=Lax, Secure in production, optional Domain | Leave `AUTH_COOKIE_DOMAIN` unset; expect fresh login on the new host, with no copying or forwarding of cookie/token values |
| `server.ts` artifact mounts | `/api/brief-charts` and `/api/generated-screenshots` | Retain old URLs and files through the same upstream, including existing Slack-fetched images |
| `backend/src/publicOrigin.ts` | `APP_PUBLIC_ORIGIN` controls Composio browser return `/integrations?connected=…` | Set new app origin; inventory pending connection returns before release |
| `backend/src/platform/stripe.ts` | Explicit success/cancel overrides take priority; otherwise `PUBLIC_APP_URL`/`APP_BASE_URL`; defaults computed at import | Update explicit overrides and restart the same process only in the authorized app-origin release |
| `frontend/src/lib/auth.ts` | Relative `/api/*` browser calls | Preserve same-origin nginx API proxy; no browser cross-origin backend URL required |
| `frontend/src/App.tsx`, `frontend/public` | App routes, existing static articles, icons/fonts/brand images | Selective browser redirects; retain old static/legal content and asset namespace |

## Exact origin environment checklist

These are target values for a future reviewed change, not a captured or complete env file. Apply through the existing protected operator mechanism; never print, copy into Git, or replace the whole live env file.

| Variable | Target / treatment |
| --- | --- |
| `AUTH_PUBLIC_URL` | `https://agent.purpleorange.ai` |
| `APP_PUBLIC_ORIGIN` | `https://agent.purpleorange.ai` |
| `PUBLIC_APP_URL` | `https://agent.purpleorange.ai` (artifact and Stripe base; takes precedence over `APP_BASE_URL`) |
| `APP_BASE_URL` | If retained, make it `https://agent.purpleorange.ai` too, to prevent conflicting fallbacks |
| `STRIPE_SUCCESS_URL` | If configured, `https://agent.purpleorange.ai/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`; keep Stripe's literal placeholder |
| `STRIPE_CANCEL_URL` | If configured, `https://agent.purpleorange.ai/pricing?checkout=cancel` |
| `AUTH_COOKIE_DOMAIN` | **Unset**, so cookies are host-only; do not set `.purpleorange.ai` or reuse `violema.com` |
| `NODE_ENV`, `PORT`, `PM2_APP_NAME`, `APP_BACKEND_CWD` | Preserve production, 3001, existing process name and existing backend cwd; verify effective values without dumping secrets |
| Auth signing, encryption, OAuth client, Stripe/Postmark/Slack credentials; data/storage paths; scheduler switches | Preserve existing values and state; no secret rotation, new store, broad env rewrite, or second worker is part of this migration |

`OPENROUTER_SITE_URL` is attribution, not browser routing; keep unless a separate attribution change is intended. Email sender domains and mailboxes are not app URLs. No global replacement of `violema.com` is warranted.

## Narrow source changes still required

`deploy/scientific-site/runtime-origin-changes.patch` is inert and has **not** been applied. It adds only `https://agent.purpleorange.ai` to the credentialed CORS allowlist and updates the operational review/login/referral links in `backend/src/reviewNotificationEmail.ts`, `backend/src/betaApplicationEmail.ts`, and `frontend/src/lib/credits.ts`. These old URLs remain readable under the compatibility vhost, but future mail/referral links should lead directly to the app. Before applying, recheck the exact source revision, run `git apply --check`, then the backend typecheck/tests/platform suite and frontend lint/build/focused link tests in a clean candidate. Patch syntax validity does not establish runtime correctness.

Additional reviewed follow-ups: the Slack footer in `backend/src/slackBlocks.ts` still names `violema.com`; decide company attribution versus app navigation before editing. `backend/src/integrationGateway/slackDelivery.ts` uses the old `/brand/violema-slack-avatar.png`, which remains served. `frontend/src/lib/pricingAccess.ts` uses `https://violema.com` as a fixed URL-validation base but returns only local paths, so it is not an emitted cross-domain link and need not be mechanically changed. Legacy app branding, its home/navigation, privacy/service-domain wording, SEO canonicals, and the Portal presentation still need their own approved editorial/source review before launch; this packet preserves the existing frontend bundle.

## Route contract and compatibility

| Request | Company host after cutover | New app host |
| --- | --- | --- |
| `/`, `/method[/]`, `/demo[/]`, metadata and `/company-assets/` | Company static bundle; missing file returns 404 | Existing app bundle |
| `/api` and `/api/*`, all methods | Proxy unchanged to `127.0.0.1:3001` | Same proxy |
| GET/HEAD login, signup, access-terms, plans, pricing, settings[/billing], connect/slack, integrations, admin, dashboard[/agents], runs/safe-id | Temporary 302 to the fixed new app origin **only** when raw path/query matches the allowlist | Existing app SPA |
| Other methods on browser/static routes | 405; no cross-domain POST redirect | 405; API methods are unaffected |
| `/faq`, `/privacy`, `/terms` | Existing frontend SPA on original host | Existing app SPA |
| `/assets/`, `/brand/`, `/fonts/`, `/seo/`, `/blog/`, `/ai-agents-for-founders/`, known public icons/verification file | Existing `frontend/dist` files; no broad repo-root access | Existing app bundle |
| Unknown paths | 404, no app fallback | Existing app fallback |
| Dotfiles, source directories, `.env`, `.bak`, `.map`, `.rtf`, operating instructions | 404 before prefix locations | 404 before prefix locations |

The query allowlist preserves `section=topups`, `plan=pro|team`, `checkout=success|cancel` on billing pages, `panel=schedules`/checkout status on dashboard, and a single local `next` value of `/dashboard`, `/plans`, or `/pricing` on auth/connect pages (raw or percent-encoded slash). Anything else stays in the legacy app without an nginx cross-domain redirect, including OAuth codes/state, magic tokens, Stripe checkout session IDs, Composio returns, repeated query fields, nested return URLs and old mission-editor queries. Fresh login is necessary on the new host. A redirect ends with `#` to clear inherited browser fragments; the server never sees the original fragment.

Do not infer that preserving an endpoint proves an in-flight OAuth/Composio flow survives an origin change. Old auth API endpoints remain proxied, but callback exchange and host-only cookies impose the drain/restart rules below. Old historical links remain supported until retention is explicitly reviewed. Temporary redirects simplify rollback and must not become 301/308 until the migration has passed its retention gates.

`www.violema.com` serves the same compatibility policy without a blanket cross-host redirect. HTTP API requests are also proxied rather than redirected; TLS remains the intended provider endpoint. HTTP browser requests only upgrade to HTTPS on the **same** host. `nexus.purpleorange.io` and any other historical aliases are outside these templates: inventory their actual vhosts, certificates and provider use, retain them untouched, and explicitly cover them in the drain if they still reach auth. Do not remove their routes based on this packet.

## Provider prerequisites and retention

| Surface | Required preparation before changing effective origins | Keep until |
| --- | --- | --- |
| Google sign-in | Add `https://agent.purpleorange.ai/api/auth/google/callback`; inspect required authorized JavaScript origins | Old 15-minute state window drained, new login/logout verified, rollback window explicitly closed |
| Microsoft sign-in | Add `https://agent.purpleorange.ai/api/auth/microsoft/callback` to the existing app registration | Same condition; retain old URI registration during rollback window |
| Composio | Inspect existing app/connection redirect requirements; verify new `/integrations` return; no enabling dormant integrations | Pending old flows resolved/restarted and an authorized test completes |
| Slack events/interactions | Initially retain `https://violema.com/api/slack/events` and `/api/slack/interactions`; preserve signing verification and event dedupe | Provider-console change separately authorized and verified, retries/rollback period elapsed |
| Postmark | Initially retain `https://violema.com/api/email/postmark/webhook`, including existing authentication mechanism | Delivery/complaint receipts verified for any separately authorized new URL and old retries elapsed |
| Stripe | Initially retain `https://violema.com/api/billing/stripe/webhook`, same signing secret and durable event ledger | Signature/idempotency and existing checkout completion verified after separately authorized provider change |
| Existing generated files/run/review URLs | Keep old API artifact paths, old static brand assets and browser compatibility | Explicit owner-approved retention decision based on monitored use, never just a successful launch |

No endpoint was queried, provider console inspected, or payload sent during preparation. Do not register duplicate active webhook deliveries casually: duplicate ingress plus process-local caches can still create side effects. Inspect each provider's actual registrations, retries and deduplication before changing it. Routing tests are not signature or webhook-idempotency tests.

## Controlled release checklist — future separate authorization

1. **Approve a concrete release candidate.** Record exact source/build hashes, independent review, distinct company and app scopes, rollback owner and window. Resolve runtime patch/branding/privacy gaps above. Confirm active production revision and dirty state from read-only inspection; do not reset it or assume this historical baseline is still deployed.
2. **Inventory without exposing secrets.** Capture nginx vhost names/paths, cert coverage/expiry, DNS ownership/current answers, backend process count/identity/cwd, scheduler ownership and pending runs, storage paths and mounted artifact directories. Back up configuration and runtime state using existing protected procedures; record paths/checksums only. Confirm snapshot consistency and restore procedure. Do not copy user records into this repository or the company build.
3. **Prepare isolated static releases.** Build `company-site/dist` from reviewed source; stage only that public output into a versioned company release directory with readable files and traversable directories. Preserve `frontend/dist` including historical hashed assets. Render with `--company-root` pointing at the selected static release/current link and `--legacy-root` at the preserved frontend build. Do not run `deploy/deploy.sh`. A later company-only update changes only its static release link/files and necessary nginx reload, never the backend process/env.
4. **DNS/TLS and new-host validation.** Only after explicit infrastructure authorization, provision `agent.purpleorange.ai` on the same nginx host and a certificate for that exact hostname. Confirm the company cert also covers `www.violema.com`. Keep old certificates. Verify complete config (`nginx -t` with actual includes/certs/permissions) before reload, and use an isolated inert upstream for routing probes before any live backend smoke. The local templates were not nginx-parsed.
5. **Provider registrations first.** Complete the above Google/Microsoft/Composio prerequisites while retaining existing registrations. Keep webhook endpoints on the old host initially. Resolve incoming magic-link and checkout return expectations; no token migration or test payment/send is implicitly authorized.
6. **Drain OAuth before the app-origin flip.** Temporarily stop new Google/Microsoft starts on **every** host serving this backend using both separately reviewed drain snippets. Include `oauth-drain.http.nginx.conf.snippet` **once directly in nginx's `http` context**. Include `oauth-drain.nginx.conf.snippet` **directly inside every backend-facing `server` context, before its locations**, covering old/new hosts, HTTP/HTTPS and historical aliases. Do not include either file in a location block. The case-insensitive `$uri` map recognizes start paths with optional trailing slash and without query arguments; the server-level return runs before location selection, including `^~ /api/`. Exact locations alone miss Express-accepted variants; a regex location after `^~ /api/` does not fix that bypass. Matching starts return 503 + Retry-After 900; callbacks and other provider requests remain proxied. Validate the complete actual nginx configuration and probe the accepted start variants against an inert upstream before enabling the gate. Keep old configured origin and old browser routing through this interval. Record the stop time and wait at least 15 full minutes from the last allowed start. If a start route/alternate host cannot be blocked or measured, require a clear restart-login path and treat active attempts as invalidated; do not pretend the drain occurred. Also resolve/restart pending provider connection flows. Do not use backend downtime as a silent drain.
7. **Flip one process and routing.** With no active send/run and a reviewed recovery procedure for schedules, apply only the tested runtime patch and exact non-secret origin env changes, then restart the existing PM2 process with its effective env updated. Keep cwd/data/secrets intact. Confirm one PID/process owner, not a cluster/duplicate scheduler. Validate complete candidate nginx, then replace the inventoried overlapping vhost and reload. Remove temporary server guards only after the new origin/callback settings are active; remove their shared HTTP map after all guards are removed (or remove both together in one fully validated config). Avoid new-old origin overlap with different backend copies.
8. **Verify explicit acceptance.** Check company HTML/metadata/hash parity, method/demo route refreshes and static roots; old/new `/api/health`; anonymous protected API remains 401/403; known old artifact/brand URLs; redirect allowlist and no-redirect API behavior; HTTPS/security headers/CORS including rejection of unapproved origins; fresh login/logout on both providers; approved workspace access and cross-workspace denial; provider connection return; old run/review links. Inspect cookie attributes without recording values. Verify exactly one scheduler and preserved records. Use `dryRun: true` for any workflow check; real sends/payments/provider events require their own explicit authorization. Review callbacks, webhook signature/dedupe outcomes and error logs with query/token redaction.
9. **Monitor and retire deliberately.** Track redirect/legacy URL use, auth errors, provider retry/error rates, missing assets and scheduler ownership. Assign each old endpoint an owner and retirement decision after its actual retry/retention horizon; none is retired by this packet. Do not set a fictional universal provider retention date.

The controlled cutover needs an operator-reviewed installation sequence against the actual host. This packet deliberately contains no script that writes `/etc/nginx`, env files, DNS, providers, PM2 or runtime stores. Successful static tests alone do not authorize or validate installation.

## Rollback checklist

1. Trigger rollback on failed login/workspace isolation, missing artifacts, API/webhook failures, wrong scheduler count, data discrepancy or routing ambiguity. Stop release progression. Do not replay paid/send operations as a test.
2. Keep callback/webhook endpoints and both certificates reachable. Gate new auth starts on every active host again; drain 15 minutes where possible, or explicitly invalidate/restart affected login flows. Do not roll the configured callback origin backward under an unacknowledged live OAuth attempt.
3. Restore the recorded old origin settings and reviewed old backend candidate to the **same** process/cwd, using the validated process restart procedure; confirm one scheduler. Restore the saved nginx vhost and company static release pointer; run full `nginx -t` before reloading. Do not delete the new host during immediate rollback if active callbacks/links still need it.
4. Revert only provider registrations/settings actually changed, preserving any URI required by in-flight flows and the rollback window. DNS rollback follows the recorded old values/TTL and does not replace server-side compatibility. Keep old webhook URLs active throughout.
5. Verify the original login/workspace/API/artifact behavior and schedule ownership with read-only/dry-run checks. A routing rollback normally restores **no runtime data**: the same backend may have accepted legitimate new records. Never restore a pre-cutover database/ledger snapshot over live records just to roll back a hostname. Reconcile any genuine data recovery separately.
6. Record exact restored hashes/settings names, observed outcome, remaining new-host sessions/links and next decision. Keep protected backups and temporary 302 routing until the rollback window closes.

## Validation and remaining gates

Offline Node tests validate redirect classification, method boundaries, token/query exclusion, API/webhook/generated-path preservation, one fixed upstream, source-path guards, preview loopback binds, deterministic templates and current source assumptions. Drain checks inspect the actual map/server guard and cover slash/case/query/encoded-provider variants plus callback exclusions. A separate dependency-backed test compares 216 variants against the installed Express route matcher without importing the app or starting a server; when backend dependencies are absent, this test explicitly skips unless `VIOLEMA_TEST_BACKEND_ROOT` points to an existing installation. `git apply --check` validates the inert runtime patch against this worktree. No backend application code was changed or executed. Nginx parsing, certificate/DNS checks, live origin state, provider registration evidence, authentication flows, signatures/dedupe, scheduler ownership and a production rollback rehearsal remain **unverified**. Those are release gates, not hidden claims of readiness.
