/**
 * The geometry table is a test, not a document.
 *
 * Build rule 1: layout figures are generated from layout, never typed. These
 * assertions are the enforcement — the handoff's stated numbers are checked
 * against what the engine derives, so the two can never drift apart silently.
 */

import { describe, expect, it } from 'vitest'
import { FRAMES, frame, resolveFrame, typeScale } from '../src/geometry/blueprints'
import { reportAll, report } from '../src/geometry/verify'
import { CalibratedMeasurer } from '../src/geometry/measure'
import { CPL_HARD_MAX } from '../src/geometry/constants'

const measurer = new CalibratedMeasurer()

describe('the invariant: live height is an exact integer multiple of its own unit', () => {
  // §11.1 lists 15 pt as INVARIANT; that cannot hold once leading is a function
  // of measure. The invariant is the rule, not the number.
  for (const id of Object.keys(FRAMES) as Array<keyof typeof FRAMES>) {
    it(`holds for ${id}`, () => {
      const f = frame(id)
      const exact = f.liveHPt / f.unitPt
      expect(exact).toBeCloseTo(Math.round(exact), 9)
    })
  }

  it('holds independently on continuation pages and page one', () => {
    // A multi-page document may have more than one live height, and each must
    // independently be an exact multiple — deltas §11.4.
    const f = frame('letter_two_column')
    expect(f.firstPage).toBeDefined()
    const exact = f.firstPage!.liveHPt / f.unitPt
    expect(exact).toBeCloseTo(37, 9)
    expect(f.input.units).toBe(43)
  })
})

describe('derived margins match the handoff figures', () => {
  // The bottom margin is an output. These assertions confirm the engine lands
  // on the numbers the design measured, without anyone typing them into it.
  const cases: Array<[keyof typeof FRAMES, number]> = [
    ['field_guide', 0.8958],
    ['letter_two_column', 0.8438],
    ['letter_prose', 0.7167],
    ['huddle_card', 0.71],
  ]
  for (const [id, expected] of cases) {
    it(`${id} bottom margin derives to ${expected} in`, () => {
      expect(frame(id).bottomMarginIn).toBeCloseTo(expected, 3)
    })
  }
})

describe('live areas', () => {
  it('field guide is 4.375 × 7.104 in — 315 × 511.5 pt, 31 × 16.5 pt', () => {
    const f = frame('field_guide')
    expect(f.liveWIn).toBeCloseTo(4.375, 6)
    expect(f.liveHIn).toBeCloseTo(7.1042, 4)
    expect(f.liveWPt).toBeCloseTo(315, 6)
    expect(f.liveHPt).toBeCloseTo(511.5, 6)
    expect(f.unitPt).toBeCloseTo(16.5, 6)
  })

  it('letter geometries share a 7.0 in live width', () => {
    expect(frame('letter_two_column').liveWIn).toBeCloseTo(7, 9)
    expect(frame('letter_prose').liveWIn).toBeCloseTo(7, 9)
    expect(frame('huddle_card').liveWIn).toBeCloseTo(7, 9)
  })

  it('two-column letter columns and its wide gutter fill the live width', () => {
    // At a 0.25 in gutter these columns measure 55 CPL, five past the
    // multi-column maximum. The whitespace moves into the gutter.
    const f = frame('letter_two_column')
    expect(f.column.widthIn).toBeCloseTo(3.0625, 6)
    expect(f.column.gutterIn).toBe(0.875)
    expect(2 * f.column.widthIn + f.column.gutterIn).toBeCloseTo(f.liveWIn, 9)
  })

  it('prose reading column is 4.5 in beside a 2.25 in rail', () => {
    const f = frame('letter_prose')
    expect(f.column.widthIn).toBeCloseTo(4.5, 6)
    expect(f.railIn).toBe(2.25)
    expect(f.column.widthIn + f.column.gutterIn + f.railIn).toBeCloseTo(f.liveWIn, 9)
  })

  it('huddle card caps its measure rather than filling the live width', () => {
    expect(frame('huddle_card').column.widthIn).toBeCloseTo(5.25, 6)
  })
})

describe('measure', () => {
  // §11.2's fallback of 0.5 em overstates Calibri by about 24% — enough to hide
  // two out-of-band geometries. Measured average advance is 0.405 em.
  it('field guide measures 71 CPL', () => {
    expect(Math.round(report(frame('field_guide'), measurer).cpl)).toBe(71)
  })

  it('two-column letter measures 49 CPL, inside the 40–50 multi-column band', () => {
    const r = report(frame('letter_two_column'), measurer)
    expect(Math.round(r.cpl)).toBe(49)
    expect(r.cpl).toBeGreaterThanOrEqual(40)
    expect(r.cpl).toBeLessThanOrEqual(50)
  })

  it('huddle card measures 58 CPL at 16 pt', () => {
    expect(Math.round(report(frame('huddle_card'), measurer).cpl)).toBe(58)
  })

  it('no geometry crosses the WCAG 1.4.8 ceiling', () => {
    for (const r of reportAll(measurer)) expect(r.cpl).toBeLessThanOrEqual(CPL_HARD_MAX)
  })

  it('the prose column measures what its own width says it measures', () => {
    // The handoff states 59 CPL for this geometry. A 4.5 in column at 11 pt and
    // a measured 0.405 em advance cannot produce that — it produces ~72.7,
    // which is legal for a single column (45–75) but is not 59. The stated
    // figure is a typed number sitting beside correct geometry, which is
    // exactly the defect class build rule 1 exists to catch. This test pins
    // the derived value so the discrepancy stays visible rather than being
    // quietly reconciled in either direction.
    const r = report(frame('letter_prose'), measurer)
    expect(r.cpl).toBeGreaterThan(70)
    expect(r.cpl).toBeLessThanOrEqual(75)
  })
})

describe('every geometry passes its own checks', () => {
  for (const r of reportAll(measurer)) {
    it(r.label, () => {
      const failed = r.checks.filter((c) => !c.ok)
      expect(failed.map((f) => `${f.name}: ${f.detail}`)).toEqual([])
    })
  }
})

describe('type scale', () => {
  it('is generated from the base and the ratio', () => {
    const s = typeScale(frame('field_guide'))
    expect(s.body).toBe(11)
    expect(s.h3).toBeCloseTo(13.25, 2)
    expect(s.tableCell).toBe(10)
  })

  it('the huddle card scales from 16 pt', () => {
    expect(typeScale(frame('huddle_card')).body).toBe(16)
  })

  it('refuses a ratio above 1.333 on the narrow page', () => {
    // A scale that looks incredible at 1440px falls apart at 375px; the field
    // guide is the 375px phone — §7.5.
    expect(() =>
      typeScale(resolveFrame({ ...FRAMES.field_guide, scaleRatio: 1.4 })),
    ).toThrow(/1.333/)
  })
})

describe('mirrored margins', () => {
  it('the field guide inner margin exceeds outer by the fold allowance', () => {
    const f = frame('field_guide')
    expect(f.input.mirrored).toBe(true)
    expect(f.input.innerMarginIn - f.input.outerMarginIn).toBeGreaterThanOrEqual(0.125)
  })

  it('loose sheets are symmetric — a structural difference, not a parameter', () => {
    for (const id of ['letter_two_column', 'letter_prose', 'huddle_card'] as const) {
      const f = frame(id)
      expect(f.input.mirrored).toBe(false)
      expect(f.input.innerMarginIn).toBe(f.input.outerMarginIn)
    }
  })
})

describe('a kit that hardcodes geometry must agree with the engine', () => {
  // The validator already refuses a kit whose JSON disagrees with its own CSS.
  // The same principle applies between a kit and the engine: a kit that states
  // a baseline unit for a blueprint and gets it wrong would break the vertical
  // grid silently. The engine wins at render time; this test says so out loud.
  it('the shipped plain kit agrees with every derived unit', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync(
      new URL('../kits/unbranded-v1.html', import.meta.url),
      'utf8',
    )
    const pairs: Array<[string, number]> = [
      ['field_guide', frame('field_guide').unitPt],
      ['quick_reference', frame('letter_two_column').unitPt],
      ['huddle_card', frame('huddle_card').unitPt],
    ]
    for (const [blueprint, derived] of pairs) {
      const rule = new RegExp(
        `\\.doc\\[data-blueprint="${blueprint}"\\][^{]*\\{[^}]*--unit:\\s*([0-9.]+)pt`,
      )
      const stated = rule.exec(css)
      expect(stated, `no --unit stated for ${blueprint}`).not.toBeNull()
      expect(Number(stated![1])).toBeCloseTo(derived, 4)
    }
  })
})
