import { describe, expect, it } from 'vitest'
import { frameFor, savedLabel, SCREEN_ORDER, SCREEN_TITLE } from '../src/app/state'
import { pageCount } from '../src/geometry/paginate'
import { frame } from '../src/geometry/blueprints'
import { emptyDocument, newSection, newStep } from '../src/model/content'
import type { DocumentBody } from '../src/model/content'
import { CHROME_CSS, COLOR } from '../src/app/theme'

function build(sections: ReturnType<typeof newSection>[]): DocumentBody {
  const d = emptyDocument('quick_reference').document
  d.title = 'Ordering referrals'
  d.sections = sections
  return d
}

function para(title: string, body: string) {
  const s = newSection(title, 'paragraph')
  s.content = { shape: 'paragraph', body }
  return s
}

function steps(title: string, count: number) {
  const s = newSection(title, 'steps')
  s.content = {
    shape: 'steps',
    numbering: 'restart',
    steps: Array.from({ length: count }, () => ({
      ...newStep(),
      intent: 'Do it',
      action: 'Select the [[Orders]] tab from the Menu and click Add.',
    })),
  }
  return s
}

describe('autosave is always on and always visible', () => {
  it('says "Saved a moment ago" just after a save', () => {
    const now = new Date('2026-09-01T12:00:00Z')
    expect(savedLabel(new Date('2026-09-01T11:59:30Z'), now)).toBe('Saved a moment ago')
  })

  it('ages honestly rather than lying about it', () => {
    const now = new Date('2026-09-01T12:00:00Z')
    expect(savedLabel(new Date('2026-09-01T11:55:00Z'), now)).toBe('Saved 5 minutes ago')
    expect(savedLabel(new Date('2026-09-01T10:00:00Z'), now)).toBe('Saved 2 hours ago')
  })

  it('does not claim a save that never happened', () => {
    expect(savedLabel(null)).toBe('Not saved yet')
  })
})

describe('the flow', () => {
  it('is linear and every screen is named in plain language', () => {
    expect(SCREEN_ORDER).toEqual(['brand', 'triage', 'blueprint', 'sections', 'review', 'done'])
    for (const id of SCREEN_ORDER) {
      const title = SCREEN_TITLE[id]
      expect(title.length).toBeGreaterThan(0)
      // No jargon reaches the screen.
      expect(title).not.toMatch(/blueprint|section type|geometry|measure|CPL|baseline/i)
    }
  })
})

describe('the app picks the layout; the author never does', () => {
  it('sends a mostly-prose sheet to the prose geometry', () => {
    const d = build([para('Why', 'Because.'), para('Scope', 'Inpatient only.'), steps('Do', 1)])
    expect(frameFor(d)).toBe('letter_prose')
  })

  it('sends a step-heavy sheet to two columns', () => {
    const d = build([para('Why', 'Because.'), steps('Do', 4), steps('Then', 3)])
    expect(frameFor(d)).toBe('letter_two_column')
  })

  it('follows the blueprint where there is only one geometry', () => {
    const d = build([para('Why', 'Because.')])
    d.blueprint = 'field_guide'
    expect(frameFor(d)).toBe('field_guide')
    d.blueprint = 'huddle_card'
    expect(frameFor(d)).toBe('huddle_card')
  })
})

describe('page count is reported, never set', () => {
  it('a short document is one page', () => {
    const d = build([para('Why', 'Referrals were being lost between the order and the clinic.')])
    expect(pageCount(d, frame('letter_two_column'))).toBe(1)
  })

  it('grows with the writing rather than being chosen', () => {
    const short = build([steps('Do', 3)])
    const long = build([steps('Do', 60)])
    expect(pageCount(long, frame('field_guide'))).toBeGreaterThan(
      pageCount(short, frame('field_guide')),
    )
  })

  it('the narrow page holds less than the letter sheet, as its live area says', () => {
    // Field guide live area is 31.9 in² against letter's 58.2 — it holds ~55%.
    const d = build([steps('Do', 40)])
    expect(pageCount(d, frame('field_guide'))).toBeGreaterThan(
      pageCount(d, frame('letter_two_column')),
    )
  })

  it('counts both columns of a two-column sheet', () => {
    const d = build([steps('Do', 30)])
    const two = frame('letter_two_column')
    const prose = frame('letter_prose')
    // Two narrow columns hold more lines than one wide one at the same trim.
    expect(pageCount(d, two)).toBeLessThanOrEqual(pageCount(d, prose))
  })

  it('never reports fewer than one page', () => {
    expect(pageCount(build([]), frame('huddle_card'))).toBe(1)
  })
})

describe('the chrome is a different visual system from the document', () => {
  it('is dark, so the white page is the brightest thing on screen', () => {
    expect(COLOR.ground).toBe('#121A16')
    expect(CHROME_CSS).toContain(`background: ${COLOR.ground}`)
  })

  it('rounds nothing', () => {
    expect(CHROME_CSS).toMatch(/border-radius: 0/)
    expect(CHROME_CSS).not.toMatch(/border-radius:\s*[1-9]/)
  })

  it('puts shadows only under the page previews and plates, never on chrome', () => {
    const shadows = [...CHROME_CSS.matchAll(/box-shadow:[^;]+/g)].map((m) => m[0])
    expect(shadows.length).toBeGreaterThan(0)
    for (const shadow of shadows) {
      expect(shadow).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.55\)|rgba\(246,243,236,0\.26\)|rgba\(0,0,0,0\.45\)/)
    }
  })

  it('never uses a browser-blue focus outline', () => {
    expect(CHROME_CSS).toContain(`outline: 2px solid ${COLOR.accent}`)
    expect(CHROME_CSS).toMatch(/outline-offset: 2px/)
  })

  it('uses one interface family, and monospace only for figures', () => {
    // Editorial faces belong to a reading column and a signpost, not a control
    // surface — deltas §5.
    expect(CHROME_CSS).not.toMatch(/Playfair|Spectral|Oswald|Georgia|Chronicle/)
    // A standalone `serif` — `sans-serif` is the fallback on the one family.
    expect(CHROME_CSS).not.toMatch(/(?<!sans-)\bserif\b/)
    expect(CHROME_CSS).toMatch(/Courier Prime/)
  })

  it('honours a reduced-motion preference', () => {
    expect(CHROME_CSS).toContain('prefers-reduced-motion: reduce')
  })

  it('keeps the footer out of the scrolling region', () => {
    // Whatever a screen exists to do belongs in persistent chrome.
    expect(CHROME_CSS).toMatch(/\.app \{[\s\S]*?height: 100vh/)
    expect(CHROME_CSS).toMatch(/\.content \{[^}]*overflow-y: auto/)
  })
})
