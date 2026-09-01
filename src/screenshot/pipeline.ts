/**
 * The screenshot pipeline — §14, built with the renderer rather than bolted on,
 * because keep-together and annotation are layout concerns.
 *
 *   drop → PHI acknowledgment at the drop point
 *        → crop, with the retain-context rule surfaced as guidance
 *        → annotate, max 4 labels on the image at the anchor point
 *        → alt text, required
 *        → caption, optional, warned if it duplicates the step text
 *
 * Every step runs in the browser. **No image is ever uploaded.** That is the
 * claim that lets this be used without a security review.
 */

import type { ImageCallout, Screenshot } from '../model/content'
import type { Frame } from '../geometry/blueprints'
import type { BrandKit } from '../brandkit/types'
import { plainText } from '../model/inline'
import { acknowledge, mayAttach, unacknowledged, type PhiAcknowledgment } from './phi'
import {
  checkResolution,
  keepsContext,
  requiredPixels,
  renderWidthIn,
  FULL_FRAME,
  type CropRect,
  type PixelSize,
  type ResolutionCheck,
} from './resolution'
import {
  applyFix, reviewAnnotations, MAX_CALLOUTS, type AnnotationFinding, type ImagePixels,
} from './annotate'

export type Stage = 'dropped' | 'acknowledged' | 'cropped' | 'annotated' | 'described' | 'ready'

export interface Draft {
  stage: Stage
  /** The source, as a data URI. It never leaves this machine. */
  source: string
  size: PixelSize
  phi: PhiAcknowledgment
  crop: CropRect
  callouts: ImageCallout[]
  alt: string
  caption: string | null
}

export function startDraft(source: string, size: PixelSize): Draft {
  return {
    stage: 'dropped',
    source,
    size,
    phi: unacknowledged(),
    crop: FULL_FRAME,
    callouts: [],
    alt: '',
    caption: null,
  }
}

export function confirmPhi(draft: Draft, now?: Date): Draft {
  return { ...draft, phi: acknowledge(now), stage: 'acknowledged' }
}

export function setCrop(draft: Draft, crop: CropRect): Draft {
  return { ...draft, crop, stage: 'cropped' }
}

export function addCallout(draft: Draft, callout: ImageCallout): Draft {
  // The cap is enforced rather than warned about: past four the labels stop
  // being read one at a time, and there is no useful "override" of that.
  if (draft.callouts.length >= MAX_CALLOUTS) return draft
  return { ...draft, callouts: [...draft.callouts, callout], stage: 'annotated' }
}

export function setAlt(draft: Draft, alt: string): Draft {
  return { ...draft, alt, stage: alt.trim() ? 'described' : draft.stage }
}

export function setCaption(draft: Draft, caption: string | null): Draft {
  return { ...draft, caption }
}

/* ------------------------------------------------------------- findings -- */

export interface PipelineFinding {
  kind: 'phi' | 'alt' | 'caption' | 'context' | 'resolution' | 'annotation'
  /** Alt text is the only thing in the whole app that blocks export. */
  blocking: boolean
  message: string
  /** Why, in the same breath as the requirement — never in a separate place. */
  because: string | null
  /**
   * A fix the app performs itself, where one exists.
   *
   * This matters most for a label that will not read where it was put. The
   * contrast rule is HARD, but the app cannot silently relocate the label:
   * where it sits *is* what it points at, and moving it without asking would
   * change the author's meaning. So the app finds a spot that reads and offers
   * to move it there, in one press.
   */
  fix: { label: string; apply: (draft: Draft) => Draft } | null
}

/**
 * Everything wrong with this draft, in the order the author should meet it.
 * The blocking item is always first: the mandatory item is never last in a list
 * of optional ones.
 */
export function review(
  draft: Draft,
  options: { frame: Frame; kit: BrandKit; pixels?: ImagePixels; stepText?: string },
): PipelineFinding[] {
  const findings: PipelineFinding[] = []

  // Alt text. The one export blocker the author meets in practice, and the
  // reason is stated in the same breath as the requirement.
  if (!draft.alt.trim()) {
    findings.push({
      kind: 'alt',
      blocking: true,
      message: 'This picture needs a sentence describing what it shows.',
      because:
        'Someone using a screen reader gets nothing from the picture without it, and it ' +
        'is the one thing that has to be there before you can finish.',
      fix: null,
    })
  }

  if (!mayAttach(draft.phi)) {
    findings.push({
      kind: 'phi',
      blocking: true,
      message: 'Have a look at the picture for patient information before adding it.',
      because: 'Nothing here is uploaded, but the finished document gets shared.',
      fix: null,
    })
  }

  // A caption that repeats the step is read twice and understood once —
  // verbatim redundancy is the well-supported half of the redundancy effect.
  if (draft.caption && options.stepText) {
    const overlap = tokenOverlap(draft.caption, options.stepText)
    if (overlap >= 0.6) {
      findings.push({
        kind: 'caption',
        blocking: false,
        message: 'This caption says much the same as the step above it.',
        because: 'A caption that repeats the step gets read twice and adds nothing the second time.',
        fix: {
          label: 'Drop the caption',
          apply: (d) => setCaption(d, null),
        },
      })
    }
  }

  if (!keepsContext(draft.crop)) {
    findings.push({
      kind: 'context',
      blocking: false,
      message:
        'This is cropped in very close. Leaving a little of the surrounding screen helps ' +
        'the reader find the same place on their own.',
      because: null,
      fix: null,
    })
  }

  const resolution = checkResolution(draft.size, draft.crop, options.frame)
  if (!resolution.ok && resolution.message) {
    findings.push({
      kind: 'resolution',
      blocking: false,
      message: resolution.message,
      because: null,
      fix: null,
    })
  }

  if (options.pixels) {
    for (const finding of reviewAnnotations(options.pixels, draft.callouts, options.kit)) {
      findings.push({
        kind: 'annotation',
        // Contrast against the sampled pixels is HARD: a label nobody can read
        // is not a label. It blocks, but it blocks with a way out.
        blocking: finding.kind === 'contrast',
        message: finding.message,
        because: null,
        fix: finding.fix
          ? {
              label: 'Move it somewhere clearer',
              apply: (d) => ({ ...d, callouts: applyFix(d.callouts, finding) }),
            }
          : null,
      })
    }
  }

  // The mandatory item goes first, never last in a list of optional ones.
  return findings.sort((a, b) => Number(b.blocking) - Number(a.blocking))
}

function tokens(text: string): Set<string> {
  return new Set(
    plainText(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3),
  )
}

/** Share of the caption's own words that also appear in the step. */
export function tokenOverlap(caption: string, step: string): number {
  const a = tokens(caption)
  const b = tokens(step)
  if (a.size === 0) return 0
  let shared = 0
  for (const word of a) if (b.has(word)) shared++
  return shared / a.size
}

export function isReady(draft: Draft): boolean {
  return mayAttach(draft.phi) && draft.alt.trim().length > 0
}

/** The model object, once the draft has everything it needs. */
export function toScreenshot(draft: Draft, assetId: string): Screenshot | null {
  if (!isReady(draft)) return null
  return {
    asset_id: assetId,
    alt: draft.alt.trim(),
    caption: draft.caption?.trim() || null,
    callouts: draft.callouts.slice(0, MAX_CALLOUTS),
  }
}

/**
 * Renders the crop at 300 PPI for the width it will actually print at, and
 * downsamples for preview — never the reverse. Browser-only: it needs a canvas.
 */
export async function bake(
  draft: Draft,
  frame: Frame,
): Promise<{ print: string; preview: string }> {
  const image = await loadImage(draft.source)
  const targetPx = requiredPixels(renderWidthIn(frame))
  const cropPx = {
    x: draft.crop.x * image.width,
    y: draft.crop.y * image.height,
    w: draft.crop.width * image.width,
    h: draft.crop.height * image.height,
  }

  // Never upsample past what was captured: it invents detail that was never
  // there and makes a soft picture look like a sharp one.
  const printWidth = Math.min(targetPx, Math.round(cropPx.w))
  const print = drawTo(image, cropPx, printWidth)
  const preview = drawTo(image, cropPx, Math.min(printWidth, 900))
  return { print, preview }
}

function drawTo(
  image: HTMLImageElement,
  crop: { x: number; y: number; w: number; h: number },
  width: number,
): string {
  const canvas = document.createElement('canvas')
  const scale = width / crop.w
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(crop.h * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No 2D context available.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That file could not be read as a picture.'))
    image.src = source
  })
}

export type { ResolutionCheck, AnnotationFinding, CropRect, PixelSize }
