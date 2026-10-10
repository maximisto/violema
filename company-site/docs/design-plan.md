# Company site design plan

Owner direction, 2026-10-10: a little wow, but clean and easy to work with, like a 21st-century lab.
Violema is the method company; PsychDoc is its first application. The two sites read as one family
(Instrument Sans and Inter, a dark instrument window on a light page) while Violema keeps its own
palette: cool lab greys and one indigo accent.

## Principles

1. **The page is a bench; the instrument is the only dark object on it.** Everything else is light,
   flat and quiet, so the eye goes to the one thing that does work.
2. **Every mark comes from the packet.** Connector lines are `claim.sourceIds`, chart marks are the
   saved estimate, interval and thresholds, the footer is `sourceVersion`. Nothing is decorative data.
3. **One moment of motion.** The hero trace draws once on load. Everything else moves only to answer
   an action, in 120 to 200 ms.
4. **Status is information.** Review states stay verbatim, set as status pills (the only pills).
   Numbers appear on the protocol because it is a real sequence; nowhere else.
5. **Plain chrome.** Sentence-case labels, no all-caps eyebrows, monospace only for identifiers,
   arrows only where a link leaves the site (the existing "↗").

## Tokens

Light on `:root`, dark under `prefers-color-scheme: dark`; the instrument is dark in both.

| Role | Light | Dark |
| --- | --- | --- |
| `--bg` page ground | `#F5F6F8` | `#0E1117` |
| `--surface` cards, statement band | `#FFFFFF` | `#151A22` |
| `--surface-2` tracks, table heads | `#ECEEF2` | `#1C222C` |
| `--ink` | `#12161D` | `#E8ECF1` |
| `--ink-2` secondary text | `#4A5260` | `#A9B2BF` |
| `--ink-3` tertiary text | `#626B78` | `#8C96A4` |
| `--line` decorative hairlines | `#DDE1E7` | `#252C37` |
| `--line-strong` control borders | `#818A97` (brief `#848D9A`) | `#626C7B` (brief `#5E6877`) |
| `--accent` fills, links, focus | `#4B3BD1` | `#A79BFF` |
| `--accent-ink` text on accent | `#FFFFFF` | `#0E1117` |

Instrument: `--inst-bg #0B0F17`, `--inst-surface #111725`, `--inst-ink #E6EAF0`,
`--inst-ink-2 #9AA4B2`, `--inst-line #263040`, `--inst-accent #A79BFF`, plus one added
`--inst-line-strong #626C7B` for the slider track and control borders inside the instrument
(`--inst-line` is 1.4:1, decorative only).

`--line-strong` was darkened by three steps in each theme because the brief values give 2.89:1 and
2.83:1 against `--surface-2`, where the segmented controls sit. Both now clear 3:1 on every ground.
Shadows are tokens too (`--shadow-raised`), tinted to the ground, used only on the hero instrument
and the selected segment, which really are raised.

Shape: 8 px controls and chips, 12 px cards and instruments, 8 px nested containers, pills only for
status tags, 1 px borders everywhere, 2 px accent focus ring at 2 px offset.

## Type

- Instrument Sans (variable, 600 max): wordmark, display, headings, navigation, buttons, segment labels.
- Inter (variable): running text, captions, table cells.
- `ui-monospace, SFMono-Regular, Menlo, monospace`: source record ids, commit ids, hashes, versions.
- Display `clamp(2.75rem, 5.2vw, 4.5rem)`, line-height 1.02, -0.02em, 600.
- Section titles `clamp(1.9rem, 3.2vw, 2.75rem)`, line-height 1.08, -0.015em, 600.
- Body 1.0625rem, line-height 1.65, measure 66ch at most. `text-wrap: balance` on headings.
- Small text 0.875rem; captions 0.8125rem. No text under 12 px, including inside the instrument.

## Layout

A 12-column grid in a 1240 px frame with 40 px gutters on desktop, 24 px on tablets and 16 px on
phones. Text is left aligned throughout; nothing is centred except inside the instrument's scale.

### Home

```
┌ Violema ─────────────────────────────── Method   Evidence lab   PsychDoc ↗ ┐ 64 px, sticky
│                                                                              │
│ Scientific evidence systems        ┌ PsychDoc specimen ── [status pill] ───┐ │
│ Know which                         │ claim ─┬──────── source 1  id  year   │ │
│ conclusions hold.                  │ text   ├──────── source 2  id  year   │ │
│ And why.                           │ limit  ├──────── source 3  id  year   │ │
│ lede                               │        └──────── source 4  id  year   │ │
│ [Explore PsychDoc ↗] [See method]  │ Saved estimate and interval  Hedges' g │ │
│ First application line             │ ┄┄┄┄┄|┄┄┄┄┄┄┄┄┄┄┄┄┄┄|┄┄  scale + refs   │ │
│   5 columns                        │ shift ────●──────────  +0.00           │ │
│                                    │ estimate text · limit text             │ │
│                                    │ version (mono)          Inspect        │ │
│                                    └──────────── 7 columns ───────────────┘ │
├────────────────────────── statement band on --surface ──────────────────────┤
│ A paper is a source.                       We make the links inspectable…    │
│ A conclusion is a chain of reasoning.                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ Keep the reasoning close to the evidence.                                    │
│ 01 ●──── 02 ●──── 03 ●──── 04 ●──── 05 ●──── 06 ●     protocol stations       │
│ Source   Study    Claim    Assumption Review  Version                        │
│ Trace the claim | Expose the assumption | Test what transfers  (to /method/) │
├──────────────────────────────────────────────────────────────────────────────┤
│ First application                                                            │
│ PsychDoc. From molecule to clinic.   intro + honest status line              │
│                                      Does the interpretation survive…        │
│                                      [Explore PsychDoc ↗]  Try the lab       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Open the record.            [● Clinical research | ○ Materials research]      │
│                             question, summary, counts, review status         │
│                             Try the evidence lab                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Oryx  [In development]      quiet two-column card                            │
│ Start with a conclusion worth getting right.   [Request a briefing ↗]        │
│ footer: wordmark · tagline · links · preview status line                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

Phones: the hero stacks copy then instrument; the trace becomes claim above sources with a vertical
trunk on the left that branches to each source; the protocol becomes a vertical list on a hairline.

### Method

```
│ The method                                                                   │
│ A conclusion should show its working.                lede                    │
│ 01 ●──── 02 ●──── … 06 ●   stations, then the "organizing workflow" note     │
│ Trace       copy  ─────────  [dark: claim ─┬─ sources, limit, status]        │
│ Challenge   copy  ─────────  [dark: interval on the Hedges' g scale]         │
│ Transfer    copy  ─────────  [dark: PsychDoc | Perovskite, receipt link]     │
│ What exists. What comes next.   status pill rows                             │
│ Inspect the record.             [Open the evidence lab]                      │
```

### Demo, the bench

```
│ Evidence lab / Open the record.                         prepared-packet note │
│ [● Clinical research  PsychDoc… | ○ Materials research  Perovskite…]  Reset  │
│ corpus header: domain, title, question            [Download packet ↓]        │
│ review banner                                                                │
│ ┌ rail ──────┐ ┌ dark instrument ───────────────┐ ┌ linked evidence ───────┐ │
│ │ Claim 1  ◀ │ │ Claim 1 [status pill]           │ │ Claim 1               │ │
│ │ Claim 2    │ │ claim text                      │ │ id  year              │ │
│ │ Claim 3    │ │ interpretation limit            │ │ title ↗               │ │
│ │            │ │ ─────────────────────────────── │ │ kind · locator        │ │
│ │            │ │ replay: scale, slider, result   │ │ …                     │ │
│ └────────────┘ └─────────────────────────────────┘ └───────────────────────┘ │
│ conditions table (scrollable, focusable region)                              │
│ how this packet was prepared · provenance details                            │
```

Tablet: rail and instrument side by side, evidence under the instrument. Phone: claim selector,
then the instrument, then evidence, then the table.

## The instrument

```
┌ header: "PsychDoc specimen" (h2)                    [claim.status pill] ┐
├ trace ──────────────────────────────────────────────────────────────────┤
│ claim card            │ leads │ ol of claim.sourceIds, equal rows         │
│  label, claim.text,   │ ───●  │  title (link ↗), kind, year, id in mono   │
│  caveat               │ ───●  │                                           │
├ replay (data-bias-root) ────────────────────────────────────────────────┤
│ "Saved estimate and interval"  unit, direction                           │
│ legend: Saved result (dot), Assumed shift (capped bar)                   │
│ scale: ticks −1.50…0.50, dashed −0.50 and −0.24 reference lines,         │
│        saved row (grey, dot), shifted row (accent, capped interval)       │
│ slider 0 to 0.60 (hidden without JS), output +0.00                       │
│ result text (aria-live), the existing limit sentence                     │
├ footer: "Prepared source packet", sourceVersion in mono, "Inspect" link ┤
```

- The leads are horizontal SVG lines placed by percentage on equal-height source rows, so they meet
  each row's centre at any width without measuring the DOM. `pathLength="1"` and a CSS
  stroke-dashoffset animation draw them in order (700 ms each, 100 ms stagger) only under
  `@media (scripting: enabled) and (prefers-reduced-motion: no-preference)`. With JavaScript off or
  reduced motion the lines are simply drawn. After the run, a class pins the drawn state so a layout
  change cannot replay it.
- The interval scale is SVG with percentage x positions and fixed pixel rows, so its labels stay at
  a readable size from 320 px to 1440 px instead of shrinking with a viewBox.
- Only the hero trace animates. The method page reuses the same trace statically.

## Interaction

- Corpus switches (home teaser, demo) are links to anchors without JavaScript and become an ARIA
  tablist with arrow, Home and End keys, roving tabindex and `aria-selected` once enhanced. Selected
  segments show a filled indicator as well as colour.
- Claim selection keeps link semantics and `aria-current`; the centre claim and its evidence switch
  together.
- The bias slider keeps its bounds, step and limit text; reset returns to the first corpus, first
  claim and zero shift.
- The header gains its hairline once the page scrolls.

## Review against the brief

- Rejected first idea: a fan of diagonal connector lines from one point. It read as decoration and
  needed DOM measurement for curves; horizontal leads on equal rows are calmer, exact and work
  without JavaScript.
- Rejected: repeating the interval chart in the PsychDoc section. The hero already does it; the
  section keeps its copy and links instead.
- Rejected: monospace small labels and middle-dot meta strings as chrome. Mono is limited to
  identifiers; middle dots appear only where they are part of packet text.
- Accessory to remove at the end: the arrow icon after every internal link and button. Only links
  that leave the site keep "↗".
