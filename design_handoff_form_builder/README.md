# Handoff: Form Builder

An application that assembles on-brand, print-ready field guides, quick reference sheets and huddle cards from filled-out forms. Written for Clinical Informatics at Ascension St. John, and built so it can serve other facilities — including non-Ascension ones — without a code change.

The premise: **content is data, brand is a swappable file, and the research is baked into the renderer.** The author supplies only what they know — the procedure. Everything else is the app's job.

---

## Read these in this order

1. **`spec/Form-Builder-Build-Spec.md`** — the original build specification. Part Zero (§1–§3) and Part Two (§9–§14) are the implementation brief.
2. **`spec/Form-Builder-Spec-Deltas.md`** — **read this second and treat it as authoritative.** Six passes of design work changed about a dozen things in the spec. Where the two disagree, the deltas file wins. Nine of those changes will break a build if missed; they are listed at the top of that file.
3. **`design/Form-Builder-Design-Passes-standalone.html`** — every screen and every print page, at true size, with the geometry annotated. Open it in a browser.

If you read only one thing before writing code, read the "short version" list at the top of the deltas file.

---

## About the design files

The files in `design/` are **design references created in HTML** — prototypes showing intended look, measurements and behavior. They are **not production code to copy**.

The task is to recreate these designs in a real codebase using its own patterns and libraries. No codebase exists yet, so the framework choice is open. Two constraints on that choice, both from the spec rather than preference:

- **The app is entirely client-side.** No accounts, no server storage, no image ever uploaded. That claim is what lets this be used at Ascension without a security review, and it is stated to the user at the moment they drop in a screenshot. If the architecture changes, §14 of the spec has to be rewritten and the promise on the first screen with it.
- **The canonical output is a single self-contained HTML file** with print CSS via CSS Paged Media, fonts and images inlined. PDF is produced by printing that HTML — do not build a second layout engine. See §13.

`design/Form-Builder-Design-Passes-standalone.html` is self-contained and opens offline. `design/Form Builder - Design Passes.dc.html` is the editable source; it needs the design-workspace runtime and will not render standalone.

## Fidelity

**High fidelity for the print output. Medium-to-high for the app screens.**

- **Print pages** — exact. Every margin, column width, leading value, baseline unit and character count is measured and stated, and the numbers are load-bearing: they are what make one content model serve two page sizes. Build these to the numbers in the deltas file, not by eye.
- **App screens** — the layout, copy, hierarchy and interaction model are settled and should be followed closely. Exact pixel values in the chrome are less critical than the rules they express: one primary action per screen, warnings as declinable offers, no jargon, nothing below the fold that the screen exists to do.

---

## The three layers

Keeping these separate is the whole design. Collapse any two and the app stops being portable.

| Layer | What it is | Who owns it |
|---|---|---|
| **Brand Kit** | An HTML file carrying design tokens + CSS. Dropped in by the user. | The facility |
| **Blueprint** | A document type with a page geometry | The app knows three |
| **Content** | Structured JSON. Never markup, never HTML, never markdown. | The author |

The renderer marries `content + blueprint + brand kit` at output time. That is why a new facility needs a new kit file and nothing else.

---

## Content model

Per §9 of the spec, **as amended by the deltas file**. The amendment is significant: the spec's twenty named section types collapse to one shape with five variants.

```json
{
  "schema_version": "1.0",
  "document": {
    "blueprint": "field_guide | quick_reference | huddle_card",
    "brand_kit_id": "ascension-baseline-v1",
    "title": "Ordering and tracking outpatient referrals",
    "meta": {
      "audience": ["providers"],
      "systems": ["cerner_powerchart"],
      "system_version": "2018.01",
      "effective_date": "2026-09-01",
      "owner": "…",
      "last_reviewed": "2026-09-01",
      "version": "1.0",
      "needs_verification": []
    },
    "sections": [
      { "id": "s1", "title": "Why we changed this", "shape": "paragraph",
        "content": { "body": "…" }, "register": "both" }
    ],
    "change_log": [
      { "version": "1.0", "date": "2026-09-01", "author": "…", "summary": "Initial release" }
    ]
  }
}
```

**Five shapes, and that is the entire vocabulary:** `steps` · `paragraph` · `table` · `callout` · `figure`.

- `title` is **author-written free text.** The app never supplies section names.
- `register` is `both` | `scaffolded` | `expert`, default `both`. It is what makes the two-variant architecture one filter instead of two templates.
- `callout` carries a `level` of `note` | `important` | `requirements` | `tip`, chosen through a plain-language question — those four words never appear in the UI while writing.
- The document **shell** is app-owned and is not an author section: title block, metadata, change log, source footer.

**Metadata stays controlled.** `audience`, `systems`, `effective_date` and `system_version` are pick-lists, not free text. This is the single highest-value thing the app does: the existing library has fifteen uncontrolled strings meaning roughly four audiences, and six different labels for the date field. See §9.1.

**Step objects** are unchanged from §9.3, with two surfacing rules: `[[double brackets]]` never appear in the UI (the author types a control's name plainly and the editor marks it), and the huddle card uses a different bold rule entirely — dates, statuses, URLs and credentials, never a UI control.

---

## Geometry

**The numbers below are the product.** They are derived from one constraint — the readable measure — and every one of them is measured rather than estimated. Full derivation in the deltas file, §7 and §11.

| | Field guide | Letter, 2 column | Letter, prose | Huddle card |
|---|---|---|---|---|
| Trim | 5.5 × 8.5 in | 8.5 × 11 in | 8.5 × 11 in | 8.5 × 11 in |
| Margins | inner .625 · outer .500 · top .500 · bottom .896, **mirrored** | .75 sides & top · .844 bottom, symmetric | .75 sides & top · .717 bottom | .75 sides & top · .710 bottom |
| Columns | 1, always | 2 × 3.0625 in, **0.875 in gutter** | 4.5 in + 2.25 in rail, .25 gutter | 1, capped at 5.25 in |
| Body | 11 pt | 11 pt | 11 pt | **16 pt** |
| Measure | 71 CPL | 49 CPL | 59 CPL | 58 CPL |
| Leading | 1.50 | 1.43 | 1.56 | 1.59 |
| Baseline unit | 16.5 pt | 15.75 pt | 17.16 pt | 25.44 pt |
| Live height | 31 units | 37 units (page 1) · 43 (continuation) | 40 units | 27 units |

**Four rules that are easy to get wrong:**

1. **The baseline unit is per geometry, not one constant.** §11.1 lists 15 pt as INVARIANT; that cannot hold once leading is a function of measure. The invariant is the rule — live height is an exact integer multiple of *its own* unit — not the number.
2. **Measure the string; never use a constant.** §11.2's fallback of `0.5 × size_pt` overstates Calibri by about 24%. Measured average advance is **0.405 em**. Render the real characters in the real face at the real size and take the advance width.
3. **There is no uniform scale factor between the page sizes.** 8.5/5.5 = 1.545 wide against 11/8.5 = 1.294 tall — a 19% aspect mismatch. Body size is invariant, headings scale, and **every line break is regenerated.** Never store a manual line break in content.
4. **Body is never justified**, at any geometry. WCAG SC 1.4.8.

**Multi-page.** The letter sheet flows to as many pages as the content needs. Page 1 carries the color-field header; continuation pages replace it with a one-line running head, which is why they have a different live height. A section that breaks across pages repeats its own title with *continued* in italic, and step numbering continues.

**Bleed 0.125 in, safe zone 0.25 in from trim, stroke floor 0.25 pt — all absolute, never percentages.**

---

## Brand Kit format

A single HTML file that is simultaneously a machine-readable token set, the CSS that renders documents, and a live specimen page that opens in any browser. **The app parses the JSON block in `<script type="application/json" id="brand-kit">` and never parses arbitrary HTML.**

Two working kits are in `brand-kits/`:

- **`ascension-baseline-v1.html`** — palette with Pantone and CMYK read from the guidelines PDF, measured contrast per pairing, `white_ok` flags, four callout levels, the enterprise Ascension horizontal lockup and emblem embedded as data URIs, clear-space and minimum-size rules, and the eight logo prohibitions as machine-readable data.
- **`unbranded-v1.html`** — **the default.** Loads when no brand file is present. No color and no marks; all four callout levels render as a ruled box with the label reversed out in an ink tab. Anything that reads correctly on this kit reads correctly on every kit, which makes it the right kit to draft on and to test against.

**The kit is dropped in by the user on the first screen.** §10 of the spec says kits ship with the app and users select them; the deltas file reverses that. No kit library, no picker, no governance problem — and the app ships with no Ascension brand in it at all, becoming an Ascension tool only when someone drops in an Ascension file.

**Validate on load; a kit that fails does not load.** Every color parses; every declared blueprint is known; `kit_version` is supported; `callouts[].color` resolves to a declared color and agrees with the kit's own CSS; every level has a distinct non-empty label. **Two levels sharing a fill is legal** — see the deltas file, §10, for why implementing that as a hard rule would break the default kit.

`assets` values are data URIs or `null`. A kit file must be fully self-contained.

---

## Screens

Ten, in order. All are in the standalone design file with the artifact id given.

| # | Screen | Id | Purpose |
|---|---|---|---|
| 1 | Drop in the brand file | `5a` | First thing the user sees. Drop zone, then what the app read from the file. |
| 2 | Is a document the right fix? | `3a` | Three plain-language triage questions. **Never blocks.** |
| 3 | What are you making? | `3b` | Three blueprints, described by use, page shapes at true relative proportion. |
| 4 | Write your sections | `5b`, `4b` | The core screen. Author-named sections, five shapes, add anywhere. |
| 5 | Add a picture | `3d` | Drop, PHI acknowledgment, up to 4 on-image labels, required alt text. |
| 6 | Suggestions before you finish | `3e` | Declinable offers; the one blocking item first. |
| 7 | Your document is ready | `3f` | Three formats plus the two extra variants, offered unasked. |

**Print pages:** field guide spread `1a`, step-action table `1b`, screenshot keep-together `1c`, letter two-column `1d`, letter prose `1e`, huddle card `2a`, the scaffolded/expert pair `2b`, multi-page letter `4a`.

`1f` and `4b` are superseded earlier versions, kept for reference. `6a` is a typography comparison, not a screen.

### Screen chrome — exact values

The app chrome is deliberately a **different visual system from the documents it produces.** Quiet, recessive chrome around a bright, high-contrast page. The document should look like it is sitting on the app, not made of it. This is also the ownership argument: chrome wearing Ascension's brand would implicitly claim to be an Ascension product.

```
Frame            1280 × 800 (the desktops this runs on)
Ground           #121A16
Bars, rails      #0C2223
Panels           #142A2B
Sunken wells     #001011
Body text        #E9E6DF        Headings #f6f3ec
Muted text       #C1D4D4        Quiet #9CB1B2        Disabled #748B8C
Hairlines        rgba(246,243,236,0.10)   Borders rgba(246,243,236,0.20)
Primary action   #f6f3ec ground, #142A2B lettering    (a routed sign board)
Accent action    #C6862F ground, #051B1C lettering    (exactly ONE per screen)
Success          #81A569        Warning #C28245        Blocking #DE6A58
Selected option  #f6f3ec ground, #142A2B lettering
Plate shadow     3px 3px 0 0 rgba(246,243,236,0.26)   — hard, no blur
```

**Typography: one family.** Archivo throughout — 600 for headings and the wordmark, 500 for emphasis, 400 for everything else. Courier Prime **only** where numbers must line up: page counts, word counts, file names, marker counts. No serif and no display face anywhere in the chrome; `6a` in the design file shows the version that got this wrong beside the version that got it right.

```
Screen h1        31 px / 1.25, weight 600, letter-spacing -0.01em
Lede             15.5 px / 1.6
Field label      14–15 px, weight 500
Body, options    14.5 px
Captions, rails  13.5 px
Progress, meta   12.5 px
Mono metadata    11.5–12 px, letter-spacing 0.04em, uppercase
```

```
Top bar          56 px      Progress strip  ~44 px      Footer bar  76 px
Content padding  32–44 px top, 24 px sides
Content column   640–760 px, centered
Option rows      52 px min       Buttons  44 px min, 48 px for the accent action
Radii            0 everywhere. Nothing is rounded.
```

**No shadows on chrome surfaces** — hairlines and 2 px rules do that work. Shadows appear only under the white page previews (`0 18px 36px rgba(0,0,0,0.55)`) and under frames.

**Focus:** a 2 px page-colored gap then a 2 px amber ring. Never a browser-blue outline.

**Motion:** 90 ms transform, 150 ms color, 240 ms surfaces, 420 ms screen changes. Fades and short vertical translates only. No bounce, no spring, no parallax, no looping animation.

---

## Interactions and behavior

**Navigation** is linear with a persistent way back. Every screen has Back in the footer left and the forward action in the footer right. The finish screen still offers "go back and change something" — the fear of a one-way door does not end at the last step.

**Autosave, always, with a visible state.** "Saved a moment ago" sits in the top bar of every screen. Nothing is ever lost, and the user can leave via "save and finish later" from anywhere.

**Validation is inline, quiet, and declinable.** Never a modal, never a wall of red. Each warning states what, then why in one sentence, then offers a fix the app performs itself — "change it to *Check that…*", not "revise wording". The decline is as easy to press as the accept. A warning that cannot be comfortably declined is a block wearing a friendlier hat.

**Exactly one thing blocks export: alt text on images.** It is stated with its reason in the same breath, and it appears first in the review list, never last.

**The preview is not a control surface.** It has no zoom, no geometry toggle, no page-turn in the primary flow. One caption says where you are and that arranging is not the author's job. Page count is **reported, never set** — there is no page-size, column, or margin control anywhere in the app.

**Adding a section** is reachable from persistent chrome (footer) *and* as a divider between every pair of sections. Adding in the middle is the common case: people remember the missing prerequisite after writing the steps.

**Screenshot pipeline** (§14): drop → PHI acknowledgment at the drop point, listing what to look for → crop, with the retain-context rule surfaced as guidance → annotate, max 4 labels placed **on the image at the anchor point**, contrast sampled against the actual pixels beneath → alt text, required → optional caption, warned if it duplicates the step text. Stored at 300 PPI at the largest render width; downsampled for preview, never the reverse.

**Copy rules for the whole app.** No jargon on screen: not *measure*, *CPL*, *baseline unit*, *blueprint*, *section type*, *geometry*, `[[double brackets]]`, or any readability score. Blueprints are "a pocket booklet", "a one-page sheet", "a card to read at huddle". No individual's name and no facility name in shipped UI copy — the first screen says "you'll be sent one file", not who sends it.

---

## The rules engine

Three levels, per §12. **Build the HARD constraints first, then the WARNINGs.**

**HARD** — enforced silently, no user-facing choice. The full list is §12.1. The ones with genuinely strong independent support: a step and its screenshot may never straddle a page or fold; callout labels render on the image at the anchor point with no separate legend; all text clears 4.5:1 against its actual rendered background including callout fills; no meaning by color alone and callout labels cannot be disabled; alt text required; `important` and `requirements` text exempt from all simplification or truncation.

**WARNING** — nudge, allow override, one sentence of why. Thresholds in §12.2.

**One rule to leave out.** The readability score is the weakest and most gameable in the set. It is **not shown, not scored, not stored, and never gates export**, and nothing is auto-rewritten to lower it. §12.2 makes this point; the design removes the temptation entirely by not putting a number on screen.

**Treat every Mayer-derived effect size as an upper bound** — §12's own caution. Build the strongly-supported rules to hold; hold the rest lightly and make warnings easy to dismiss.

---

## The two-variant architecture

The strongest evidence-backed finding in the research set, and it shapes the product rather than a setting: high-assistance materials help novices (d = 0.505) and actively harm experts (d = −0.428).

**One submission produces two documents.** Same JSON, one filter on `register`:

- **Scaffolded** — everything renders. Key terms, rationale prose, step glosses, a screenshot per step, a retrieval block.
- **Expert** — sections marked `scaffolded` are suppressed, step glosses and screenshots drop, step lists render as tables.
- **`important` and `requirements` callouts are byte-identical in both cuts.** The one thing the expert path may not touch.

Default to scaffolded when the audience is ambiguous — withholding help from an expert costs less than withholding it from a novice. Both variants are produced on export and presented as gifts, not settings: *"a short version for people who already know the steps."*

A **large-print variant** is generated the same way on every export: body ≥1.4×, single column, reflowed. Both kits carry the `[data-large-print]` token block, so it is a token swap and not a redesign.

---

## Build order

From §15, unchanged, with the deltas applied:

1. Content model and section types — the real intellectual work.
2. Brand Kit format, both kits, and the validator.
3. **HTML renderer at all geometries. Prove pagination before building anything on top of it.**
4. Screenshot pipeline, built with the renderer rather than bolted on.
5. PDF export — nearly free once step 3 holds.
6. The form UI.
7. Rules engine: HARD first, then WARNING.
8. DOCX emitter. Ship last, framed as *an editable copy*, not the deliverable.
9. Huddle card, large-print variant, retrieval blocks.

---

## Four build rules earned during the design

Each of these came from a defect found in review, and each will save time:

1. **Layout figures are generated from layout, never typed.** Every stated-number error across six design passes was a hand-typed figure sitting beside correct geometry. Annotations, budgets and page counts should be computed and rendered, not written.
2. **Measure the string.** In the engine, and in your own arithmetic.
3. **Whatever a screen exists to do belongs in persistent chrome**, not in a scroll region. Completed work collapses; the current task and the primary action stay visible.
4. **The mandatory item goes first**, never last in a list of optional ones.

---

## Assets

In `design/assets/`, both copied from the Ascension St. John design system and already embedded as data URIs inside `brand-kits/ascension-baseline-v1.html`:

- `arch-1-green.png` — the alternate arch graphic, Arch 1 crop, green. Used as the color-field header on letter sheets. The arch always bleeds off the left or right edge, is never rotated, never used as a photo mask, and never carries more than one brand color.
- `asj-logo-hz-fc.png` — Ascension St. John horizontal lockup, full color.

Also embedded in the Ascension kit: the enterprise Ascension horizontal lockup in full color and white, and the emblem. **Still missing:** `arch` color-field art in the kit JSON (currently `null`), and a St. John market kit — the current kit carries the enterprise lockup.

**No photography or illustration exists or should be improvised.** Screenshots come from the author. Use placeholders and ask.

**Fonts.** Print output uses the guideline-approved Microsoft Office substitutes — Georgia for headings, Calibri for body, Arial as fallback. These need no external reference, which is what keeps a kit file self-contained. Chronicle Text G1 and Whitney are licensed Hoefler faces and no binaries were supplied; if they are ever licensed, `type` in the kit JSON is the only thing that changes. The app chrome uses Archivo.

---

## Files in this bundle

```
spec/
  Form-Builder-Build-Spec.md              the original specification
  Form-Builder-Spec-Deltas.md             ← authoritative where the two disagree
design/
  Form-Builder-Design-Passes-standalone.html    open this — self-contained, works offline
  Form Builder - Design Passes.dc.html          editable source (needs the design workspace)
  support.js                                    runtime for the source file
  assets/                                       arch graphic, St. John lockup
brand-kits/
  ascension-baseline-v1.html              Ascension tokens, CSS, embedded logos, specimen
  unbranded-v1.html                       the default kit — no color, no marks
```

---

## Open decisions for the owner

Three, none blocking:

- Is TIP's gold `#ffb400` sanctioned, or does it stay flagged `"status": "proposed"` in the kit?
- Does the shipped kit carry the enterprise Ascension lockup, or a St. John market lockup? A market kit is a separate file.
- Saddle-stitch creep allowance for the field guide. Unsourced; the printer's spec governs.

## Not yet designed

None of it blocks a v1 build: the field guide cover and back page, change-log editing, and the audience selector that sets which variant is the default.
