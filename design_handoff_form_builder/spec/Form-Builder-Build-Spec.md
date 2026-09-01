# Form Builder — Build Specification

*Working title. An application that assembles on-brand field guides, quick reference guides, and huddle cards from filled-out forms.*

**Author:** Joshua Davis · Clinical Informatics, Ascension St. John
**Version:** 0.1 — first full spec
**Date:** September 1, 2026

---

## How to use this document

This spec is written for two stops, in order.

**Part One (§4–§8) goes to the design workspace.** It carries the visual brief: the app's own aesthetic, the screen inventory, and — most importantly — the two output page designs with real measurements. Mock the output before the interface.

**Part Two (§9–§14) goes to Claude Code.** It carries the data model, the Brand Kit file format, the geometry engine, and the rules the renderer enforces.

**Part Zero (§1–§3) is shared.** Both stops need it.

Numbers marked `[CITED]` come from the research libraries and can be defended. Numbers marked `[DERIVED]` are arithmetic on a cited constraint — implement them, but don't present them as research findings. Numbers marked `[GAP]` are unsourced defaults filling a hole in the libraries; verify before relying on them.

---
---

# PART ZERO — SHARED FOUNDATIONS

## 1. What this is

A clinician opens the app, picks a document type, fills out a series of small forms — title, purpose, audience, steps, callouts, screenshots — and the app assembles a finished, on-brand, print-ready document. No template wrangling, no Word formatting, no design decisions.

The premise that makes it portable: **content is data, brand is a swappable layer, and the research is baked into the renderer.** The user supplies only what they know — the procedure. Everything else is the app's job.

### What problem it actually solves

The existing job aid library was built by hand, and it shows the strain. Across the 24 documents reviewed:

- **Audience** is a free-text field with **15 different values** meaning roughly four things ("ED Providers" / "Providers (ED)" / "Emergency Room Providers" are the same audience typed three ways).
- The **date field** carries **six different labels** — `Date:`, `Go-live:`, `Go-live date:`, `Revision:`, `Published:`, `Cerner update effective:` — and is missing entirely from 14 of 24 documents. One value is `Go-live: current`.
- **No document carries a version, owner, or review date.** Nothing in the library can support a Change Log even though the house style requires one.
- **Prerequisites** appear as a labeled section in **0 of 24** documents, despite being in the house structure. The information exists — it's smuggled into IMPORTANT callouts.
- Four documents have **no Support block**, including the two where a stuck physician most needs a phone number (`PowerChart-Touch-Errors`, `Sign-EPCS`).
- One document shipped with **blank contacts preserved from the source template**.

Every one of those is a problem a form solves for free. That's the case for the app in a sentence: *the structure stops being something each author has to remember.*

## 2. The three-layer architecture

Keeping these separate is the whole design. Collapse any two and the app stops being portable.

| Layer | What it is | Who owns it | Answers |
|---|---|---|---|
| **Brand Kit** | An HTML file carrying design tokens + CSS | You author; user selects | *What does it look like* |
| **Blueprint** | A document type with a fixed section spine | The app knows a few | *What shape is it* |
| **Section types** | The reusable bricks each blueprint assembles from | The app defines all | *What goes in it* |

The user's content is stored as **structured JSON**, never as markup. The renderer marries `content + blueprint + brand kit` at output time. That is why a new facility needs a new kit file and nothing else.

### 2.1 The three blueprints

| Blueprint | Trim | Binding | Typical length | Origin |
|---|---|---|---|---|
| **Field Guide** | 5.5 × 8.5 in | Folded / saddle-stitched | 4–24 pages | Hands off to Let It Book for imposition |
| **Quick Reference** | 8.5 × 11 in | Loose sheet | 1–2 pages | Posted, laminated, or handed out |
| **Huddle Card** | 8.5 × 11 in | Loose sheet | 1 page | Read aloud at shift huddle |

The Huddle Card earned its own blueprint rather than being a short Quick Reference. Analysis of `Remote-Access-Huddle-Card.md` shows a genuinely different document: ~150 words against a job-aid median of ~330, a fixed three-part spine (**What's changing** → **Why it matters** → **Action required**) that appears in no job aid, bold falling on URLs and credentials rather than UI controls, and a speaker-facing urgency register. It carries no Overview, no Support block, and no screenshots.

> **A note on that specific card:** it ships with an unresolved date conflict — the source lists a cutover of "Wednesday, March 11" against huddle dates of "Nov. 17–21." That's the argument for the `needs_verification` flag in §9.

### 2.2 The section catalog

Derived from the actual structure of the 24-document library, not from the stated house style. Frequencies are observed.

| Section | Field Guide | Quick Ref | Huddle | Observed |
|---|---|---|---|---|
| Title | required | required | required | 24/24 |
| Metadata block | required | required | required | 24/24 |
| Overview / Purpose | required | required | — | 23/24 |
| Prerequisites | required | optional | — | **0/24 — net new** |
| Scope note (unlabeled) | optional | optional | — | ~10/24 |
| Procedure section (H2) | required | required | — | 22/24 |
| Step list | required | required | — | 1–6 sections per doc |
| Subsection lead | optional | optional | — | ~6/24, faked with bold |
| Callout | optional | optional | — | median 1 per doc |
| Reference table | optional | optional | — | 1/24 |
| Options list | optional | optional | — | ~8/24 |
| Completion criteria | optional | optional | — | 1/24 |
| Troubleshooting | optional | optional | — | 1/24 labeled |
| Resources / videos | optional | optional | — | 4/24 |
| Exception / role variance | optional | optional | — | 2/24 |
| What's changing | — | — | required | Huddle only |
| Why it matters | — | — | required | Huddle only |
| Action required | — | — | required | Huddle only |
| Support / contacts | required | required | optional | 20/24 |
| Change log | required | required | required | **0/24 — net new** |
| Source footer | auto | auto | auto | 24/24 |

**Three sections are net new** — Prerequisites, Change Log, and Owner/Review Date. They're in the house style but nowhere in the library. The form is what will finally make them exist.

**One structural note:** the library contains **no H3 anywhere**. Where a third level is needed, authors write a bold paragraph lead (`**To customize before saving:**`). The app should make **Subsection Lead** a real section type rather than letting authors fake it with bold.

## 3. The invariant / variable split

The single most important engineering decision in this build. Every geometry bug traces back to a value sitting in the wrong bucket. `[DERIVED from Mark & Measure 05 §5]`

| Bucket | Values |
|---|---|
| **INVARIANT** — identical at both geometries | body size (10 pt) · baseline unit (15 pt) · spacing scale · line-height *function* · weight steps · all color tokens · bleed (0.125 in) · safe zone · stroke weights · table cell floor (8 pt) · figure settings |
| **VARIABLE** — recomputed per geometry | margins · column count · column width · gutter · heading sizes · line-height *value* · table column budget · image render width · every line break |
| **FORBIDDEN** — never exists | any uniform scale factor · any percentage-of-page value for a print constant · any hardcoded line-height · any manual line break stored in content |

**There is no uniform scale factor between the two pages.** 8.5/5.5 = 1.545 wide; 11/8.5 = 1.294 tall — a 19% aspect mismatch. Scaling the artboard is mathematically impossible without distortion. `[DERIVED]`

---
---

# PART ONE — FOR THE DESIGN WORKSPACE

## 4. Design brief

**Build two things, in this order:**

1. **The output pages.** A Field Guide spread and a Quick Reference sheet, with real content in them, at real measurements. These are the product. Every upstream decision answers to them.
2. **The app interface.** The forms, the preview, the chrome. Medium fidelity is enough — pagination will force revisions.

**Stop at "clearly right in direction."** Anything fine-tuned before the renderer exists will churn.

### 4.1 The governing principle: chrome versus canvas

The app's own aesthetic and the document's brand must be **visibly different systems**. If the app chrome is Ascension green and the document preview is Ascension green, the user cannot tell where the tool ends and their work begins.

Every serious document tool solves this the same way: **quiet, recessive chrome around a bright, high-contrast page.** Word, InDesign, and Figma all do it. The document should look like it's sitting on the app, not made of it.

This is also the ownership argument. The app is built uncommissioned and is intended to serve facilities beyond St. John — and potentially non-Ascension users. Chrome that wears Ascension's brand implicitly claims to be an Ascension product. Neutral chrome keeps the app's identity separate from the brands it serves, which is both the honest framing and the safer one.

## 5. The app's own aesthetic — Timber & Ink, restrained

**Palette roles.** The hex values below are the ones stated for the Field Notes build and should be treated as a **starting point, not canon** — swap in the actual values from the Timber & Ink `colors v2.2` token file before finalizing.

| Role | Use | Working value |
|---|---|---|
| Chrome ground | App background, panels, rails | Deep green-teal, several shades darker than the site's page color |
| Chrome surface | Cards, form fields, raised elements | One step lighter than ground |
| Ink | Primary chrome text | Warm off-white, never pure `#ffffff` |
| Ink muted | Labels, helper text, metadata | Ink at ~65% |
| Accent — amber | **Primary action only.** One per screen. | `#7b6200` family, lifted for contrast on dark |
| Accent — sage | Secondary actions, active states | `#123737` family, lifted |
| Warning | Validation warnings (soft) | `#7b6200` |
| Error | Blocking validation | `#530a28` |
| Canvas | The page itself | Pure white paper, hard-edged, with a real drop shadow |

**Type.** One family for the chrome. It should not be Calibri or Georgia — those belong to the document. A clean, quiet humanist sans with good small sizes; the chrome should recede.

**Restraint rules — these matter.**

- **No paper texture, no engraving, no ornament.** In a clinical setting, decorated reads as hobby project; considered reads as professional. The warmth is the signature and it does not need volume.
- **Amber appears once per screen.** It marks the primary action and nothing else. `[CITED — Mark & Measure 06 §2: "If everything is emphasized, then nothing is emphasized"]`
- **Three visual cues maximum** on any element meant to be read at a glance. `[CITED MM06 §4]`
- **One focal point per screen.** `[CITED MM06 §2]`
- The canvas is the brightest thing on screen at all times. If your eye goes to the chrome first, the chrome is too loud.

**Dark chrome is not a stylistic preference here — it's functional.** It maximizes the contrast step between tool and page, which is exactly what a document builder needs.

## 6. Screen inventory

| # | Screen | Purpose | Notes |
|---|---|---|---|
| 1 | **Intake gate** | Three questions before the builder opens | See §6.1 — this screen has teeth |
| 2 | **Document type picker** | Field Guide / Quick Reference / Huddle Card | Show the page shape at true relative proportion |
| 3 | **Brand kit picker** | Choose a vetted kit | Live swatch + type specimen preview per kit |
| 4 | **Builder** | The main workspace | Two panes: form rail left, live page preview right |
| 5 | **Section library** | Add a section | Drawer or modal; sections grouped by function |
| 6 | **Step editor** | The densest form in the app | See §7.3 — deserves its own design pass |
| 7 | **Screenshot handler** | Upload, crop, annotate, alt text, PHI ack | See §7.6 |
| 8 | **Review & validate** | The rules report before export | Warnings grouped, each with its "why" |
| 9 | **Export** | HTML / PDF / DOCX + large-print variant | |

### 6.1 The intake gate

Three questions before the builder opens, adapted from Mager & Pipe's acid test. `[CITED — Adult Learning 07; evidence grade: weak, practitioner heuristic]`

1. *Could they do this if their life depended on it?* — If yes, it's a job aid. If no, it's a skill gap and a document won't fix it.
2. *How often do they do it?* — Infrequent tasks favor job aids.
3. *How often does it change?* — Volatile tasks favor job aids over training.

Route look-up-able, infrequent, high-consequence, or frequently-changing tasks into the builder. Flag genuine skill gaps as **out of scope for this tool** with a pointer to Clinical Informatics. This is a `WARNING`, never a block — but it's the highest-leverage screen in the app, because it prevents the wrong artifact from being made at all.

### 6.2 Builder layout

- **Left rail:** section list, drag to reorder, add-section button at the bottom. Completion state per section.
- **Right pane:** live page preview at true proportion, page-turn control, and a geometry toggle so the author can see the same content at both trims.
- **Validation is inline and quiet.** Warnings appear next to the field, in warning-amber, with one sentence of *why* — never a modal, never a wall of red.
- **The preview must render body text at ≥16 px on screen.** That means previewing 10 pt print type at roughly 133% zoom. `[CITED — MM01 §8: 16 px is the accessible screen minimum]` Do **not** raise print body size to satisfy a screen rule, and do not let the preview's smallness tempt anyone into shrinking print type.

## 7. The output pages — design these first

### 7.1 Field Guide — 5.5 × 8.5 in

The narrow page is **safe by default**; its risk is the opposite of the letter page's.

| Property | Value | Grade |
|---|---|---|
| Trim | 5.5 × 8.5 in | — |
| Build size w/ bleed | 5.75 × 8.75 in | `[CITED MM10 §5]` |
| Bleed | 0.125 in per edge, absolute | `[CITED]` |
| Safe zone | 0.25 in from trim (conservative) | `[CITED]` |
| Margins | inner 0.625 · outer 0.500 · top 0.500 · bottom 0.708 in | `[DERIVED]` |
| Live area | 4.375 × 7.292 in (315 × 525 pt) | `[DERIVED]` |
| Columns | **1, always** | `[DERIVED]` |
| Measure at 10 pt | **63 characters** ✓ | `[DERIVED]` |
| Live height | exactly 35 baseline units | `[DERIVED]` |

**Margins are mirrored, not symmetric.** Inner must exceed outer by ≥0.125 in — the fold swallows inner space. **The spread, not the page, is the design unit.** `[CITED MM06 §4]`

**Never two-column this page.** Two 2.0 in columns at 9 pt yields 32 characters per line, below the 40-character multi-column floor. `[CITED MM01 §2]`

### 7.2 Quick Reference — 8.5 × 11 in

The wide page **fails by default** and must be actively constrained. This is the single biggest layout risk in the build.

A 10 pt body at 1 in margins, single column, produces **93.6 characters per line** — past the readable maximum of 75 *and* past the WCAG hard ceiling of 80. `[CITED MM01 §2, §8]` It happens automatically if the layout is width-driven.

Two valid fixes:

| Option | Spec | Measure | Use when |
|---|---|---|---|
| **A — one column, wide margins** | sides 1.75 in @ 10 pt | 72 CPL ✓ | Prose-dominant sheets |
| **B — two columns** *(default)* | 1 in margins, 0.25 in gutter, 3.125 in columns | 45 CPL ✓ | Anything with steps or tables |

Option B is the default: step and table content wastes roughly 4 square inches of sheet under Option A.

**Margins are symmetric.** A loose sheet has no spread. This is a structural difference between the blueprints, not a parameter. `[DERIVED from MM06 §4]`

### 7.3 The Step-Action block

The house style specifies a two-column *What to do | Where to click* layout. It survives in exactly **1 of 24** converted documents, so here is the one real specimen, from `PowerChart-Touch-Errors.md`:

| What to do | Where to click |
|---|---|
| 1. Force close the app | Swipe up from the bottom of the screen and pause, then swipe up on PowerChart Touch to close it completely. |
| 3. Locate browser settings | Scroll to and tap **Safari** (or the default browser, e.g., Chrome). |
| 4. Clear cached data | Scroll down and tap **Clear History and Website Data**. |

Observed behavior worth designing to:

- **Numbering lives inside the left cell as literal text.** Two columns, not three.
- **Left cell = intent**, 3–5 words, verb-first, no period, not bold.
- **Right cell = gesture and target**, 8–25 words, full sentence, UI labels bolded. May carry the expected system response.
- **The columns are not literally "what/where."** In practice: left is the goal, right is the mechanics.
- **No screenshots inside cells.** Callouts sit after the table, not as a row.
- **Maximum observed length: 6 rows** — the document starts a new H2 rather than continuing.

**Table design rules** `[CITED — Research Library 12; Few, Schwabish]`:

- Text left-aligned, numbers right/decimal-aligned, headers align to their column's data
- Horizontal rules only — one under the header, one at the foot. **No vertical rules.**
- Whitespace **or** banding for grouping, never both. Band only at ≥6 rows, tint ≤8% ink
- Cell padding: horizontal ≥0.75 em, vertical ≥0.35 em, horizontal must exceed vertical
- Row height = an integer multiple of the 15 pt baseline unit
- Rule weight 0.5 pt, absolute, with a 0.25 pt reproduction floor

**The field-guide table budget is 97 characters across all columns** (4.375 in live width at 9 pt cells). That's four columns at 24 characters, or two at 48. **Design every table to that budget first**, then let it breathe on letter. Minimum column width is 12 characters; if `columns × 12 > live_width`, the table cannot render at that geometry — transpose, split, or stack it. Never shrink type below the 8 pt floor to make it fit. `[DERIVED]`

### 7.4 Callouts

Four types. Design all four; the fourth is currently undocumented but appears in practice.

| Type | Meaning | Ground | Text | Observed |
|---|---|---|---|---|
| **NOTE** | Icon decoding, shortcuts, alternate paths, system behavior. **Never a consequence.** | Medium Blue `#1e69d2` | White — `OK` | 11 docs |
| **IMPORTANT** | A blocker, trap, or consequence. Reliably contains a modal: *can't, must, are mandatory.* | Violet `#b40f87` | White — `OK` | 10 docs |
| **REQUIREMENTS** | Regulatory or mandatory. | Ascension Green `#00a791` | **Black — see below** | 1 doc |
| **TIP** | Optional efficiency. | Gold `#ffb400` *(proposed, not a brand rule)* | Black | 3 docs |

> **Two corrections the design must carry.**
>
> **1. Ascension Green is `#00a791`, not `#00a890`.** The brand PDF's palette page (p.7) gives Pantone 3275 / CMYK 90-0-52-0 / RGB 0-167-145, which converts to `#00A791` exactly. The `00A890` string originates in the PDF's *own* accessibility table on p.8 — a typo that then propagated into the house style. Use `#00a791`.
>
> **2. White text on Ascension Green fails at body size.** The brand PDF's p.8 matrix rates white-on-green as **LRG only** — 14 pt bold / 18 pt minimum. White is `OK` on Blue, Medium Blue, and Violet, but not Green. A REQUIREMENTS callout rendered white-on-green at body size violates Ascension's own accessibility floor. **Use black text on green** (rated `OK` on p.8), or white at large-bold only. This also contradicts the bridge file's quick-reference, which should be corrected.

**Callout rules:**

- The text label is **never optional and cannot be toggled off** — no meaning may be encoded by color alone. Up to ~8% of male readers have color vision deficiency. `[CITED — RL13, WCAG; Simunovic 2010]`
- All callout text clears **4.5:1** contrast against its actual rendered fill. `[CITED — WCAG 2.1 AA]`
- IMPORTANT and REQUIREMENTS text is **exempt from any simplification, truncation, or readability-driven rewrite.** Automated simplification of clinical text omitted 30% of critical information in one study; more readable but inaccurate is worse than no access. `[CITED — Shardlow & Nawaz 2019; Devaraj 2022 — strong]`
- Position: IMPORTANT defaults to nesting directly under the step it guards. NOTE defaults to section level.
- The brand PDF assigns **bold Calibri to callouts** specifically — so the label renders in Calibri Bold.

### 7.5 Type and hierarchy

**Document typefaces** (from the brand PDF, pp.10–12): Chronicle Text G1 and Whitney are primary; the Microsoft Office substitutes are **Georgia** (headlines bold, subheads regular) and **Calibri** (bold for subheads and callouts, regular for body). Calibri 11 is the stated house body. Arial if Calibri is unavailable.

**Concrete print scale**, base 10 pt, rounded to 0.5 pt: `[DERIVED]`

| Level | Field Guide (r=1.2) | Letter (r=1.25) | Line-height |
|---|---|---|---|
| Doc title (cover) | 21 pt | 24.5 pt | 1.05 |
| H1 / page title | 17.5 pt | 19.5 pt | 1.15 |
| H2 / section head | 14.5 pt | 15.5 pt | 1.25 |
| H3 / step label | 12 pt | 12.5 pt | 1.30 |
| **Body** | **10 pt** | **10 pt** | **1.50** |
| Table cell | 9 pt | 9 pt | 1.40 |
| Caption | 8 pt | 8 pt | 1.50 |

**Body size is invariant across geometries. Headings scale.** `[CITED MM01 §4]`

> **⚠ One conflict to settle before building.** The scale above is derived at a **10 pt** base, but the Ascension house style specifies **Calibri 11**. Both fit the measure envelope, so this is a choice, not a constraint:
>
> | Base | Field Guide (4.375 in) | Letter, 2-col (3.125 in) |
> |---|---|---|
> | 10 pt | 63 CPL ✓ | 45 CPL ✓ |
> | **11 pt** | **57 CPL ✓** | **41 CPL** — at the multi-column floor |
>
> **Recommendation: go with 11 pt** and match the house style. It reads better for the audience, it's what every existing document uses, and 57 CPL on the field guide is closer to the 66-character target than 63 is. The cost is that the letter page's two columns land at 41 CPL, one character above the 40-character multi-column floor — tight but legal. If that proves uncomfortable in the mockup, widen the letter page to 0.875 in side margins to buy back room.
>
> If 11 pt is chosen, **rescale everything**: baseline unit becomes 16.5 pt (11 × 1.5), the spacing scale becomes multiples of 8.25 pt, and every value in §11.1 shifts. Settle this before the design pass, not after.

**Ban any ratio above 1.333 on the 5.5 in page.** The library's warning transposes exactly: a scale that "looks incredible at 1440px falls apart at 375px" — the field guide *is* the 375px phone. `[CITED MM01 §4]`

**Hierarchy: 5 levels default, 6 hard ceiling.** Every adjacent pair must differ on **at least two** of size (≥1.2×), weight (≥200 units), space-above (≥1 baseline unit), or case. One differentiator alone reads as an accident. `[DERIVED from MM01 §3]`

**Differentiation levers, in priority order for this app:** space/isolation → weight → size → case → color last and never alone. Size is reordered downward from the library's default because it's the scarcest resource on a 4.375 in measure; space is geometry-independent. `[DERIVED]`

**Vertical rhythm:** baseline unit **15 pt** (10 pt × 1.5), absolute at both geometries. Spacing scale is whole multiples of 7.5 pt only: 7.5 · 15 · 22.5 · 30 · 45 · 60. Space above headings — H3 1.5 units, H2 2 units, H1 3 units; space below always ½ unit, so proximity binds the heading to what follows. `[CITED MM06 §6a — Gestalt proximity, the strong-evidence part of the library]`

**Micro-typography, enforced silently** — the library calls these "the fastest tell of amateur vs. pro." Curly quotes and apostrophes. Three dashes for three jobs: hyphen for compounds, en dash for ranges (July 5–9), em dash for sentence breaks. One space between sentences. Real ellipsis, real prime marks. Ligatures on, discretionary ligatures off in running text. Real small caps or none. Oldstyle proportional figures in body, tabular lining figures in tables. `[CITED MM01 §2]`

### 7.6 Screenshots

**Zero images survive in the converted library** — not one `![]()` across 24 files. What survives are pointers, and one of them is the key finding: two documents carry an identical standing note that *"each step is paired with a screenshot,"* implying a **1:1 step-to-screenshot ratio** — roughly 5–8 images for a mid-length job aid. Re-attaching screenshots is the single biggest gap this app closes.

**No captions, no figure numbering, and no alt text exist anywhere in the library.** All three are net new.

Design requirements:

- **A screenshot is an optional slot on the step object**, not a document-level gallery.
- **Callout labels render on the image at the anchor point.** No numbered legend, no separate key. This is the most defensible layout constraint in the spec — split-attention meta-analytic g ≈ 0.63–0.72. `[CITED — Schroeder & Cenkci 2018; Ginns 2006 — strong]`
- **A step and its screenshot may never straddle a page or fold.** Keep-together is enforced. `[CITED — same, strong]`
- **Maximum 4 callouts per screenshot.** `[CITED — Cowan's ~4-chunk limit]`
- Callout arrows and boxes clear **3:1 contrast against the pixels beneath them** — sample the actual underlying region, not an assumed background. `[CITED — WCAG non-text contrast]`
- House style specifies **violet arrows and boxes** — the same `#b40f87` as IMPORTANT.
- Crops must retain surrounding UI context so the reader can locate themselves.
- **Crop tighter for the field guide; never scale the letter crop down.** A capture placed at 6.5 in on letter and reused at 4.375 in has its own embedded UI text scaled to 67% — 9 pt UI text prints at 6 pt and becomes unreadable. `[DERIVED from MM10 §1]`
- Assets at **300 PPI at final printed size** — ≥1950 px for a full-measure letter image. `[CITED MM10 §5]`

### 7.7 What breaks between the two geometries

Design against these explicitly. The full failure list is in §11; these are the ones that show up visually and should be tested in the mockup:

1. **Measure blowout on letter** — 93.6 CPL at defaults. The #1 risk.
2. **Every line break is regenerated.** Reflowing 63 → 45 CPL changes 100% of line breaks. Hand-fixed rag from one geometry is noise in the other.
3. **Hierarchy compresses on the narrow page.** At ratio 1.2, adjacent levels differ by ~2 pt — not a legible break on its own at 4.375 in. Shift weight to space and weight.
4. **Content-per-page shifts.** Field guide live area is 31.9 in² against letter's 58.2 in² — it holds ~55%. One letter page becomes ~1.8 field guide pages, stranding headings and final lines.
5. **Two focal points arrive on one field-guide page by accident** during reflow.

> **A finding against the existing artifact.** The current field guide build (recorded in `Inpatient-Field-Guide-Page11-ClinicalCollab.md`) uses a 338.4 pt content width: body at 9 pt gives **75 CPL** — exactly at the ceiling — and table text at 8.3 pt gives **82 CPL**, which is **over the WCAG 80-character maximum**. If the builder inherits those tokens, it ships a known violation on day one. Narrow the content width to ~310 pt, or raise the table size.

## 8. Design deliverables checklist

- [ ] Field Guide spread — facing pages, mirrored margins, real content, at 5.5 × 8.5
- [ ] Field Guide page with a step-action table at the 97-character budget
- [ ] Field Guide page with a step + screenshot + callout, showing keep-together
- [ ] Quick Reference sheet, two-column, at 8.5 × 11
- [ ] Quick Reference sheet, one-column prose variant
- [ ] Huddle Card — the three-part spine
- [ ] All four callout types at both geometries, with the black-on-green correction
- [ ] Type specimen showing all six levels at both geometries
- [ ] App chrome: builder screen, both panes
- [ ] App chrome: step editor
- [ ] App chrome: review & validate screen
- [ ] Brand kit picker showing the swatch/specimen preview

---
---

# PART TWO — FOR CLAUDE CODE

## 9. The content data model

Content is JSON. It is never markup, never HTML, never markdown. Every emitter reads this and nothing else.

```json
{
  "schema_version": "1.0",
  "document": {
    "blueprint": "field_guide | quick_reference | huddle_card",
    "brand_kit_id": "ascension-baseline-v1",
    "title": "Ordering PowerPlans / Add to Phase",
    "meta": {
      "audience": ["physicians"],
      "systems": ["cerner_powerchart"],
      "system_version": "2018.01",
      "domain": "P1048",
      "effective_date": "2026-09-01",
      "owner": "joshua.davis@ascension.org",
      "last_reviewed": "2026-09-01",
      "version": "1.0",
      "needs_verification": []
    },
    "sections": [ /* ordered array of section objects */ ],
    "change_log": [
      { "version": "1.0", "date": "2026-09-01", "author": "…", "summary": "Initial release" }
    ]
  }
}
```

### 9.1 Controlled vocabularies — this is where the app earns its keep

The library's inconsistency is almost entirely a free-text problem. Every field below becomes a **select**, not an input.

**`audience`** — replaces 15 uncontrolled strings. Multi-select:
`physicians` · `providers` (incl. APRN/PA) · `ed_providers` · `nurses` · `case_management` · `scribes` · `all_clinical_staff` · `all_associates`

**`systems`** — replaces 7 spellings plus 3 label variants (`System:` / `Network:` / `Apps:` / `Type:`). Multi-select, tiered by the environment:
Tier 1 — `cerner_powerchart` · `cerner_firstnet` · `perfectserve`
Tier 2 — `dragon_dmo` · `imprivata_id` · `imprivata_confirm_id` · `lightning_bolt` · `wellsheet`
Tier 3 — `servicenow` · `citrix_workspace` · `google_workspace`
Other — `network` · `mobile_device` · `none`

**`effective_date`** — one field, one label, replacing six. A real date, never a string like `current`. The form offers a semantic sub-label (Published / Go-live / Revision) that changes the *display* text without changing the field.

**`system_version`** — defaults to `2018.01`, stamped into the footer automatically. Procedures drift with builds, so the document must say which build it describes.

**`needs_verification`** — an array of section IDs the author flagged as unconfirmed. Renders as a build-time warning and a visible marker in draft output only. Two documents in the library carry unresolved content flags in prose; this makes them structural.

### 9.2 Section objects

```json
{ "type": "overview", "id": "s1", "body": "…", "benefits": ["…"] }

{ "type": "prerequisites", "id": "s2", "items": ["…"] }

{ "type": "scope_note", "id": "s3", "body": "…" }

{ "type": "procedure", "id": "s4",
  "heading": "Ordering a PowerPlan",
  "numbering": "restart | continue",
  "render_as": "table | list",
  "steps": [ /* step objects */ ] }

{ "type": "callout", "id": "s5",
  "level": "note | important | requirements | tip",
  "body": "…",
  "attached_to": "step_id | section_id | null" }

{ "type": "subsection_lead", "id": "s6", "text": "To customize before saving:" }

{ "type": "options_list", "id": "s7",
  "items": [ { "label": "Plan for Later", "description": "…" } ] }

{ "type": "reference_table", "id": "s8",
  "columns": ["Trigger", "Description"], "rows": [["…","…"]] }

{ "type": "completion_criteria", "id": "s9",
  "status_label": "Admission reconciliation status — Complete",
  "conditions": ["…"] }

{ "type": "troubleshooting", "id": "s10",
  "items": [ { "symptom": "…", "cause": "…", "fix": "…" } ] }

{ "type": "resources", "id": "s11",
  "items": [ { "label": "…", "url": "…", "kind": "video|doc|link", "duration": "3:30" } ] }

{ "type": "exception", "id": "s12", "heading": "APRNs & PAs — Schedule II", "body": "…" }

{ "type": "support", "id": "s13", "preset": "hospital | amg | both | custom" }
```

**The support block is a preset, not free text.** Three shapes appear in the library; four documents omit it entirely. Presets:

- `hospital` — Clinical Informatics — Hospital: ClinicalInformaticsHospitals@sjmc.org · 918-744-3088 (Mon–Fri)
- `amg` — AMG Clinic: OKTUL-DL-SJCAmbulatoryClinicalInformatics@ascension.org
- `both` — default

> Note: email capitalization is inconsistent across the library (`ClinicalInformaticshospitals@` vs `ClinicalInformaticsHospitals@`). The preset settles it. Confirm the canonical casing before shipping.

### 9.3 The step object

```json
{
  "id": "st1",
  "number": 1,
  "intent": "Locate browser settings",
  "action": "Scroll to and tap [[Safari]] (or the default browser, e.g., Chrome).",
  "system_response": "It should prompt for a fresh Microsoft login.",
  "path": ["Settings", "Wi-Fi", "the blue i", "Limit IP Address Tracking"],
  "substeps": [
    { "kind": "branch | option | gloss", "text": "…" }
  ],
  "screenshot": { "asset_id": "…", "alt": "…", "caption": "…", "callouts": [] },
  "callouts": [ /* inline callout objects */ ]
}
```

**Field notes:**

- **`intent`** is the left cell of the step-action table: 3–5 words, verb-first, no period, not bold. **`action`** is the right cell: 8–25 words, full sentence, terminal period.
- **`[[Double brackets]]` mark UI targets** and render as bold. This is the one piece of inline markup in the model, and it exists because the convention is completely consistent across the library: *bold means anything the user clicks or reads on screen* — buttons, tabs, fields, menu items, statuses. Never the verb, never a general noun.
- **Backticks mark literal strings the user types** — `domain\username`, `%CSROSALL`, a URL path. Also consistent across the library.
- **`path` is its own field type**, rendering as an arrow chain: `Settings → Wi-Fi → the blue "i" → Limit IP Address Tracking`. Authors reach for this constantly whenever a step would otherwise become four steps. Give it a real input rather than making them type arrows.
- **`system_response` is declarative present, never future.** "Matching notifications appear," not "will appear." The library is consistent on this.
- **Substeps go one level deep only.** Nothing in the library goes three deep. Four payloads observed: branch, option enumeration, gloss/definition, and callout.
- **Verbatim system messages render in italics inside quotes** and are never paraphrased. Error strings should be usable as headings, since users search on the error text.

### 9.4 Voice defaults for placeholder text

Steps are **imperative, present tense, second person implied and never stated.** Verb-first, no "Please," no "You will now." Observed verb set: Select, Click, Choose, Go to, Search for, Enter, Type, Complete, Tap, Open, Right-click, Double-click, Toggle, Refresh, Navigate to, Add, Verify, Drag and drop, Check, Scroll.

Real examples for placeholders:

- `Select the [[Orders]] or [[Medication List]] tab from the Menu.`
- `When complete, click [[Reconcile and Sign]] (bottom-right).`
- `In the [[Orders]] window, search for the plan as you would any orderable.`
- `Right-click the order → [[Refuse]].`
- `Refresh via the chasing-arrows icon (top-right of the Orders screen).`

Prose sections use contractions freely — *it's, won't, can't, you'll* — matching the voice guide. Steps rarely need them.

**Jargon gets a parenthetical gloss on first use.** The library does this well already: "HIM Refusal Inbox (HIM = Health Information Management, the medical-records department)"; "door-to-doc time (the interval from patient arrival to first provider evaluation)"; "TJC (The Joint Commission)."

## 10. The Brand Kit file format

A single HTML file. It is simultaneously (a) a machine-readable token set, (b) the CSS that renders documents, and (c) a live specimen page that opens in any browser.

**The app parses the JSON block. It never parses arbitrary HTML.**

```html
<!doctype html>
<meta charset="utf-8">
<title>Ascension Baseline — Brand Kit v1</title>

<script type="application/json" id="brand-kit">
{
  "kit_version": "1.0",
  "id": "ascension-baseline-v1",
  "name": "Ascension Baseline",
  "org": "Ascension",
  "source": "Ascension Digital Brand Guidelines, Nov 2022",

  "color": {
    "green":       { "hex": "#00a791", "pantone": "3275", "cmyk": [90,0,52,0],
                     "text_on": "black", "white_ok": "large_only" },
    "blue":        { "hex": "#1e69d2", "text_on": "white" },
    "violet":      { "hex": "#b40f87", "text_on": "white" },
    "gold":        { "hex": "#ffb400", "text_on": "black", "status": "proposed" },
    "ink":         { "hex": "#231f20" },
    "paper":       { "hex": "#ffffff" }
  },

  "type": {
    "serif":  { "primary": "Chronicle Text G1", "office": "Georgia",
                "web": "Frank Ruhl Libre", "use": "headlines" },
    "sans":   { "primary": "Whitney", "office": "Calibri",
                "web": "Roboto", "fallback": "Arial", "use": "body, callouts" },
    "body_family": "sans",
    "body_size_pt": 10,
    "scale_ratio": { "field_guide": 1.2, "quick_reference": 1.25 },
    "min_size_pt": 7.5
  },

  "callouts": [
    { "key": "note",         "label": "NOTE",         "color": "blue",   "text": "white" },
    { "key": "important",    "label": "IMPORTANT",    "color": "violet", "text": "white" },
    { "key": "requirements", "label": "REQUIREMENTS", "color": "green",  "text": "black" },
    { "key": "tip",          "label": "TIP",          "color": "gold",   "text": "black" }
  ],

  "blueprints": ["field_guide", "quick_reference", "huddle_card"],
  "sections_enabled": null,
  "support_presets": { "…": "…" },
  "footer_template": "Source: {org_unit}, {org} (internal job aid).",
  "assets": { "logo": null, "wordmark": null }
}
</script>

<style>
  /* Document CSS. Consumes the tokens above as custom properties.
     Must be complete and self-contained — no external references. */
</style>

<!-- Below: a rendered swatch grid and type specimen.
     This is what makes the kit file self-documenting when opened directly. -->
```

**Rules:**

- `assets` values are **data URIs or null**. A kit file must be fully self-contained.
- `sections_enabled: null` means all sections. A kit may restrict the set — an ED kit and an ambulatory kit can expose different sections without any app change.
- The kit declares its `white_ok` per color so the renderer can enforce contrast without hardcoding brand knowledge. Ascension Green's `large_only` is what prevents the white-on-green failure.
- **Validate on load:** every color parses, every contrast pair clears 4.5:1 at body size (or is marked `large_only`), every declared blueprint is one the app knows, `kit_version` is supported.
- **A kit that fails validation does not load.** It reports which token failed and why.

**Kits ship with the app** (v1 decision — users select, they don't upload). Upload can open later; the format is designed for it. Ship at minimum: `ascension-baseline-v1`, and an `unbranded-v1` neutral kit for testing and non-Ascension use.

## 11. The geometry engine

### 11.1 Constants

*Values below assume a 10 pt base. **If the 11 pt house-style option in §7.5 is chosen, every value here shifts** — baseline unit 16.5 pt, spacing scale in multiples of 8.25 pt. Settle that first.*

```
BASELINE_UNIT   = 15 pt        (10 pt body × 1.5)   INVARIANT
HALF_UNIT       = 7.5 pt                            INVARIANT
SPACING_SCALE   = [7.5, 15, 22.5, 30, 45, 60] pt    INVARIANT
BODY_SIZE       = 10 pt                             INVARIANT
BODY_MIN        = 10 pt (hard floor)                INVARIANT
TABLE_CELL_MIN  = 8 pt (hard floor)                 INVARIANT
BLEED           = 0.125 in per edge, absolute       INVARIANT
SAFE_ZONE       = 0.25 in from trim                 INVARIANT
STROKE_FLOOR    = 0.25 pt                           INVARIANT
CPL_TARGET      = 66
CPL_RANGE       = 45–75 (single column)
CPL_MULTICOL    = 40–50
CPL_HARD_MAX    = 80  (WCAG SC 1.4.8)
```

### 11.2 Measure

Measure the actual string — render 66 characters of the real font at the real size and take the advance width. Do not use a constant.

Fallback when measurement isn't available: `CPL ≈ column_width_pt / (0.5 × size_pt)` for humanist text faces. `[DERIVED]`

**Column-count decision function:** `[DERIVED from MM01 §2]`

```
if live_width_ch <= 75:
    columns = 1
else:
    find smallest n >= 2 where (live_width - (n-1)*gutter)/n lands in 40–50 ch
    if none qualifies:
        widen margins first, then increase body size
        never ship a column above 75 ch
```

Practical trigger: at 10 pt, a single column crosses 75 CPL at **5.21 in**. At 11 pt, at **5.73 in**.

### 11.3 Leading

Line-height is a **function of measure**, never a constant. This is what makes one system serve both geometries: `[DERIVED from MM01 §2]`

```
lh = clamp(1.35, 1.35 + (CPL - 40) / 120, 1.60)
```

Yields 1.39 at 45 CPL (two-column letter), 1.57 at 66, 1.60 at 75. The narrow field guide's longer measure automatically gets more leading than the letter page's tighter columns — which is correct, and which a hardcoded value gets wrong every time.

Add **+0.05** for sans body faces. Captions and small text get **looser** leading, never tighter — caption line-height ≥ body's.

**Body must not be justified at either geometry.** WCAG SC 1.4.8; uneven word spacing and rivers hurt dyslexic and low-vision readers. Flush left, both outputs. `[CITED MM01 §2, §8]`

### 11.4 Vertical grid

Body line boxes sit **on** the 15 pt grid. Every other element's total block height (line-height plus margins) rounds up to the nearest 7.5 pt, so the next body block re-enters the grid. Do not fight to snap every element's own line-height.

**Choose top and bottom margins so live height is an exact integer multiple of the baseline unit at both geometries** — 35 units on the field guide, 43 on letter. This single constraint is what makes the vertical grid survive the geometry switch. `[DERIVED from MM06 §1]`

**Widow/orphan control: minimum 2 lines** at both ends of any break. Headings bind to ≥2 following lines. Re-run per geometry — reflow invalidates every previous decision.

**Never store manual line breaks in content.** Rag fixes, discretionary breaks, and tracking nudges live in a per-geometry override layer, because 100% of them are invalid at the other geometry.

## 12. The rules engine

Three enforcement levels:

- **HARD** — the renderer enforces silently. No user-facing choice.
- **WARNING** — the form nudges; the user may proceed. Shows one sentence of *why*.
- **DEFAULT** — the app's starting value; the user may change it.

> **A caution to carry into implementation.** Many of the effect sizes behind these rules come from Mayer's own laboratory box scores, and independent estimates are consistently smaller — one analysis of ~800 meta-analyses found an average d ≈ .40 against d ≈ .06 for pre-registered large RCTs. **Treat every Mayer-derived number as an upper bound.** The rules with genuinely strong independent support are marked below. Build those to hold; hold the rest lightly, and make WARNINGs easy to dismiss.

### 12.1 HARD — renderer enforces

| Rule | Source |
|---|---|
| A step and its screenshot may never straddle a page or fold. Splits only at sub-heading boundaries. | **Strong** — split attention, g ≈ 0.63–0.72 |
| Callout labels render on the image at the anchor point; no separate legend. | **Strong** — spatial contiguity |
| All text ≥4.5:1 contrast; large text ≥3:1 — against the actual rendered background including callout fills. | **Consensus/legal** — WCAG 2.1 AA |
| No meaning by color alone. Callout text labels cannot be disabled. | **Consensus/legal**; CVD ~8% of males |
| Alt text required on every image; export blocked without it. | **Consensus/legal** |
| Callout arrows clear 3:1 against sampled underlying pixels. | **Consensus/legal** |
| IMPORTANT and REQUIREMENTS text exempt from all simplification or truncation. | **Good** — Shardlow 2019; Devaraj 2022 |
| Body size floor 10 pt. The fit-to-page engine may never go below it. | House + accessibility |
| Table cell floor 8 pt. | Derived |
| Semantic heading tags; no skipped levels. | WCAG |
| Store caps as normal case + `text-transform`, never literal caps. | Screen readers spell literal caps letter by letter |
| Nothing renders above Purpose. | BLUF / plain language |
| Prerequisites render above step 1. | Pre-training |
| Acronyms expanded on first use; export blocks on an unexpanded term. | **Good** — plain language |
| Retrieval questions cannot be saved without an answer. | **Strong** — feedback nearly doubles the effect (g 0.73 vs 0.39) |
| Change log with version and date required; system version stamped in footer. | House |
| Tagged PDF export: title, language, semantic tags, reading order matching visual order. | **Consensus/legal** |
| Tables: numbers right-aligned, text left, no vertical rules, whitespace **or** banding never both. | Craft — safe as a silent default |
| Tabular lining figures in numeric columns (`font-variant-numeric`, not `font-feature-settings`). | MM01 §6 |
| Micro-typography (§7.5) applied automatically. | MM01 §2 |
| Ban ratios above 1.333 on the 5.5 in geometry. | MM01 §4 |
| Every adjacent hierarchy level differs on ≥2 of size/weight/space/case. | Derived |
| One level-1 element per page. | MM06 §2 |
| Bleed, safe zone, and stroke weights are absolute — never percentages. | MM10 §5 |

### 12.2 WARNING — nudge, allow override

| Rule | Threshold | Evidence |
|---|---|---|
| Step-action table too long | >7 rows without a break; default chunk = 4 | **Strong** for the capacity limit |
| More than one goal per guide | prompt to split | Moderate |
| Caption duplicates adjacent step text | high token overlap | Moderate–strong for verbatim harm |
| Callout inflation | >4 callouts per screenshot | Derived from the ~4-chunk limit |
| Sentence or paragraph too long | >25 words / >4 sentences | **Good** for plain language |
| Passive voice in step text | any | **Good** |
| Step doesn't open with an imperative verb | fuzzy openers: know, understand, be aware | Weak — practitioner heuristic |
| Title is a bare noun phrase | not verb-first | Weak |
| Non-step content exceeds 25% of body words | boilerplate creep | **Contested** — relax first under pushback |
| Decorative image in a field guide | function tag = decorative | **Contested** |
| Emphasis inflation | bolded runs >10% of a step block | Weakest of the signaling set |
| Readability above grade 8 | SMOG | **Weak and explicitly gameable** — see below |
| Reader test not recorded | 3–5 representative users | Library calls this the single highest-value step |
| Intake gate: task looks like a skill gap | not a job aid | Weak but high-leverage |
| More than 3 consecutive pages above 85% text fill | pacing | Craft |

> **One rule to be careful with.** The readability warning is the weakest and most gameable in the set. Score-gaming produces choppier text with *no* comprehension gain, and automated simplification of clinical text has been shown to drop critical information. **Never auto-rewrite to lower a score, and never gate export on it.** If this is ever hardened into a publish gate, the app will have reproduced the exact failure the source library spends its longest passage warning about.

### 12.3 DEFAULT — starting values

| Setting | Default |
|---|---|
| Chunk size in the step form | 4 steps |
| Second person, conversational register | on |
| "Key terms" block when 3+ new UI objects appear | on, removable |
| Scaffolded variant (vs. quick-reference variant) | scaffolded — see §12.4 |
| "Check yourself" retrieval block, 2–3 questions | on |
| Large-print variant generated on export | on |
| Spaced follow-up reminders | 1 day / 1 week / 1 month |
| Interleaving procedures within one guide | **off** — most over-generalized finding in the set |
| Organizing scheme for multi-topic guides | author picks one of Location/Alphabet/Time/Category/Hierarchy |
| Step numbering | restart per section |

> **On step numbering:** the library splits. Four documents restart per section; two run continuous (PowerPlans 1–20, Message Center 1–22) — and those two are the longest procedures, which is exactly where restarting would help most. Default to restart; expose the toggle.

### 12.4 The two-variant architecture

**This is the strongest evidence-backed finding in the entire research set, and it should shape the product, not just a setting.**

Expertise reversal: high-assistance materials help novices (d = 0.505) and actively *harm* experts (d = −0.428). Tetzlaff et al. 2025 — 60 studies, 176 effect sizes, 5,924 participants. `[CITED — strong]`

So: **one form submission produces two documents.**

- **Scaffolded** (novice) — full pre-training block, explanatory prose, rationale, screenshot per step.
- **Quick reference** (expert) — pre-training block stripped, prose and rationale removed, screenshots reduced to icon-plus-terse-text, clean tables.

An **audience selector at intake** picks the default. When audience is ambiguous, **default to scaffolded** — the research shows withholding help from an expert costs less than withholding it from a novice.

This also gives the app a genuinely useful answer to "we need a one-pager version of the field guide": it already has one.

## 13. Emitters

One content model, three outputs.

### 13.1 HTML — the spine

Single self-contained file. Print CSS via CSS Paged Media. Inline everything: CSS, fonts as base64 WOFF2, images as data URIs. This is the format that drops straight into Let It Book for booklet imposition, and it's the canonical output — the other two derive from it.

### 13.2 PDF

Print the HTML. Do **not** build a second layout engine.

Export as **PDF/X with fonts embedded**, tagged for accessibility, with reading order matching visual order — callouts emitted adjacent to their anchor, never appended at the end. Preflight before delivery.

Print color is **CMYK**; the preview is sRGB. Define print tints in CMYK and soft-proof. Uncoated stock prints tints heavier through dot gain, so an 8% table band that reads correctly on screen can print as a competing gray.

### 13.3 DOCX

Ship last. Frame it in the UI as *an editable copy*, not the deliverable — the moment the file opens in Word, brand fidelity is out of the app's hands. Map sections to Word styles rather than direct formatting, so a user's edits inherit rather than fight the design.

### 13.4 Large-print variant

Generated from the same source on every export: ≥1.4× body size, reflowed, single column. `[CITED — curb-cut effect]`

Note a real conflict here: the British Dyslexia Association's 2023 print guidance calls for **12–14 pt body**, against the 9–11 pt reference-document norm. If a document is patient-facing or accessibility-priority, 12 pt is the floor — which forces the letter page to two columns and the field guide to ~52 CPL. **Build the geometry so a 12 pt large-print variant is a token swap, not a redesign.**

## 14. Screenshots and PHI

**The app is entirely client-side. No image is ever uploaded to a server.** That is the claim that lets this be used at Ascension without a security review, and it should be stated plainly in the UI at the moment of upload — not buried in a terms page.

Pipeline:

1. User drops an image into a step's screenshot slot.
2. **PHI acknowledgment appears at the drop point.** One sentence, requires an explicit confirm: the image contains no patient information.
3. Crop tool, with the "retain surrounding context" rule surfaced as guidance.
4. Annotation: violet boxes and arrows, labels placed on the image, maximum 4, contrast sampled against the pixels beneath.
5. Alt text — **required**, export blocked without it.
6. Caption — optional, warned if it duplicates the step text.
7. Stored at 300 PPI at the largest render width; downsampled for preview, never the reverse.

**Crop separately per geometry when a document targets both.** Scaling a letter crop down to 4.375 in shrinks the screenshot's own embedded UI text to 67% — 9 pt UI text prints at 6 pt.

---
---

## 15. Build order

1. **Content model and section types.** The real intellectual work. Everything else is downstream.
2. **Brand Kit format**, plus the `ascension-baseline-v1` and `unbranded-v1` kits, plus the validator.
3. **HTML renderer at both geometries.** The hard part. Prove pagination before building anything on top of it.
4. **Screenshot pipeline**, built with the renderer rather than bolted on — keep-together and annotation are layout concerns.
5. **PDF export.** Nearly free once step 3 holds.
6. **The form UI.** Now that you know what the renderer needs.
7. **The rules engine**, HARD constraints first, then WARNINGs.
8. **DOCX emitter.**
9. Huddle Card blueprint, large-print variant, retrieval blocks.

## 16. Open questions and things to verify

**Verify before building:**

- [ ] Canonical casing of `ClinicalInformaticsHospitals@sjmc.org` — the library disagrees with itself.
- [ ] Whether TIP is an approved callout type and what color it carries. The bridge file proposes gold `#ffb400` and explicitly flags it as a proposal, not a brand rule.
- [ ] Whether the bridge file's white-on-green guidance should be corrected — it contradicts p.8 of the brand PDF.
- [ ] Saddle-stitch creep allowance for the field guide. **The design library has no binding or folded-signature guidance at all** — this is a real gap. The printer's spec governs; the working default (negligible below ~5 folded sheets, then shave `0.5 × caliper × sheet_index` from the outer margin) is `[GAP]` and unsourced.
- [ ] The existing field guide's 82 CPL table violation (§7.7) — decide whether to narrow content width or raise table size before those tokens get inherited.

**Assumptions flagged:**

- The 24 job aids reviewed are **markdown conversions of original PDFs**, with screenshots and formatting stripped by design. Calibri 11, the callout colors, and most Step-Action tables are therefore **not directly observable** — the section frequencies are reliable, but visual details are reconstructed from the stated house style plus one surviving table specimen. Reviewing 2–3 original PDFs would firm this up considerably.
- Every margin number in §7 is **derived from the measure constraint**, because the design library carries no numeric margin canon — no Van de Graaf, no Tschichold, no page-proportion system. This is the largest sourcing gap in the spec and worth closing in the library itself.
- The app is assumed to be **client-side only, no accounts, no server storage** — following the Let It Book precedent. If that changes, the PHI posture in §14 has to be rewritten.

**Deferred to later versions:**

- User-uploaded brand kits (format is ready; the governance isn't)
- Multi-author editing and document ownership handoff
- A ServiceNow KB export path
- Pulling existing job aids in as a starting point rather than authoring from blank

---

*Sources: the project's Ascension job aid library (24 documents) and `00_Job-Aids-Index.md`; `asce_digital_guidelines.pdf` (Ascension Digital Brand Guidelines, Nov 2022); `Clinical-Bridge_Library-Brand-Voice.md`; the Adult Learning research library, phases 05, 06, 07, 12, 13; the Mark & Measure design library, phases 01, 05, 06, 10, 11.*
