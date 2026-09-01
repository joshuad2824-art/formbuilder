/**
 * The geometry engine — §7 and §11, as amended by the deltas file.
 *
 * Build rule 1, earned during the design: **layout figures are generated from
 * layout, never typed.** Every stated-number error across six design passes was
 * a hand-typed figure sitting beside correct geometry. So this module takes the
 * genuinely chosen inputs — trim, the margins that protect the fold or the
 * staple, the column structure, the body size, the leading, and how many
 * baseline units the page should hold — and *derives* everything else: the
 * bottom margin, the live area, the measure, the type scale.
 *
 * Nothing downstream ever reads a margin or a character budget from a table.
 */

import {
  BODY_SIZE_PT,
  HUDDLE_BODY_SIZE_PT,
  MAX_RATIO_NARROW,
  PT_PER_IN,
  inToPt,
  ptToIn,
} from './constants'
import { charactersPerLine, type Measurer } from './measure'

export type FrameId = 'field_guide' | 'letter_two_column' | 'letter_prose' | 'huddle_card'

export interface ColumnPlan {
  count: number
  /** Inches. Derived from the live width and the gutter. */
  widthIn: number
  gutterIn: number
}

/**
 * The chosen inputs for one page geometry. A `bottomMarginIn` is conspicuously
 * absent — it is an output, computed so live height lands on an exact whole
 * number of baseline units.
 */
export interface FrameInput {
  id: FrameId
  label: string
  trimWIn: number
  trimHIn: number
  /** Mirrored margins: the fold swallows inner space — §7.1. */
  mirrored: boolean
  innerMarginIn: number
  outerMarginIn: number
  topMarginIn: number
  bodySizePt: number
  /**
   * Chosen leading. Checked against `leadingForMeasure` by the verifier rather
   * than taken from it, because a geometry may bend the curve slightly to land
   * live height on a whole unit — that landing is the invariant, not the curve.
   */
  leading: number
  /** Baseline units the live area must hold, exactly. */
  units: number
  /** Units the first page loses to the colour-field header band, if any. */
  headerBandUnits?: number
  columns: number
  gutterIn: number
  /** Some geometries cap the measure rather than filling the live width. */
  maxColumnWidthIn?: number
  /** A fixed side rail taken out of the live width before columns are cut. */
  railIn?: number
  scaleRatio: number
}

export interface Frame {
  input: FrameInput
  /** Derived. */
  bottomMarginIn: number
  liveWIn: number
  liveHIn: number
  liveWPt: number
  liveHPt: number
  unitPt: number
  halfUnitPt: number
  column: ColumnPlan
  railIn: number
  /** Set on multi-page geometries whose first page carries a header band. */
  firstPage?: { liveHIn: number; liveHPt: number; units: number }
}

/* ------------------------------------------------------------- the four -- */

export const FRAMES: Record<FrameId, FrameInput> = {
  field_guide: {
    id: 'field_guide',
    label: 'Field guide',
    trimWIn: 5.5,
    trimHIn: 8.5,
    mirrored: true,
    innerMarginIn: 0.625,
    outerMarginIn: 0.5,
    topMarginIn: 0.5,
    bodySizePt: BODY_SIZE_PT,
    leading: 1.5,
    units: 31,
    columns: 1,
    gutterIn: 0,
    scaleRatio: 1.2,
  },
  letter_two_column: {
    id: 'letter_two_column',
    label: 'Letter, two column',
    trimWIn: 8.5,
    trimHIn: 11,
    mirrored: false,
    innerMarginIn: 0.75,
    outerMarginIn: 0.75,
    topMarginIn: 0.75,
    bodySizePt: BODY_SIZE_PT,
    leading: 15.75 / BODY_SIZE_PT,
    // Continuation pages, which start at the top margin. Page 1 gives six
    // units back to the colour-field header — deltas §7.2.
    units: 43,
    headerBandUnits: 6,
    columns: 2,
    // The whitespace moves into the gutter instead of the outer margin: at a
    // 0.25 in gutter these columns measure 55 CPL, five past the multi-column
    // maximum — deltas §7.2.
    gutterIn: 0.875,
    scaleRatio: 1.25,
  },
  letter_prose: {
    id: 'letter_prose',
    label: 'Letter, prose with rail',
    trimWIn: 8.5,
    trimHIn: 11,
    mirrored: false,
    innerMarginIn: 0.75,
    outerMarginIn: 0.75,
    topMarginIn: 0.75,
    bodySizePt: BODY_SIZE_PT,
    leading: 17.16 / BODY_SIZE_PT,
    units: 40,
    columns: 1,
    gutterIn: 0.25,
    // Not "one column, wide margins": a 2/3 reading column plus a 1/3 rail,
    // with metadata, logo and support moved off the reading column — deltas §7.2.
    railIn: 2.25,
    scaleRatio: 1.25,
  },
  huddle_card: {
    id: 'huddle_card',
    label: 'Huddle card',
    trimWIn: 8.5,
    trimHIn: 11,
    mirrored: false,
    innerMarginIn: 0.75,
    outerMarginIn: 0.75,
    topMarginIn: 0.75,
    // Exempt from the body-size invariant. At 11 pt a 79-word spine fills
    // about 8% of a letter live area — a 92%-white page read aloud to a
    // room. Deltas §3.
    bodySizePt: HUDDLE_BODY_SIZE_PT,
    leading: 25.44 / HUDDLE_BODY_SIZE_PT,
    units: 27,
    columns: 1,
    gutterIn: 0,
    maxColumnWidthIn: 5.25,
    scaleRatio: 1.25,
  },
}

/* -------------------------------------------------------------- derive --- */

export function resolveFrame(input: FrameInput): Frame {
  const unitPt = input.bodySizePt * input.leading
  const liveHPt = input.units * unitPt
  const liveHIn = ptToIn(liveHPt)

  // The bottom margin is an output. This is the whole point: live height is an
  // exact integer multiple of the unit, so the margin absorbs the remainder.
  const bottomMarginIn = input.trimHIn - input.topMarginIn - liveHIn

  const liveWIn = input.trimWIn - input.innerMarginIn - input.outerMarginIn
  const railIn = input.railIn ?? 0
  const available = liveWIn - railIn - (railIn > 0 ? input.gutterIn : 0)

  const raw = (available - (input.columns - 1) * input.gutterIn) / input.columns
  const widthIn = input.maxColumnWidthIn ? Math.min(raw, input.maxColumnWidthIn) : raw

  const frame: Frame = {
    input,
    bottomMarginIn,
    liveWIn,
    liveHIn,
    liveWPt: inToPt(liveWIn),
    liveHPt,
    unitPt,
    halfUnitPt: unitPt / 2,
    column: { count: input.columns, widthIn, gutterIn: input.gutterIn },
    railIn,
  }

  if (input.headerBandUnits) {
    const units = input.units - input.headerBandUnits
    frame.firstPage = { units, liveHPt: units * unitPt, liveHIn: ptToIn(units * unitPt) }
  }

  return frame
}

export function frame(id: FrameId): Frame {
  const input = FRAMES[id]
  return resolveFrame(input)
}

/** Which frames a blueprint can produce. Quick reference offers two. */
export const BLUEPRINT_FRAMES: Record<string, FrameId[]> = {
  field_guide: ['field_guide'],
  quick_reference: ['letter_two_column', 'letter_prose'],
  huddle_card: ['huddle_card'],
}

/* ------------------------------------------------------------- measure --- */

export function measureOf(frame: Frame, measurer: Measurer, family: string): number {
  return charactersPerLine(
    measurer,
    inToPt(frame.column.widthIn),
    family,
    frame.input.bodySizePt,
  )
}

/**
 * The type scale — deltas §7.5. Generated from the base and the ratio, never
 * typed. `[CITED MM01 §4]` Body size is invariant across the two reference
 * geometries; headings scale.
 */
export interface TypeScale {
  docTitle: number
  h1: number
  h2: number
  h3: number
  body: number
  tableCell: number
  caption: number
}

export function typeScale(frame: Frame): TypeScale {
  const { bodySizePt: body, scaleRatio: r, trimWIn } = frame.input
  if (trimWIn <= 5.5 && r > MAX_RATIO_NARROW) {
    throw new Error(
      `Ratio ${r} exceeds ${MAX_RATIO_NARROW} on the ${trimWIn} in page — §7.5 bans it.`,
    )
  }
  const round = (n: number) => Math.round(n * 4) / 4
  return {
    docTitle: round(body * r ** 4),
    h1: round(body * r ** 3),
    h2: round(body * r ** 2),
    h3: round(body * r),
    body,
    tableCell: body === HUDDLE_BODY_SIZE_PT ? body : 10,
    caption: 9,
  }
}

/**
 * Spacing scale — multiples of half the geometry's own unit (deltas §7.5).
 * Space above headings: H3 1.5 units, H2 2, H1 3. Space below is always half a
 * unit, so proximity binds a heading to what follows.
 */
export function spacing(frame: Frame) {
  const u = frame.unitPt
  return {
    unit: u,
    half: u / 2,
    aboveH3: u * 1.5,
    aboveH2: u * 2,
    aboveH1: u * 3,
    below: u / 2,
    scale: [0.5, 1, 1.5, 2, 3, 4].map((m) => m * u),
  }
}

/**
 * Table character budget — deltas §7.3. Measured at the table cell size across
 * the live width, never assumed. Minimum column width is 12 characters; below
 * that the table cannot render at this geometry and must be transposed, split
 * or stacked rather than shrunk.
 */
export function tableBudget(
  frame: Frame,
  measurer: Measurer,
  family: string,
  columns: number,
): { total: number; each: number; renderable: boolean } {
  const cellPt = typeScale(frame).tableCell
  const total = Math.floor(
    charactersPerLine(measurer, inToPt(frame.column.widthIn), family, cellPt),
  )
  const each = Math.floor(total / columns)
  return { total, each, renderable: each >= 12 }
}

/** Row height is an integer multiple of the geometry's unit — §7.3. */
export function tableRowHeightPt(frame: Frame, lines = 1): number {
  return Math.max(2, Math.ceil(lines * 1.4)) * frame.halfUnitPt
}

export { PT_PER_IN }
