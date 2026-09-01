/**
 * The two-variant architecture — deltas §12.4.
 *
 * The strongest evidence-backed finding in the research set: high-assistance
 * materials help novices (d = 0.505) and actively harm experts (d = -0.428).
 * So one submission produces two documents, from one filter on `register` —
 * not from a second template.
 *
 * The one thing the expert path may not touch: `important` and `requirements`
 * callouts are byte-identical in both cuts.
 */

import type { Section, DocumentBody } from './content'
import type { Variant } from './vocabularies'

/** Callout levels the expert cut may never alter, drop, or shorten. */
const PROTECTED_LEVELS = new Set(['important', 'requirements'])

export function isProtected(section: Section): boolean {
  return section.content.shape === 'callout' && PROTECTED_LEVELS.has(section.content.level)
}

function expertSection(section: Section): Section {
  if (isProtected(section)) return section
  if (section.content.shape !== 'steps') return section

  // The expert cut drops glosses and screenshots and keeps the action. That is
  // why the step object holds the gloss separably — deltas §12.4.
  return {
    ...section,
    content: {
      ...section.content,
      steps: section.content.steps.map((step) => ({
        ...step,
        substeps: step.substeps.filter((s) => s.kind !== 'gloss'),
        screenshot: null,
      })),
    },
  }
}

export function filterSections(sections: Section[], variant: Variant): Section[] {
  if (variant === 'scaffolded') return sections
  return sections.filter((s) => s.register !== 'scaffolded').map(expertSection)
}

export function cut(document: DocumentBody, variant: Variant): DocumentBody {
  return { ...document, sections: filterSections(document.sections, variant) }
}

/**
 * The expert cut renders step lists as tables rather than as lists — §12.4.
 * The renderer asks this rather than reading `variant` directly, so the rule
 * lives in one place.
 */
export function stepsRenderAs(variant: Variant): 'list' | 'table' {
  return variant === 'expert' ? 'table' : 'list'
}
