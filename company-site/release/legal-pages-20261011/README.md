# Public legal pages: deployment preparation only

This local-only preparer adds `/legal/terms/` and `/legal/privacy/` to the existing company release. It performs no SSH, upload, activation, reload, PM2 action, or app deployment. A separate deployment request and fresh server checks are required before publication.

## Exact predecessor

- Company source: `e2784a029c15df11fd478b2a0e9c4cdaa740a65f`; merge: `17502238e39062904ed2460ab2f5e0b9cbbe82e1`.
- Expected current pointer: `/var/www/violema-science/releases/20261010-e2784a0-map`.
- Vhost SHA-256: `9a39f359e917393cc8c686672b858c1f8395b6fed19054e93205093dbf444592`.
- Archived helper SHA-256: `a5022f289923080fb7307c6989f838039147fa5ff975f92fc5a457cb4586f643`.
- Durable predecessor packet: `/Users/maximisto/SecondBrain/MySecondBrain/70 Agents/Agent Runs/Artifacts/2026-10-10-evidence-map-release/`.

The vault's successor runbook and `server-verification.json` record this activated pointer. The predecessor packet's `server-baseline.json` was captured before its activation and names the earlier physician release; do not use that stale pointer for this release. These receipts establish the last verified state, not a fresh check of production.

## Minimal change

The configuration patch inserts six exact locations inside the existing company overlay: `/legal/terms`, `/legal/terms/`, `/legal/terms/index.html`, and the corresponding three privacy variants. They serve only their company HTML with GET/HEAD, no-cache and the current security headers. All original configuration bytes remain unchanged. `/terms`, `/privacy`, `/index.html`, `/login`, `/dashboard`, `/assets/`, `/brand/`, API proxying, host redirects and certificates retain their previous behavior.

The bundle and server helper allowlists gain only `legal/terms/index.html` and `legal/privacy/index.html`. Both pages are required before packet generation. The patched helper also rejects activation unless `current` still names the verified evidence-map release. Existing archive checks, atomic writes, directory permissions, vhost drift guards, nginx checks and backend-PID verification remain in the inherited helper.

## Run locally

From the repository root, first build and test the company site. Then run the packet tests against the archived, hash-pinned predecessor:

```sh
python3 -B company-site/release/legal-pages-20261011/test_prepare.py \
  --previous-packet '/Users/maximisto/SecondBrain/MySecondBrain/70 Agents/Agent Runs/Artifacts/2026-10-10-evidence-map-release'
```

After freezing the final source commit, generate a packet in a new directory. Replace `EXACT_TESTED_SOURCE_SHA` with its full 40-character hash; the preparer rejects placeholders and refuses an existing output directory.

```sh
python3 -B company-site/release/legal-pages-20261011/prepare.py \
  --previous-packet '/Users/maximisto/SecondBrain/MySecondBrain/70 Agents/Agent Runs/Artifacts/2026-10-10-evidence-map-release' \
  --dist company-site/dist \
  --revision EXACT_TESTED_SOURCE_SHA \
  --output /private/tmp/violema-legal-pages-packet-20261011
```

Inspect `baseline-violema.conf` against `candidate-violema.conf`, and the predecessor helper against generated `server-release.py`. The local tests cover configuration preservation, exact legal allowlisting, wrong-pointer rejection, activation under umask 077, and rollback to the evidence-map pointer. nginx and PM2 are mocked: these tests do not establish production syntax validity or live HTTP behavior.

Never invoke the predecessor `prepare.py` CLI: it is the initial-overlay preparer. This script hash-checks that file and calls only its public bundle builder, with the two legal paths explicitly added.

## Later authorized release

1. Recheck the current vhost hash, pointer, backend PID and legacy `/terms` and `/privacy` responses; capture fresh read-only baselines. Stop on drift. Parse the complete candidate nginx configuration separately before activation.
2. Verify frozen source/build identity, all packet hashes, and the full source/site tests. Review the generated helper diff. Upload only the generated `server-release.py`, `candidate-violema.conf`, `config-hashes.json`, `manifest.json` and `public-dist.tar.gz` to a fresh staging directory.
3. Run the generated helper's existing `activate` command with a unique release ID and the exact candidate hash. It must preserve the backend PID. Do not use `deploy/deploy.sh`: it overwrites this vhost and also deploys the legacy application.
4. Verify every manifest file, both legal pages and all six route variants, HTML MIME/no-cache/security headers, footer links, canonical/sitemap behavior, existing company pages/map, and unchanged legacy `/terms`, `/privacy`, SPA assets and API responses. Compare only stable `/api/health` fields because its timestamp changes. Check mobile/browser navigation without logging in or submitting forms.
5. Save the generated helper and recovery receipts in the new protected backup. If that release is rolled back, its helper restores the evidence-map pointer and this pre-legal vhost; use the new release ID, not the earlier physician or map rollback command. Retain the old release and archive the new public packet and verification receipts.

The script records the predecessor identity in `release-baseline.json`; generated packet hashes are in `packet-sha256.json`. Neither file is part of the public tarball. Do not package repository source, credentials or runtime/user data.
