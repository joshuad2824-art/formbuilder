/**
 * WARNING rules — §12.2, as amended by the deltas file.
 *
 * **Every warning is an offer with a specific fix and an equally easy decline.**
 * A warning that cannot be comfortably declined is a block wearing a friendlier
 * hat. Each states *what*, then *why* in one sentence, then offers a fix the app
 * performs itself — "change it to `Check that…`", never "revise wording".
 *
 * Two things are deliberately absent:
 *
 *  - **The readability score.** Not shown, not scored, not stored, and it never
 *    gates export. Nothing is auto-rewritten to lower one. It is the weakest and
 *    most gameable rule in the set, and score-gaming produces choppier text with
 *    no comprehension gain.
 *
 *  - **Any rule whose effect size rests only on Mayer's own box scores**, held
 *    lightly rather than built to hold. §12's own caution: treat every
 *    Mayer-derived number as an upper bound.
 */

import type { DocumentBody, Section, Step } from '../model/content'
import { plainText } from '../model/inline'
import { mayRewrite } from './hard'

export type WarningId =
  | 'table-too-long'
  | 'sentence-too-long'
  | 'passive-voice'
  | 'not-imperative'
  | 'title-not-verb-first'
  | 'callout-inflation'
  | 'emphasis-inflation'
  | 'no-prerequisites'
  | 'reader-test'

export interface Offer {
  id: WarningId
  /** The section or step it belongs to, so the card can point at it. */
  where: string
  /** What. One line. */
  what: string
  /** Why. Exactly one sentence. */
  why: string
  /** A fix the app performs itself — or null when only the author can act. */
  fix: { label: string; apply: (document: DocumentBody) => DocumentBody } | null
  /** The decline is as easy to press as the accept. */
  decline: string
}

const DECLINE = 'Leave it as it is'

/* ------------------------------------------------------------ the rules -- */

/** >7 rows without a break; the default chunk is 4 — strong for the capacity limit. */
export function tableTooLong(document: DocumentBody): Offer[] {
  return document.sections.flatMap((section) => {
    if (section.content.shape !== 'steps') return []
    const count = section.content.steps.length
    if (count <= 7) return []
    return [
      {
        id: 'table-too-long' as const,
        where: section.id,
        what: `“${section.title}” runs to ${count} steps without a break.`,
        why: 'Past about seven, a reader loses their place and starts again from the top.',
        fix: {
          label: `Split it after step 4`,
          apply: (doc) => splitSteps(doc, section.id, 4),
        },
        decline: DECLINE,
      },
    ]
  })
}

function splitSteps(document: DocumentBody, sectionId: string, after: number): DocumentBody {
  const index = document.sections.findIndex((s) => s.id === sectionId)
  const section = document.sections[index]
  if (!section || section.content.shape !== 'steps') return document

  const head = section.content.steps.slice(0, after)
  const tail = section.content.steps.slice(after)
  if (tail.length === 0) return document

  const first: Section = { ...section, content: { ...section.content, steps: head } }
  const second: Section = {
    ...section,
    id: `${section.id}b`,
    // The author named the section; the app does not rename it for them. It
    // carries the same name with "continued", which is what the print rule does
    // at a page break too.
    title: `${section.title}, continued`,
    content: { ...section.content, numbering: 'continue', steps: tail },
  }

  const sections = document.sections.slice()
  sections.splice(index, 1, first, second)
  return { ...document, sections }
}

/** >25 words per sentence — good evidence, plain language. */
const SENTENCE_LIMIT = 25

export function sentenceTooLong(document: DocumentBody): Offer[] {
  const offers: Offer[] = []
  for (const section of document.sections) {
    // IMPORTANT and REQUIREMENTS are exempt from any rewrite. Not warned about,
    // because a warning whose only fix is forbidden is just noise.
    if (!mayRewrite(section)) continue
    if (section.content.shape !== 'paragraph') continue
    const body = plainText(section.content.body)
    for (const sentence of body.split(/(?<=[.!?])\s+/)) {
      const words = sentence.trim().split(/\s+/).filter(Boolean)
      if (words.length > SENTENCE_LIMIT) {
        offers.push({
          id: 'sentence-too-long',
          where: section.id,
          what: `A sentence in “${section.title}” runs to ${words.length} words.`,
          why: 'Long sentences are where a reader in a hurry loses the thread.',
          fix: null,
          decline: DECLINE,
        })
        break
      }
    }
  }
  return offers
}

/**
 * Passive voice in step text. Good evidence, and the fix is mechanical enough
 * that the app can offer the actual replacement rather than a scolding.
 */
const PASSIVE = /\b(?:is|are|was|were|be|been|being)\s+(\w+(?:ed|en))\b/i

export function passiveVoice(document: DocumentBody): Offer[] {
  const offers: Offer[] = []
  for (const section of document.sections) {
    if (section.content.shape !== 'steps') continue
    for (const step of section.content.steps) {
      const match = PASSIVE.exec(plainText(step.action))
      if (match) {
        offers.push({
          id: 'passive-voice',
          where: step.id,
          what: `“${truncate(step.action)}” describes what happens rather than what to do.`,
          why: 'A step reads faster when it starts with the action the reader takes.',
          fix: null,
          decline: DECLINE,
        })
      }
    }
  }
  return offers
}

/**
 * A step that opens with a fuzzy verb. Weak — a practitioner heuristic, not a
 * finding — so it offers a specific replacement and is trivially declined.
 */
const FUZZY_OPENERS: Record<string, string> = {
  know: 'Check that',
  understand: 'Check that',
  'be aware': 'Check that',
  remember: 'Check that',
  ensure: 'Check that',
  note: 'Check that',
}

export function notImperative(document: DocumentBody): Offer[] {
  const offers: Offer[] = []
  for (const section of document.sections) {
    if (section.content.shape !== 'steps') continue
    for (const step of section.content.steps) {
      const action = plainText(step.action).trim()
      const opener = Object.keys(FUZZY_OPENERS).find((word) =>
        action.toLowerCase().startsWith(word),
      )
      if (!opener) continue
      const replacement = FUZZY_OPENERS[opener]!
      offers.push({
        id: 'not-imperative',
        where: step.id,
        what: `“${truncate(step.action)}” asks the reader to know something rather than do something.`,
        why: 'A job aid works when every line is something the reader can act on.',
        fix: {
          // The fix is the actual replacement text, performed by the app — not
          // an instruction to "revise wording".
          label: `Change it to “${replacement}…”`,
          apply: (doc) => rewriteStep(doc, step.id, (text) => replaceOpener(text, opener, replacement)),
        },
        decline: DECLINE,
      })
    }
  }
  return offers
}

function replaceOpener(text: string, opener: string, replacement: string): string {
  // "Know that the plan…" replaced with "Check that" would leave "Check that
  // that the plan…". Where the replacement already carries the conjunction,
  // absorb the one that follows.
  const carriesThat = /\bthat$/i.test(replacement)
  const pattern = new RegExp(`^\\s*${opener}\\b${carriesThat ? '(\\s+that\\b)?' : ''}`, 'i')
  return text.replace(pattern, replacement)
}

function rewriteStep(
  document: DocumentBody,
  stepId: string,
  transform: (action: string) => string,
): DocumentBody {
  return {
    ...document,
    sections: document.sections.map((section) => {
      if (section.content.shape !== 'steps') return section
      return {
        ...section,
        content: {
          ...section.content,
          steps: section.content.steps.map((step: Step) =>
            step.id === stepId ? { ...step, action: transform(step.action) } : step,
          ),
        },
      }
    }),
  }
}

/** Bolded runs over 10% of a step block — the weakest of the signaling set. */
export function emphasisInflation(document: DocumentBody): Offer[] {
  const offers: Offer[] = []
  for (const section of document.sections) {
    if (section.content.shape !== 'steps') continue
    for (const step of section.content.steps) {
      const full = plainText(step.action).length
      const marked = [...step.action.matchAll(/\[\[([^\]]+)\]\]/g)].reduce(
        (sum, m) => sum + m[1]!.length,
        0,
      )
      if (full > 0 && marked / full > 0.4) {
        offers.push({
          id: 'emphasis-inflation',
          where: step.id,
          what: `Most of “${truncate(step.action)}” is marked as something on screen.`,
          why: 'If everything is emphasised, nothing is.',
          fix: null,
          decline: DECLINE,
        })
      }
    }
  }
  return offers
}

/**
 * The enforcement that moved off the section catalog and onto the review screen
 * — deltas §9.2.
 *
 * Prerequisites appeared as a labelled section in 0 of 24 documents, despite
 * being in the house structure. Free-named sections give up the slot that would
 * have forced them, so the question is asked here instead — as a question, not
 * as a vocabulary.
 */
export function noPrerequisites(document: DocumentBody): Offer[] {
  const hasSteps = document.sections.some((s) => s.content.shape === 'steps')
  if (!hasSteps) return []
  const firstSteps = document.sections.findIndex((s) => s.content.shape === 'steps')
  const before = document.sections.slice(0, firstSteps)
  // Anything the author wrote before the first step could be prerequisites.
  // The app does not try to identify it — it asks.
  if (before.length >= 2) return []
  return [
    {
      id: 'no-prerequisites',
      where: document.sections[firstSteps]?.id ?? '',
      what: 'Does anyone need something in hand before step 1?',
      why: 'Access, a role, or a screen already open — the thing that sends someone away halfway through.',
      fix: null,
      decline: 'No, they can start straight away',
    },
  ]
}

/**
 * The reader test. The library calls it the single highest-value step, so a
 * plain dismissal would delete the most valuable nudge in the set forever —
 * it offers a reminder instead.
 */
export function readerTest(): Offer[] {
  return [
    {
      id: 'reader-test',
      where: '',
      what: 'Have three to five people who will use this actually try it.',
      why: 'It is the one step that reliably finds the thing everybody else missed.',
      fix: null,
      decline: 'Remind me in a week',
    },
  ]
}

/* ------------------------------------------------------------ the suite -- */

export function reviewDocument(document: DocumentBody): Offer[] {
  return [
    ...tableTooLong(document),
    ...noPrerequisites(document),
    ...notImperative(document),
    ...passiveVoice(document),
    ...sentenceTooLong(document),
    ...emphasisInflation(document),
    ...readerTest(),
  ]
}

function truncate(text: string, at = 48): string {
  const plain = plainText(text).trim()
  return plain.length > at ? `${plain.slice(0, at).trimEnd()}…` : plain
}
