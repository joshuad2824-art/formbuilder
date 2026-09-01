/**
 * Inline markup — §9.3.
 *
 * Two marks exist in the model and neither is ever shown to the author:
 *
 *   [[double brackets]]  a UI target — a button, tab, field, menu item, status
 *   `backticks`          a literal string the user types
 *
 * The author types a control's name plainly and the editor marks it; the model
 * still receives the markup (deltas §9.3). `[[ ]]` is not applied to the huddle
 * card at all — that blueprint bolds dates, statuses, URLs and credentials
 * instead, and never a UI control.
 */

import type { BlueprintId } from './vocabularies'

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'ui'; text: string }
  | { kind: 'literal'; text: string }

const PATTERN = /\[\[([^\]]+)\]\]|`([^`]+)`/g

export function tokenize(source: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let cursor = 0
  for (const match of source.matchAll(PATTERN)) {
    const at = match.index
    if (at > cursor) tokens.push({ kind: 'text', text: source.slice(cursor, at) })
    if (match[1] !== undefined) tokens.push({ kind: 'ui', text: match[1] })
    else if (match[2] !== undefined) tokens.push({ kind: 'literal', text: match[2] })
    cursor = at + match[0].length
  }
  if (cursor < source.length) tokens.push({ kind: 'text', text: source.slice(cursor) })
  return tokens
}

/** The plain string, with every mark removed. Used for measuring and counting. */
export function plainText(source: string): string {
  return tokenize(source)
    .map((t) => t.text)
    .join('')
}

/**
 * The author's own prose, with marked runs removed rather than unwrapped.
 *
 * Anything the author marked is a name they did not invent: a control on
 * screen, or a string typed verbatim. Rules about *writing* — expanding an
 * acronym on first use, say — must not read those runs, or they demand an
 * author explain what `REF` stands for when `REF` is simply what gets typed
 * into the box.
 */
export function prose(source: string): string {
  return tokenize(source)
    .filter((t) => t.kind === 'text')
    .map((t) => t.text)
    .join(' ')
}

/** The huddle card gets no UI-control bolding — deltas §9.3. */
export function uiMarksApply(blueprint: BlueprintId): boolean {
  return blueprint !== 'huddle_card'
}

/**
 * Micro-typography, applied silently — §7.5 / §12.1. The library calls these
 * "the fastest tell of amateur vs. pro". Deliberately conservative: it only
 * touches cases that are unambiguous from context.
 */
export function microTypography(source: string): string {
  return (
    source
      // Real ellipsis.
      .replace(/\.\.\./g, '…')
      // En dash for numeric and date ranges (July 5-9, 918-744-3088 is left alone
      // by requiring spaces or a following capital letter word boundary).
      .replace(/(\d)\s*-\s*(\d)/g, (whole, a: string, b: string) =>
        whole.includes(' ') ? `${a}–${b}` : whole,
      )
      // Em dash for a spaced sentence break. Written as escapes so the space
      // characters are unambiguous — an invisible thin space here would be a
      // hidden typographic decision nobody chose.
      .replace(/ -- /g, ' — ')
      // Curly apostrophes and quotes.
      .replace(/(\w)'(\w)/g, '$1’$2')
      .replace(/(^|[\s(\[])"/g, '$1“')
      .replace(/"/g, '”')
      .replace(/(^|[\s(\[])'/g, '$1‘')
      .replace(/'/g, '’')
      // One space between sentences.
      .replace(/([.!?])\s{2,}(?=[A-Z“])/g, '$1 ')
  )
}
