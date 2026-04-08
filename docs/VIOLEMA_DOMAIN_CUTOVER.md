# VIOLEMA Domain Cutover

## Current state

As of 2026-04-08:

- `nexus.purpleorange.io` is the real live app host.
- `violema.com` is still being served by Hostinger parking / CDN.
- DNS for `violema.com` still uses:
  - `pixel.dns-parking.com.`
  - `byte.dns-parking.com.`
- `http://violema.com` returns `Server: hcdn`
- `http://violema.com/.well-known/acme-challenge/test` returns `500`
- `https://violema.com` does not cleanly terminate to the VPS yet

That means app code is ready, but the domain is not.

## What is already ready in code

- auth cookies support `AUTH_COOKIE_DOMAIN=violema.com`
- auth public origin supports `AUTH_PUBLIC_URL=https://violema.com`
- Stripe success/cancel URLs support `violema.com`
- nginx/deploy config supports:
  - `violema.com`
  - `www.violema.com`
  - redirect from `nexus.purpleorange.io`

## What must be changed outside the repo

Do this in Hostinger/domain management:

1. Stop parking / CDN handling for `violema.com`
- disable any parked domain page
- disable any Hostinger edge/site product intercepting traffic

2. Point both records at the VPS
- `violema.com` → VPS public IP
- `www.violema.com` → VPS public IP

3. Ensure HTTP reaches the VPS directly
- `http://violema.com` must no longer return `Server: hcdn`
- `http://violema.com/.well-known/acme-challenge/test` must reach nginx, not Hostinger parking

## VPS-side cutover

Once DNS is fixed:

1. SSH to the VPS
2. Run:

```bash
cd /var/www/nexus/deploy
sudo DOMAIN=violema.com LEGACY_DOMAIN=nexus.purpleorange.io APP_DIR=/var/www/nexus PM2_APP_NAME=violema-backend bash deploy.sh
```

3. Set backend env values:

```env
PUBLIC_APP_URL=https://violema.com
APP_BASE_URL=https://violema.com
AUTH_PUBLIC_URL=https://violema.com
AUTH_COOKIE_DOMAIN=violema.com
STRIPE_SUCCESS_URL=https://violema.com/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://violema.com/plans?checkout=cancel
OPENROUTER_SITE_URL=https://violema.com
```

4. Restart backend:

```bash
cd /var/www/nexus
pm2 restart violema-backend --update-env
```

## Verification

Use the helper:

```bash
cd /var/www/nexus
bash deploy/check-domain-cutover.sh violema.com
```

Healthy cutover should look like:

- `dig +short violema.com A` → VPS IP
- `dig +short www.violema.com A` → VPS IP
- `curl -I http://violema.com` → redirect to `https://violema.com/...`
- `curl -I https://violema.com` → `server: nginx`
- `curl -s https://violema.com/api/health` → valid JSON health response

## Final cleanup after cutover

Once `violema.com` is truly live:

1. Update Google OAuth redirect URIs
- `https://violema.com/api/auth/google/callback`

2. Update Microsoft OAuth redirect URIs
- `https://violema.com/api/auth/microsoft/callback`

3. Keep `nexus.purpleorange.io` as a redirect only

4. Re-test:
- signup
- login
- Google OAuth
- Microsoft OAuth
- Slack onboarding
- Stripe checkout return
- dashboard session persistence
