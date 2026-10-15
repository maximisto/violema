# October 15 compact mobile header successor

Max authorized push and deployment of the latest reviewed Violema updates; this scoped correction completes that release on October 15. This preparer pins the immediately preceding refinements packet and preserves the audited static release mechanism. It changes only the activation helper predecessor guard and diagnostic; nginx bytes, public-only archive validation, atomic activation, rollback and backend PID checks remain unchanged.

Predecessor: `/var/www/violema-science/releases/20261015-32f1c1b-refinements`, source `32f1c1be06cc6532198b12f48fff37cd48088e96`.

Run `test_prepare.py` and `prepare.py` with `--previous-packet` pointing to the archived `2026-10-15-violema-refinements-release/packet` and `--bundle-preparer` pointing to `2026-10-10-evidence-map-release/prepare.py`. Preparation also requires `--dist`, the exact committed `--revision`, and a new `--output` directory. These scripts are local only.

Before activation, verify the fresh pointer, vhost hash/mode, public legacy baseline and backend identity. Build and test the committed source, review the helper diff and validate every packet member/hash. Upload only the five reviewed deployment files to a fresh staging directory. Activate with the exact candidate config hash; retain the helper and recovery record under the protected backup directory. Do not run the legacy application deploy script.

After activation, verify every public file, route variants, headers, private-path exclusions, legacy responses and backend identity, then check live desktop/mobile interactions. Archive receipts in the vault. The guarded rollback restores the immediately preceding refinements release.
