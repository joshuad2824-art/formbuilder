/**
 * Reading a brand kit file.
 *
 * The app parses the JSON block in `<script type="application/json"
 * id="brand-kit">` and never parses arbitrary HTML. The kit's `<style>` block
 * is carried through verbatim into rendered documents, but it is never
 * interpreted beyond the one narrow token lookup the validator does.
 */

import { validateKit, refusalMessage, type ValidationResult } from './validate'
import type { BrandKit, LoadedKit } from './types'

const JSON_BLOCK =
  /<script\b[^>]*\btype=["']application\/json["'][^>]*\bid=["']brand-kit["'][^>]*>([\s\S]*?)<\/script>/i

const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi

export interface ParseResult {
  kit: LoadedKit | null
  validation: ValidationResult
  /** One plain sentence, ready to put on screen. Empty when the kit loaded. */
  refusal: string
}

export function parseKitFile(html: string, origin: LoadedKit['origin'] = 'dropped-in'): ParseResult {
  const block = JSON_BLOCK.exec(html)
  if (!block) {
    const validation: ValidationResult = {
      ok: false,
      errors: [
        {
          severity: 'error',
          where: 'file',
          message: 'That file does not have any brand information in it. It may not be the right file.',
        },
      ],
      advisories: [],
    }
    return { kit: null, validation, refusal: refusalMessage(validation) }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(block[1]!)
  } catch {
    const validation: ValidationResult = {
      ok: false,
      errors: [
        {
          severity: 'error',
          where: 'file',
          message: 'The brand information in that file is damaged and cannot be read.',
        },
      ],
      advisories: [],
    }
    return { kit: null, validation, refusal: refusalMessage(validation) }
  }

  const css = [...html.matchAll(STYLE_BLOCK)].map((m) => m[1] ?? '').join('\n')
  const validation = validateKit(parsed, css)

  if (!validation.ok) return { kit: null, validation, refusal: refusalMessage(validation) }

  return { kit: { kit: parsed as BrandKit, css, origin }, validation, refusal: '' }
}

/**
 * What the first screen shows back after a kit loads — "here's what came in the
 * file". Plain language throughout; no token names reach the screen.
 */
export interface KitSummary {
  name: string
  swatches: string[]
  headingFace: string
  bodyFace: string
  bodySizePt: number
  calloutLabels: string[]
  hasLogo: boolean
  pageShapes: number
  contrastChecked: boolean
}

export function summarise(loaded: LoadedKit): KitSummary {
  const { kit } = loaded
  const face = (slot: 'serif' | 'sans' | 'condensed') => {
    const family = kit.type[slot]
    return family?.office ?? family?.primary ?? 'the default face'
  }
  const logo = kit.assets?.['logo']
  return {
    name: kit.name,
    swatches: Object.values(kit.color)
      .filter((c) => c.role !== 'table hairlines')
      .map((c) => c.hex)
      .slice(0, 6),
    headingFace: face(kit.type.heading_family),
    bodyFace: face(kit.type.body_family),
    bodySizePt: kit.type.body_size_pt,
    calloutLabels: kit.callouts.map((c) => c.label),
    hasLogo: Boolean(logo && (typeof logo === 'string' ? logo : logo.src)),
    pageShapes: kit.blueprints.length,
    contrastChecked: true,
  }
}
