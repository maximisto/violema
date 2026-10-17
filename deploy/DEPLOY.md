# VIOLEMA VPS deploy

## Since the company-site cutover (2026-10-16)

`violema.com` is the static company site. Its vhost, `/etc/nginx/sites-available/violema.com`, carries the `BEGIN VIOLEMA SCIENCE COMPANY-ONLY OVERLAY` block, serves `/var/www/violema-science/current`, and proxies only `/api/` to the backend on `127.0.0.1:3001`. Release packets in `company-site/release/` change it by exact hash. The legacy app (`frontend/dist`) is served on agent.purpleorange.ai, through a vhost this script does not manage.

`deploy.sh` without `--backend-only` refuses to run while that vhost is in place. It stops before apt, git or any build, and changes nothing. Its legacy nginx templates would otherwise replace the company site with the old app. There is no override. The cutover is undone with its own rollback packet, never with this script.

### Backend-only redeploy

Use this to ship backend code or dependency fixes (for example a Dependabot lockfile bump). It runs: git sync of `/var/www/nexus` to `origin/$BRANCH` (default `main`), backend `npm ci` and Playwright Chromium (no apt), `npm run build`, `pm2 restart violema-backend --update-env`, `pm2 save`, then polls `http://127.0.0.1:3001/api/health` (15 tries, 2 seconds apart) and fails if it never answers. It never touches system packages, the frontend, nginx, certificates or the company site.

**Do not run the copy at `/var/www/nexus/deploy/deploy.sh` for the first backend-only deploy.** That checkout predates `--backend-only`. The old script ignores unknown flags, so it would run a full deploy and overwrite the company vhost. Run a fresh copy, and only once it is confirmed to know the flag:

```bash
DEPLOY_SRC="$(mktemp -d)"
git clone --depth 1 --branch main https://github.com/maximisto/violema.git "$DEPLOY_SRC"
grep -q -- '--backend-only' "$DEPLOY_SRC/deploy/deploy.sh" && sudo bash "$DEPLOY_SRC/deploy/deploy.sh" --backend-only --skip-deps
```

Clone the same branch the script deploys (`BRANCH`, default `main`). After that first run, `/var/www/nexus` itself has the new script.

Before and after, confirm nothing outside the backend moved:

```bash
sudo sha256sum /etc/nginx/sites-available/violema.com   # must be identical before and after
pm2 status
curl -fsS http://127.0.0.1:3001/api/health
curl -sI https://violema.com | head -1
```

Notes:
- The backend restarts in place by name. If `violema-backend` is not in the current user's PM2 list, the script fails instead of starting a second backend. Run it with the same `sudo` as before.
- A backend restart resumes the scheduler and any live sends it owns. Check `pm2 logs violema-backend` after the health check passes.
- The frontend on agent.purpleorange.ai is not rebuilt. That is fine for dependency-only or backward-compatible API changes. A change the old frontend cannot handle needs its own frontend release.
- Rollback: revert the commit on `main`, then run the backend-only deploy again.

### `--skip-deps` and lockfile changes

`--skip-deps` skips apt and skips `npm ci` only when `node_modules` holds a stamp (`node_modules/.violema-deploy-lock.sha256`) matching the current `package-lock.json`. A changed lockfile always installs, so lockfile-only security fixes are never skipped. The stamp is written only after every install step succeeds. Installs made before this change have no stamp, so the first `--skip-deps` run after it reinstalls once.

## Fresh box provisioning (full deploy)

The full deploy below (apt, Node, nginx bootstrap, Certbot, frontend build, PM2) applies only to a box where `violema.com` does not yet carry the company vhost. On the current VPS it refuses, by design.

1. Point `violema.com` and `www.violema.com` at the VPS public IP.
2. SSH into the VPS as `root` or a sudo user.
3. Run:

```bash
git clone https://github.com/maximisto/violema.git /tmp/violema
cd /tmp/violema/deploy
sudo bash deploy.sh
```

Optional overrides:

```bash
sudo DOMAIN=violema.com APP_DIR=/var/www/nexus PM2_APP_NAME=violema-backend bash deploy.sh
```

Legacy redirect:

```bash
sudo DOMAIN=violema.com LEGACY_DOMAIN=nexus.purpleorange.io APP_DIR=/var/www/nexus PM2_APP_NAME=violema-backend bash deploy.sh
```

4. Before rerunning if the backend stops on startup, create:

```bash
sudo mkdir -p /var/www/nexus/backend
sudo tee /var/www/nexus/backend/.env >/dev/null <<'EOF'
ANTHROPIC_API_KEY=your_real_key
TAVILY_API_KEY=your_tavily_key
# Also powers the email sign-in link (see the magic-link note below). Without
# both of these, POST /api/auth/magic-link/request still answers 200 — it must
# never reveal anything — but no mail is sent and the browser-agnostic sign-in
# is effectively dead. Check pm2 logs for `[magic-link] no link sent`.
POSTMARK_API_KEY=your_postmark_server_api_key
POSTMARK_FROM_EMAIL=demo@yourdomain.com
# Enables POST /api/email/postmark/webhook (bounce/complaint suppression — the
# behaviour promised to Postmark at account approval). Generate a long random
# value, then configure the webhook in Postmark (server → Settings → Webhooks)
# as https://violema.com/api/email/postmark/webhook?token=<this value> with the
# Bounce and Spam Complaint events checked. Unset = the route answers 404 and
# no suppression is recorded. Suppressed addresses land in
# backend/email-suppressions.json (gitignored runtime data); removing a line
# from that file is the deliberate way to re-enable a repaired mailbox.
POSTMARK_WEBHOOK_SECRET=replace_with_a_long_random_webhook_secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
PUBLIC_APP_URL=https://violema.com
APP_BASE_URL=https://violema.com
AUTH_PUBLIC_URL=https://violema.com
AUTH_COOKIE_DOMAIN=violema.com
AUTH_STATE_SECRET=replace_with_a_random_auth_state_secret
OPENROUTER_SITE_URL=https://violema.com
OPENROUTER_APP_NAME=VIOLEMA
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
# Enables the one-click partner connectors (Gmail, Google Calendar, Google Drive,
# GitHub, Linear, Notion, HubSpot). Unset = connect returns 503 and partner-reading
# workflows stay blocked; nothing falls back to fake data.
COMPOSIO_API_KEY=your_composio_api_key
# Optional, one per toolkit: pin which auth config new connections are opened
# against. A Composio account can hold several auth configs for the same toolkit,
# and a stale or read-only one silently cripples every connection made through it
# — the UI still says "connected", but the workflow has no permission to read what
# it needs. Connections normally pick the Composio-managed config automatically;
# set this only to force a specific one. A set-but-unknown id fails the connect
# outright rather than falling back: a silently-wrong auth config is the bug this
# variable exists to prevent, not one it should reintroduce.
# COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE=ac_your_auth_config_id
# Where Composio returns the user after OAuth. Server-derived on purpose — never
# taken from a request header. Defaults to https://violema.com when NODE_ENV=production.
APP_PUBLIC_ORIGIN=https://violema.com
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_TENANT_ID=common
PORT=3001
NODE_ENV=production
# Optional: comma-separated workspace ids allowed to receive LABELED simulated
# sample data (demo query fixtures, simulated run_code/create_task). Every
# workspace not listed here fails closed: unconnected sources block or error
# instead of fabricating numbers. Leave unset so nothing is a demo workspace;
# set deliberately before a sales/investor demo that needs sample-data beats.
# DEMO_WORKSPACE_IDS=demo-workspace-id
EOF
```

5. Check status:

```bash
pm2 status
pm2 logs violema-backend
sudo systemctl status nginx
curl -I https://violema.com
curl https://violema.com/api/health
```

Notes:
- On a fresh box, the full deploy bootstraps nginx over HTTP first, then switches to the full HTTPS config after Certbot succeeds. Both steps refuse if the target vhost is the company site.
- On the current VPS, `violema.com` serves the company site and proxies only `/api/*` to the Express backend on port `3001`. `frontend/dist` is served on agent.purpleorange.ai.
- `/api/health` is a public liveness probe and returns only `{ status, service, timestamp }`. Model ids, provider routing, and integration status are operator diagnostics and now live behind `GET /api/admin/health`, which requires an admin session.
- With `NODE_ENV=production`, checkout endpoints return an honest 503 (`billing_not_configured`) instead of mock sessions when Stripe env vars are missing, and `/api/billing/stripe/mock-checkout/*` returns 404. Mock checkout exists for local development only.
- Auth cookies can now be pinned to `violema.com` with `AUTH_COOKIE_DOMAIN=violema.com`, which is the right setting once DNS fully cuts over.
- **Email sign-in link (browser-agnostic re-authentication).** Two public routes, both required for people whose browser never returns from the Google account chooser — a real Safari behaviour when several Google accounts are signed in:
  - `POST /api/auth/magic-link/request` — body `{ email, next? }`. **Always** `200 {ok:true, message}` with one generic message, for every address, existing or not. Behind the strict per-IP limiter, plus a 60s per-address cooldown and a 5-per-15-minutes per-address window.
  - `GET /api/auth/magic-link/consume?token=…` — single-use, 10-minute token. On success sets the same session cookie as the OAuth callback and redirects to an allowlisted internal path. Every failure redirects to `/login` with one identical message.
  - **Depends on `POSTMARK_API_KEY` and `POSTMARK_FROM_EMAIL`.** They are the same variables the delivery steps use; no separate mail config. Missing them does not error the endpoint — it silently sends nothing, so verify with a real request after deploying.
  - Links are issued **only** to an address that already has an auth user, an access record with `identityVerifiedAt` set by a Google/Microsoft OAuth login, and `status: approved`. It is re-authentication only: it never verifies identity, never records terms acceptance, and never creates an account. A user with stale terms is signed in and then routed to `/access-terms`, exactly as after an OAuth login.
  - Adds runtime state at `backend/auth-magic-link-tokens.json` (gitignored). Tokens are stored as sha256 hashes — the plaintext exists only in the email. Deleting the file invalidates outstanding links and nothing else.
  - Both `auth.magic_link.requested` and `auth.magic_link.signed_in` land in the admin audit log, so sessions created without an OAuth round-trip stay answerable.
- The production nginx template now supports redirecting the legacy host `nexus.purpleorange.io` to `violema.com` over HTTP with `LEGACY_DOMAIN=nexus.purpleorange.io`.
- If you also want clean HTTPS redirects from the legacy host, keep or provision a separate certificate for `nexus.purpleorange.io` before adding an SSL redirect block for that host.
