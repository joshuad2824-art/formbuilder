/**
 * Geometry constants — §11.1, as amended by the deltas file.
 *
 * Note what is NOT here: `BASELINE_UNIT` and `SPACING_SCALE`. §11.1 lists a
 * baseline unit of 15 pt as INVARIANT; that cannot hold once leading is a
 * function of measure, because each geometry then has its own leading and so
 * its own unit. The invariant is the *rule* — live height is an exact integer
 * multiple of its own unit — not the number. The rule lives in `blueprints.ts`.
 */

export const PT_PER_IN = 72

export const BODY_SIZE_PT = 11
/** The huddle card is the one documented exception — deltas §3. */
export const HUDDLE_BODY_SIZE_PT = 16

export const BODY_MIN_PT = 11
export const TABLE_CELL_MIN_PT = 8
export const MIN_SIZE_PT = 7.5

/** Absolute, never percentages — §12.1. */
export const BLEED_IN = 0.125
export const SAFE_ZONE_IN = 0.25
export const STROKE_FLOOR_PT = 0.25

export const CPL_TARGET = 66
export const CPL_MIN_SINGLE = 45
export const CPL_MAX_SINGLE = 75
export const CPL_MIN_MULTICOL = 40
export const CPL_MAX_MULTICOL = 50
/** WCAG SC 1.4.8. */
export const CPL_HARD_MAX = 80

/** Minimum lines either side of any break — §11.4. */
export const WIDOW_ORPHAN_MIN = 2

/** Field guide only: a scale above this compresses to illegibility — §7.5. */
export const MAX_RATIO_NARROW = 1.333

export const inToPt = (inches: number) => inches * PT_PER_IN
export const ptToIn = (points: number) => points / PT_PER_IN

/**
 * Line-height as a function of measure — §11.3. Never a constant; this is what
 * makes one system serve four geometries.
 */
export function leadingForMeasure(cpl: number, sansBody = true): number {
  const raw = 1.35 + (cpl - 40) / 120
  return clamp(1.35, raw, 1.6) + (sansBody ? 0.05 : 0)
}

export function clamp(low: number, value: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}
