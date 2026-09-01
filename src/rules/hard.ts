/**
 * HARD rules — §12.1. The renderer enforces these silently. No user-facing
 * choice, no warning card, no override.
 *
 * The distinction that matters: a HARD rule is not "a warning we feel strongly
 * about." It is a rule with no sensible other side, so putting it to the author
 * would only be theatre. Everything the author could reasonably decide
 * differently belongs in `warnings.ts` instead.
 *
 * Most of these are enforced structurally — in the renderer's markup and CSS,
 * where they cannot be forgotten. What lives here is the subset that has to be
 * checked against content: the ones that can be violated by what someone wrote
 * rather than by how it was laid out.
 */

import type { DocumentBody, Section } from '../model/content'
import { plainText, prose } from '../model/inline'
import type { BrandKit } from '../brandkit/types'
import { contrastHex, requiredRatio } from '../brandkit/contrast'
import { BODY_MIN_PT, TABLE_CELL_MIN_PT } from '../geometry/constants'
import { typeScale, type Frame } from '../geometry/blueprints'

export interface HardViolation {
  rule: string
  where: string
  /** What the author sees, when they see anything at all. Usually nothing. */
  message: string
  /** Alt text is the only one of these the author meets as a block. */
  blocksExport: boolean
}

/* ----------------------------------------------------------------- text -- */

/**
 * `important` and `requirements` text is exempt from all simplification and
 * truncation — §12.1.
 *
 * Automated simplification of clinical text omitted 30% of critical information
 * in one study. More readable but inaccurate is worse than no access. This is
 * the exemption expressed as a predicate, so every transform in the app has one
 * place to ask.
 */
const EXEMPT_LEVELS = new Set(['important', 'requirements'])

export function mayRewrite(section: Section): boolean {
  if (section.content.shape !== 'callout') return true
  return !EXEMPT_LEVELS.has(section.content.level)
}

export function mayTruncate(section: Section): boolean {
  return mayRewrite(section)
}

/**
 * Acronyms expanded on first use — §12.1. The library does this well already:
 * "HIM Refusal Inbox (HIM = Health Information Management)".
 *
 * Deliberately narrow: an all-caps run of 2–6 letters that never appears with a
 * parenthetical nearby. Product names and UI labels are excluded, because the
 * author marked those and they are not acronyms to expand.
 */
const ACRONYM = /\b([A-Z]{2,6})\b/g

/** Never flagged: units, standard abbreviations, and the app's own vocabulary. */
const KNOWN = new Set([
  'AM', 'PM', 'ID', 'OK', 'US', 'IT', 'PC', 'PDF', 'URL', 'FAQ', 'ED', 'OR', 'ICU',
  'MRN', 'DOB', 'PHI', 'NOTE', 'TIP', 'A', 'I',
])

export function unexpandedAcronyms(document: DocumentBody): string[] {
  const seen = new Set<string>()
  const expanded = new Set<string>()
  const found: string[] = []

  for (const text of documentText(document)) {
    // An expansion is a parenthetical within a short distance of the term.
    for (const match of text.matchAll(/\b([A-Z]{2,6})\b\s*\(([^)]{3,})\)/g)) {
      expanded.add(match[1]!)
    }
    for (const match of text.matchAll(/\(([^)]*?)\b([A-Z]{2,6})\b([^)]*?)\)/g)) {
      expanded.add(match[2]!)
    }
    for (const match of text.matchAll(ACRONYM)) {
      const term = match[1]!
      if (KNOWN.has(term) || expanded.has(term) || seen.has(term)) continue
      seen.add(term)
      found.push(term)
    }
  }

  return found.filter((term) => !expanded.has(term))
}

/**
 * Store caps as normal case plus `text-transform`, never as literal caps —
 * §12.1. Screen readers spell literal caps out letter by letter, so a stored
 * "IMPORTANT" is read as I-M-P-O-R-T-A-N-T.
 */
export function hasLiteralCaps(text: string): boolean {
  return /\b[A-Z]{4,}\b/.test(plainText(text).replace(/\b(?:[A-Z]{2,6})\b(?=\s*\()/g, ''))
}

export function normaliseCaps(text: string): string {
  return text.replace(/\b([A-Z]{4,})\b/g, (word) => word.charAt(0) + word.slice(1).toLowerCase())
}

/* ------------------------------------------------------------- document -- */

/**
 * The author's prose, for rules about writing.
 *
 * Marked runs are excluded rather than unwrapped: a UI control's name and a
 * literal string the user types are both names the author did not choose, and
 * a rule that reads them ends up demanding someone expand an acronym that is
 * simply the text on a button.
 */
function documentText(document: DocumentBody): string[] {
  const out: string[] = [document.title]
  for (const section of document.sections) {
    out.push(section.title)
    const content = section.content
    switch (content.shape) {
      case 'paragraph':
      case 'callout':
        out.push(prose(content.body))
        break
      case 'table':
        out.push(...content.columns, ...content.rows.flat().map(prose))
        break
      case 'steps':
        for (const step of content.steps) {
          out.push(prose(step.intent), prose(step.action))
          if (step.system_response) out.push(prose(step.system_response))
          for (const sub of step.substeps) out.push(prose(sub.text))
        }
        break
      case 'figure':
        if (content.screenshot) out.push(content.screenshot.alt)
        break
    }
  }
  return out
}

/** Every image carries alt text. Export is blocked without it — §12.1. */
export function missingAltText(document: DocumentBody): HardViolation[] {
  const violations: HardViolation[] = []
  for (const section of document.sections) {
    const shots =
      section.content.shape === 'steps'
        ? section.content.steps.map((step) => [step.id, step.screenshot] as const)
        : section.content.shape === 'figure'
          ? [[section.id, section.content.screenshot] as const]
          : []

    for (const [id, shot] of shots) {
      if (shot && !shot.alt.trim()) {
        violations.push({
          rule: 'alt-text',
          where: id,
          message:
            'This picture needs a sentence describing what it shows — someone using a ' +
            'screen reader gets nothing from it otherwise.',
          blocksExport: true,
        })
      }
    }
  }
  return violations
}

/**
 * Retrieval questions cannot be saved without an answer — §12.1.
 *
 * Feedback is what carries retrieval practice: with an answer available the
 * effect nearly doubles (g 0.73 against 0.39). A question with no answer is
 * the weaker intervention wearing the stronger one's clothes, so this blocks
 * rather than warns.
 */
export function incompleteQuestions(document: DocumentBody): HardViolation[] {
  return document.retrieval
    .filter((q) => q.question.trim() && !q.answer.trim())
    .map((q) => ({
      rule: 'retrieval-answer',
      where: q.id,
      message:
        `“${q.question.trim()}” needs its answer written out too — a question a reader ` +
        'cannot check themselves against does most of the work and none of the good.',
      blocksExport: true,
    }))
}

/**
 * Nothing renders above the document's purpose, and prerequisites render above
 * step 1 — §12.1 (BLUF, and pre-training). Enforced as an ordering the renderer
 * applies, not as a rule the author is told about: the author named their own
 * sections and should not be lectured about where they go.
 */
export function orderingIsSound(document: DocumentBody): boolean {
  const firstSteps = document.sections.findIndex((s) => s.content.shape === 'steps')
  if (firstSteps <= 0) return true
  // Something has to precede the first step list: a purpose, prerequisites, or
  // both. What it is called is the author's business.
  return document.sections.slice(0, firstSteps).some((s) => s.content.shape !== 'callout')
}

/* --------------------------------------------------------------- render -- */

/**
 * Contrast at the sizes this geometry actually renders — §12.1. Checked against
 * the kit's real fills, including callout grounds, at the real point size.
 */
export function contrastViolations(kit: BrandKit, frame: Frame): HardViolation[] {
  const violations: HardViolation[] = []
  const scale = typeScale(frame)

  for (const callout of kit.callouts) {
    const fill = kit.color[callout.color]
    if (!fill) continue
    const text = callout.text === 'black' ? '#000000' : '#ffffff'
    const ratio = contrastHex(text, fill.hex)
    if (ratio === null) continue
    const need = requiredRatio(scale.body, false)
    if (ratio < need) {
      violations.push({
        rule: 'contrast',
        where: `callout.${callout.key}`,
        message: `${callout.label} text is ${ratio.toFixed(2)}:1 on its own fill and needs ${need}:1.`,
        blocksExport: false,
      })
    }
  }
  return violations
}

/** Type floors. The fit-to-page engine may never go below them — §12.1. */
export function sizeFloorsHold(frame: Frame): boolean {
  const scale = typeScale(frame)
  return scale.body >= BODY_MIN_PT && scale.tableCell >= TABLE_CELL_MIN_PT
}

/**
 * Everything HARD that can be checked against content rather than layout.
 * Layout-side rules — keep-together, no vertical rules, banding thresholds, the
 * baseline grid, mirrored margins — are enforced in the renderer's own CSS,
 * where they cannot be forgotten.
 */
export function checkHard(
  document: DocumentBody,
  kit: BrandKit,
  frame: Frame,
): HardViolation[] {
  return [
    ...missingAltText(document),
    ...incompleteQuestions(document),
    ...contrastViolations(kit, frame),
    ...unexpandedAcronyms(document).map(
      (term): HardViolation => ({
        rule: 'acronym',
        where: term,
        message: `“${term}” is used without saying what it stands for the first time.`,
        blocksExport: true,
      }),
    ),
  ]
}

/** Export is blocked only by things that genuinely cannot ship. */
export function blockers(violations: HardViolation[]): HardViolation[] {
  return violations.filter((v) => v.blocksExport)
}
