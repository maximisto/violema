# Rollout Checklist

## Phase 0: product split is explicit

- [ ] Violema positioning is outcome-first
- [ ] Agent Studio positioning is optimization-first
- [ ] nav language reflects the split
- [ ] docs are the source of truth

## Phase 1: code boundary

- [ ] Studio frontend is feature-isolated
- [ ] Studio backend routes are isolated
- [ ] `/api/studio/*` exists and is the only Studio read model
- [ ] Violema adapter is explicit
- [ ] Studio does not depend on Violema page state hacks

## Phase 2: Violema product cleanup

- [ ] landing page rewritten around recurring work execution
- [ ] dashboard simplified
- [ ] Agent Studio demoted to advanced surface
- [ ] workflow create/edit/run path is stable

## Phase 3: domains

- [ ] `violema.com` frontend deployed
- [ ] `www.violema.com` redirects correctly
- [ ] `nexus.purpleorange.io` remains stable
- [ ] TLS works on all domains

## Phase 4: auth and handoff

- [ ] one shared identity system
- [ ] Violema -> Studio launch path works
- [ ] Studio -> Violema return path works
- [ ] workspace context survives handoff
- [ ] logout clears both surfaces

## Phase 5: repos

- [ ] `violema` repo created
- [ ] `agent-studio` repo created
- [ ] Violema repo contains main app only
- [ ] Agent Studio repo contains Studio shell and adapters only
- [ ] cross-repo coupling is explicit and minimal

## Phase 6: smoke tests

- [ ] Violema landing loads
- [ ] Violema login works
- [ ] Violema dashboard works
- [ ] workflows can be edited and saved
- [ ] Agent Studio opens from Violema
- [ ] replay loads
- [ ] promotion/rollback surfaces load
- [ ] return path to Violema works

## Phase 7: launch readiness

- [ ] product messaging is no longer blurred
- [ ] both products have distinct nav and copy
- [ ] Studio feels optional for Violema users
- [ ] Studio feels standalone for power users
- [ ] support docs and internal ownership are clear
