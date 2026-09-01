/**
 * The content model — spec §9, as amended by the deltas file.
 *
 * Content is JSON. It is never markup, never HTML, never markdown. Every
 * emitter reads this and nothing else.
 *
 * The spec's twenty named section types collapse to one section shape with
 * five variants (deltas §9.2). The app only ever needs to know the shape, in
 * order to lay the section out; naming a clinical expert's own content for
 * them was the part that had no justification.
 */

import type {
  AudienceId,
  BlueprintId,
  CalloutLevel,
  DateSublabelId,
  Register,
  Shape,
  SystemId,
} from './vocabularies'

export const SCHEMA_VERSION = '1.0'

export interface DocumentMeta {
  audience: AudienceId[]
  systems: SystemId[]
  system_version: string | null
  /** ISO 8601 date. A real date, never a string like `current` — §9.1. */
  effective_date: string | null
  /** Changes the displayed label only. The field is one field. */
  effective_date_sublabel: DateSublabelId
  owner: string
  last_reviewed: string | null
  version: string
  /** Section ids the author flagged as unconfirmed — §9.1. */
  needs_verification: string[]
}

/**
 * A "check yourself" question — §12.3, on by default and removable.
 *
 * Retrieval practice is one of the strongly-supported findings, and the
 * feedback is what carries it: with an answer available the effect nearly
 * doubles (g 0.73 against 0.39). So §12.1 makes it HARD that a question
 * cannot be saved without its answer — a question with no answer is the
 * weaker intervention wearing the stronger one's clothes.
 *
 * This is app-owned shell, like the title block and the change log. It is not
 * a sixth author shape: the five shapes remain the whole vocabulary.
 */
export interface RetrievalQuestion {
  id: string
  question: string
  answer: string
}

export interface ChangeLogEntry {
  version: string
  date: string
  author: string
  summary: string
}

/* ---------------------------------------------------------------- steps -- */

export type SubstepKind = 'branch' | 'option' | 'gloss'

export interface Substep {
  kind: SubstepKind
  text: string
}

export interface ImageCallout {
  /** Fractions of the image's own width and height, 0–1. */
  x: number
  y: number
  label: string
}

export interface Screenshot {
  asset_id: string
  /** Required. The one thing that blocks export — §12.1. */
  alt: string
  caption: string | null
  /** Maximum four, per Cowan's ~4-chunk limit — §7.6. */
  callouts: ImageCallout[]
}

export interface Step {
  id: string
  /** Left cell: 3–5 words, verb-first, no period, not bold — §9.3. */
  intent: string
  /** Right cell: 8–25 words, full sentence. `[[…]]` marks UI targets. */
  action: string
  /** Declarative present, never future — §9.3. */
  system_response: string | null
  /** Renders as an arrow chain. Its own field so authors stop typing arrows. */
  path: string[]
  /**
   * Separable from `action` because the expert cut drops the gloss and keeps
   * the action — deltas §12.4.
   */
  substeps: Substep[]
  screenshot: Screenshot | null
}

/* ------------------------------------------------------------- sections -- */

export interface StepsContent {
  numbering: 'restart' | 'continue'
  steps: Step[]
}

export interface ParagraphContent {
  body: string
}

export interface TableContent {
  columns: string[]
  rows: string[][]
}

export interface CalloutContent {
  level: CalloutLevel
  body: string
}

export interface FigureContent {
  screenshot: Screenshot | null
}

export type SectionContent =
  | ({ shape: 'steps' } & StepsContent)
  | ({ shape: 'paragraph' } & ParagraphContent)
  | ({ shape: 'table' } & TableContent)
  | ({ shape: 'callout' } & CalloutContent)
  | ({ shape: 'figure' } & FigureContent)

export interface Section {
  id: string
  /** Author-written free text. The app never supplies a section name. */
  title: string
  shape: Shape
  content: SectionContent
  register: Register
}

export interface DocumentBody {
  blueprint: BlueprintId
  /** Null until the author drops in a brand file; the plain kit renders. */
  brand_kit_id: string | null
  title: string
  meta: DocumentMeta
  sections: Section[]
  change_log: ChangeLogEntry[]
  /** Rendered in the scaffolded cut only — it is assistance, by definition. */
  retrieval: RetrievalQuestion[]
}

export interface ContentDocument {
  schema_version: string
  document: DocumentBody
}

/* --------------------------------------------------------- constructors -- */

let counter = 0
const nextId = (prefix: string) => `${prefix}${++counter}`

export function emptyDocument(blueprint: BlueprintId): ContentDocument {
  return {
    schema_version: SCHEMA_VERSION,
    document: {
      blueprint,
      brand_kit_id: null,
      title: '',
      meta: {
        audience: [],
        systems: [],
        system_version: null,
        effective_date: null,
        effective_date_sublabel: 'effective',
        owner: '',
        last_reviewed: null,
        version: '1.0',
        needs_verification: [],
      },
      sections: [],
      change_log: [],
      retrieval: [],
    },
  }
}

export function newQuestion(): RetrievalQuestion {
  return { id: nextId('q'), question: '', answer: '' }
}

/** A question is only saveable once it carries its answer — §12.1. */
export function questionIsComplete(question: RetrievalQuestion): boolean {
  return question.question.trim().length > 0 && question.answer.trim().length > 0
}

export function newSection(title: string, shape: Shape): Section {
  return {
    id: nextId('s'),
    title,
    shape,
    content: emptyContent(shape),
    register: 'both',
  }
}

export function newStep(): Step {
  return {
    id: nextId('st'),
    intent: '',
    action: '',
    system_response: null,
    path: [],
    substeps: [],
    screenshot: null,
  }
}

export function emptyContent(shape: Shape): SectionContent {
  switch (shape) {
    case 'steps':
      return { shape, numbering: 'restart', steps: [newStep()] }
    case 'paragraph':
      return { shape, body: '' }
    case 'table':
      return { shape, columns: ['', ''], rows: [['', '']] }
    case 'callout':
      return { shape, level: 'note', body: '' }
    case 'figure':
      return { shape, screenshot: null }
  }
}

/** Insert at any index — adding in the middle is the common case (deltas §5b). */
export function insertSection(sections: Section[], section: Section, index: number): Section[] {
  const next = sections.slice()
  next.splice(Math.max(0, Math.min(index, sections.length)), 0, section)
  return next
}
