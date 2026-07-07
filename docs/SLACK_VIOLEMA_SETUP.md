# Slack Setup For Violema

Use the Violema Slack app identity. Do not reuse `hermes_agent` or the old Nexus bot identity.

## What To Create

- App name: `Violema`
- Workspace: `purpleorangehq`
- Bot display name: `Violema`
- Bot default username / mention handle: `violema`
- User-facing mention: `@Violema`
- Short description: `Reviewable AI operator for founder-led teams`

## Required Right Now

These scopes are enough for outbound delivery and channel-based automations:

- `chat:write`
- `im:write`
- `im:read`
- `im:history`
- `channels:history`

## Add These Next

These are needed for a proper Slack copilot that can respond to mentions and resolve channels more safely:

- `app_mentions:read`
- `channels:read`
- `chat:write.public`
- `users:read` if operators need to inspect or label Slack user identities from API logs

## Create The App

1. Go to `https://api.slack.com/apps`
2. Click `Create New App`
3. Choose `From scratch`
4. Name it `Violema`
5. Pick workspace `Purple Orange AI`

## Configure The Bot

1. Open `OAuth & Permissions`
2. Add the bot token scopes listed above
3. Open `App Home`
4. Turn on:
   - `Allow users to send Slash commands and messages from the messages tab`
   - `Show Tabs` if you want the app home visible
5. Open `Basic Information`
6. Set the icon and branding to Violema / Purple Orange
7. In the bot user / display information area, set:
   - Display name: `Violema`
   - Default username: `violema`

If Slack already shows a `Violema` app in the workspace, prefer that existing app. Copy the Violema app's own bot token and signing secret into production. Do not keep production wired to the old `nexus_coworker` token.

Only rename the old bot if you intentionally decide to reuse the legacy app instead of the real Violema app.

## Install The App

1. In `OAuth & Permissions`, click `Install to Workspace`
2. Copy:
   - `Bot User OAuth Token` (`xoxb-...`)
   - `Signing Secret` from `Basic Information`

Important:

- Slack signing secrets do **not** start with `whsec_`
- `whsec_` is a Stripe webhook format
- Slack signing secrets are plain secret strings from Slack app credentials

## Put These In Production

Add these env vars to the backend:

- `SLACK_BOT_TOKEN=xoxb-...` from the `Violema` Slack app, not the old `nexus_coworker` app
- `SLACK_SIGNING_SECRET=...` from the same `Violema` Slack app

Optional channel alias:

- `SLACK_CHANNEL_ALL_PURPLE_ORANGE=C07PCJAV1BJ`
- `SLACK_CHANNEL_OPS_ALERTS=C0APS37V8V8`

## Invite The Bot To A Channel

Use a real channel ID whenever possible.

For `#all-purple-orange` / `C07PCJAV1BJ`:

1. Open that channel in Slack
2. Run:
   - `/invite @Violema`

If the display name has not updated yet, invite the app by whatever Slack shows for the installed bot user.

## What Works Today

Current Violema backend supports:

- posting messages to Slack
- sending automation summaries to Slack
- validating Slack channel IDs
- replying to Slack messages
- app mentions
- DM chat loop

The Slack Events endpoint is `https://violema.com/api/slack/events`.

## Handoff Back To Codex

Once the new app exists, send me:

- the new `SLACK_BOT_TOKEN`
- the new `SLACK_SIGNING_SECRET`
- confirmation that `Violema` was invited to `C07PCJAV1BJ`

Then I can verify production inbound replies with a signed smoke event.

## Current Mismatch To Avoid

If `auth.test` reports user `nexus_coworker`, production is still using the old app token. Replace `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` with the installed `Violema` app credentials, restart `violema-backend`, then re-run the signed Slack smoke.
