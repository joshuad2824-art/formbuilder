import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseKitFile } from '../src/brandkit/parse'
import { renderDocument, renderExportSet } from '../src/render/html'
import { emptyDocument, newSection, newStep } from '../src/model/content'
import { cut, filterSections, isProtected } from '../src/model/register'
import { microTypography, tokenize, plainText, uiMarksApply } from '../src/model/inline'
import type { DocumentBody } from '../src/model/content'

const kitHtml = readFileSync(
  new URL('../design_handoff_form_builder/brand-kits/unbranded-v1.html', import.meta.url),
  'utf8',
)
const kit = parseKitFile(kitHtml, 'default').kit!

function sample(): DocumentBody {
  const doc = emptyDocument('quick_reference').document
  doc.title = 'Ordering and tracking outpatient referrals'
  doc.meta.audience = ['providers']
  doc.meta.systems = ['cerner_powerchart']
  doc.meta.system_version = '2018.01'
  doc.meta.effective_date = '2026-09-01'
  doc.meta.owner = 'Clinical Informatics'

  const why = newSection('Why we changed this', 'paragraph')
  why.content = { shape: 'paragraph', body: 'Referrals were being lost between the order and the clinic.' }
  why.register = 'scaffolded'

  const steps = newSection('Placing the referral', 'steps')
  const one = newStep()
  one.intent = 'Open the orders list'
  one.action = 'Select the [[Orders]] tab from the Menu.'
  one.system_response = 'The orders list opens.'
  one.path = ['Menu', 'Orders']
  one.substeps = [{ kind: 'gloss', text: 'A referral is an order like any other.' }]
  const two = newStep()
  two.intent = 'Search for the referral'
  two.action = 'Type `REF` and select the matching order.'
  steps.content = { shape: 'steps', numbering: 'restart', steps: [one, two] }

  const important = newSection('Watch out', 'callout')
  important.content = {
    shape: 'callout',
    level: 'important',
    body: 'A referral signed on the wrong encounter cannot be moved.',
  }

  doc.sections = [why, steps, important]
  doc.change_log = [
    { version: '1.0', date: '2026-09-01', author: 'Clinical Informatics', summary: 'Initial release' },
  ]
  return doc
}

describe('the two-variant architecture is one filter, not two templates', () => {
  it('the scaffolded cut renders everything', () => {
    expect(filterSections(sample().sections, 'scaffolded')).toHaveLength(3)
  })

  it('the expert cut suppresses sections marked scaffolded', () => {
    const kept = filterSections(sample().sections, 'expert')
    expect(kept.map((s) => s.title)).toEqual(['Placing the referral', 'Watch out'])
  })

  it('the expert cut drops step glosses and screenshots but keeps the action', () => {
    const steps = filterSections(sample().sections, 'expert').find((s) => s.shape === 'steps')!
    if (steps.content.shape !== 'steps') throw new Error('shape')
    expect(steps.content.steps[0]!.substeps).toEqual([])
    expect(steps.content.steps[0]!.screenshot).toBeNull()
    expect(steps.content.steps[0]!.action).toContain('[[Orders]]')
  })

  it('important and requirements callouts are byte-identical in both cuts', () => {
    // The one thing the expert path may not touch.
    const doc = sample()
    const scaffolded = cut(doc, 'scaffolded').sections.filter(isProtected)
    const expert = cut(doc, 'expert').sections.filter(isProtected)
    expect(JSON.stringify(expert)).toBe(JSON.stringify(scaffolded))
  })

  it('the expert cut renders step lists as tables', () => {
    const doc = sample()
    const expert = renderDocument(doc, kit, { variant: 'expert', frameId: 'letter_two_column' })
    const scaffolded = renderDocument(doc, kit, { variant: 'scaffolded', frameId: 'letter_two_column' })
    expect(expert).toContain('<th scope="col">What to do</th>')
    expect(scaffolded).toContain('<ol class="steps"')
    expect(scaffolded).not.toContain('<th scope="col">What to do</th>')
  })
})

describe('inline markup never reaches the reader as markup', () => {
  it('double brackets render as bold, not as brackets', () => {
    const html = renderDocument(sample(), kit, { variant: 'scaffolded', frameId: 'letter_two_column' })
    expect(html).toContain('<b class="ui">Orders</b>')
    expect(html).not.toContain('[[')
  })

  it('backticks render as a literal string', () => {
    const html = renderDocument(sample(), kit, { variant: 'scaffolded', frameId: 'letter_two_column' })
    expect(html).toContain('<code class="literal">REF</code>')
  })

  it('the huddle card takes no UI-control bolding at all', () => {
    expect(uiMarksApply('huddle_card')).toBe(false)
    expect(uiMarksApply('field_guide')).toBe(true)
  })

  it('plainText strips every mark, for measuring and counting', () => {
    expect(plainText('Click [[Save]] then type `x`')).toBe('Click Save then type x')
  })

  it('tokenize keeps surrounding text intact', () => {
    expect(tokenize('a [[B]] c').map((t) => t.kind)).toEqual(['text', 'ui', 'text'])
  })
})

describe('micro-typography is applied silently', () => {
  it('gives real ellipses, curly apostrophes and em dashes', () => {
    expect(microTypography("It's done... -- really")).toBe('It’s done… — really')
  })
  it('leaves a phone number alone', () => {
    expect(microTypography('918-744-3088')).toBe('918-744-3088')
  })
})

describe('the rendered file is self-contained', () => {
  const html = renderDocument(sample(), kit, { variant: 'scaffolded', frameId: 'letter_two_column' })

  it('fetches nothing', () => {
    expect(html).not.toMatch(/<link\b/i)
    expect(html).not.toMatch(/<script\b/i)
    expect(html).not.toMatch(/src="https?:/i)
  })

  it('carries its page geometry as CSS Paged Media', () => {
    expect(html).toContain('@page')
    expect(html).toContain('size: 8.5in 11in')
  })

  it('never justifies body text — WCAG SC 1.4.8', () => {
    expect(html).toContain('text-align: left')
    expect(html).not.toContain('text-align: justify')
  })

  it('keeps a step and its screenshot together', () => {
    expect(html).toContain('class="keep-together"')
  })

  it('carries the shell the app owns, not the author', () => {
    expect(html).toContain('class="doc-title"')
    expect(html).toContain('Change log')
    expect(html).toContain('class="source-footer"')
  })

  it('states the system version it describes', () => {
    expect(html).toContain('2018.01')
  })
})

describe('mirrored pages', () => {
  it('the field guide emits distinct left and right page margins', () => {
    const html = renderDocument(sample(), kit, { variant: 'scaffolded', frameId: 'field_guide' })
    expect(html).toContain('@page :left')
    expect(html).toContain('@page :right')
  })

  it('a loose sheet emits one symmetric page rule', () => {
    const html = renderDocument(sample(), kit, { variant: 'scaffolded', frameId: 'huddle_card' })
    expect(html).not.toContain('@page :left')
  })
})

describe('every export produces both variants and the large-print cut, unasked', () => {
  const set = renderExportSet(sample(), kit, 'letter_two_column')

  it('produces three files', () => {
    expect(Object.keys(set)).toEqual(['scaffolded', 'expert', 'largePrint'])
  })

  it('large print is a token swap, not a redesign', () => {
    expect(set.largePrint).toContain('data-large-print')
    expect(set.largePrint).toContain('[data-large-print]')
  })

  it('large print raises body by at least 1.4× and drops to one column', () => {
    expect(set.largePrint).toMatch(/\.doc\[data-large-print\][\s\S]*?--body-size: 15\.4pt/)
    expect(set.largePrint).toMatch(/\.doc\[data-large-print\] \.flow \{ column-count: 1/)
  })

  it('the expert cut is genuinely shorter', () => {
    expect(set.expert.length).toBeLessThan(set.scaffolded.length)
  })
})

describe('the app owns geometry, the kit owns appearance', () => {
  const html = renderDocument(sample(), kit, { variant: 'scaffolded', frameId: 'letter_two_column' })

  it('writes the engine’s derived geometry onto the document element', () => {
    // Where a kit hardcodes a unit for a blueprint, the engine wins. Layout
    // figures are generated from layout — build rule 1, applied to kits too.
    expect(html).toMatch(/--unit:15\.75pt/)
    expect(html).toMatch(/--leading:1\.4318/)
  })

  it('emits the DOM contract the kit styles against', () => {
    expect(html).toContain('class="doc" data-blueprint="quick_reference"')
    expect(html).toContain('<span class="n">1</span>')
    expect(html).toContain('class="sysmsg"')
  })

  it('marks the prose geometry so the kit lays out its rail', () => {
    const prose = renderDocument(sample(), kit, { variant: 'scaffolded', frameId: 'letter_prose' })
    expect(prose).toContain('data-variant="prose"')
    expect(prose).toContain('class="body-grid"')
    expect(prose).toContain('class="rail"')
  })

  it('does not restyle what the kit already renders', () => {
    // The app must not emit callout fills of its own: the kit's treatment is
    // authoritative, and a duplicate rule is how white-on-white happens.
    const appCss = html.slice(html.lastIndexOf('<style>'))
    expect(appCss).not.toMatch(/\.callout--\w+\s*\{/)
    expect(appCss).not.toMatch(/font-family/)
  })
})

describe('the emitted stylesheet is well formed', () => {
  it('has balanced braces at every geometry', () => {
    for (const frameId of ['field_guide', 'letter_two_column', 'letter_prose', 'huddle_card'] as const) {
      const html = renderDocument(sample(), kit, { variant: 'scaffolded', frameId })
      const opens = (html.match(/\{/g) ?? []).length
      const closes = (html.match(/\}/g) ?? []).length
      expect(`${frameId}: ${opens} ${closes}`).toBe(`${frameId}: ${opens} ${opens}`)
      expect(closes).toBe(opens)
    }
  })
})

describe('pictures reach the exported file', () => {
  it('inlines the image as a data URI and carries its alt text', () => {
    const doc = sample()
    const steps = doc.sections.find((s) => s.shape === 'steps')!
    if (steps.content.shape !== 'steps') throw new Error('shape')
    steps.content.steps[0]!.screenshot = {
      asset_id: 'a1',
      alt: 'The Orders window, with Reconcile and Sign at the bottom right.',
      caption: null,
      callouts: [{ x: 0.8, y: 0.9, label: 'Reconcile and Sign' }],
    }
    const assets = new Map([['a1', 'data:image/png;base64,AAAA']])
    const html = renderDocument(doc, kit, { variant: 'scaffolded', frameId: 'field_guide' }, assets)

    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).toContain('alt="The Orders window, with Reconcile and Sign at the bottom right."')
    // On the image at the anchor point — never a legend beside it.
    expect(html).toContain('class="anno-label"')
    expect(html).toMatch(/left:80\.00%;top:90\.00%/)
  })

  it('drops the picture in the expert cut but keeps the action', () => {
    const doc = sample()
    const steps = doc.sections.find((s) => s.shape === 'steps')!
    if (steps.content.shape !== 'steps') throw new Error('shape')
    steps.content.steps[0]!.screenshot = { asset_id: 'a1', alt: 'A window.', caption: null, callouts: [] }
    const assets = new Map([['a1', 'data:image/png;base64,AAAA']])
    const expert = renderDocument(doc, kit, { variant: 'expert', frameId: 'field_guide' }, assets)
    expect(expert).not.toContain('data:image/png;base64,AAAA')
    expect(expert).toContain('Orders')
  })

  it('omits an image whose asset is missing rather than emitting a broken one', () => {
    const doc = sample()
    const steps = doc.sections.find((s) => s.shape === 'steps')!
    if (steps.content.shape !== 'steps') throw new Error('shape')
    steps.content.steps[0]!.screenshot = { asset_id: 'gone', alt: 'A window.', caption: null, callouts: [] }
    const html = renderDocument(doc, kit, { variant: 'scaffolded', frameId: 'field_guide' }, new Map())
    expect(html).not.toContain('<img')
    expect(html).not.toContain('src=""')
  })
})

describe('referencedAssets finds every picture the document uses', () => {
  it('collects them from steps and from figure sections alike', async () => {
    const { referencedAssets } = await import('../src/screenshot/assets')
    const doc = sample()
    const steps = doc.sections.find((s) => s.shape === 'steps')!
    if (steps.content.shape !== 'steps') throw new Error('shape')
    steps.content.steps[0]!.screenshot = { asset_id: 'a1', alt: 'x', caption: null, callouts: [] }
    steps.content.steps[1]!.screenshot = { asset_id: 'a2', alt: 'y', caption: null, callouts: [] }

    const figure = newSection('A picture', 'figure')
    figure.content = {
      shape: 'figure',
      screenshot: { asset_id: 'a3', alt: 'z', caption: null, callouts: [] },
    }
    doc.sections.push(figure)

    expect(referencedAssets(doc.sections).sort()).toEqual(['a1', 'a2', 'a3'])
  })
})
