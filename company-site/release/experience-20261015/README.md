# October 15 company experience successor

Max authorized push and deployment of the reviewed company-site experience on October 15.

This preparer retains the existing static-release mechanism. It pins the archived October 12 legal-operator packet and the original public-only bundle builder. It changes only the activation helper's predecessor pointer and diagnostic, preserving the nginx bytes, public allowlist, atomic writes, rollback and backend PID guard. The existing legal release preparation remains a historical record.

Predecessor: `/var/www/violema-science/releases/20261012-4753e53-legal-operator`, source `4753e53db0d35fcd1386ff2afbefdea286a35aa5`. Expected vhost SHA-256: `71f4245751dd468a810c026d0300f68c45a9cd7f53412c9976dc9aba085fbd5d`.

Run `test_prepare.py` and `prepare.py` with `--previous-packet` pointing to the archived `2026-10-12-violema-legal-operator-release/packet` and `--bundle-preparer` pointing to the archived `2026-10-10-evidence-map-release/prepare.py`. Preparation also requires `--dist`, the exact committed `--revision`, and a new `--output` directory. These scripts have no network or deployment action.

Before activation, build/test the exact committed source; capture fresh public legacy responses, current pointer, vhost bytes/mode and backend identity; compare the generated helper; and validate every archive member and hash. Upload only the five deployment packet files to a fresh staging directory. Activate with the generated helper and its exact candidate hash. Never use the legacy application deployment script for this static release.

Verify all public file hashes, route variants, response headers, preserved legacy routes and API, then the live browser experience. Keep the generated helper and state under the new protected backup directory; its guarded rollback restores the October 12 release. Archive packet hashes and before/after verification receipts in the vault run artifacts.
