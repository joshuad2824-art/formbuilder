/**
 * Drives the picture pipeline: drop, PHI acknowledgment, label placement, alt
 * text, and the attachment back onto the step.
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const out = new URL('../out/', import.meta.url)
const base = process.env.APP_URL ?? 'http://localhost:4173'

const browser = await chromium
  .launch({ executablePath: '/opt/pw-browsers/chromium' })
  .catch(() => chromium.launch())
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })

const problems = []
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
page.on('pageerror', (e) => problems.push(String(e)))

const shot = async (name) => {
  await page.waitForTimeout(320)
  await page.screenshot({ path: fileURLToPath(new URL(`pic-${name}.png`, out)) })
  console.log(`pic-${name}.png`)
}

await page.goto(base, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('form-builder') })
await page.reload({ waitUntil: 'domcontentloaded' })

await page.getByRole('button', { name: /Carry on with a plain look/ }).click()
await page.getByRole('button', { name: 'Start my first document' }).click()
await page.getByRole('button', { name: 'Carry on' }).click()
await page.getByRole('button', { name: /A one-page sheet/ }).click()
await page.fill('#doc-title', 'Ordering a cardiology referral')
await page.getByRole('button', { name: 'Start writing' }).click()

// A steps section, so the picture attaches to a step.
await page.fill('#new-section-title', 'Placing the referral')
await page.getByRole('button', { name: 'Steps to follow' }).click()
await page.getByRole('button', { name: 'Add it' }).click()
await page.getByLabel('What are they doing?').fill('Sign the order')
await page.getByLabel('How do they do it?').fill('Click [[Reconcile and Sign]] at the bottom right.')

await page.getByRole('button', { name: 'Add a picture', exact: true }).click()
await page.waitForSelector('text=Add a picture')
await shot('1-drop')

await page.setInputFiles('input[type=file]', 'out/fake-screenshot.png')
await page.waitForSelector('text=Have a look at the picture')
await shot('2-phi')

await page.getByRole('button', { name: /I have checked/ }).click()
await page.waitForSelector('text=Point at something on the picture')
await shot('3-editor')

// Place a label on the green button — dark ink on green should read.
await page.getByLabel('What to call this label').fill('Reconcile and Sign')
await page.getByRole('button', { name: 'Place it' }).click()
const img = page.locator('.anno-layer img')
const box = await img.boundingBox()
await page.mouse.click(box.x + box.width * 0.86, box.y + box.height * 0.86)
await shot('4-label-placed')

// Place one on the dark blue title bar — should be flagged as unreadable.
await page.getByLabel('What to call this label').fill('Title bar')
await page.getByRole('button', { name: 'Place it' }).click()
await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.04)
await shot('5-contrast-flag')

// The app offers a move for the label that will not read. Take it.
const move = page.getByRole('button', { name: 'Move it somewhere clearer' })
if (await move.count()) {
  await move.first().click()
  await shot('6-contrast-fixed')
}

await page.fill('#picture-alt', 'The Orders window, with Reconcile and Sign at the bottom right.')
await shot('7-alt-written')

const add = page.getByRole('button', { name: 'Add this picture' })
console.log('add enabled:', await add.isEnabled())
await add.click()
await page.waitForSelector('text=Write your sections')
await shot('8-back-on-sections')

await page.getByRole('button', { name: 'Review and finish' }).click()
await page.waitForSelector('text=Before you finish')
await shot('9-review')

const make = page.getByRole('button', { name: 'Make my document' })
console.log('export allowed:', await make.isEnabled())
if (await make.isEnabled()) {
  await make.click()
  await page.waitForSelector('text=Your document is ready')
  await page.waitForFunction(() => !document.body.innerText.includes('Just a moment'), { timeout: 10000 })
  await shot('10-done')
}

console.log('console errors:', problems.length ? problems : 'none')
await browser.close()
