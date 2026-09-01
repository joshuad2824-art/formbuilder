/**
 * The review screen's model — §12.1, deltas §6 screen 8.
 *
 * "Suggestions before you finish." Offers, not a report. The one blocking item
 * sits first and the declinable suggestions scroll below it: **the mandatory
 * item is never last in a list of optional ones.**
 */

import type { DocumentBody } from '../model/content'
import type { BrandKit } from '../brandkit/types'
import type { Frame } from '../geometry/blueprints'
import { blockers, checkHard, type HardViolation } from './hard'
import { reviewDocument, type Offer } from './warnings'

export interface ReviewItem {
  kind: 'blocking' | 'offer'
  where: string
  what: string
  why: string | null
  fixLabel: string | null
  declineLabel: string | null
}

export interface Review {
  items: ReviewItem[]
  /** Export is permitted when nothing blocks it. Warnings never block. */
  canExport: boolean
}

export function buildReview(document: DocumentBody, kit: BrandKit, frame: Frame): Review {
  const hard = checkHard(document, kit, frame)
  const blocking = blockers(hard)
  const offers = reviewDocument(document)

  return {
    // Blocking first, always.
    items: [...blocking.map(fromViolation), ...offers.map(fromOffer)],
    canExport: blocking.length === 0,
  }
}

function fromViolation(violation: HardViolation): ReviewItem {
  return {
    kind: 'blocking',
    where: violation.where,
    what: violation.message,
    why: null,
    fixLabel: null,
    declineLabel: null,
  }
}

function fromOffer(offer: Offer): ReviewItem {
  return {
    kind: 'offer',
    where: offer.where,
    what: offer.what,
    why: offer.why,
    fixLabel: offer.fix?.label ?? null,
    declineLabel: offer.decline,
  }
}

/** Applies one offer's fix. Everything else is left exactly as written. */
export function applyOffer(document: DocumentBody, offer: Offer): DocumentBody {
  return offer.fix ? offer.fix.apply(document) : document
}
