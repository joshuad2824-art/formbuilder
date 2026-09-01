/**
 * Drives the app through the whole flow and screenshots every screen.
 *
 * The suite was fully green last time while the rendered page had white text on
 * a white ground. Assertions do not look at a screen; this does.
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const out = new URL('../out/', import.meta.url)
const base = process.env.APP_URL ?? 'http://localhost:4173'

const browser = await chromium
  .launch({ executablePath: '/opt/pw-browsers/chromium' })
  .catch(() => chromium.launch())
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })

const problems = []
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
page.on('pageerror', (e) => problems.push(String(e)))

const shot = async (name) => {
  // Colour transitions run for 150 ms and surfaces for 240 ms. Screenshotting
  // inside that window photographs a blend and reads as a styling bug — which
  // it did, once.
  await page.waitForTimeout(320)
  await page.screenshot({ path: fileURLToPath(new URL(`app-${name}.png`, out)) })
  console.log(`app-${name}.png`)
}

await page.goto(base, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('h1.screen')
await shot('1-brand')

// Drop in the Ascension kit through the real file input.
await page.setInputFiles('input[type=file]', 'design_handoff_form_builder/brand-kits/ascension-baseline-v1.html')
await page.waitForSelector('text=Ascension Baseline is in')
await shot('1-brand-loaded')

await page.getByRole('button', { name: 'Start my first document' }).click()
await page.waitForSelector('text=Is a document the right fix?')
await page.getByRole('button', { name: /they know how/ }).click()
await page.getByRole('button', { name: /Now and then/ }).click()
await page.getByRole('button', { name: /It changes/ }).click()
await shot('2-triage')

await page.getByRole('button', { name: 'Carry on' }).click()
await page.waitForSelector('text=What are you making?')
await page.getByRole('button', { name: /A one-page sheet/ }).click()
await page.fill('#doc-title', 'Ordering and tracking outpatient referrals')
await shot('3-blueprint')

await page.getByRole('button', { name: 'Start writing' }).click()
await page.waitForSelector('text=Write your sections')
await shot('4-sections-empty')

// Add a paragraph.
await page.fill('#new-section-title', 'Why we changed this')
await page.getByRole('button', { name: 'A paragraph', exact: true }).click()
await page.getByRole('button', { name: 'Add it' }).click()
await page.waitForSelector('#\\31 -body, textarea.field')
await page.locator('textarea.field').first().fill(
  'Referrals were being lost between the order and the clinic. The order now carries a tracking number.',
)

// Add a watch-out box, to see the print chip.
await page.locator('button.divider-add').last().click()
await page.fill('#new-section-title', 'Watch out')
await page.getByRole('button', { name: 'Something to watch out for' }).click()
await page.getByRole('button', { name: 'They must not miss this' }).click()
await shot('4-sections-callout-chip')

await page.getByRole('button', { name: 'Add it' }).click()
await page.locator('textarea.field').last().fill(
  'A referral signed on the wrong encounter cannot be moved. It must be voided and re-ordered.',
)
await shot('4-sections-written')

await page.getByRole('button', { name: 'Review and finish' }).click()
await page.waitForSelector('text=Before you finish')
await shot('5-review')

const make = page.getByRole('button', { name: 'Make my document' })
if (await make.isEnabled()) {
  await make.click()
  await page.waitForSelector('text=Your document is ready')
  await shot('6-done')
} else {
  console.log('! Make my document is disabled')
}

console.log('console errors:', problems.length ? problems : 'none')
await browser.close()
