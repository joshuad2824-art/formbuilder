/**
 * The app's own stylesheet — deliberately small.
 *
 * A brand kit is not a token file with a specimen attached: it carries the CSS
 * that renders documents, with its own DOM contract (`.doc[data-blueprint]`,
 * `.steps > li` as a two-cell grid, `.body-grid`, `.rail`, `.spine`, `.sysmsg`,
 * `.anno-label`, and the rest). So the division of labour is:
 *
 *   the kit  owns appearance — faces, colour, rules, callout treatment
 *   the app  owns geometry   — page boxes, margins, bleed, the baseline unit,
 *                              and pagination, which no kit can know
 *
 * Everything here is derived from the geometry engine. The engine's values are
 * also written onto the document element as custom properties at render time,
 * so where a kit hardcodes a unit for a blueprint, the engine wins and the two
 * can never silently diverge.
 */

import { spacing, typeScale, type Frame } from '../geometry/blueprints'
import { BLEED_IN } from '../geometry/constants'

const pt = (n: number) => `${Number(n.toFixed(4))}pt`
const inches = (n: number) => `${Number(n.toFixed(4))}in`

/** The geometry the engine derived, as the custom properties a kit consumes. */
export function geometryVariables(frame: Frame): Record<string, string> {
  const scale = typeScale(frame)
  const space = spacing(frame)
  return {
    '--unit': pt(frame.unitPt),
    '--half': pt(space.half),
    '--leading': String(Number(frame.input.leading.toFixed(4))),
    '--body-size': pt(scale.body),
    '--table-size': pt(scale.tableCell),
    '--caption-size': pt(scale.caption),
    '--size-title': pt(scale.docTitle),
    '--size-h1': pt(scale.h1),
    '--size-h2': pt(scale.h2),
    '--size-h3': pt(scale.h3),
    '--measure': inches(frame.column.widthIn),
  }
}

export function inlineGeometry(frame: Frame): string {
  return Object.entries(geometryVariables(frame))
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
}

/**
 * Page boxes and the flow scaffolding. This is the part a kit cannot supply,
 * because it depends on which geometry the document is being cut to and on how
 * many pages the content turns out to need.
 */
export function pageCss(frame: Frame): string {
  const { input } = frame
  const bottom = frame.bottomMarginIn

  // Mirrored margins are a structural difference between the blueprints, not a
  // parameter: the fold swallows inner space, so the spread is the design unit.
  const pageRules = input.mirrored
    ? `@page :left  { size: ${input.trimWIn}in ${input.trimHIn}in; bleed: ${inches(BLEED_IN)};
  margin: ${inches(input.topMarginIn)} ${inches(input.innerMarginIn)} ${inches(bottom)} ${inches(input.outerMarginIn)}; }
@page :right { size: ${input.trimWIn}in ${input.trimHIn}in; bleed: ${inches(BLEED_IN)};
  margin: ${inches(input.topMarginIn)} ${inches(input.outerMarginIn)} ${inches(bottom)} ${inches(input.innerMarginIn)}; }`
    : `@page { size: ${input.trimWIn}in ${input.trimHIn}in;
  margin: ${inches(input.topMarginIn)} ${inches(input.outerMarginIn)} ${inches(bottom)} ${inches(input.innerMarginIn)}; }`

  // Flowing content across as many pages as it needs is the app's job. The
  // kit's own `.body-grid` is a fixed two-cell grid — right for a specimen,
  // wrong for a sheet that paginates.
  const flow =
    frame.column.count > 1
      ? `.doc .flow {
  column-count: ${frame.column.count};
  column-gap: ${inches(frame.column.gutterIn)};
  column-fill: balance;
}`
      : `.doc .flow { max-width: ${inches(frame.column.widthIn)}; }`

  return `
${pageRules}

html { margin: 0; }
body { margin: 0; background: var(--paper, #fff); }

${flow}

/* Body is never justified, at any geometry — WCAG SC 1.4.8. Uneven word
   spacing and rivers hurt dyslexic and low-vision readers. */
.doc, .doc p, .doc li, .doc td { text-align: left; }

/* A step and its screenshot may never straddle a page or fold — HARD, §12.1.
   Split attention, g ≈ 0.63–0.72. */
.doc .keep-together, .doc .steps > li, .doc figure, .doc .callout {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Widow and orphan control: two lines minimum at both ends of any break. */
.doc p, .doc li { orphans: 2; widows: 2; }

/* Headings bind to what follows them. */
.doc h1, .doc h2, .doc h3 { break-after: avoid; page-break-after: avoid; }

/* A section that breaks across pages repeats its own title with "continued". */
.doc .continued { font-style: italic; font-weight: 400; }

/* Screenshot annotations sit on the image at the anchor point — never in a
   separate legend. The layer is what makes that positioning possible. */
.doc .anno-layer { position: relative; }

/* The metadata block is app-owned shell, and neither kit styles a definition
   list — so its structure is supplied here. Appearance still comes from the
   kit's own .meta and .eyebrow rules. */
.doc .meta {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: var(--half, 8pt);
  row-gap: calc(var(--half, 8pt) * 0.35);
  margin: var(--half, 8pt) 0 var(--unit, 16pt);
}
.doc .meta dt { grid-column: 1; }
.doc .meta dd { grid-column: 2; margin: 0; }

/* The rule under the title is a fixed brand element, not a page-width rule. */
.doc header .rule-brand { margin: var(--half, 8pt) 0; }

@media screen {
  html { background: #6d6d6d; }
  .doc {
    box-sizing: border-box;
    width: ${input.trimWIn}in;
    min-height: ${input.trimHIn}in;
    margin: 24px auto;
    padding: ${inches(input.topMarginIn)} ${inches(input.outerMarginIn)} ${inches(bottom)} ${inches(input.innerMarginIn)};
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.55);
  }
}

@media print {
  html { background: none; }
  .doc { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
}
`.trim()
}

/**
 * Large print — §13.4. A token swap, not a redesign: body to at least 1.4×,
 * single column, unit recomputed. Both shipped kits carry the
 * `[data-large-print]` block, so this only has to supply the arithmetic.
 */
export function largePrintCss(frame: Frame): string {
  const scale = typeScale(frame)
  const factor = 1.4
  return `
.doc[data-large-print] {
  --body-size: ${pt(scale.body * factor)};
  --unit: ${pt(frame.unitPt * factor)};
  --half: ${pt((frame.unitPt * factor) / 2)};
  --table-size: ${pt(Math.max(scale.tableCell * factor, scale.tableCell))};
  --caption-size: ${pt(scale.caption * factor)};
}
.doc[data-large-print] .flow { column-count: 1; max-width: none; }
.doc[data-large-print] .body-grid { grid-template-columns: 1fr; }
`.trim()
}
