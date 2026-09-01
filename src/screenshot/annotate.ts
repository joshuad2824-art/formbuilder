/**
 * Screenshot annotation — §7.6 and §12.1.
 *
 * Two of these rules are HARD and among the best-supported in the whole spec:
 *
 *  - **Labels render on the image at the anchor point.** No numbered legend, no
 *    separate key. Split-attention meta-analytic g ≈ 0.63–0.72 — a reader who
 *    must hold "3" in mind while hunting for "3." in a list below is paying for
 *    the layout with working memory they needed for the procedure.
 *
 *  - **Contrast is sampled against the pixels actually beneath the label**, not
 *    against an assumed background. A screenshot is not a flat colour; a violet
 *    box that clears 3:1 over a white dialog can vanish over a dark toolbar
 *    four pixels away.
 *
 * Maximum four labels per image, from Cowan's ~4-chunk limit.
 */

import { averageRegion, contrast, parseHex, type Rgb } from '../brandkit/contrast'
import type { ImageCallout } from '../model/content'
import type { BrandKit } from '../brandkit/types'

export const MAX_CALLOUTS = 4

/** Non-text contrast floor for a graphical object — WCAG 1.4.11. */
export const MIN_ANNOTATION_CONTRAST = 3

export interface Placement {
  /** Fractions of the image, 0–1. */
  x: number
  y: number
  label: string
}

export interface SampledContrast {
  ratio: number
  ok: boolean
  beneath: Rgb
}

/**
 * The label's footprint, as a fraction of the image. Sampling one pixel would
 * be dishonest: a label sits over a patch, and the patch is what it has to
 * survive.
 */
const SAMPLE_W = 0.08
const SAMPLE_H = 0.04

export interface ImagePixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

export function sampleBeneath(image: ImagePixels, at: Placement): Rgb {
  const w = Math.max(1, Math.round(image.width * SAMPLE_W))
  const h = Math.max(1, Math.round(image.height * SAMPLE_H))
  const x = clampInt(Math.round(image.width * at.x - w / 2), 0, image.width - w)
  const y = clampInt(Math.round(image.height * at.y - h / 2), 0, image.height - h)
  return averageRegion(image.data, image.width, x, y, w, h)
}

function clampInt(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, Math.max(0, value)))
}

/**
 * Does this label read where it has been put? The kit supplies the annotation
 * colour — house style is violet boxes and arrows, the same as IMPORTANT — so
 * the check is against the kit's own choice, not a hardcoded one.
 */
export function checkPlacement(
  image: ImagePixels,
  at: Placement,
  kit: BrandKit,
): SampledContrast {
  const beneath = sampleBeneath(image, at)
  const fillHex = kit.color[kit.annotation?.box_color ?? 'ink']?.hex ?? '#1a1a1a'
  const fill = parseHex(fillHex) ?? { r: 26, g: 26, b: 26 }
  const ratio = contrast(fill, beneath)
  const floor = kit.annotation?.min_contrast_vs_sampled_pixels ?? MIN_ANNOTATION_CONTRAST
  return { ratio, ok: ratio >= floor, beneath }
}

/**
 * Where the label could go instead. Offered as a move the app performs, not as
 * a complaint — the author placed it where the thing is, and the app's job is
 * to keep it readable without moving it far.
 */
const NUDGES: Array<[number, number]> = [
  [0, -0.06],
  [0, 0.06],
  [-0.08, 0],
  [0.08, 0],
  [-0.08, -0.06],
  [0.08, -0.06],
  [-0.08, 0.06],
  [0.08, 0.06],
]

export function suggestPlacement(
  image: ImagePixels,
  at: Placement,
  kit: BrandKit,
): Placement | null {
  let best: { placement: Placement; ratio: number } | null = null
  for (const [dx, dy] of NUDGES) {
    const candidate: Placement = {
      ...at,
      x: Math.min(0.97, Math.max(0.03, at.x + dx)),
      y: Math.min(0.97, Math.max(0.03, at.y + dy)),
    }
    const { ratio, ok } = checkPlacement(image, candidate, kit)
    if (ok && (best === null || ratio > best.ratio)) best = { placement: candidate, ratio }
  }
  return best?.placement ?? null
}

export interface AnnotationFinding {
  index: number
  label: string
  kind: 'contrast' | 'count' | 'empty' | 'overlap'
  message: string
  /** A fix the app performs itself, where one exists. */
  fix: { move: Placement } | null
}

/** Two labels this close read as one — and one of them is then unfindable. */
const OVERLAP = 0.05

/**
 * Every check an annotated image has to pass, phrased the way the author will
 * read them. Contrast failures carry a fix the app can apply; the others are
 * things only the author can decide.
 */
export function reviewAnnotations(
  image: ImagePixels,
  callouts: ImageCallout[],
  kit: BrandKit,
): AnnotationFinding[] {
  const findings: AnnotationFinding[] = []

  if (callouts.length > MAX_CALLOUTS) {
    findings.push({
      index: MAX_CALLOUTS,
      label: '',
      kind: 'count',
      message:
        `There are ${callouts.length} labels on this picture. Past four, a reader stops ` +
        'taking them in one at a time. Consider a second picture.',
      fix: null,
    })
  }

  callouts.forEach((callout, index) => {
    if (!callout.label.trim()) {
      findings.push({
        index,
        label: '',
        kind: 'empty',
        message: 'One of the labels on this picture has nothing written on it.',
        fix: null,
      })
      return
    }

    const at: Placement = { x: callout.x, y: callout.y, label: callout.label }
    const { ratio, ok } = checkPlacement(image, at, kit)
    if (!ok) {
      const move = suggestPlacement(image, at, kit)
      findings.push({
        index,
        label: callout.label,
        kind: 'contrast',
        message:
          `The label “${callout.label}” is hard to see against what is behind it ` +
          `(${ratio.toFixed(1)} to 1, and it needs ${MIN_ANNOTATION_CONTRAST}).` +
          (move ? ' It can be moved a little to sit somewhere clearer.' : ''),
        fix: move ? { move } : null,
      })
    }

    for (let other = index + 1; other < callouts.length; other++) {
      const next = callouts[other]!
      if (Math.abs(next.x - callout.x) < OVERLAP && Math.abs(next.y - callout.y) < OVERLAP) {
        findings.push({
          index,
          label: callout.label,
          kind: 'overlap',
          message:
            `“${callout.label}” and “${next.label}” are on top of each other, so neither ` +
            'points at anything in particular.',
          fix: null,
        })
      }
    }
  })

  return findings
}

/** Applies a fix the app offered. The author never repositions by hand. */
export function applyFix(callouts: ImageCallout[], finding: AnnotationFinding): ImageCallout[] {
  if (!finding.fix) return callouts
  return callouts.map((callout, index) =>
    index === finding.index
      ? { ...callout, x: finding.fix!.move.x, y: finding.fix!.move.y }
      : callout,
  )
}
