/**
 * Renders a sample document at every geometry, in both cuts.
 *
 * Build order §15 step 3: prove the renderer before building anything on top
 * of it. This is that proof, runnable.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseKitFile } from '../src/brandkit/parse'
import { renderDocument } from '../src/render/html'
import { emptyDocument, newSection, newStep } from '../src/model/content'
import type { DocumentBody } from '../src/model/content'
import type { FrameId } from '../src/geometry/blueprints'
import type { BlueprintId } from '../src/model/vocabularies'

const kitHtml = readFileSync(new URL('../kits/unbranded-v1.html', import.meta.url), 'utf8')
const kit = parseKitFile(kitHtml, 'default').kit!

function sample(): DocumentBody {
  const doc = emptyDocument('quick_reference').document
  doc.title = 'Ordering and tracking outpatient referrals'
  doc.meta = {
    ...doc.meta,
    audience: ['providers'],
    systems: ['cerner_powerchart'],
    system_version: '2018.01',
    effective_date: 'September 1, 2026',
    effective_date_sublabel: 'go_live',
    owner: 'Clinical Informatics',
    version: '1.0',
  }

  const why = newSection('Why we changed this', 'paragraph')
  why.content = {
    shape: 'paragraph',
    body:
      "Referrals placed in PowerChart were reaching the clinic without a tracking number, " +
      "so nobody could tell whether one had been received. The order now carries the number " +
      "with it, and the clinic sees the same record you do.",
  }
  why.register = 'scaffolded'

  const before = newSection('Before you start', 'paragraph')
  before.content = {
    shape: 'paragraph',
    body: 'Ordering privileges on the patient’s care team, and the chart open to the [[Orders]] tab.',
  }

  const steps = newSection('Placing the referral', 'steps')
  const s1 = newStep()
  s1.intent = 'Open the orders list'
  s1.action = 'Select the [[Orders]] or [[Medication List]] tab from the Menu.'
  s1.path = ['Menu', 'Orders']
  s1.substeps = [{ kind: 'gloss', text: 'A referral is an orderable like any other — it is not a message.' }]
  const s2 = newStep()
  s2.intent = 'Search for the referral'
  s2.action = 'Click [[+ Add]] (top-left), then type `REF` and select the matching order.'
  s2.system_response = 'Matching referrals appear as you type.'
  const s3 = newStep()
  s3.intent = 'Sign the order'
  s3.action = 'When complete, click [[Reconcile and Sign]] (bottom-right).'
  s3.system_response = 'The order moves to Ordered and a tracking number is issued.'
  steps.content = { shape: 'steps', numbering: 'restart', steps: [s1, s2, s3] }

  const watch = newSection('Watch out', 'callout')
  watch.content = {
    shape: 'callout',
    level: 'important',
    body: 'A referral signed on the wrong encounter cannot be moved. It must be voided and re-ordered on the correct encounter.',
  }

  const who = newSection('Who to call', 'paragraph')
  who.content = {
    shape: 'paragraph',
    body: 'Clinical Informatics, weekdays. Contact details are written by the author — the app bakes in no department.',
  }

  doc.sections = [why, before, steps, watch, who]
  doc.change_log = [
    { version: '1.0', date: '2026-09-01', author: 'Clinical Informatics', summary: 'Initial release' },
  ]
  return doc
}

const out = new URL('../out/', import.meta.url)
mkdirSync(out, { recursive: true })

// Each frame is rendered with the blueprint it belongs to. A quick-reference
// document laid out on huddle-card geometry would render with the wrong type
// scale and quietly misrepresent both.
const frames: Array<[FrameId, BlueprintId]> = [
  ['field_guide', 'field_guide'],
  ['letter_two_column', 'quick_reference'],
  ['letter_prose', 'quick_reference'],
  ['huddle_card', 'huddle_card'],
]

for (const [frameId, blueprint] of frames) {
  const doc = { ...sample(), blueprint }
  for (const variant of ['scaffolded', 'expert'] as const) {
    const html = renderDocument(doc, kit, { variant, frameId })
    const name = `${frameId}-${variant}.html`
    writeFileSync(new URL(name, out), html)
    console.log(`${name.padEnd(38)} ${String(html.length).padStart(6)} bytes`)
  }
}

const large = renderDocument({ ...sample(), blueprint: 'quick_reference' }, kit, {
  variant: 'scaffolded',
  frameId: 'letter_prose',
  largePrint: true,
})
writeFileSync(new URL('letter_prose-large-print.html', out), large)
console.log(`letter_prose-large-print.html          ${String(large.length).padStart(6)} bytes`)
