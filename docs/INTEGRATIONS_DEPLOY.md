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
echo 'COMPOSIO_API_KEY=YOUR-KEY-HERE' >> /var/www/nexus/.env
pm2 restart nexus-backend --update-env
```

### 3. Verify it loaded

`/api/integrations/*` sits behind the beta auth gate, so an anonymous `curl` gets
`401 {"code":"beta_session_required"}` — that is the gate working, not Composio
failing. Verify with a real session cookie:

```bash
curl -H "Cookie: violema_session=YOUR-SESSION-TOKEN" \
  https://violema.com/api/integrations/composio/status
# Expected: {"enabled":true,"workspaceId":"..."}
```

Easiest path: sign in at https://violema.com and read `GET /api/integrations/catalog`
from the browser devtools network tab. Its `partner` block reports `enabled`,
`connectedApps`, and `degraded` — `degraded: true` means Composio was unreachable,
which is deliberately distinct from "nothing is connected".

### 4. Connect your first integration via the UI
- Visit https://violema.com/integrations
- The "One-click integrations" section will appear
- Click any partner tool (Gmail, Google Calendar, Google Drive, GitHub, Linear,
  Notion, …) → redirects to OAuth → approve
- Returns to Violema with the integration "Connected ✓"

**Slack is not in that list.** Slack is Tier 1 — a native `SLACK_BOT_TOKEN` set
on the server, not a per-workspace OAuth connector — so it never appears as a
one-click partner app. Configure it via step 1 above.

The server builds the return URL itself, as
`https://violema.com/integrations?connected=<toolkit>`, and Composio appends
`status=success` or `status=failed` to it. Nothing carries a status before
Composio sets one.

### 5. How a connection actually gets used

**Connected tools are not auto-discovered by the model.** There is no dynamic
tool catalog handed to Claude. Partner data reaches a workflow one way only:
a `query_data` step names a source, and
`backend/src/integrationGateway/adapters/partnerComposio.ts` maps that source to
a fixed Composio action.

| Source id | Composio action(s) |
| --- | --- |
| `email` | `GMAIL_FETCH_EMAILS` |
| `calendar` | `GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS` |
| `google_drive` | `GOOGLEDRIVE_FIND_FILE` |
| `linear` | `LINEAR_SEARCH_ISSUES` |
| `github` | `GITHUB_GET_A_REPOSITORY`, `GITHUB_LIST_PULL_REQUESTS`, `GITHUB_LIST_REPOSITORY_ISSUES`, `GITHUB_LIST_COMMITS` |

All of these are **reads**. Connecting GitHub does not let a chat message file
an issue — adding a write action means adding it to that adapter, behind the
approval gate. Adding a new source means adding it to
`backend/src/integrationGateway/partnerAppMap.ts` and the adapter together.

If a source is not connected, its `query_data` step fails closed with an
`integration_not_ready` blocker pointing at `/integrations?provider=<source>`.
It never falls back to sample data.

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
- Check that the OAuth callback URL allowed in the Composio dashboard matches the one the server sends: `https://violema.com/integrations` (or the `APP_PUBLIC_ORIGIN` you configured)

---

## What to do next

1. **Set Slack token** — 5 minutes, immediate "real integration" demo
2. **Sign up for Composio + set API key** — 10 minutes, unlocks 250 tools
3. **Connect 3 hero tools** (Gmail, GitHub, Linear) via Composio — 15 minutes. Slack is already covered by step 1; it is not a Composio connector.
4. **Demo the full pipeline** — ask Violema to pull GitHub issues, summarize them, post to Slack, file a Linear task. End-to-end real.
