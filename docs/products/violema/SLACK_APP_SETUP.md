# Violema's own Slack app — setup runbook

**Why this exists (2026-08-03).** Tenant Slack deliveries ride Composio's shared
Slack app, so every DM and channel post displays as **"Composio"** — including
the Slack notification emails customers receive. Our code already sends
`username: "Violema"` + icon overrides, but Composio's app token lacks
`chat:write.customize` (verified against the live connection's granted scopes),
so Slack silently ignores them. The scope set belongs to their app; no flag on
our side can fix it.

The fix is a Slack app **we** own, plugged into Composio as a custom auth
config — the exact pattern that fixed Google Drive scopes
(`COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE`). Messages then display as **Violema** at
the app level, and this same app is the foundation for tenant review cards,
approve buttons, and operator verbs (Phase B).

---

## 1. Create the app (~5 min, needs a Violema-Slack admin login)

1. Go to <https://api.slack.com/apps> → **Create New App** → **From an app manifest**.
2. Pick the workspace to develop it in (your **Violema Slack** tenant workspace is fine — distribution to other workspaces comes later).
3. Paste this manifest (YAML):

```yaml
display_information:
  name: Violema
  description: The outcome-first AI operator for recurring founder and team workflows.
  background_color: "#1a1033"
features:
  bot_user:
    display_name: Violema
    always_online: true
oauth_config:
  redirect_urls:
    - https://backend.composio.dev/api/v1/auth-apps/add
  scopes:
    bot:
      - channels:read
      - channels:history
      - chat:write
      - chat:write.customize
      - im:write
      - reactions:read
      - reactions:write
      - team:read
      - users:read
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

   Scope notes: this mirrors the working Composio set, plus
   `chat:write.customize` (identity control even when posting under an
   override) and `im:write` (open DMs deliberately instead of relying on
   implicit behaviour).

4. **Basic Information → Display Information**: upload the square avatar —
   `frontend/public/brand/violema-slack-avatar.png` (512×512, made for this).
   This icon + the app name are what DMs and notification emails will show.

## 2. Register it in Composio (~3 min)

1. Composio dashboard → **Auth Configs** → create a new auth config for the
   **`slackbot`** toolkit → choose **custom OAuth credentials**.
2. Paste the Slack app's **Client ID** and **Client Secret** (Basic
   Information page).
3. Composio displays the exact **Redirect URL** it expects on this screen —
   verify it matches the one in the manifest; if it differs, add Composio's
   URL under the Slack app's **OAuth & Permissions → Redirect URLs** and save.
4. Copy the new auth config id (`ac_…`) **from the create screen itself** —
   the dashboard playground snippets embed dead keys (learned 2026-08-01).

## 3. Pin it on the VPS (~1 min)

Add to `/var/www/nexus/backend/.env`:

```
COMPOSIO_AUTH_CONFIG_SLACKBOT=ac_your_new_config_id
```

(The bridge's precedence is env override → managed → first → create, so this
pin wins for every new connection. Existing connections keep their old config
until reconnected.)

## 4. Reconnect the tenant's Slack (~1 min per workspace)

In the tenant dashboard → **Integrations** tab → Slack → **Disconnect**, then
**Connect** again. The OAuth consent screen should now say **Violema** (not
Composio) — that's the proof the custom config took.

## 5. Verify

Trigger any Slack-delivering mission (or the next scheduled one). The message
and any Slack notification email must show **Violema** with the avatar. If it
still says Composio, the connection was not re-opened against the new auth
config — check step 3's env var landed and the reconnect actually happened.

---

**Relation to Phase B:** review cards, approve buttons, and operator verbs in
tenant workspaces need event subscriptions + interactivity on a bot we control.
This app is that bot — those features add `app_mention`/`message` events and an
interactivity URL to this same manifest later, no second app needed.
