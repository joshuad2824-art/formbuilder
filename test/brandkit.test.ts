import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseKitFile, summarise } from '../src/brandkit/parse'
import { validateKit, cssFillForLevel } from '../src/brandkit/validate'
import { contrastHex } from '../src/brandkit/contrast'

const read = (name: string) =>
  readFileSync(new URL(`../design_handoff_form_builder/brand-kits/${name}`, import.meta.url), 'utf8')

const unbranded = read('unbranded-v1.html')
const ascension = read('ascension-baseline-v1.html')

describe('the two shipped kits load', () => {
  it('unbranded-v1 loads and is the plain default', () => {
    const { kit, validation } = parseKitFile(unbranded, 'default')
    expect(validation.errors).toEqual([])
    expect(kit).not.toBeNull()
    expect(kit!.kit.id).toBe('unbranded-v1')
    expect(kit!.kit.org).toBeNull()
  })

  it('ascension-baseline-v1 loads', () => {
    const { kit, validation } = parseKitFile(ascension)
    expect(validation.errors).toEqual([])
    expect(kit!.kit.id).toBe('ascension-baseline-v1')
  })
})

describe('two levels sharing a fill is legal', () => {
  // unbranded-v1 gives all four the same ink fill on purpose — the word carries
  // the whole signal. Implementing "no two levels may share a fill" as a hard
  // rule would fail the app's own default kit, and "carry on with a plain look"
  // would dead-end on the first screen. Deltas §10.
  it('the plain kit passes with four identical fills', () => {
    const { validation } = parseKitFile(unbranded)
    expect(validation.ok).toBe(true)
  })

  it('and its declared monochrome suppresses the fill advisory', () => {
    const { validation } = parseKitFile(unbranded)
    expect(validation.advisories).toEqual([])
  })

  it('but an undeclared shared fill is mentioned once, as an advisory only', () => {
    const kit = {
      kit_version: '1.0', id: 'k', name: 'K', org: null, org_unit: null, source: '',
      color: { a: { hex: '#1a1a1a' }, paper: { hex: '#ffffff' } },
      type: {
        serif: { primary: null, office: 'Georgia' }, sans: { primary: null, office: 'Calibri' },
        body_family: 'sans', heading_family: 'serif', callout_label_family: 'sans',
        callout_label_weight: 700, body_size_pt: 11, scale_ratio: {}, min_size_pt: 7.5,
        body_min_pt: 11, table_cell_min_pt: 8, justify: false,
      },
      callouts: [
        { key: 'note', label: 'NOTE', color: 'a', text: 'white' },
        { key: 'important', label: 'IMPORTANT', color: 'a', text: 'white' },
        { key: 'requirements', label: 'REQUIREMENTS', color: 'a', text: 'white' },
        { key: 'tip', label: 'TIP', color: 'a', text: 'white' },
      ],
      blueprints: ['field_guide'], sections_enabled: null, footer_template: '', assets: {},
    }
    const result = validateKit(kit)
    expect(result.ok).toBe(true)
    expect(result.advisories).toHaveLength(1)
  })
})

describe('the validator refuses a kit that cannot be trusted', () => {
  const base = JSON.parse(
    /<script[^>]*id="brand-kit"[^>]*>([\s\S]*?)<\/script>/.exec(unbranded)![1]!,
  )

  it('rejects a callout fill the kit never declares', () => {
    const kit = structuredClone(base)
    kit.callouts[0].color = 'chartreuse'
    expect(validateKit(kit).ok).toBe(false)
  })

  it('rejects two levels sharing a label', () => {
    // The label is what distinguishes the levels, in every kit, always.
    const kit = structuredClone(base)
    kit.callouts[1].label = 'NOTE'
    const result = validateKit(kit)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => /cannot tell them apart/.test(e.message))).toBe(true)
  })

  it('rejects an empty label', () => {
    const kit = structuredClone(base)
    kit.callouts[2].label = '   '
    expect(validateKit(kit).ok).toBe(false)
  })

  it('rejects JSON that disagrees with the kit’s own CSS', () => {
    // This exact bug shipped once during the design and rendered NOTE and
    // REQUIREMENTS identically.
    const kit = structuredClone(base)
    kit.color['test_fill'] = { hex: '#1e69d2' }
    kit.callouts[0].color = 'test_fill'
    const css = ':root { --callout-note-fill: #b40f87; }'
    const result = validateKit(kit, css)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => /contradicts itself/.test(e.message))).toBe(true)
  })

  it('rejects text that cannot be read on its own fill', () => {
    const kit = structuredClone(base)
    kit.color['pale'] = { hex: '#ffe9a8' }
    kit.callouts[0].color = 'pale'
    kit.callouts[0].text = 'white'
    const result = validateKit(kit)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => /too faint/.test(e.message))).toBe(true)
  })

  it('rejects an asset that points outside the file', () => {
    const kit = structuredClone(base)
    kit.assets.logo = { src: 'https://example.org/logo.png' }
    expect(validateKit(kit).ok).toBe(false)
  })

  it('rejects an unsupported kit version', () => {
    const kit = structuredClone(base)
    kit.kit_version = '2.0'
    expect(validateKit(kit).ok).toBe(false)
  })

  it('rejects a page shape the app does not make', () => {
    const kit = structuredClone(base)
    kit.blueprints = ['poster']
    expect(validateKit(kit).ok).toBe(false)
  })

  it('says so in one plain sentence, with no jargon', () => {
    const { refusal } = parseKitFile('<html><body>not a kit</body></html>')
    expect(refusal).toMatch(/does not have any brand information/)
    expect(refusal).not.toMatch(/JSON|token|schema|parse/i)
  })
})

describe('measured contrast, per pairing', () => {
  // White on Ascension green clears the 3:1 large-text floor by one hundredth
  // of a point. Treat "white at large-bold only" as unavailable in practice:
  // black on green, always. Deltas §7.4.
  it('white on green is 3.03 — unusable in practice', () => {
    expect(contrastHex('#ffffff', '#00a791')!).toBeCloseTo(3.03, 2)
  })

  it('black on green is 6.94 and is what the kit uses', () => {
    expect(contrastHex('#000000', '#00a791')!).toBeCloseTo(6.94, 2)
    const { kit } = parseKitFile(ascension)
    const requirements = kit!.kit.callouts.find((c) => c.key === 'requirements')!
    expect(requirements.color).toBe('green')
    expect(requirements.text).toBe('black')
  })

  it('matches the deltas table for every stated pairing', () => {
    const table: Array<[string, number, number]> = [
      ['#1b4297', 9.24, 2.27],
      ['#1e69d2', 5.24, 4.01],
      ['#00a791', 3.03, 6.94],
      ['#b40f87', 6.25, 3.36],
      ['#ffb400', 1.78, 11.78],
    ]
    for (const [hex, white, black] of table) {
      expect(contrastHex('#ffffff', hex)!).toBeCloseTo(white, 2)
      expect(contrastHex('#000000', hex)!).toBeCloseTo(black, 2)
    }
  })
})

describe('the summary the first screen shows back', () => {
  it('describes the Ascension kit in plain language', () => {
    const { kit } = parseKitFile(ascension)
    const summary = summarise(kit!)
    expect(summary.name).toBe('Ascension Baseline')
    expect(summary.headingFace).toBe('Georgia')
    expect(summary.bodyFace).toBe('Calibri')
    expect(summary.bodySizePt).toBe(11)
    expect(summary.calloutLabels).toEqual(['NOTE', 'IMPORTANT', 'REQUIREMENTS', 'TIP'])
    expect(summary.hasLogo).toBe(true)
    expect(summary.pageShapes).toBe(3)
  })

  it('the plain kit carries no marks', () => {
    const { kit } = parseKitFile(unbranded, 'default')
    expect(summarise(kit!).hasLogo).toBe(false)
  })
})

describe('cssFillForLevel', () => {
  it('reads the token form', () => {
    expect(cssFillForLevel(':root{--callout-note-fill:#1e69d2;}', 'note')).toBe('#1e69d2')
  })
  it('reads the class form', () => {
    expect(cssFillForLevel('.callout--tip { background: #ffb400; }', 'tip')).toBe('#ffb400')
  })
  it('returns null when the kit says nothing', () => {
    expect(cssFillForLevel('body{color:red}', 'note')).toBeNull()
  })
})
