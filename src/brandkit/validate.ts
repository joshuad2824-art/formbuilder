/**
 * The brand kit validator — §10 plus the additions in deltas §10.
 *
 * A kit that fails does not load. It reports which token failed and why, in one
 * plain sentence, and the first screen offers the plain look instead of a
 * dead end.
 *
 * One rule deliberately *not* implemented: "no two callout levels may share a
 * fill." The app's own default kit gives all four the same ink fill on purpose
 * — the word carries the whole signal, which is the no-meaning-by-colour-alone
 * rule taken to its end rather than a violation of it. Implementing that as a
 * hard rule would fail `unbranded-v1`, and "carry on with a plain look" would
 * dead-end on the first screen.
 */

import { BLUEPRINTS, CALLOUT_LEVELS } from '../model/vocabularies'
import { BLACK, WHITE, contrastHex, parseHex } from './contrast'
import type { BrandKit } from './types'

export type Severity = 'error' | 'advisory'

export interface Finding {
  severity: Severity
  where: string
  /** One plain sentence. This is what the user reads. */
  message: string
}

export interface ValidationResult {
  ok: boolean
  errors: Finding[]
  advisories: Finding[]
}

const SUPPORTED_KIT_VERSIONS = ['1.0']

export function validateKit(kit: unknown, css = ''): ValidationResult {
  const errors: Finding[] = []
  const advisories: Finding[] = []
  const fail = (where: string, message: string) => errors.push({ severity: 'error', where, message })
  const warn = (where: string, message: string) =>
    advisories.push({ severity: 'advisory', where, message })

  if (typeof kit !== 'object' || kit === null) {
    return {
      ok: false,
      errors: [{ severity: 'error', where: 'file', message: 'That file has no brand information in it.' }],
      advisories: [],
    }
  }

  const k = kit as Partial<BrandKit>

  if (!k.kit_version || !SUPPORTED_KIT_VERSIONS.includes(k.kit_version)) {
    fail('kit_version', `This file was made for a different version of the app (${k.kit_version ?? 'none given'}).`)
  }
  if (!k.id) fail('id', 'The file does not say which brand it is.')
  if (!k.name) fail('name', 'The file does not carry a name to show you.')

  /* colours — every one must parse */
  const colors = k.color ?? {}
  if (Object.keys(colors).length === 0) fail('color', 'The file lists no colours.')
  for (const [name, value] of Object.entries(colors)) {
    if (!value || typeof value.hex !== 'string' || !parseHex(value.hex)) {
      fail(`color.${name}`, `The colour "${name}" is not a colour this app can read.`)
    }
  }

  /* blueprints — every declared one must be known */
  const blueprints = k.blueprints ?? []
  if (blueprints.length === 0) fail('blueprints', 'The file names no page shapes.')
  for (const b of blueprints) {
    if (!(BLUEPRINTS as readonly string[]).includes(b)) {
      fail('blueprints', `This file expects a page shape the app does not make (${b}).`)
    }
  }

  /* type */
  const type = k.type
  if (!type) fail('type', 'The file says nothing about type.')
  else {
    if (typeof type.body_size_pt !== 'number' || type.body_size_pt <= 0) {
      fail('type.body_size_pt', 'The body text size in this file is not a usable size.')
    }
    for (const slot of ['body_family', 'heading_family', 'callout_label_family'] as const) {
      const family: string | undefined = type[slot]
      if (!family || !(family in type)) {
        fail(`type.${slot}`, `The file points its ${slot.replace(/_/g, ' ')} at a typeface it does not describe.`)
      }
    }
  }

  /* callouts — the heart of the added validation */
  const callouts = k.callouts ?? []
  const seenKeys = new Set<string>()
  const labels = new Map<string, string>()

  for (const level of CALLOUT_LEVELS) {
    if (!callouts.some((c) => c.key === level)) {
      fail('callouts', `The file has no box for "${level}", so some of your writing could not be printed.`)
    }
  }

  for (const callout of callouts) {
    const where = `callouts.${callout.key}`
    if (seenKeys.has(callout.key)) fail(where, `The file describes "${callout.key}" twice.`)
    seenKeys.add(callout.key)

    // Every level carries a distinct, non-empty label. The label is what
    // distinguishes the levels, in every kit, always — deltas §10.
    const label = (callout.label ?? '').trim()
    if (!label) {
      fail(where, `One of the boxes has no word on it, and the word is what tells them apart.`)
    } else if (labels.has(label.toUpperCase())) {
      fail(where, `Two boxes are both labelled "${label}", so a reader cannot tell them apart.`)
    } else {
      labels.set(label.toUpperCase(), callout.key)
    }

    // The fill must resolve to a colour the kit declares.
    const fill = colors[callout.color]
    if (!fill) {
      fail(where, `The "${label || callout.key}" box asks for a colour the file never describes.`)
      continue
    }

    // …and must agree with the kit's own CSS for that level. A kit whose JSON
    // and CSS disagree is unverifiable by eye — that exact bug shipped once
    // during the design and rendered NOTE and REQUIREMENTS identically.
    const declared = cssFillForLevel(css, callout.key)
    if (declared && parseHex(declared) && parseHex(fill.hex)) {
      if (declared.toLowerCase() !== fill.hex.toLowerCase()) {
        fail(
          where,
          `The "${label}" box is described as ${fill.hex} but printed as ${declared}, so the file contradicts itself.`,
        )
      }
    }

    // Contrast against the actual fill, at body size.
    const textHex = callout.text === 'black' ? BLACK : WHITE
    const ratio = contrastHex(textHex, fill.hex)
    if (ratio === null) {
      fail(where, `The "${label}" box uses a colour pairing this app cannot check.`)
    } else if (ratio < 4.5) {
      const other = contrastHex(callout.text === 'black' ? WHITE : BLACK, fill.hex) ?? 0
      const suggestion = other >= 4.5 ? ` ${callout.text === 'black' ? 'White' : 'Black'} lettering would read.` : ''
      fail(
        where,
        `${callout.text === 'black' ? 'Black' : 'White'} lettering on the "${label}" box is too faint to read (${ratio.toFixed(2)} to 1, and it needs 4.5).${suggestion}`,
      )
    }
  }

  /* Two levels sharing a fill is legal. It is only worth mentioning when the
     kit has not said the sharing is deliberate. */
  if (!k.monochrome) {
    const byFill = new Map<string, string[]>()
    for (const c of callouts) {
      const hex = colors[c.color]?.hex?.toLowerCase()
      if (!hex) continue
      byFill.set(hex, [...(byFill.get(hex) ?? []), c.label])
    }
    for (const [hex, sharing] of byFill) {
      if (sharing.length > 1) {
        warn(
          'callouts',
          `${sharing.join(' and ')} print on the same colour (${hex}). That reads correctly — the word on the box carries the meaning — but if it was not intended, the file can say so.`,
        )
      }
    }
  }

  /* assets are data URIs or null — a kit file must be fully self-contained.
     Both shipped kits also put a prose `note` in this block, so only values
     that actually reference a resource are checked: an object carrying a
     `src`, or a string shaped like a URI or a path. A sentence is
     documentation, not an image. */
  for (const [name, asset] of Object.entries(k.assets ?? {})) {
    if (asset === null || asset === undefined) continue
    const src = typeof asset === 'string' ? asset : (asset as { src?: string }).src
    if (typeof src !== 'string') continue
    if (typeof asset === 'string' && !looksLikeReference(asset)) continue
    if (!src.startsWith('data:')) {
      fail(`assets.${name}`, `The ${name} image points somewhere outside the file, so it would not print.`)
    }
  }

  return { ok: errors.length === 0, errors, advisories }
}

/**
 * Distinguishes a resource reference from prose. A kit's `assets` block may
 * carry a human-readable note alongside its images; that note is not an asset
 * and must not be validated as one.
 */
function looksLikeReference(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/') || value.startsWith('./')
}

/**
 * Read the fill the kit's own CSS gives a callout level. Deliberately narrow:
 * it looks for the token this format defines and nothing else, because the app
 * never parses arbitrary HTML or reasons about a full stylesheet.
 */
export function cssFillForLevel(css: string, key: string): string | null {
  const token = new RegExp(`--callout-${key}-fill\\s*:\\s*(#[0-9a-fA-F]{3,8})`)
  const variable = token.exec(css)
  if (variable) return variable[1]!
  const rule = new RegExp(
    `\\.callout--${key}\\b[^{]*\\{[^}]*?background(?:-color)?\\s*:\\s*(#[0-9a-fA-F]{3,8})`,
    's',
  )
  const match = rule.exec(css)
  return match ? match[1]! : null
}

/** One plain sentence for the first screen, when a kit will not load. */
export function refusalMessage(result: ValidationResult): string {
  const first = result.errors[0]
  if (!first) return ''
  const more = result.errors.length - 1
  return more > 0
    ? `${first.message} (${more} other thing${more === 1 ? '' : 's'} in the file needs fixing too.)`
    : first.message
}
