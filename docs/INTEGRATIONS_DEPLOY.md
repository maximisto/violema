# Activating Real Integrations

Your VIOLEMA backend already has the integration plumbing. To go from mock data to real integrations, you need to set environment variables on the VPS. This guide gets you live.

---

## Tier 1 — Slack (native, already in code)

Slack messaging is already wired into the backend via `backend/src/integrations.ts`. It uses the official Slack Web API. To activate:

### 1. Create a Slack app
- Go to https://api.slack.com/apps → **Create New App** → From scratch
- Name it "Violema" (or your workspace name)
- Pick the Slack workspace you want to test with

### 2. Add OAuth scopes
Under **OAuth & Permissions → Scopes → Bot Token Scopes**, add:
- `chat:write` — send messages
- `channels:read` — list channels
- `channels:history` — read channel history (optional)
- `im:write` — send DMs (optional)
- `app_mentions:read` — receive @-mentions (for inbound)

### 3. Install + grab token
- **Install to Workspace** → approve
- Copy the **Bot User OAuth Token** (starts with `xoxb-...`)

### 4. Set on the VPS
```bash
ssh root@187.77.220.60
echo 'SLACK_BOT_TOKEN=xoxb-YOUR-TOKEN-HERE' >> /var/www/nexus/backend/.env
echo 'SLACK_BOT_TOKEN=xoxb-YOUR-TOKEN-HERE' >> /var/www/nexus/.env  # PM2 cwd fallback
pm2 restart nexus-backend --update-env
```

### 5. Test in chat
Open https://nexus.purpleorange.io/dashboard and ask:
> "Send 'hello from Violema' to #general"

Violema will pick the `send_message` tool, validate the channel ID, and post the message. Real.

### Optional: alias channels by name
If you want to ask "send to #revenue-team" instead of memorizing channel IDs, set:
```bash
SLACK_CHANNEL_ALIASES='{"revenue-team":"C0123456789","engineering":"C9876543210"}'
```

---

## Tier 2 — Composio (250+ tools via OAuth)

Composio gives you Slack/GitHub/Stripe/HubSpot/Linear/Notion/Asana/Salesforce/Gmail/Calendar/etc. without building each OAuth flow yourself.

### 1. Sign up + grab API key
- Go to https://app.composio.dev/
- Create an account, then **Settings → API Keys**
- Copy your API key

### 2. Set on the VPS
```bash
echo 'COMPOSIO_API_KEY=YOUR-KEY-HERE' >> /var/www/nexus/backend/.env
echo 'COMPOSIO_ENTITY_ID=violema-founder-os' >> /var/www/nexus/backend/.env
echo 'COMPOSIO_API_KEY=YOUR-KEY-HERE' >> /var/www/nexus/.env
echo 'COMPOSIO_ENTITY_ID=violema-founder-os' >> /var/www/nexus/.env
pm2 restart nexus-backend --update-env
```

`COMPOSIO_ENTITY_ID` is the stable OAuth identity Composio uses for connected accounts. Keep it separate from Violema's internal workspace id; otherwise the default workspace slug can leak into Composio as the OAuth user id.

### 3. Verify it loaded
```bash
curl https://nexus.purpleorange.io/api/integrations/composio/status
# Expected: {"enabled":true,"workspaceId":"...","entityId":"violema-founder-os"}
```

### 4. Connect your first integration via the UI
- Visit https://nexus.purpleorange.io/integrations
- The "One-click integrations" section will appear
- Click any tool (Slack, GitHub, Linear, etc.) → redirects to OAuth → approve
- Returns to Violema with the integration "Connected ✓"

### 5. Use it in chat
The Claude API automatically discovers connected Composio tools (e.g., `SLACK_SEND_MESSAGE`, `GITHUB_CREATE_ISSUE`, `LINEAR_CREATE_TASK`). Just ask Violema to do something with the connected tool — it'll pick the right action.

> "File a GitHub issue in maximisto/violema titled 'investigate streaming bug'"

Violema → calls `GITHUB_CREATE_ISSUE` → Composio executes → real issue gets filed.

## Google Drive workflow reads

Drive source-material workflows use Violema's native Google Drive API adapter instead of Composio. Configure a refresh token with Drive metadata/file-list scope plus Google OAuth client credentials:

```bash
echo 'GOOGLE_CLIENT_ID=YOUR-GOOGLE-OAUTH-CLIENT-ID' >> /var/www/nexus/backend/.env
echo 'GOOGLE_CLIENT_SECRET=YOUR-GOOGLE-OAUTH-CLIENT-SECRET' >> /var/www/nexus/backend/.env
echo 'GOOGLE_DRIVE_REFRESH_TOKEN=YOUR-DRIVE-REFRESH-TOKEN' >> /var/www/nexus/backend/.env
pm2 restart nexus-backend --update-env
```

`GOOGLE_DRIVE_CLIENT_ID` and `GOOGLE_DRIVE_CLIENT_SECRET` can be used instead of the shared `GOOGLE_CLIENT_*` values when Drive needs a separate OAuth client. The native adapter only requests file metadata for workflow source discovery and does not return document body text.

### Cost
- Free tier: ~200 tool calls/day
- Growth: ~$50/mo for 5K calls/day
- Scale: ~$500/mo for 50K calls/day

---

## Why both?

Slack stays **native** (Tier 1) because:
- It's your hero integration — needs flawless UX
- Slack Web API is rock-solid and free at our scale
- Already built, just needs a token

Everything else goes through **Composio** (Tier 2) because:
- 250 OAuth flows is too much engineering
- Composio handles auth, rate limits, schema mapping, errors
- We can ship 50 integrations in a day instead of 50 weeks

---

## Troubleshooting

### Slack: "Slack target X is not resolvable"
Use a real channel ID (starts with `C`, `G`, or `D`, ~9+ chars). To find it: in Slack, right-click a channel → Copy link → the ID is the last segment.

### Composio: status shows `enabled: false` after setting key
- Confirm the env var is in BOTH `.env` files (PM2 reads the cwd one)
- Confirm `pm2 restart nexus-backend --update-env` was used (without `--update-env`, PM2 keeps the old environment)
- Check `pm2 logs nexus-backend` for `[composio] enabled` or `[composio] disabled`

### Composio: connection redirect 404s
- Check that the OAuth callback URL in Composio dashboard matches `https://nexus.purpleorange.io/integrations` (or wherever you redirect users)

---

## What to do next

1. **Set Slack token** — 5 minutes, immediate "real integration" demo
2. **Sign up for Composio + set API key** — 10 minutes, unlocks 250 tools
3. **Connect 3 hero tools** (Slack via Composio, GitHub, Linear) — 15 minutes
4. **Demo the full pipeline** — ask Violema to pull GitHub issues, summarize them, post to Slack, file a Linear task. End-to-end real.
