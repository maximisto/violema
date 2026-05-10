# Handoff — VIOLEMA AI Assistant Platform

**Branch:** `claude/build-ai-assistant-platform-BsdRr`  
**Repo:** `maximisto/test-repo`  
**Date:** 2026-05-10  
**Build status:** Clean (tsc + vite build both pass as of last commit)

---

## What Was Done This Session

### Commits (newest first)

| SHA | Summary |
|-----|---------|
| `177b577` | Compact sidebar footer — replace two large cards with 44px row |
| `d30c8d8` | Beta QA pass — homepage CTAs, dead links, scheduling correctness |
| `c1898e0` | P3 Slack surface improvements + P4 automation runtime visibility |
| `f98bac6` | P5 cost and margin visibility per run |
| `b24a6b5` | Scheduling UX — timezone picker, condition evaluation, Agent Studio cleanup |

---

## Current Product State

### Authentication
- Email/password auth is fully working.
- Google OAuth and Microsoft OAuth routes are **implemented in `backend/src/server.ts`** (lines ~3692–3900) but **require env vars on the VPS to activate**:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
  - `AUTH_STATE_SECRET` (HMAC signing key for OAuth state parameter — refuse to run without this in production; the guard is already in place)
- OAuth callback URL is built dynamically from `AUTH_PUBLIC_URL` env var. Example: `https://violema.com/auth/callback/google`
- Session cookies use `AUTH_COOKIE_DOMAIN` env var for cross-subdomain sharing.

### Slack Integration
- Full bot implementation in `backend/src/server.ts`.
- Requires `SLACK_BOT_TOKEN` on VPS.
- Slack formatting rules applied: no `#` headers, `*bold*` sparingly, max 3 paragraphs / 6 bullets, truncates at paragraph boundaries.
- Delivery notifications: structured format with per-step status emoji (✅/❌/—).
- Event guard: only checks `channel` presence (not `threadTs`) so DMs work.

### Automations / Scheduling
- `backend/src/scheduler.ts`: `evaluateCondition()` supports:
  - `"only if last run failed"` / `"only if last run succeeded"`
  - `"if consecutive failures > N"`
  - Fail-**closed** — unrecognised patterns now **skip the run** with an actionable error (was silently passing).
  - `consecutive_failures` counter is tracked per automation (reset on success, incremented on failure).
- Timezone picker: 15 common zones; detected device timezone labelled `(your device)`.
- **hasUnconfiguredDelivery guard**: Save and "Save & run" are disabled when a Deliver step exists but no notification target is configured. Amber warning shown in editor.
- "Save & run" button in automation editor: saves then immediately triggers `POST /api/automations/:id/run` using a `pendingRunAfterSave` ref to avoid duplicating save logic.
- Per-step execution results shown in "Latest result" panel (status, duration, credits, output snippet).

### Cost / Margin Visibility (P5)
- `backend/src/platform/cost.ts`:
  - `PROVIDER_COST_USD_PER_1M_TOKENS` table: `micro/$0.10`, `default/$6`, `hard/$15`, `critical/$30`, `ops/$0.20`
  - `CREDIT_VALUE_USD = 0.0395` (Pro plan: $79 / 2000 credits)
  - `estimateProviderCostUsd(modelTier, totalTokens): number`
- `/api/billing/recent-usage` aggregates `stepCharges` from `TaskRunRecord.metadata` and returns: `totalTokens`, `inputTokens`, `outputTokens`, `providerCostUsd`, `creditValueUsd`, `marginPct`
- `frontend/src/components/CreditSurface.tsx`: usage rows show token count (K/M formatted), provider cost in USD, margin % with TrendingUp icon. Falls back to credits-only when token data absent.
- `frontend/src/lib/credits.ts`: `RecentCreditUsage` interface extended with optional enriched fields.

### Homepage / Landing
- "See it in action" (Hero) and "See how it works" (Landing) both scroll to `#how-it-works`.
- Footer: 3 real link groups only (Product, Company, Legal) — 9 dead placeholder links removed.
- Footer: placeholder social icons and inert "Book a demo" button removed.

### Sidebar (Dashboard)
- Two large bottom cards (~190px combined: Slack connection card + account card) replaced with **single 44px compact footer row**:
  - Initials avatar
  - Name + plan label (truncated)
  - Slack status dot (green = connected, grey = not; click → `/connect/slack?next=%2Fdashboard`; tooltip shows channel name)
  - Settings icon → `/settings`
  - Home/logout icon → `/`
- Full Slack setup and account detail remain in Settings page.

---

## Remaining Work

### 1. Google OAuth — activate + test
The route exists. Steps:
1. Create a Google Cloud OAuth 2.0 client at console.cloud.google.com.
2. Authorised redirect URI: `https://violema.com/auth/callback/google` (and `http://localhost:3000/auth/callback/google` for local dev).
3. Set on VPS: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_STATE_SECRET`.
4. Test the full flow: Login → "Continue with Google" → Google consent → redirect back → session cookie set → dashboard loads.
5. Verify `authSession.email` is populated from the Google ID token `email` claim.

### 2. Microsoft OAuth — activate + test
Same pattern as Google:
1. Register an app in Azure AD (Entra ID) → App registrations.
2. Redirect URI: `https://violema.com/auth/callback/microsoft`.
3. Set on VPS: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`.
4. For multi-tenant support `tenantId` defaults to `'common'` — change if you want single-tenant.
5. Test the full flow (same as Google).

### 3. P2 — Domain Cutover (violema.com)
Do this **after** OAuth is wired, because OAuth redirect URIs must match the production domain.

Checklist:
- [ ] Point DNS `violema.com` A/CNAME to VPS IP
- [ ] Provision TLS cert (Let's Encrypt / Certbot or Caddy auto-TLS)
- [ ] Set on VPS:
  - `AUTH_PUBLIC_URL=https://violema.com`
  - `AUTH_COOKIE_DOMAIN=violema.com`
- [ ] Update Stripe webhook endpoint URL in Stripe dashboard
- [ ] Update Stripe `success_url` / `cancel_url` in server.ts if hardcoded
- [ ] Update Google OAuth authorised redirect URIs
- [ ] Update Microsoft OAuth redirect URIs in Azure
- [ ] Update `COMPOSIO_REDIRECT_URL` if used
- [ ] Smoke-test: login, chat, automation run, Slack bot, Stripe checkout

---

## VPS Environment Variables — Full Checklist

```
# Required for auth
AUTH_STATE_SECRET=<random 32+ char hex>
AUTH_PUBLIC_URL=https://violema.com
AUTH_COOKIE_DOMAIN=violema.com

# Database
DATABASE_URL=<postgres connection string>

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_ID=...

# Google OAuth
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# Microsoft OAuth
MICROSOFT_CLIENT_ID=<UUID>
MICROSOFT_CLIENT_SECRET=<value>

# Composio (250+ integrations bridge)
COMPOSIO_API_KEY=...
```

---

## Key Files

| File | Role |
|------|------|
| `backend/src/server.ts` | Main Express server — all API routes, OAuth flows, Slack bot, billing |
| `backend/src/scheduler.ts` | Cron scheduler, condition evaluation, run tracking |
| `backend/src/platform/cost.ts` | Credit estimation, provider cost table, margin calculation |
| `backend/src/auth.ts` | Auth helpers (cookie helpers, `AuthMethod` type) |
| `backend/src/composioBridge.ts` | Composio 250+ integrations proxy |
| `frontend/src/pages/Dashboard.tsx` | Main app shell — chat, automation editor, task panel, sidebar |
| `frontend/src/pages/Landing.tsx` | Public landing page |
| `frontend/src/components/Hero.tsx` | Hero section on landing |
| `frontend/src/components/Footer.tsx` | Site footer |
| `frontend/src/components/CreditSurface.tsx` | Billing/credit usage panel |
| `frontend/src/lib/credits.ts` | `RecentCreditUsage` interface + API helpers |
| `frontend/src/components/AuthProviderButton.tsx` | Google + Microsoft OAuth button UI |
| `frontend/src/pages/Login.tsx` | Login page (email + Google + Microsoft) |
| `frontend/src/pages/SettingsPage.tsx` | Settings (Slack, account, plan — linked from compact sidebar footer) |

---

## Known Quirks / Watch Out For

1. **TypeScript TS1127 "Invalid character" bug**: The Edit tool can silently introduce UTF-8 curly/smart quotes (`\xe2\x80\x9c`/`\x9d` for `"`, `\xe2\x80\x98`/`\x99` for `'`) and emoji bytes into TypeScript source files, causing `tsc` to fail with `error TS1127: Invalid character`. If `tsc` starts failing with TS1127, run:
   ```python
   python3 -c "
   import pathlib
   p = pathlib.Path('backend/src/server.ts')
   c = p.read_bytes()
   c = c.replace(b'\xe2\x80\x9c', b'\"').replace(b'\xe2\x80\x9d', b'\"')
   c = c.replace(b'\xe2\x80\x98', b\"'\").replace(b'\xe2\x80\x99', b\"'\")
   p.write_bytes(c)
   print('done')
   "
   ```

2. **`evaluateCondition` is fail-closed**: Unrecognised condition strings now skip the run (not silently pass). If a user's existing automation stops running, check the condition field.

3. **`buildOAuthCallbackUrl`**: This reads `AUTH_PUBLIC_URL` at request time. If the env var is missing, it falls back to reconstructing from `req.protocol + req.hostname` — which may be wrong behind a proxy. Set `AUTH_PUBLIC_URL` explicitly.

4. **Slack `event.ts` vs `event.thread_ts`**: The bot uses `event.ts` as the fallback thread anchor for DM replies. The channel guard (`if (!channel) return`) deliberately does NOT gate on `threadTs` — don't add that back.

5. **`hasUnconfiguredDelivery` memo**: Triggers when a step with `kind === 'deliver'` exists AND `step.notify` is empty AND `step.destinationType === 'none'`. This disables Save / Save & run with an amber warning. If users report they can't save, check the deliver step config.

6. **Composio bridge** (`COMPOSIO_API_KEY`): 250+ tool integrations route through `backend/src/composioBridge.ts`. Without the API key, tool calls to external services silently fail with a 500. Set the key on VPS before enabling integrations for users.
