# October 24 Fe4S4 simulated-reading fixes: staged

Before the record was sent to anyone, it was put in front of four blind readers:
- two Fable simulations of the researcher it is meant for, one reading on a phone and one at a desk;
- a Grok 4.7 simulation of the same reader;
- a Fable reviewer acting as an adversarial quantum-chemistry expert.

Claude checked their factual challenges against sources, and this release fixes what held up:
- **A reversed comparison.** The race chart's note said Zhai et al. report a *lower* DMRG bound. Their −327.244001 Eh is 0.66 mEh *above* the reference; the figure is now derived.
- **A missing cost.** The SQD card now says that run's quantum time alone would cost about US$57,600 at IBM's public pay-as-you-go rate (US$96 a minute, checked 2026-10-24). That is more than half of this test's US$100,000 ceiling per run.
- **A misattribution.** "In parallel" was the preprint's description, presented as the tracker's. Both pages now attribute it to the preprint.
- **An identifying line.** Neither page says whom the demo was prepared for any more.
- **A sales button.** The closing section's "Request a briefing" button is gone; the site footer keeps its link.
- **Rule ids.** They leave the main page's outcome list. The full record keeps them and says what they are for.
- **Plainer wording.**
  - Tiers are defined where they are used.
  - The speed score reads in one direction.
  - The two orbital-basis sentences no longer contradict each other.
  - The input rule says that rotating the pinned file's orbitals within the active space counts as input processing. This is a dated revision in the record; the energy target, budget, speed score and outcome rule are unchanged.

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

The built tree is `7ba21bb` on `feat/fe4s4-sim-fixes`: main `3ec1583`, which builds the live release `20261024-de4a746-fe4s4-headers`, plus one commit.

Against the live release, four files change:
- `records/fe4s4-benchmark/index.html`;
- `records/fe4s4-benchmark/record/index.html`;
- `company-assets/records.css`;
- `company-assets/browser/fe4s4-figures.mjs`.

The other 60 files are byte-identical, the file count stays at 64, and no route is added. The vhost does not change; `activate.sh` checks its hash read-only.

## Pins

| What | Value |
| --- | --- |
| Release | `20261024-7ba21bb-fe4s4-sim-fixes` |
| Previous release | `20261024-de4a746-fe4s4-headers` |
| `index.html` SHA-256 (unchanged) | `d74c6df025f781dac2a722d0f7bbf45987d0148f6d99e897ce0f0d8bf6cef558` |
| `records/fe4s4-benchmark/index.html` SHA-256 | `8a5a9d9f01a6c656643e8aaa7dc60094090fa555299539b938fea4fb7a0748ac` |
| `records/fe4s4-benchmark/record/index.html` SHA-256 | `49eb3c98288de5de8b96c4f4d85b7ef9b342ca465c280ffb08e54d31867a4912` |
| `company-assets/records.css` SHA-256 | `8dee175dde6cca1963e6faff79b43456ec880434b02bcf164b0f009e394aa166` (was `26c5e527…`) |
| `public-dist.tar.gz` SHA-256 | `8ea2b33372643cd7354a0e625421b829b23bbc4a3842786be96dd78d3583dc17` |
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
