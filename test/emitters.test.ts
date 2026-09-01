import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseKitFile } from '../src/brandkit/parse'
import { renderDocument } from '../src/render/html'
import { renderDocx, DOCX_CAVEAT } from '../src/render/docx'
import { emptyDocument, newQuestion, newSection, newStep, questionIsComplete } from '../src/model/content'
import type { DocumentBody } from '../src/model/content'
import { checkHard, blockers, incompleteQuestions } from '../src/rules/hard'
import { frame } from '../src/geometry/blueprints'

const loaded = parseKitFile(
  readFileSync(new URL('../kits/unbranded-v1.html', import.meta.url), 'utf8'),
  'default',
)!.kit!

function sample(): DocumentBody {
  const d = emptyDocument('quick_reference').document
  d.title = 'Ordering referrals'
  d.meta.owner = 'Clinical Informatics'

  const why = newSection('Why we changed this', 'paragraph')
  why.content = { shape: 'paragraph', body: 'Referrals were being lost.' }

  const steps = newSection('Placing the referral', 'steps')
  steps.content = {
    shape: 'steps',
    numbering: 'restart',
    steps: [{ ...newStep(), intent: 'Open orders', action: 'Select the [[Orders]] tab and type `REF`.' }],
  }

  const watch = newSection('Watch out', 'callout')
  watch.content = { shape: 'callout', level: 'important', body: 'It cannot be moved.' }

  d.sections = [why, steps, watch]
  d.retrieval = [
    { ...newQuestion(), question: 'What cannot be moved?', answer: 'One signed on the wrong encounter.' },
  ]
  return d
}

/* --------------------------------------------------- retrieval blocks --- */

describe('check-yourself questions', () => {
  it('cannot be saved without an answer — HARD, §12.1', () => {
    // Feedback is what carries retrieval practice: with an answer available the
    // effect nearly doubles (g 0.73 against 0.39).
    const d = sample()
    d.retrieval = [{ ...newQuestion(), question: 'What cannot be moved?', answer: '' }]
    const found = incompleteQuestions(d)
    expect(found).toHaveLength(1)
    expect(found[0]!.blocksExport).toBe(true)
    expect(blockers(checkHard(d, loaded.kit, frame('letter_two_column')))).toHaveLength(1)
  })

  it('a question with both halves is complete', () => {
    expect(questionIsComplete({ id: 'q1', question: 'Why?', answer: 'Because.' })).toBe(true)
    expect(questionIsComplete({ id: 'q1', question: 'Why?', answer: '  ' })).toBe(false)
  })

  it('an empty question blocks nothing — it simply is not there yet', () => {
    const d = sample()
    d.retrieval = [newQuestion()]
    expect(incompleteQuestions(d)).toEqual([])
  })

  it('renders in the scaffolded cut, with the answer beside its question', () => {
    const html = renderDocument(sample(), loaded, { variant: 'scaffolded', frameId: 'letter_two_column' })
    expect(html).toContain('Check yourself')
    expect(html).toContain('What cannot be moved?')
    // Retrieval without feedback is the weaker half of the effect, so the
    // answer prints with the question rather than at the back.
    expect(html).toContain('One signed on the wrong encounter.')
  })

  it('is absent from the expert cut — it is assistance by definition', () => {
    const html = renderDocument(sample(), loaded, { variant: 'expert', frameId: 'letter_two_column' })
    expect(html).not.toContain('Check yourself')
  })

  it('is not rendered while half-written', () => {
    const d = sample()
    d.retrieval = [{ ...newQuestion(), question: 'Why?', answer: '' }]
    const html = renderDocument(d, loaded, { variant: 'scaffolded', frameId: 'letter_two_column' })
    expect(html).not.toContain('Check yourself')
  })
})

/* ---------------------------------------------------------------- DOCX -- */

describe('the DOCX emitter', () => {
  it('produces a real OOXML package', async () => {
    const blob = await renderDocx(sample(), loaded)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // Every .docx is a zip; a zip begins PK.
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
    expect(bytes.length).toBeGreaterThan(4000)
  })

  it('maps sections to Word styles rather than direct formatting', async () => {
    // §13.3: a user's edits should inherit the design instead of fighting it.
    // Someone who changes "Heading 2" in Word gets every section heading.
    const xml = await documentXml(sample())
    expect(xml).toContain('w:val="Heading2"')
    expect(xml).toContain('w:val="Title"')
  })

  it('carries the kit’s Office substitutes into the stylesheet', async () => {
    const styles = await partXml(sample(), 'word/styles.xml')
    expect(styles).toMatch(/Georgia/)
    expect(styles).toMatch(/Calibri/)
  })

  it('keeps the callout’s label, because the word is the whole signal', async () => {
    // Word will not carry the kit's fill, so no meaning by colour alone
    // matters more here than anywhere.
    expect(await documentXml(sample())).toContain('IMPORTANT')
  })

  it('bolds UI targets and never leaks the brackets', async () => {
    const xml = await documentXml(sample())
    expect(xml).toContain('Orders')
    expect(xml).not.toContain('[[')
    expect(xml).toMatch(/<w:b\b/)
  })

  it('names a picture rather than placing one', async () => {
    // A screenshot Word resizes stops being readable — §7.6. The alt text goes
    // instead, so nothing is silently lost.
    const d = sample()
    const steps = d.sections.find((s) => s.shape === 'steps')!
    if (steps.content.shape !== 'steps') throw new Error('shape')
    steps.content.steps[0]!.screenshot = {
      asset_id: 'a1', alt: 'The Orders window.', caption: null, callouts: [],
    }
    const xml = await documentXml(d)
    expect(xml).toContain('[Picture: The Orders window.]')
  })

  it('honours the register filter like every other emitter', async () => {
    const d = sample()
    d.sections[0]!.register = 'scaffolded'
    const scaffolded = await documentXml(d, 'scaffolded')
    const expert = await documentXml(d, 'expert')
    expect(scaffolded).toContain('Why we changed this')
    expect(expert).not.toContain('Why we changed this')
    // The one thing the expert path may not touch.
    expect(expert).toContain('IMPORTANT')
  })

  it('says plainly what it cannot promise', async () => {
    expect(DOCX_CAVEAT).toMatch(/out of our hands/)
    expect(DOCX_CAVEAT).toMatch(/Pictures are named rather than placed/)
  })
})

async function partXml(document: DocumentBody, part: string, variant: 'scaffolded' | 'expert' = 'scaffolded') {
  const blob = await renderDocx(document, loaded, variant)
  const buffer = Buffer.from(await blob.arrayBuffer())
  const { execFileSync } = await import('node:child_process')
  const { writeFileSync, mkdtempSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(join(tmpdir(), 'docx-'))
  const path = join(dir, 'out.docx')
  writeFileSync(path, buffer)
  return execFileSync('unzip', ['-p', path, part]).toString()
}

const documentXml = (d: DocumentBody, variant: 'scaffolded' | 'expert' = 'scaffolded') =>
  partXml(d, 'word/document.xml', variant)
