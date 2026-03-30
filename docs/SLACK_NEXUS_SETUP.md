# Slack Setup For NEXUS

Use a fresh Slack app for NEXUS. Do not reuse `hermes_agent`.

## What To Create

- App name: `NEXUS`
- Workspace: `purpleorangehq`
- Bot display name: `NEXUS`
- Short description: `AI coworker for real work`

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

## Create The App

1. Go to `https://api.slack.com/apps`
2. Click `Create New App`
3. Choose `From scratch`
4. Name it `NEXUS`
5. Pick workspace `Purple Orange AI`

## Configure The Bot

1. Open `OAuth & Permissions`
2. Add the bot token scopes listed above
3. Open `App Home`
4. Turn on:
   - `Allow users to send Slash commands and messages from the messages tab`
   - `Show Tabs` if you want the app home visible
5. Open `Basic Information`
6. Set the icon and branding to Nexus / Purple Orange

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

- `SLACK_BOT_TOKEN=xoxb-...`
- `SLACK_SIGNING_SECRET=...`

Optional channel alias:

- `SLACK_CHANNEL_OPS_ALERTS=C0APS37V8V8`

## Invite The Bot To A Channel

Use a real channel ID whenever possible.

For `C0APS37V8V8`:

1. Open that channel in Slack
2. Run:
   - `/invite @NEXUS`

If the display name has not updated yet, invite the app by whatever Slack shows for the installed bot user.

## What Works Today

Current Nexus backend supports:

- posting messages to Slack
- sending automation summaries to Slack
- validating Slack channel IDs

It does **not** yet support:

- replying to Slack messages
- app mentions
- DM chat loop

That needs a Slack Events endpoint plus `SLACK_SIGNING_SECRET`.

## Handoff Back To Codex

Once the new app exists, send me:

- the new `SLACK_BOT_TOKEN`
- the new `SLACK_SIGNING_SECRET`
- confirmation that `NEXUS` was invited to `C0APS37V8V8`

Then I can switch production from Hermes to NEXUS and wire the inbound Slack bot flow next.
