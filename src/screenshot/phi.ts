/**
 * PHI acknowledgment — §14, with the three requirements the design makes
 * explicit.
 *
 * The acknowledgment **lists what to look for** rather than asking for a
 * blanket attestation. A blanket attestation is a checkbox someone ticks; a
 * list is something they actually check the picture against.
 *
 * "The picture never leaves this computer" sits next to the drop zone at the
 * same size as everything else. It is the claim that makes the app usable
 * without a security review, so it is not fine print.
 */

/** What the author is asked to look for, in the order they would scan an image. */
export const PHI_CHECKLIST = [
  'A patient’s name, anywhere on screen — including the banner bar across the top',
  'A date of birth, or an age with a date beside it',
  'A medical record number, account number, or visit number',
  'A room or bed number',
  'Anything in a chart that belongs to a real person rather than a test patient',
] as const

export const PHI_PROMPT = 'Have a look at the picture and check for these before you add it.'

export const PHI_CONFIRMATION = 'I have checked. There is no patient information in this picture.'

/**
 * Sits beside the drop zone, at the same size as everything else on the screen.
 * Never in fine print, never behind a link.
 */
export const CLIENT_SIDE_PROMISE =
  'The picture never leaves this computer. Nothing here is uploaded anywhere.'

/** Optional things that look mandatory are how forms get abandoned — §14. */
export const SKIP_LABEL = 'Skip the picture'

export interface PhiAcknowledgment {
  confirmed: boolean
  /** When they confirmed it, so the document can record that they did. */
  at: string | null
}

export function unacknowledged(): PhiAcknowledgment {
  return { confirmed: false, at: null }
}

export function acknowledge(now = new Date()): PhiAcknowledgment {
  return { confirmed: true, at: now.toISOString() }
}

/**
 * An image cannot be attached to a step until the acknowledgment is given. This
 * is a gate on *adding the picture*, not on export — the only thing that blocks
 * export is alt text.
 */
export function mayAttach(ack: PhiAcknowledgment): boolean {
  return ack.confirmed
}
