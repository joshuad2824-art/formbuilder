/**
 * Image resolution and cropping — §7.6 and §14.
 *
 * Two rules do the real work here, and both are about a screenshot's *own*
 * embedded UI text rather than about the image as a picture:
 *
 *  - Assets are stored at **300 PPI at the largest render width**, and
 *    downsampled for preview — never the reverse. Upsampling a small capture
 *    to meet a print figure invents detail that was never captured.
 *
 *  - **Crop tighter for the field guide; never scale the letter crop down.** A
 *    capture placed at 6.5 in on letter and reused at 4.375 in has its own
 *    embedded UI text scaled to 67% — 9 pt UI text prints at 6 pt and becomes
 *    unreadable.
 */

import { inToPt, PT_PER_IN } from '../geometry/constants'
import type { Frame } from '../geometry/blueprints'

export const PRINT_PPI = 300

export interface PixelSize {
  width: number
  height: number
}

export interface CropRect {
  /** Fractions of the source image, 0–1, so a crop survives a re-encode. */
  x: number
  y: number
  width: number
  height: number
}

export const FULL_FRAME: CropRect = { x: 0, y: 0, width: 1, height: 1 }

/** Pixels needed to print `widthIn` inches at 300 PPI. */
export function requiredPixels(widthIn: number): number {
  return Math.ceil(widthIn * PRINT_PPI)
}

/**
 * How wide a figure renders. A figure either sits in the reading column, or
 * spans the whole live width — and the difference is what makes reuse across
 * geometries dangerous: a letter figure spanning 7 in reused at the field
 * guide's 4.375 in column loses more than a third of its scale.
 */
export type FigureSpan = 'column' | 'live'

export function renderWidthIn(frame: Frame, span: FigureSpan = 'column'): number {
  return span === 'live' ? frame.liveWIn : frame.column.widthIn
}

export interface ResolutionCheck {
  ok: boolean
  havePx: number
  needPx: number
  effectivePpi: number
  /** One plain sentence, or null when there is nothing to say. */
  message: string | null
}

/**
 * Checks a crop against the geometry it will print at. Reported as a warning,
 * never a block: a slightly soft screenshot is worth more than no screenshot,
 * and the author often cannot recapture at a higher resolution.
 */
export function checkResolution(
  source: PixelSize,
  crop: CropRect,
  frame: Frame,
  span: FigureSpan = 'column',
): ResolutionCheck {
  const havePx = Math.round(source.width * crop.width)
  const widthIn = renderWidthIn(frame, span)
  const needPx = requiredPixels(widthIn)
  const effectivePpi = havePx / widthIn

  if (havePx >= needPx) {
    return { ok: true, havePx, needPx, effectivePpi, message: null }
  }
  return {
    ok: false,
    havePx,
    needPx,
    effectivePpi,
    message:
      'This picture will look a little soft in print. If you can take it again on a ' +
      'larger screen, it will come out sharper — but it is fine to carry on with this one.',
  }
}

/**
 * The scale a screenshot's own embedded UI text ends up at when a crop made for
 * one geometry is reused at another. Below `MIN_EMBEDDED_SCALE` the UI text in
 * the picture stops being readable, and the crop should be retaken rather than
 * scaled.
 */
export const MIN_EMBEDDED_SCALE = 0.8

export function embeddedTextScale(
  from: Frame,
  to: Frame,
  fromSpan: FigureSpan = 'column',
  toSpan: FigureSpan = 'column',
): number {
  return renderWidthIn(to, toSpan) / renderWidthIn(from, fromSpan)
}

export interface ReuseCheck {
  scale: number
  ok: boolean
  /** Point size the picture's own 9 pt UI text would print at. */
  embeddedPtAt9: number
  message: string | null
}

export function checkReuse(
  from: Frame,
  to: Frame,
  fromSpan: FigureSpan = 'column',
  toSpan: FigureSpan = 'column',
): ReuseCheck {
  const scale = embeddedTextScale(from, to, fromSpan, toSpan)
  const embeddedPtAt9 = 9 * scale
  if (scale >= MIN_EMBEDDED_SCALE) {
    return { scale, ok: true, embeddedPtAt9, message: null }
  }
  return {
    scale,
    ok: false,
    embeddedPtAt9,
    message:
      'This picture was cut for a wider page. Used here it shrinks, and the writing ' +
      'inside it gets too small to read. It needs cutting again, closer in.',
  }
}

/**
 * The retain-context rule, surfaced as guidance rather than enforced — §14.
 * A crop that keeps nothing around the target leaves the reader unable to
 * locate themselves in their own screen.
 */
export const RETAIN_CONTEXT_GUIDANCE =
  'Leave a little of the surrounding screen in the picture, so the reader can tell ' +
  'where they are. A close crop of one button on its own is hard to find.'

/** Below this share of the source, a crop has probably lost its context. */
export const CONTEXT_FLOOR = 0.12

export function keepsContext(crop: CropRect): boolean {
  return crop.width * crop.height >= CONTEXT_FLOOR
}

/** Points, for laying a figure out against the geometry's own grid. */
export function renderWidthPt(frame: Frame, span: FigureSpan = 'column'): number {
  return inToPt(renderWidthIn(frame, span))
}

export { PT_PER_IN }
