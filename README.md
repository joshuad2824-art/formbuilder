# Form Builder

An application that assembles on-brand, print-ready field guides, quick reference
sheets and huddle cards from filled-out forms.

The premise: **content is data, brand is a swappable file, and the research is
baked into the renderer.** The author supplies only what they know — the
procedure. Everything else is the app's job.

The design handoff this is built from lives in `design_handoff_form_builder/`.
Where its spec and its deltas file disagree, the deltas file wins.

---

## Where the build has got to

Spec §15 sets the build order and says why: *prove pagination before building
anything on top of it.* Steps 1–3 are done.

| | Step | State |
|---|---|---|
| 1 | Content model and section types | done |
| 2 | Brand kit format, both kits, the validator | done |
| 3 | HTML renderer at all geometries | done — four geometries render, 80 tests |
| 4 | Screenshot pipeline | contract in place, pipeline not built |
| 5 | PDF export | prints from the HTML; no preflight yet |
| 6 | The form UI | not started |
| 7 | Rules engine — HARD first, then WARNING | HARD contrast and keep-together enforced in the renderer |
| 8 | DOCX emitter | not started |
| 9 | Huddle card, large print, retrieval blocks | card and large print done |

```
npm install
npm test          # 80 tests
npm run geometry  # prints the geometry table, generated from the engine
npm run sample    # renders a document at every geometry into out/
npm run dev       # the app shell (screens not yet built)
```

---

## Architecture

The app is **entirely client-side**. No accounts, no server storage, no image
ever uploaded. That claim is what lets this be used without a security review,
and it is stated to the user at the moment they drop in a screenshot. If the
architecture changes, §14 of the spec has to be rewritten and the promise on the
first screen with it.

### Three layers, kept apart

| Layer | What it is | Who owns it | Where |
|---|---|---|---|
| Brand kit | An HTML file carrying tokens **and the CSS that renders documents** | The facility | `src/brandkit/` |
| Blueprint | A document type with a page geometry | The app knows three | `src/geometry/` |
| Content | Structured JSON — never markup | The author | `src/model/` |

The renderer marries content + blueprint + brand kit at output time. That is why
a new facility needs a new kit file and nothing else.

### The division the renderer turns on

A brand kit is not a token file with a specimen attached. It carries a complete
document stylesheet with its own DOM contract — `.doc[data-blueprint]`,
`.steps > li` as a two-cell grid, `.body-grid`, `.rail`, `.spine`, `.sysmsg`,
`.anno-label`. So:

- **the kit owns appearance** — faces, colour, rules, callout treatment;
- **the app owns geometry** — page boxes, margins, bleed, the baseline unit, and
  pagination, which no kit can know.

The engine's derived geometry is written onto the document element as custom
properties at render time, so where a kit hardcodes a unit for a blueprint the
engine wins and the two cannot silently diverge. A test asserts the shipped kit
agrees with every derived unit.

Getting this wrong is not theoretical: the first cut of the renderer emitted its
own callout fills alongside the kit's, and shipped white text on a white ground.

---

## The numbers are the product

Build rule 1, earned during the design: **layout figures are generated from
layout, never typed.** Every stated-number error across six design passes was a
hand-typed figure sitting beside correct geometry.

So `src/geometry/blueprints.ts` takes only the genuinely chosen inputs — trim,
the margins that protect the fold, the column structure, the body size, the
leading, and how many baseline units the page holds — and derives the rest. The
bottom margin is an *output*, computed so live height lands on an exact whole
number of baseline units.

`npm run geometry` prints the table. Nothing in it is typed:

| | Field guide | Letter, 2 col | Letter, prose | Huddle card |
|---|---|---|---|---|
| Trim | 5.5 × 8.5 in | 8.5 × 11 in | 8.5 × 11 in | 8.5 × 11 in |
| Body | 11 pt | 11 pt | 11 pt | 16 pt |
| Unit | 16.5 pt | 15.75 pt | 17.16 pt | 25.44 pt |
| Live height | 31 units | 37 (p1) · 43 (cont.) | 40 units | 27 units |
| Measure | 70.7 CPL | 49.5 CPL | 72.7 CPL | 58.3 CPL |

**The baseline unit is per geometry, not one constant.** §11.1 lists 15 pt as
INVARIANT; that cannot hold once leading is a function of measure. The invariant
is the *rule* — live height is an exact integer multiple of *its own* unit — not
the number. Every geometry is tested against it, continuation pages
independently of page one.

**Measure the string.** §11.2's fallback of `0.5 × size_pt` overstates Calibri by
about 24%. `src/geometry/measure.ts` measures the real characters in the real
face where a canvas exists, and falls back to a *calibrated* 0.405 em where one
does not — never to the spec's constant.

### One number in the handoff does not reconcile

The handoff states **59 CPL** for the letter-prose geometry. A 4.5 in reading
column at 11 pt and a measured 0.405 em advance gives **72.7 CPL**. The two
cannot both be true, and 59 CPL would require a 3.65 in column.

72.7 is legal — inside the 45–75 single-column band and under the WCAG 1.4.8
ceiling of 80 — so nothing is blocked, and the engine derives it rather than
asserting either figure. But the stated leading of 1.56 doesn't follow from the
line-height curve for *either* value, so **the reading column's width is worth a
decision** rather than an inference. Every other figure in the handoff
reproduces exactly.

---

## Content model

Five shapes, and that is the entire vocabulary: `steps` · `paragraph` · `table` ·
`callout` · `figure`. The spec's twenty named section types collapse to one shape
with five variants, and **the author writes the section title** — the app never
supplies section names.

`register` (`both` | `scaffolded` | `expert`) sits on every section. It is what
makes the two-variant architecture **one filter instead of two templates**:
high-assistance materials help novices (d = 0.505) and actively harm experts
(d = −0.428), so one submission produces two documents. `important` and
`requirements` callouts are byte-identical in both cuts — the one thing the
expert path may not touch, and it is tested.

Metadata stays controlled: `audience`, `systems`, `effective_date` and
`system_version` are pick-lists. The reviewed library had fifteen uncontrolled
strings meaning roughly four audiences, and six labels for one date field.

`support_presets` is deleted, along with every hardcoded email address and phone
number. Contact details are an ordinary author-written section — nothing about a
specific department is baked into the app or the kit.

---

## Brand kits

`unbranded-v1` is bundled as **the default, not a test fixture**. It loads when no
brand file is present, and "carry on with a plain look" is a supported path — a
document picks the brand up retroactively, because content is data.

The app ships with **no Ascension brand in it at all**. It becomes an Ascension
tool only when someone drops in an Ascension file.

The validator refuses a kit that cannot be trusted: a fill that resolves to no
declared colour, a fill that disagrees with the kit's own CSS, a missing or
duplicate label, text that fails 4.5:1 against its actual fill, an asset pointing
outside the file, an unsupported version, an unknown page shape. Failures are one
plain sentence with no jargon.

**Two levels sharing a fill is legal** and is deliberately *not* implemented as a
hard rule. `unbranded-v1` gives all four the same ink fill on purpose — the word
carries the whole signal. A hard rule would fail the app's own default kit and
dead-end the first screen.

---

## What is deliberately absent

- **No readability score.** Not shown, not scored, not stored, and it never gates
  export. Nothing is auto-rewritten to lower one. It is the weakest and most
  gameable rule in the set.
- **No page controls.** No page size, column count, margin or zoom control
  anywhere. Page count is reported, never set.
- **No jargon on screen.** Not *measure*, *CPL*, *baseline unit*, *blueprint*,
  *section type*, *geometry*, or `[[double brackets]]`.
- **No second layout engine.** PDF is the HTML, printed.

---

## Open decisions

Carried forward from the handoff, none blocking:

- Is TIP's gold `#ffb400` sanctioned, or does it stay flagged `proposed`?
- Does the shipped kit carry the enterprise Ascension lockup, or a St. John
  market lockup? A market kit is a separate file.
- Saddle-stitch creep allowance for the field guide. The printer's spec governs.
- **New:** the letter-prose reading column width, per the reconciliation above.
