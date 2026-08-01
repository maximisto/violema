# VIOLEMA VPS deploy

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
POSTMARK_API_KEY=your_postmark_server_api_key
POSTMARK_FROM_EMAIL=demo@yourdomain.com
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
- The deploy script now bootstraps nginx over HTTP first, then switches to the full HTTPS config after Certbot succeeds.
- The frontend is served from `frontend/dist` and `/api/*` is proxied to the Express backend on port `3001`.
- `/api/health` is a public liveness probe and returns only `{ status, service, timestamp }`. Model ids, provider routing, and integration status are operator diagnostics and now live behind `GET /api/admin/health`, which requires an admin session.
- With `NODE_ENV=production`, checkout endpoints return an honest 503 (`billing_not_configured`) instead of mock sessions when Stripe env vars are missing, and `/api/billing/stripe/mock-checkout/*` returns 404. Mock checkout exists for local development only.
- Auth cookies can now be pinned to `violema.com` with `AUTH_COOKIE_DOMAIN=violema.com`, which is the right setting once DNS fully cuts over.
- The production nginx template now supports redirecting the legacy host `nexus.purpleorange.io` to `violema.com` over HTTP with `LEGACY_DOMAIN=nexus.purpleorange.io`.
- If you also want clean HTTPS redirects from the legacy host, keep or provision a separate certificate for `nexus.purpleorange.io` before adding an SSL redirect block for that host.
