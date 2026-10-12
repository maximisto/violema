# Company legal-copy successor: local preparation only

This local-only preparer packages the 2026-10-12 company legal-copy release, retaining the existing `/legal/terms/` and `/legal/privacy/` routes. Phase 1 performs no SSH, upload, activation, reload, PM2 action, merge, push, or app deployment. Max must separately approve the exact phase-2 activation plan before publication.

## Exact predecessor

- Company source: `87bac30f800e7c94624140e002c8859c0be45729`; release: `20261011-87bac30-method`.
- Expected current pointer: `/var/www/violema-science/releases/20261011-87bac30-method`.
- Baseline and candidate vhost SHA-256: `71f4245751dd468a810c026d0300f68c45a9cd7f53412c9976dc9aba085fbd5d`.
- Archived helper SHA-256: `a252fb4dede3de991a4b0769170de49a37cd2e688e18eb290069fb33a6bb2f82`.
- Archived manifest SHA-256: `b4e6811d874e08f45ca3a48d14fa3583b3e4de535950ecaaf46c5727219de84e`.
- Durable predecessor packet: `/Users/maximisto/SecondBrain/MySecondBrain/70 Agents/Agent Runs/Artifacts/2026-10-11-physician-review-release/violema-packet/`.
- Separate bundle preparer: `/Users/maximisto/SecondBrain/MySecondBrain/70 Agents/Agent Runs/Artifacts/2026-10-10-evidence-map-release/prepare.py`, SHA-256 `783ccfb1b722629fcac3961b5b581501cd7793addd3d49aded856132ba54d3c2`.

The latest vault physician-review release receipts record the method pointer, which succeeded the 2026-10-11 legal-pages release. The predecessor helper still guards its own earlier legal pointer; this successor refreshes that guard to the method pointer. These archived receipts establish the last verified state, not a fresh check of production. The method packet does not contain the original bundle preparer, so its separate hash-pinned path is required explicitly.

## Minimal change

Baseline and candidate nginx bytes are identical. The preparer verifies one existing company overlay and the six existing exact legal locations: `/legal/terms`, `/legal/terms/`, `/legal/terms/index.html`, and the corresponding three privacy variants. It inserts no configuration. Their GET/HEAD restriction, no-cache and security headers remain unchanged, as do legacy routes, API proxying, host redirects and certificates.

The server helper's only changes are its expected predecessor pointer and diagnostic message. Its legal allowlist, archive checks, atomic writes, directory permissions, vhost drift guards, nginx checks and backend-PID verification remain unchanged. The original bundle builder still receives only the existing two-path legal allowlist extension. Both legal pages are required before packet generation.

## Run locally

From the repository root, build and test the company site at the exact approved source `4753e53db0d35fcd1386ff2afbefdea286a35aa5`, then confirm its clean tree:

```sh
git rev-parse HEAD
npm --prefix company-site run build
npm --prefix company-site test
git status --short
```

Any later preparer-only commit does not change this frozen served source. Run the packet tests against the archived, hash-pinned method predecessor and original bundle dependency:

```sh
python3 -B company-site/release/legal-pages-20261011/test_prepare.py \
  --previous-packet '/Users/maximisto/SecondBrain/MySecondBrain/70 Agents/Agent Runs/Artifacts/2026-10-11-physician-review-release/violema-packet' \
  --bundle-preparer '/Users/maximisto/SecondBrain/MySecondBrain/70 Agents/Agent Runs/Artifacts/2026-10-10-evidence-map-release/prepare.py'
```

Generate the packet from the frozen build into the exact phase-1 directory. The preparer requires a full 40-character source hash and refuses an existing output directory.

```sh
python3 -B company-site/release/legal-pages-20261011/prepare.py \
  --previous-packet '/Users/maximisto/SecondBrain/MySecondBrain/70 Agents/Agent Runs/Artifacts/2026-10-11-physician-review-release/violema-packet' \
  --bundle-preparer '/Users/maximisto/SecondBrain/MySecondBrain/70 Agents/Agent Runs/Artifacts/2026-10-10-evidence-map-release/prepare.py' \
  --dist company-site/dist \
  --revision 4753e53db0d35fcd1386ff2afbefdea286a35aa5 \
  --output /private/tmp/violema-legal-operator-packet-20261012
```

Compare `baseline-violema.conf` against `candidate-violema.conf` byte for byte, and review the predecessor helper against generated `server-release.py`. The local tests cover configuration preservation, exact legal allowlisting, dependency drift rejection, the required bundle dependency, packet hashes, wrong-pointer rejection before mutation, activation under umask 077, and rollback to the method pointer. nginx and PM2 are mocked: these tests do not establish production syntax validity or live HTTP behavior.

Never invoke the original bundle dependency's `prepare.py` CLI: it is the initial-overlay preparer. This script hash-checks that file and calls only its public `prepare_bundle()`, with the existing two legal paths explicitly allowed.

Inspect all archive members against the manifest and predecessor archive. Only the two legal pages and Corporation JSON-LD in HTML heads may differ. Confirm the two PsychDoc division phrases, the 2026-10-12 date, no `Purple Orange` or `Inc..`, and exactly one Corporation node with `@id` `https://violema.com/#organization` in every HTML head. Neither frontend changes nor repository documentation belong in the public archive.

## Later authorized release

1. Recheck the current vhost hash, pointer, backend PID and legacy `/terms` and `/privacy` responses; capture fresh read-only baselines. Stop on drift. Parse the complete candidate nginx configuration separately before activation.
2. Verify frozen source/build identity, all packet hashes, and the company-site and packet tests. Review the generated helper diff. Upload only the generated `server-release.py`, `candidate-violema.conf`, `config-hashes.json`, `manifest.json` and `public-dist.tar.gz` to a fresh staging directory.
3. Run the generated helper's existing `activate` command with a unique release ID and the exact candidate hash. It must preserve the backend PID. Do not use `deploy/deploy.sh`: it overwrites this vhost and also deploys the legacy application.
4. Verify every manifest file, both legal pages and all six route variants, HTML MIME/no-cache/security headers, footer links, canonical/sitemap behavior, existing company pages/map, and unchanged legacy `/terms`, `/privacy`, SPA assets and API responses. Compare only stable `/api/health` fields because its timestamp changes. Check mobile/browser navigation without logging in or submitting forms.
5. Save the generated helper and recovery receipts in the new protected backup. If that release is rolled back, its helper restores the method pointer and the identical pre-activation vhost; use the new release ID, not an earlier legal, physician or map rollback command. Retain the old release and archive the new public packet and verification receipts.

The script records the predecessor identity in `release-baseline.json`; generated packet hashes are in `packet-sha256.json`. Neither file is part of the public tarball. Do not package repository source, credentials or runtime/user data.
