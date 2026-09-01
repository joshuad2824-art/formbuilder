import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseKitFile } from '../src/brandkit/parse'
import { frame } from '../src/geometry/blueprints'
import {
  addCallout, confirmPhi, isReady, review, setAlt, setCaption, setCrop, startDraft,
  toScreenshot, tokenOverlap,
} from '../src/screenshot/pipeline'
import { checkPlacement, reviewAnnotations, sampleBeneath, suggestPlacement, applyFix,
  MAX_CALLOUTS, type ImagePixels } from '../src/screenshot/annotate'
import { checkResolution, checkReuse, keepsContext, requiredPixels } from '../src/screenshot/resolution'
import { mayAttach, unacknowledged, PHI_CHECKLIST, CLIENT_SIDE_PROMISE } from '../src/screenshot/phi'

const kit = parseKitFile(
  readFileSync(new URL('../kits/unbranded-v1.html', import.meta.url), 'utf8'),
  'default',
)!.kit!.kit

/** A synthetic image: white on the left half, near-black on the right. */
function twoTone(width = 200, height = 100): ImagePixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const dark = x >= width / 2
      data[i] = dark ? 20 : 255
      data[i + 1] = dark ? 20 : 255
      data[i + 2] = dark ? 20 : 255
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

describe('PHI acknowledgment', () => {
  it('lists what to look for rather than asking for a blanket attestation', () => {
    expect(PHI_CHECKLIST.length).toBeGreaterThanOrEqual(4)
    expect(PHI_CHECKLIST.join(' ')).toMatch(/name/i)
    expect(PHI_CHECKLIST.join(' ')).toMatch(/medical record/i)
    expect(PHI_CHECKLIST.join(' ')).toMatch(/banner/i)
  })

  it('states the client-side promise in plain words, not as fine print', () => {
    expect(CLIENT_SIDE_PROMISE).toMatch(/never leaves this computer/)
    expect(CLIENT_SIDE_PROMISE).not.toMatch(/terms|policy|agree/i)
  })

  it('gates attaching the picture, not exporting the document', () => {
    expect(mayAttach(unacknowledged())).toBe(false)
    const draft = confirmPhi(startDraft('data:,x', { width: 100, height: 100 }))
    expect(mayAttach(draft.phi)).toBe(true)
    expect(draft.phi.at).not.toBeNull()
  })
})

describe('resolution and cropping', () => {
  it('stores at 300 PPI at the width it will print', () => {
    expect(requiredPixels(4.375)).toBe(1313)
    // A full-measure letter image is at least 1950 px, per §7.6.
    expect(requiredPixels(6.5)).toBe(1950)
  })

  it('warns about a soft picture without blocking it', () => {
    const check = checkResolution({ width: 600, height: 400 }, { x: 0, y: 0, width: 1, height: 1 }, frame('field_guide'))
    expect(check.ok).toBe(false)
    expect(check.message).toMatch(/fine to carry on/)
  })

  it('is satisfied by a capture large enough for the measure', () => {
    const check = checkResolution({ width: 2000, height: 1200 }, { x: 0, y: 0, width: 1, height: 1 }, frame('field_guide'))
    expect(check.ok).toBe(true)
    expect(check.message).toBeNull()
  })

  it('refuses to reuse a full-width letter figure at field-guide width', () => {
    // The §7.6 case: a capture placed across the letter live width and reused
    // in the field guide's column has its own 9 pt UI text scaled to about 6 pt.
    const check = checkReuse(frame('letter_prose'), frame('field_guide'), 'live', 'column')
    expect(check.ok).toBe(false)
    expect(check.embeddedPtAt9).toBeLessThan(6.5)
    expect(check.message).toMatch(/cutting again/)
  })

  it('leaves a column-width crop alone between those two geometries', () => {
    // 4.5 in to 4.375 in is a 3% change — not worth telling anyone about.
    expect(checkReuse(frame('letter_prose'), frame('field_guide')).ok).toBe(true)
  })

  it('is happy going the other way', () => {
    expect(checkReuse(frame('field_guide'), frame('letter_prose')).ok).toBe(true)
  })

  it('notices a crop that has lost its surrounding context', () => {
    expect(keepsContext({ x: 0.4, y: 0.4, width: 0.1, height: 0.1 })).toBe(false)
    expect(keepsContext({ x: 0.1, y: 0.1, width: 0.6, height: 0.6 })).toBe(true)
  })
})

describe('annotation contrast is sampled against the actual pixels', () => {
  const image = twoTone()

  it('samples what is beneath the label, not an assumed background', () => {
    expect(sampleBeneath(image, { x: 0.1, y: 0.5, label: 'a' }).r).toBeGreaterThan(200)
    expect(sampleBeneath(image, { x: 0.9, y: 0.5, label: 'a' }).r).toBeLessThan(40)
  })

  it('passes an ink label over white and fails it over near-black', () => {
    expect(checkPlacement(image, { x: 0.1, y: 0.5, label: 'a' }, kit).ok).toBe(true)
    expect(checkPlacement(image, { x: 0.9, y: 0.5, label: 'a' }, kit).ok).toBe(false)
  })

  it('offers a move rather than a complaint', () => {
    const move = suggestPlacement(image, { x: 0.58, y: 0.5, label: 'a' }, kit)
    expect(move).not.toBeNull()
    expect(checkPlacement(image, move!, kit).ok).toBe(true)
  })

  it('applies the move itself', () => {
    const callouts = [{ x: 0.9, y: 0.5, label: 'Save' }]
    const findings = reviewAnnotations(image, callouts, kit)
    const contrast = findings.find((f) => f.kind === 'contrast')!
    expect(contrast.message).toMatch(/hard to see/)
    if (contrast.fix) {
      const moved = applyFix(callouts, contrast)
      expect(moved[0]!.x).not.toBe(0.9)
    }
  })

  it('caps labels at four', () => {
    let draft = confirmPhi(startDraft('data:,x', { width: 100, height: 100 }))
    for (let i = 0; i < 7; i++) draft = addCallout(draft, { x: 0.1 * i, y: 0.5, label: `L${i}` })
    expect(draft.callouts).toHaveLength(MAX_CALLOUTS)
  })

  it('notices two labels sitting on top of each other', () => {
    const findings = reviewAnnotations(
      image,
      [{ x: 0.2, y: 0.5, label: 'A' }, { x: 0.21, y: 0.51, label: 'B' }],
      kit,
    )
    expect(findings.some((f) => f.kind === 'overlap')).toBe(true)
  })
})

describe('the pipeline', () => {
  const base = () => startDraft('data:,x', { width: 2000, height: 1200 })

  it('blocks on alt text and states the reason in the same breath', () => {
    const draft = confirmPhi(base())
    const findings = review(draft, { frame: frame('field_guide'), kit })
    const alt = findings.find((f) => f.kind === 'alt')!
    expect(alt.blocking).toBe(true)
    expect(alt.because).toMatch(/screen reader/)
  })

  it('puts the blocking item first, never last', () => {
    let draft = confirmPhi(base())
    draft = setCrop(draft, { x: 0.45, y: 0.45, width: 0.08, height: 0.08 })
    const findings = review(draft, { frame: frame('field_guide'), kit })
    expect(findings.length).toBeGreaterThan(1)
    expect(findings[0]!.blocking).toBe(true)
    expect(findings.slice(1).every((f) => !f.blocking)).toBe(true)
  })

  it('warns when a caption duplicates the step it sits under', () => {
    let draft = setAlt(confirmPhi(base()), 'The Orders tab in the menu.')
    draft = setCaption(draft, 'Select the Orders tab from the Menu')
    const findings = review(draft, {
      frame: frame('field_guide'),
      kit,
      stepText: 'Select the [[Orders]] tab from the Menu.',
    })
    expect(findings.some((f) => f.kind === 'caption')).toBe(true)
  })

  it('leaves a caption that adds something alone', () => {
    let draft = setAlt(confirmPhi(base()), 'The Orders tab.')
    draft = setCaption(draft, 'The tab sits under the patient banner, not beside it.')
    const findings = review(draft, {
      frame: frame('field_guide'),
      kit,
      stepText: 'Select the [[Orders]] tab from the Menu.',
    })
    expect(findings.some((f) => f.kind === 'caption')).toBe(false)
  })

  it('is ready only once PHI is acknowledged and alt text is written', () => {
    let draft = base()
    expect(isReady(draft)).toBe(false)
    draft = confirmPhi(draft)
    expect(isReady(draft)).toBe(false)
    draft = setAlt(draft, 'The Orders tab, highlighted in the left menu.')
    expect(isReady(draft)).toBe(true)
    expect(toScreenshot(draft, 'a1')).toMatchObject({ asset_id: 'a1', caption: null })
  })

  it('will not produce a model object before it is ready', () => {
    expect(toScreenshot(base(), 'a1')).toBeNull()
  })
})

describe('tokenOverlap', () => {
  it('scores a verbatim repeat high and a different sentence low', () => {
    expect(tokenOverlap('Select the Orders tab', 'Select the [[Orders]] tab')).toBeGreaterThan(0.9)
    expect(tokenOverlap('The banner sits above', 'Select the Orders tab')).toBeLessThan(0.3)
  })
})
