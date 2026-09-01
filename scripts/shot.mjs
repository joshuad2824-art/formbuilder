/**
 * Screenshots the rendered samples.
 *
 * Worth keeping as a first-class step rather than a one-off: the test suite was
 * fully green while the rendered page had white text on a white ground and step
 * bodies collapsed to one word per line. Print fidelity is the highest bar in
 * this build, and only looking at the page catches that class of defect.
 *
 * Run `npm run sample` first.
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const out = new URL('../out/', import.meta.url)

const browser = await chromium
  .launch({ executablePath: '/opt/pw-browsers/chromium' })
  .catch(() => chromium.launch())

const page = await browser.newPage({
  viewport: { width: 900, height: 1200 },
  deviceScaleFactor: 2,
})

const pages = [
  ['field_guide-scaffolded', 'field-guide'],
  ['letter_two_column-scaffolded', 'letter-2col'],
  ['letter_prose-scaffolded', 'letter-prose'],
  ['huddle_card-scaffolded', 'huddle-card'],
  ['letter_two_column-expert', 'letter-2col-expert'],
]

for (const [source, name] of pages) {
  await page.goto(new URL(`${source}.html`, out).href)
  const path = fileURLToPath(new URL(`${name}.png`, out))
  await page.screenshot({ path, fullPage: true })
  console.log(`${name}.png`)
}

await browser.close()
