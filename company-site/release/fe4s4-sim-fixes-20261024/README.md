# October 24 Fe4S4 simulated-reading fixes: staged

Before the record was sent to anyone, it was put in front of four blind readers:
- two Fable simulations of the researcher it is meant for, one reading on a phone and one at a desk;
- a Grok 4.7 simulation of the same reader;
- a Fable reviewer acting as an adversarial quantum-chemistry expert.

Claude checked their factual challenges against sources, and this release fixes what held up:
- **An incomplete comparison.** The race chart's note said only that Zhai et al. report "a lower DMRG bound on a model of the same size", with integrals unchecked. Their paper (arXiv 2601.04621 v1, supplementary section 4.1) names this record's pinned file as its input. It reports spin-adapted DMRG upper bounds down to −327.247036 Eh, with entanglement-minimized orbitals at D = 20,000, for the lowest of three spin isomers. That is 2.38 mEh below the GPU DMRG reference. The page now states it, derived, and leaves the reference as drafted, open for review. (A first attempt quoted only Zhai's −327.244001 for one isomer, which sits above the reference. A fact-check against the paper caught that before release.)
- **A missing cost.** The SQD card now says that run's quantum time alone would cost US$57,600 or more at IBM's public pay-as-you-go rate, which starts at US$96 a minute (checked 2026-10-24). That is over half of this test's US$100,000 ceiling per run.
- **A loose attribution.** "In parallel" now reads as what the submission and its preprint both describe: overlapping quantum and classical phases.
- **An identifying line.** Neither page says whom the demo was prepared for any more.
- **A sales button.** The closing section's "Request a briefing" button is gone; the site footer keeps its link.
- **Rule ids.** They leave the main page's outcome list. The full record keeps them and says what they are for.
- **Plainer wording.**
  - Tiers are defined where they are used.
  - The speed score reads in one direction.
  - The two orbital-basis sentences no longer contradict each other.
  - The input rule says that rotating the pinned file's orbitals within the active space counts as input processing. This is a dated revision in the record; the energy target, budget, speed score and outcome rule are unchanged.

Further fixes from the same fact-check: "three charts plus the ledger" instead of "four charts", and "a draft rule" instead of "a committed rule" in the page description.

PR maximisto/violema#42. Max asked for it on 2026-10-24: "Fix the page issues from the Carl simulation (Zhai line, the Cleveland Clinic sentence, rule ids and the confusing phrases, the basis sentence, 'in parallel', the budget note, the briefing button), then PR, merge once CI is green and deploy."

## The previous release

`20261024-de4a746-fe4s4-headers` (packet `fe4s4-headers-20261024`, which still says "staged") was activated on 2026-10-24 at 22:53 UTC with its `activate.sh`, after PR #41 merged as `3ec1583`. Every guard passed, and the public checks passed:
- all 64 live files matched;
- both record routes answered 200;
- `/api/health` answered 200;
- `POST /api/briefing` with `{}` answered 400;
- an unknown path answered 404.

On a 375 px phone, the live page showed all five chapter labels, the legend under the molecule and the charts at their stops, with no overflow and no console errors.

## Source

The built tree is `46d6e25` on `feat/fe4s4-sim-fixes`: main `3ec1583`, which builds the live release `20261024-de4a746-fe4s4-headers`, plus two content commits.

Against the live release, four files change:
- `records/fe4s4-benchmark/index.html`;
- `records/fe4s4-benchmark/record/index.html`;
- `company-assets/records.css`;
- `company-assets/browser/fe4s4-figures.mjs`.

The other 60 files are byte-identical, the file count stays at 64, and no route is added. The vhost does not change; `activate.sh` checks its hash read-only.

## Pins

| What | Value |
| --- | --- |
| Release | `20261024-46d6e25-fe4s4-sim-fixes` |
| Previous release | `20261024-de4a746-fe4s4-headers` |
| `index.html` SHA-256 (unchanged) | `d74c6df025f781dac2a722d0f7bbf45987d0148f6d99e897ce0f0d8bf6cef558` |
| `records/fe4s4-benchmark/index.html` SHA-256 | `331386c0963920eeacbe2e4222d5ab88ea6dd62e94699ac3487c4247f9efd746` |
| `records/fe4s4-benchmark/record/index.html` SHA-256 | `9b7426b3faab021001361735bc25a18e0b7089f47ec6ecbbd29ff7e05bf9d392` |
| `company-assets/records.css` SHA-256 | `8dee175dde6cca1963e6faff79b43456ec880434b02bcf164b0f009e394aa166` (was `26c5e527…`) |
| `public-dist.tar.gz` SHA-256 | `a5db716afbebda07b4cfd6cbf4f6acdea84be897023cc087d8e49d8f62e8f77a` |
| Vhost (read-only check) | `dfadb9960b8a7c23865d00aca148635b0058d460a860688127b0b04737bca5c5` |
| Files | 64, each hash in `SHA256SUMS` beside this file |

To reproduce the tarball:
1. From the source revision, run `npm --prefix company-site run build`.
2. From `dist/`, run `COPYFILE_DISABLE=1 tar --no-xattrs -czf public-dist.tar.gz` over the 64 files in `SHA256SUMS` order (`find . -type f | sort`).

## How to activate

From a directory holding `public-dist.tar.gz` and `SHA256SUMS`, run `./activate.sh root@<vps>`.

The script refuses unless all of these hold:
- `current` points at `releases/20261024-de4a746-fe4s4-headers`;
- the live `index.html` equals `d74c6df0…`;
- the live `records.css` equals `26c5e527…`;
- the vhost equals `dfadb996…`;
- the new release directory does not exist.

It then unpacks the files, checks them against `SHA256SUMS`, requires 64 files and sets permissions. It moves `current` over with a sibling symlink and `mv -T`, then runs `nginx -t` and a reload; if the reload fails, it restores the previous `current`. Finally it runs the same public checks as the previous release.

## Rollback

1. Point `/var/www/violema-science/current` back at `releases/20261024-de4a746-fe4s4-headers`: create a sibling symlink, then rename it over `current`.
2. Run `nginx -t`, then reload nginx.
