/**
 * Measure the string. Never use a constant — §11.2, and the second of the four
 * build rules earned during the design.
 *
 * The spec's fallback of `0.5 × size_pt` overstates Calibri by about 24% —
 * enough to hide two out-of-band geometries. Measured average advance is
 * 0.405 em. So this module renders the real characters in the real face at the
 * real size and takes the advance width, and falls back to a *calibrated*
 * per-family figure only where no rendering surface exists.
 */

export interface Measurer {
  /** Advance width of `text` in points, at `sizePt` in `family`. */
  advancePt(text: string, family: string, sizePt: number, weight?: number): number
}

/**
 * Calibrated average advance per em, by family. These are measurements, not
 * the spec's 0.5 guess, and they are the fallback path only.
 */
const CALIBRATED_EM: ReadonlyArray<[RegExp, number]> = [
  [/calibri/i, 0.405],
  [/georgia/i, 0.487],
  [/arial|helvetica/i, 0.478],
  [/roboto/i, 0.474],
  [/courier/i, 0.6],
]

const DEFAULT_EM = 0.48

export function calibratedEm(family: string): number {
  for (const [pattern, em] of CALIBRATED_EM) if (pattern.test(family)) return em
  return DEFAULT_EM
}

/**
 * Used where there is no rendering surface — Node, tests, a worker. Honest
 * about being an average rather than a measurement of this particular string.
 */
export class CalibratedMeasurer implements Measurer {
  advancePt(text: string, family: string, sizePt: number): number {
    return text.length * calibratedEm(family) * sizePt
  }
}

/** Measures the actual rendered face. Preferred wherever a canvas exists. */
export class CanvasMeasurer implements Measurer {
  private context: CanvasRenderingContext2D
  private cache = new Map<string, number>()

  constructor(canvas?: HTMLCanvasElement) {
    const element = canvas ?? document.createElement('canvas')
    const context = element.getContext('2d')
    if (!context) throw new Error('No 2D context available for measurement.')
    this.context = context
  }

  advancePt(text: string, family: string, sizePt: number, weight = 400): number {
    const key = `${weight}|${sizePt}|${family}|${text}`
    const hit = this.cache.get(key)
    if (hit !== undefined) return hit
    // Measure at a large size and scale, so hinting at small sizes does not
    // skew the result.
    const probePx = 200
    this.context.font = `${weight} ${probePx}px ${family}`
    const width = this.context.measureText(text).width
    const pt = (width / probePx) * sizePt
    this.cache.set(key, pt)
    return pt
  }
}

/**
 * A representative prose sample. Measure this rather than a synthetic
 * alphabet: character frequency is what makes an average advance meaningful.
 */
export const PROSE_SAMPLE =
  'Select the Orders or Medication List tab from the Menu, then click Add and ' +
  'search for the plan as you would any orderable. Enter the start date and ' +
  'time, or leave Now selected. When complete, click Reconcile and Sign.'

export function defaultMeasurer(): Measurer {
  return typeof document === 'undefined' ? new CalibratedMeasurer() : new CanvasMeasurer()
}

/** Characters per line for a column, measured — §11.2. */
export function charactersPerLine(
  measurer: Measurer,
  columnWidthPt: number,
  family: string,
  sizePt: number,
): number {
  const advance = measurer.advancePt(PROSE_SAMPLE, family, sizePt) / PROSE_SAMPLE.length
  return columnWidthPt / advance
}
