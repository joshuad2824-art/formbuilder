# Form Builder — Spec Deltas

**What this is.** Design Pass 1–6 changed a number of things Part Two of `Form-Builder-Build-Spec.md` specifies. This file records every change, with the reason, so Part Two can be built as written without re-implementing decisions that were superseded during the design.

**How to use it.** Read this alongside the spec, not instead of it. Where the two disagree, this file wins. Where this file is silent, the spec stands.

Design source: `Form Builder - Design Pass 1.dc.html` — artifact ids (`1a`, `4a`, `5b`…) refer to labelled frames in that file.

---

## The short version

Nine changes matter enough to break a build if missed:

1. **Body is 11 pt**, and the baseline unit is **per geometry**, not one constant.
2. **Measure the string.** §11.2's 0.5 em fallback overstates Calibri by ~24%; measured is 0.405 em.
3. **Twenty section types collapse to five content shapes**, and the author writes the section title.
4. **A new `register` field** on every section — this is what makes the two-variant architecture one filter instead of two templates.
5. **The brand kit is dropped in by the user at first run.** It does not ship with the app.
6. **`support_presets` is deleted.** Contact details are an ordinary author-written section.
7. **The letter sheet is multi-page**, with a different live height on continuation pages.
8. **The Huddle Card is exempt from the body-size invariant** and has its own bold rule.
9. **The one-page cap and the section catalog are gone from the UI entirely** — no page controls, no jargon.

---

## §3 — The invariant / variable split

**Body size is no longer strictly invariant.** It is invariant across the two *reference* geometries (field guide, quick reference) and has one documented exception.

| | Value |
|---|---|
| Field guide, quick reference | 11 pt |
| **Huddle card** | **16 pt** |

**Why.** At 11 pt, a 79-word huddle spine fills about 8% of a letter live area — a 92%-white page that is read aloud to a room. The invariant was derived from two geometries both read silently at arm's length; a read-aloud script is a third register and was never tested against it. See `2a`.

**The baseline unit is variable, not invariant.** §11.1 lists `BASELINE_UNIT = 15 pt` as INVARIANT. That cannot hold: once leading is a function of measure (§11.3), each geometry has its own leading, so each has its own unit. The invariant is the *rule* — live height is an exact integer multiple of its own unit — not the number.

---

## §7.1 — Field Guide

| Property | Spec | Now | Why |
|---|---|---|---|
| Bottom margin | 0.708 in | **0.896 in** | Buys an exact 31 × 16.5 pt live height at 11 pt |
| Live area | 4.375 × 7.292 in | **4.375 × 7.104 in** | Follows from the above |
| Baseline units | 35 × 15 pt | **31 × 16.5 pt** | |
| Measure | 63 CPL | **71 CPL** | Measured, not estimated |

All other §7.1 values stand: trim, bleed, safe zone, mirrored margins, one column always.

---

## §7.2 — Quick Reference

**Margins are 0.75 in, not 1 in.** The 1 in default was inherited, not derived. It cost measure without protecting it.

**Option B (two columns, the default) needs a wide gutter.** At 0.75 in margins with a 0.25 in gutter the columns measure **55 CPL** — five past the multi-column maximum. The whitespace moves into the gutter instead of the outer margin:

```
margins   0.75 in sides and top · 0.844 in bottom (symmetric)
columns   2 × 3.0625 in
gutter    0.875 in
measure   49 CPL          (band 40–50)
leading   1.43 · unit 15.75 pt
units     37 × 15.75 pt exactly
```

**Option A is not "one column, wide margins."** That framing is wrong and should be rewritten. A single column at 11 pt runs 97 CPL at 1.25 in sides and 113 CPL at 0.75 in — the margin was doing real work, badly. Option A is now a **2/3 reading column plus a 1/3 rail**, on Ascension's own three-column grid, with metadata, logo and support moved off the reading column into the rail:

```
margins   0.75 in sides and top · 0.717 in bottom
grid      4.5 in reading column + 0.25 in gutter + 2.25 in rail
measure   59 CPL
leading   1.56 · unit 17.16 pt
units     40 × 17.16 pt exactly
```

**The sheet is multi-page.** "1–2 pages" in §2.1 is removed; a sheet flows to as many pages as the content needs. This introduces a second live height in one document:

| | Live area starts | Units |
|---|---|---|
| Page 1 (carries the color-field header) | below the band | 37 × 15.75 pt |
| Continuation pages (running head) | at the top margin | 43 × 15.75 pt |

Continuation pages replace the 150 px header band with a one-line running head (document title, version, date) above a hairline. A section that breaks across pages **repeats its own title with "continued"** in italic, and step numbering continues rather than restarting. See `4a`.

---

## §7.3 — The Step-Action block

**The field-guide table budget is 78 characters, not 87.** Measured at 10 pt cells across a 4.375 in live width. A table authored to 87 would overflow its measure.

| Columns | Budget each |
|---|---|
| 2 | 27 / 51 ch |
| 3 | 26 ch |
| minimum | 12 ch |

Table cell size rises from 9 pt to **10 pt** with the 11 pt base. Row height is 2 × the geometry's unit for single-line rows. All other table rules stand unchanged — horizontal rules only, banding at ≥6 rows or whitespace but never both, horizontal padding exceeding vertical.

---

## §7.4 — Callouts

**Contrast, measured rather than asserted:**

| Fill | White text | Black text |
|---|---|---|
| Blue `#1b4297` | 9.24 | 2.27 |
| Medium Blue `#1e69d2` | 5.24 | 4.01 |
| **Green `#00a791`** | **3.03** | **6.94** |
| Violet `#b40f87` | 6.25 | 3.36 |
| Gold `#ffb400` | 1.78 | 11.78 |

The green correction in §7.4 is right, and stronger than stated: white on green clears the 3:1 large-text floor by one hundredth of a point. Treat "white at large-bold only" as unavailable in practice. **Black on green, always.**

**CMYK, read from p.7 of the guidelines PDF** (four of the five values circulating were wrong):

| | Pantone | CMYK |
|---|---|---|
| Blue | 286 | 100 / 87 / 2 / 0 |
| Medium Blue | 285 | 90 / 48 / 0 / 0 |
| Green | 3275 | 90 / 0 / 52 / 0 |
| Violet | 248 | 42 / 100 / 0 / 0 |
| Gold | 7409 | 0 / 31 / 100 / 0 |

**TIP's gold remains unsanctioned.** It is implemented and flagged `"status": "proposed"` in the kit JSON. Still an open decision.

**The author never sees the words NOTE / IMPORTANT / REQUIREMENTS / TIP while writing.** The UI asks "how strongly do you mean it?" with four plain answers — *just so they know · they must not miss this · required by policy · a shortcut worth knowing* — and then shows the rendered label as a chip. See `5b`.

---

## §7.5 — Type and hierarchy

**11 pt is settled**, matching the house style. Everything derived at 10 pt shifts.

| Level | Field guide (r 1.2) | Letter (r 1.25) | Huddle (r 1.25, base 16) |
|---|---|---|---|
| Doc title | 23 pt | 27 pt | 31.25 pt |
| H1 | 19 pt | 21.5 pt | 25 pt |
| H2 | 16 pt | 17 pt | 20 pt |
| H3 | 13 pt | 13.5 pt | 16 pt |
| **Body** | **11 pt** | **11 pt** | **16 pt** |
| Table cell | 10 pt | 10 pt | — |
| Caption | 9 pt | 9 pt | 9 pt |

**Spacing scale** becomes multiples of half the geometry's unit. Space above headings: H3 1.5 units, H2 2 units, H1 3 units; space below always ½ unit.

---

## §9 — The content data model

### §9.1 — Controlled vocabularies

**`support_presets` is deleted**, along with every hardcoded email address and phone number. Contact details are an ordinary author-written section — the author titles it ("Who to call") and fills a paragraph. Nothing about a specific department is baked into the app or the kit.

Everything else in §9.1 stands and is load-bearing: `audience`, `systems`, `effective_date`, `system_version`, `needs_verification`. Those inconsistencies were never the author's fault — fifteen ways to type "ED Providers" is a UI problem, and a pick-list fixes it.

### §9.2 — Section objects

**The twenty named section types are replaced by one shape.** Every section becomes:

```json
{ "id": "s4", "title": "Placing the referral", "shape": "steps", "content": { }, "register": "both" }
```

- **`title`** — author-written, free text. The app never supplies it.
- **`shape`** — one of exactly five: `steps` · `paragraph` · `table` · `callout` · `figure`.
- **`register`** — `both` | `scaffolded` | `expert`, default `both`. See §12.4 below.
- **`callout`** carries a `level` (`note` | `important` | `requirements` | `tip`) chosen through the plain-language question.
- **`steps`** carries step objects per §9.3.

**Why.** Overview, Prerequisites, Scope note, Troubleshooting, Completion criteria and the rest are all a title plus one of five shapes. The app only needs to know the shape, to lay it out. Naming a clinical expert's own content for them was the part that had no justification.

**What is lost, and where it went.** The spec's strongest argument was that a form makes Prerequisites finally exist — 0 of 24 documents had one. Free-named sections give that up. The enforcement moves to the review screen as a question rather than a slot: *"Does anyone need something in hand before step 1?"* Same outcome, without dictating vocabulary.

**The shell stays app-owned** and is not an author section: title block, metadata, change log, source footer.

### §9.3 — The step object

Unchanged as a data structure. Two changes to how it is surfaced:

- **`[[double brackets]]` never appear in the UI.** The author types a control's name plainly; the editor marks it inline. The model still receives the markup.
- **The huddle card has a different bold rule.** Bold falls on dates, status words, URLs and credentials — never a UI control. `[[ ]]` should not be applied to that blueprint at all.

---

## §10 — The Brand Kit

**The kit is dropped in by the user on the first screen.** §10's "kits ship with the app — users select, they don't upload" is reversed. Three things get simpler:

- **No kit library.** No picker screen, no gallery, no naming scheme for facilities.
- **No governance problem.** §16 deferred user-uploaded kits because governance wasn't ready. Sharing the file directly *is* the governance.
- **The ownership question answers itself.** The app ships with no Ascension brand in it. It becomes an Ascension tool when someone drops in an Ascension file.

**`unbranded-v1` is the default, not a test fixture.** It loads when no brand file is present, and "carry on with a plain look" on the first screen is a supported path. A document picks the brand up retroactively — content is data, so nothing is retyped.

**Two kits are built:**

- `brand-kits/ascension-baseline-v1.html` — palette with Pantone and CMYK, measured contrast per pairing, `white_ok` flags, four callout levels, the enterprise horizontal lockup and emblem embedded as data URIs, clear-space and minimum-size rules, and the eight logo prohibitions from p.5 as machine-readable data.
- `brand-kits/unbranded-v1.html` — no color and no marks. All four callout levels render as a ruled box with the label reversed out in an ink tab, so the word is the entire signal. This makes it the reference implementation of the no-meaning-by-color-alone rule and the right kit to draft and test against.

**Validator additions.** Beyond §10's list:

1. **`callouts[].color` must resolve to a color the kit declares, and must agree with the kit's own CSS for that level.** A kit whose JSON and CSS disagree is unverifiable by eye — that exact bug shipped once during this design and rendered NOTE and REQUIREMENTS identically.
2. **Every level must carry a distinct, non-empty `label`.** The label is what distinguishes the levels, in every kit, always.
3. **Two levels sharing a fill is legal.** `unbranded-v1` gives all four the same ink fill on purpose — the word carries the whole signal, which is the no-meaning-by-color-alone rule taken to its end rather than a violation of it. A kit may declare `"monochrome": true` to say the shared fill is deliberate; the validator then suppresses any fill-distinction advisory. Do **not** implement "no two levels may share a fill" as a hard rule — the app's own default kit would fail it, and "carry on with a plain look" would dead-end on the first screen.

**`assets` values are data URIs or null** and remain so. Still null in the Ascension kit: `arch`, `wordmark`, and any St. John market lockup. The kit currently carries the **enterprise** Ascension lockup; a document that should read "Ascension St. John" needs its own kit file.

---

## §11 — The geometry engine

### §11.1 — Constants at 11 pt

```
BODY_SIZE       = 11 pt                     (16 pt for huddle_card)
BODY_MIN        = 11 pt (hard floor)
TABLE_CELL_MIN  = 8 pt (hard floor)
BLEED           = 0.125 in per edge, absolute
SAFE_ZONE       = 0.25 in from trim
STROKE_FLOOR    = 0.25 pt
CPL_TARGET      = 66
CPL_RANGE       = 45–75 (single column)
CPL_MULTICOL    = 40–50
CPL_HARD_MAX    = 80  (WCAG SC 1.4.8)
```

`BASELINE_UNIT` and `SPACING_SCALE` are **derived per geometry**, not constants:

| Geometry | Leading | Unit | Half | Live height |
|---|---|---|---|---|
| Field guide | 1.50 | 16.5 pt | 8.25 pt | 31 units |
| Letter, 2 column | 1.43 | 15.75 pt | 7.875 pt | 37 units (page 1) · 43 (continuation) |
| Letter, prose | 1.56 | 17.16 pt | 8.58 pt | 40 units |
| Huddle card | 1.59 | 25.44 pt | 12.72 pt | 27 units |

### §11.2 — Measure

**The fallback constant is wrong and should be corrected in the spec.** §11.2 offers `CPL ≈ column_width_pt / (0.5 × size_pt)`. Measured against Calibri with real prose, the average advance is **0.405 em**, so that formula overstates capacity by about a quarter — enough to hide two out-of-band geometries. If a fallback is needed at all, use 0.41 em for Calibri; better, obey §11.2's own first sentence and measure the string.

**This applies to the spec's own numbers, not just the engine.** Four rounds of review during this design found stated figures that disagreed with correct rendered geometry. Build rule: **layout figures are generated from the layout, never typed alongside it.**

### §11.4 — Vertical grid

Unchanged in principle. One addition: a multi-page document may have **more than one live height**, and each must independently be an exact integer multiple of its geometry's unit. Continuation pages are a distinct case, not a variant of page 1.

---

## §12 — The rules engine

### §12.1 — HARD

Unchanged, with two notes:

- **Alt text remains the only export blocker** the author meets in practice, and the UI states the reason in the same breath as the requirement.
- **The mandatory item is never last** in a list of optional ones. On the review screen the blocking card sits first; the declinable suggestions scroll below it.

### §12.2 — WARNING

**Every warning is phrased as an offer with a specific fix and an equally easy decline.** A warning that cannot be comfortably declined is a block in a friendlier hat. Each card states what, then why in one sentence, then offers a fix the app performs itself ("change it to *Check that…*", not "revise wording").

**The readability warning is removed from the UI entirely.** §12.2 already warns that it is gameable and must never gate export. It is not shown, not scored, and not stored. Nothing is auto-rewritten to lower a score.

The reader-test nudge offers "remind me in a week" rather than a dismissal, because the library calls it the highest-value step and a plain dismissal deletes it forever.

### §12.4 — The two-variant architecture

Implemented as `register` on every section object (see §9.2). One filter, not a second template.

- **Scaffolded** renders everything.
- **Expert** suppresses sections marked `scaffolded`, drops step glosses and screenshots, and renders step lists as tables.
- **`important` and `requirements` callouts are byte-identical in both cuts.** This is the one thing the expert path may not touch.

The step object needs its **gloss separable from its action**, because the expert cut drops one and keeps the other.

Both variants are produced on export and presented as gifts, not settings: *"a short version for people who already know the steps."*

---

## §13 — Emitters

Unchanged. Two framing notes carried into the UI:

- Formats are named by what the user would do with them — **For printing** (PDF) · **For sharing a link** (web page) · **If someone must edit it** (Word) — with the file type as a sub-label.
- The Word card carries its own caveat in plain voice: once it opens in Word, the layout is out of the app's hands.

**§13.4 large print** is generated on every export and offered alongside the main file. Implemented as a token swap: `--body-size` to ≥1.4×, single column, unit recomputed. Both kits carry the `[data-large-print]` block.

---

## §14 — Screenshots and PHI

Unchanged in substance. Three requirements the design makes explicit:

- **The PHI acknowledgment lists what to look for** — names, dates of birth, medical record numbers, banner bars — rather than asking for a blanket attestation.
- **"The picture never leaves this computer" sits next to the drop zone**, at the same size as everything else. It is the claim that makes the app usable without a security review, so it is not fine print.
- **"Skip the picture" is a visible, ordinary-looking option.** Optional things that look mandatory are how forms get abandoned.

---

## §5 and §6 — The app itself

### §5 — Chrome

The chrome uses **one interface family (Archivo)** across every screen, per §5's own "one family, quiet, recessive" rule. Editorial faces are not used in the app: Playfair Display, Spectral and Oswald belong to a reading column and a signpost, not a control surface. Monospace appears only where numbers must line up — page counts, word counts, file names.

Kept from Timber & Ink because it is structural rather than decorative: the dark ground (so the white page is the brightest thing on screen), cream lettering, hairline rules instead of shadows, and **exactly one amber element per screen**, always the forward action.

Not kept: the brand's editorial typography, its engravings and mascots, its masthead. The tool wears no one's brand — consistent with a first screen that names no facility.

### §6 — Screen inventory, revised

| # | Screen | Change |
|---|---|---|
| 1 | **Drop in the brand file** | New. Replaces the kit picker. First thing the user sees. |
| 2 | Intake gate | Reworded to plain language; three questions on one screen; never blocks |
| 3 | What are you making | Blueprints described by use, page shapes at true relative proportion |
| 4 | **Write your sections** | Replaces the two-pane builder and the per-section wizard |
| 5 | ~~Section library~~ | Removed. Five shapes need no library. |
| 6 | Step editor | Folded into the section list |
| 7 | Picture and PHI | Kept |
| 8 | Review | Offers, not a report; blocking item first |
| 9 | Done | Both extra variants offered unasked |

**Jargon that never appears on screen:** measure, CPL, baseline unit, blueprint, section type, geometry, `[[double brackets]]`, readability score. **Controls that do not exist:** page size, column count, margins, zoom. Page count is reported, never set.

---

## Build rules earned during the design

Four, all learned the hard way:

1. **Layout figures are generated from layout, never typed.** Every stated-number error in six passes was a hand-typed figure beside correct geometry.
2. **Measure the string.** Not only in the engine — in the spec's own arithmetic too.
3. **Whatever a screen exists to do belongs in persistent chrome**, not in a scroll region. Completed work collapses; the current task and the primary action stay visible.
4. **The mandatory item goes first.** Never last in a list of optional ones.

---

## Still open

**Decisions only the owner can make:**

- Is TIP's gold sanctioned, or does it stay flagged as proposed?
- Does the shipped kit carry the enterprise Ascension lockup or a St. John market lockup? A market kit is a separate file.
- Saddle-stitch creep allowance for the field guide. Still unsourced; the printer's spec governs.

**Not yet designed** (none blocks a v1 build):

- Field guide cover and back page
- Change-log editing
- The audience selector that sets which variant is the default
- `arch` color-field art in the Ascension kit — still null, so no color-field header on kit-driven output

**Assumptions unchanged from the spec:** client-side only, no accounts, no server storage. If that changes, the PHI posture in §14 has to be rewritten and the first-screen promise with it.
