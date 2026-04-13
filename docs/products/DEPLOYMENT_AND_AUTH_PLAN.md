# Deployment And Auth Plan

## Recommendation

Start with:

- two frontends
- one shared backend
- one shared auth system

This is the fastest clean split.

Do not start with two fully separate backend stacks unless you want avoidable ops drag.

## Deployment model

### Violema

- deploy the main web app to `violema.com`
- keep product navigation and app shell outcome-focused

### Agent Studio

- deploy the Studio shell to `nexus.purpleorange.io`
- connect it to the same backend contract at first

### Backend

Keep one backend initially if it can cleanly expose:

- Violema app endpoints
- `/api/studio/*` endpoints
- shared auth/session validation

## Auth handoff

## Best short-term version

Use one identity system and a signed handoff between products.

Flow:

1. user authenticates in Violema
2. user clicks `Open Agent Studio`
3. Violema requests a short-lived signed Studio access token
4. browser redirects to `nexus.purpleorange.io` with bootstrap token
5. Agent Studio exchanges token for a valid session

## Why

This avoids:

- fragile shared-cookie assumptions
- weird cross-domain session breakage
- duplicated login state logic

## Minimum viable fallback

If you need a simpler first pass:

- use one backend session store
- set cookie scope intentionally
- test Safari carefully

But do not assume this will be durable.

## Route ownership

### Violema-owned

- marketing
- auth entry
- dashboard
- workflows
- runs
- billing
- integrations

### Agent Studio-owned

- topology
- replay
- experiments
- plans
- promotions
- rollbacks
- policy governance

## API ownership

### Shared backend first

- Violema app endpoints stay where they are
- Studio consumes only `/api/studio/*` and auth/session endpoints

### Later

If Agent Studio becomes fully independent:

- move `/api/studio/*` behind the Agent Studio service
- keep Violema as one upstream integration

## Environment variables to separate

At minimum, define separately:

- `APP_BASE_URL`
- `STUDIO_BASE_URL`
- `API_BASE_URL`
- `AUTH_BASE_URL`
- `COOKIE_DOMAIN`
- `SESSION_SIGNING_SECRET`

Optional but useful:

- `VIOLEMA_PUBLIC_APP_NAME`
- `STUDIO_PUBLIC_APP_NAME`

## Rollback rule

If cross-product auth is unreliable:

- keep Studio accessible from a trusted Violema session only
- temporarily route users through a signed launch endpoint
- do not launch broken SSO

## Launch bar

Do not call the split ready until this is true:

- Violema login works on `violema.com`
- Agent Studio launches cleanly from Violema
- returning from Studio preserves workspace context
- logout clears both surfaces correctly
