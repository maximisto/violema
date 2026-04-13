# Domain And DNS Instructions

## Domain ownership

### Violema

- primary: `violema.com`
- canonical app: `app.violema.com` is optional, but not required if you want the app on root
- recommended redirect:
  - `www.violema.com` -> `violema.com`

### Agent Studio

- primary: `nexus.purpleorange.io`
- keep this as the advanced product surface for now

## Recommended public structure

### `violema.com`

- marketing site
- login
- app shell
- workflows
- runs
- integrations
- billing

### `nexus.purpleorange.io`

- Agent Studio shell
- replay
- experiments
- policy control
- optimization history

## DNS records

The exact record values depend on your hosting provider, but the structure should be:

### For `violema.com`

- `A` or `ALIAS` for root domain to the main frontend host
- `CNAME` for `www` pointing to the same host or redirect target

### For `nexus.purpleorange.io`

- keep the existing `A` or `CNAME` record unchanged until the Studio split is fully deployed

## Redirect rules

### Required

- `www.violema.com` -> `violema.com`

### Strongly recommended

- old public Violema entrypoints on `nexus.purpleorange.io` should redirect to `violema.com`

### Do not do

- do not redirect Agent Studio routes away from `nexus.purpleorange.io`
- do not create partial split routing where half the Studio lives on Violema and half on Nexus

## TLS / certificates

Make sure both properties have valid certificates:

- `violema.com`
- `www.violema.com`
- `nexus.purpleorange.io`

Do not flip DNS before certificates are ready.

## Session and auth implications

If the products live on different domains or subdomains, assume cookies may not just “work” by accident.

Recommended path:

- central auth backend
- signed session bootstrap or token handoff between products

Do not rely on fragile client-side hacks for cross-domain login.

## Domain rollout sequence

1. Prepare `violema.com` hosting.
2. Confirm TLS is live.
3. Deploy Violema shell there.
4. Verify routes, login, logout, and billing pages.
5. Keep `nexus.purpleorange.io` stable.
6. Only then change redirects.

## Smoke checklist after DNS cutover

Check these exact URLs:

- `https://violema.com`
- `https://www.violema.com`
- `https://nexus.purpleorange.io`

Then verify:

- landing renders
- login works
- dashboard loads
- Studio still loads
- back-and-forth navigation works

## If using one VPS initially

You can still run both surfaces from one server.

Use separate vhost configs:

- `server_name violema.com www.violema.com`
- `server_name nexus.purpleorange.io`

The split can be product-clean before it is infrastructure-separate.
