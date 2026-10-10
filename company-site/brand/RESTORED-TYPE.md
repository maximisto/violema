# Exact restoration of the preferred lettering — 2026-10-10

Max clarified that the typography immediately before the neckline edit was correct and requested its restoration while retaining the fine neck. After a generated attempt drifted, Max explicitly authorized direct pixel editing. The selected result uses that authorized method, not image regeneration.

Current [logo](violema-restored-type-20261010.png), unchanged [fine-neck icon](violema-fine-neck-icon-20261010.png), and [verification receipt](restored-type-verification.json).

## Exact composition

Both source PNGs are 2172×724 RGBA. Preserve columns0–899 from `violema-fine-neck-20261010.png`; copy columns900–2171 from `violema-refined-wordmark-20261010.png` at the same coordinates with no resize, interpolation, masking or text rendering. Column900 is fully transparent in both images. The split lies in the portrait/name gap.

Decoded output portrait pixels equal the current fine-neck source exactly. Decoded output lettering pixels equal the preferred pre-neck source exactly. PNG save/reload is byte-equal at the RGBA pixel level. The restored I stem is24px at source row340, matching the preferred reference. Region and file SHA-256 values are recorded in the receipt. Earlier versions remain preserved.
