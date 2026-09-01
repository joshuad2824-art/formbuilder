import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseKitFile } from '../src/brandkit/parse'
import { frame } from '../src/geometry/blueprints'
import { emptyDocument, newSection, newStep } from '../src/model/content'
import type { DocumentBody } from '../src/model/content'
import {
  checkHard, blockers, hasLiteralCaps, mayRewrite, mayTruncate, missingAltText,
  normaliseCaps, orderingIsSound, sizeFloorsHold, unexpandedAcronyms,
} from '../src/rules/hard'
import {
  emphasisInflation, noPrerequisites, notImperative, passiveVoice, readerTest,
  reviewDocument, sentenceTooLong, tableTooLong,
} from '../src/rules/warnings'
import { applyOffer, buildReview } from '../src/rules/review'
import { filenameFor, FORMAT_COPY } from '../src/render/pdf'

const kit = parseKitFile(
  readFileSync(new URL('../kits/unbranded-v1.html', import.meta.url), 'utf8'),
  'default',
)!.kit!.kit

function doc(build: (d: DocumentBody) => void): DocumentBody {
  const d = emptyDocument('quick_reference').document
  d.title = 'Ordering referrals'
  build(d)
  return d
}

function steps(title: string, actions: string[]) {
  const section = newSection(title, 'steps')
  section.content = {
    shape: 'steps',
    numbering: 'restart',
    steps: actions.map((action) => ({ ...newStep(), intent: 'Do it', action })),
  }
  return section
}

function para(title: string, body: string) {
  const section = newSection(title, 'paragraph')
  section.content = { shape: 'paragraph', body }
  return section
}

function callout(title: string, level: 'note' | 'important' | 'requirements' | 'tip', body: string) {
  const section = newSection(title, 'callout')
  section.content = { shape: 'callout', level, body }
  return section
}

/* -------------------------------------------------------------- HARD ---- */

describe('HARD: the simplification exemption', () => {
  // Automated simplification of clinical text omitted 30% of critical
  // information in one study. More readable but inaccurate is worse than no
  // access — so these two levels are untouchable.
  it('exempts important and requirements from every rewrite and truncation', () => {
    for (const level of ['important', 'requirements'] as const) {
      const section = callout('Watch out', level, 'x')
      expect(mayRewrite(section)).toBe(false)
      expect(mayTruncate(section)).toBe(false)
    }
  })

  it('leaves note and tip rewritable', () => {
    for (const level of ['note', 'tip'] as const) {
      expect(mayRewrite(callout('Handy', level, 'x'))).toBe(true)
    }
  })

  it('and never warns about a sentence it is forbidden to fix', () => {
    const long = 'word '.repeat(40).trim()
    const d = doc((x) => { x.sections = [callout('Watch out', 'important', long)] })
    expect(sentenceTooLong(d)).toEqual([])
  })
})

describe('HARD: alt text is the only export blocker', () => {
  it('blocks on an image with no alt text', () => {
    const section = steps('Placing it', ['Click [[Save]].'])
    if (section.content.shape !== 'steps') throw new Error('shape')
    section.content.steps[0]!.screenshot = { asset_id: 'a', alt: '', caption: null, callouts: [] }
    const d = doc((x) => { x.sections = [section] })
    const found = missingAltText(d)
    expect(found).toHaveLength(1)
    expect(found[0]!.blocksExport).toBe(true)
    expect(found[0]!.message).toMatch(/screen reader/)
  })

  it('passes once alt text is written', () => {
    const section = steps('Placing it', ['Click [[Save]].'])
    if (section.content.shape !== 'steps') throw new Error('shape')
    section.content.steps[0]!.screenshot = {
      asset_id: 'a', alt: 'The Save button, bottom right.', caption: null, callouts: [],
    }
    expect(missingAltText(doc((x) => { x.sections = [section] }))).toEqual([])
  })
})

describe('HARD: acronyms', () => {
  it('flags a term used without an expansion', () => {
    const d = doc((x) => { x.sections = [para('Why', 'Send it to the HIM inbox.')] })
    expect(unexpandedAcronyms(d)).toContain('HIM')
  })

  it('accepts the library’s own expansion style', () => {
    const d = doc((x) => {
      x.sections = [para('Why', 'Send it to the HIM (Health Information Management) inbox.')]
    })
    expect(unexpandedAcronyms(d)).not.toContain('HIM')
  })

  it('leaves ordinary abbreviations alone', () => {
    const d = doc((x) => { x.sections = [para('Why', 'Open it at 9 AM in the ED.')] })
    expect(unexpandedAcronyms(d)).toEqual([])
  })
})

describe('HARD: caps are stored as normal case', () => {
  // Screen readers spell literal caps out letter by letter.
  it('spots literal caps and normalises them', () => {
    expect(hasLiteralCaps('This is IMPORTANT')).toBe(true)
    expect(normaliseCaps('This is IMPORTANT')).toBe('This is Important')
  })

  it('leaves a short acronym alone', () => {
    expect(hasLiteralCaps('Open the ED list')).toBe(false)
  })
})

describe('HARD: structural rules', () => {
  it('every geometry holds the type floors', () => {
    for (const id of ['field_guide', 'letter_two_column', 'letter_prose', 'huddle_card'] as const) {
      expect(sizeFloorsHold(frame(id))).toBe(true)
    }
  })

  it('something always precedes the first step list', () => {
    expect(orderingIsSound(doc((x) => { x.sections = [steps('Do', ['Click.'])] }))).toBe(true)
    expect(
      orderingIsSound(doc((x) => { x.sections = [para('Why', 'Because.'), steps('Do', ['Click.'])] })),
    ).toBe(true)
  })

  it('the shipped kit has no contrast violation at any geometry', () => {
    for (const id of ['field_guide', 'letter_two_column', 'huddle_card'] as const) {
      const d = doc((x) => { x.sections = [para('Why', 'Because.')] })
      expect(checkHard(d, kit, frame(id)).filter((v) => v.rule === 'contrast')).toEqual([])
    }
  })
})

/* ----------------------------------------------------------- WARNINGS --- */

describe('WARNING: every warning is a declinable offer', () => {
  const d = doc((x) => {
    x.sections = [
      para('Why', 'We changed it.'),
      steps('Placing it', Array.from({ length: 9 }, (_, i) => `Click [[Thing ${i}]].`)),
    ]
  })

  it('states what, then why in one sentence, and offers a decline', () => {
    for (const offer of reviewDocument(d)) {
      expect(offer.what.length).toBeGreaterThan(0)
      expect(offer.why.length).toBeGreaterThan(0)
      // One sentence of why. Not a paragraph, not a citation.
      expect(offer.why.split(/(?<=[.!?])\s+/).filter(Boolean)).toHaveLength(1)
      expect(offer.decline.length).toBeGreaterThan(0)
    }
  })

  it('never phrases a fix as "revise wording"', () => {
    for (const offer of reviewDocument(d)) {
      if (offer.fix) expect(offer.fix.label).not.toMatch(/revise|rewrite|improve|fix the/i)
    }
  })
})

describe('WARNING: the fixes the app performs itself', () => {
  it('splits a long step list and keeps the numbering running', () => {
    const d = doc((x) => { x.sections = [steps('Placing it', Array.from({ length: 9 }, (_, i) => `Click ${i}.`))] })
    const offer = tableTooLong(d)[0]!
    expect(offer.fix!.label).toMatch(/Split it after step 4/)
    const after = applyOffer(d, offer)
    expect(after.sections).toHaveLength(2)
    expect(after.sections[1]!.title).toBe('Placing it, continued')
    if (after.sections[1]!.content.shape !== 'steps') throw new Error('shape')
    expect(after.sections[1]!.content.numbering).toBe('continue')
    expect(after.sections[1]!.content.steps).toHaveLength(5)
  })

  it('replaces a fuzzy opener with the actual replacement text', () => {
    const d = doc((x) => { x.sections = [steps('Before', ['Know that the plan must be signed.'])] })
    const offer = notImperative(d)[0]!
    expect(offer.fix!.label).toBe('Change it to “Check that…”')
    const after = applyOffer(d, offer)
    if (after.sections[0]!.content.shape !== 'steps') throw new Error('shape')
    expect(after.sections[0]!.content.steps[0]!.action).toBe('Check that the plan must be signed.')
  })

  it('leaves a properly imperative step alone', () => {
    const d = doc((x) => { x.sections = [steps('Do', ['Select the [[Orders]] tab.'])] })
    expect(notImperative(d)).toEqual([])
  })
})

describe('WARNING: the rest of the set', () => {
  it('notices passive voice in a step', () => {
    const d = doc((x) => { x.sections = [steps('Do', ['The order is signed by the provider.'])] })
    expect(passiveVoice(d)).toHaveLength(1)
  })

  it('notices a sentence past twenty-five words', () => {
    const d = doc((x) => { x.sections = [para('Why', `${'word '.repeat(30).trim()}.`)] })
    expect(sentenceTooLong(d)).toHaveLength(1)
  })

  it('notices emphasis inflation', () => {
    const d = doc((x) => { x.sections = [steps('Do', ['[[Click the button in the corner of the window]] now.'])] })
    expect(emphasisInflation(d)).toHaveLength(1)
  })

  it('asks the prerequisites question rather than dictating a section name', () => {
    const d = doc((x) => { x.sections = [steps('Do', ['Click [[Save]].'])] })
    const offer = noPrerequisites(d)[0]!
    expect(offer.what).toMatch(/before step 1\?$/)
    // The enforcement moved to a question. It never names a section for the author.
    expect(offer.what).not.toMatch(/prerequisite/i)
    expect(offer.fix).toBeNull()
  })

  it('drops the prerequisites question once something precedes the steps', () => {
    const d = doc((x) => {
      x.sections = [para('Why', 'Because.'), para('Before', 'Access.'), steps('Do', ['Click.'])]
    })
    expect(noPrerequisites(d)).toEqual([])
  })

  it('offers a reminder for the reader test rather than a dismissal', () => {
    // The library calls it the highest-value step; a plain dismissal deletes it
    // forever.
    expect(readerTest()[0]!.decline).toBe('Remind me in a week')
  })
})

describe('WARNING: what is deliberately absent', () => {
  it('there is no readability rule anywhere in the set', () => {
    const d = doc((x) => { x.sections = [para('Why', `${'word '.repeat(30).trim()}.`)] })
    const ids = reviewDocument(d).map((o) => o.id)
    expect(ids).not.toContain('readability')
    const text = JSON.stringify(reviewDocument(d))
    expect(text).not.toMatch(/readability|grade level|SMOG|reading level/i)
  })
})

/* ------------------------------------------------------------- review --- */

describe('the review screen', () => {
  it('puts the blocking item first and the offers below it', () => {
    const section = steps('Placing it', Array.from({ length: 9 }, (_, i) => `Click ${i}.`))
    if (section.content.shape !== 'steps') throw new Error('shape')
    section.content.steps[0]!.screenshot = { asset_id: 'a', alt: '', caption: null, callouts: [] }
    const d = doc((x) => { x.sections = [para('Why', 'Because.'), section] })

    const review = buildReview(d, kit, frame('letter_two_column'))
    expect(review.items[0]!.kind).toBe('blocking')
    expect(review.items.slice(1).every((i) => i.kind === 'offer')).toBe(true)
    expect(review.canExport).toBe(false)
  })

  it('permits export once nothing blocks, warnings and all', () => {
    const d = doc((x) => {
      x.sections = [para('Why', 'Because.'), steps('Do', Array.from({ length: 9 }, (_, i) => `Click ${i}.`))]
    })
    const review = buildReview(d, kit, frame('letter_two_column'))
    expect(review.items.some((i) => i.kind === 'offer')).toBe(true)
    expect(review.canExport).toBe(true)
  })

  it('reports no blockers on a clean document', () => {
    const d = doc((x) => { x.sections = [para('Why', 'Because.'), steps('Do', ['Click [[Save]].'])] })
    expect(blockers(checkHard(d, kit, frame('field_guide')))).toEqual([])
  })
})

describe('export formats are named by what you would do with them', () => {
  it('leads with the job, not the file type', () => {
    expect(FORMAT_COPY.map((f) => f.title)).toEqual([
      'For printing', 'For sharing a link', 'If someone must edit it',
    ])
    expect(FORMAT_COPY.map((f) => f.sub)).toEqual(['PDF', 'Web page', 'Word'])
  })

  it('the Word card carries its own caveat in plain voice', () => {
    expect(FORMAT_COPY[2]!.note).toMatch(/out of our hands/)
  })

  it('builds a filename someone can find again', () => {
    expect(filenameFor('Ordering and tracking outpatient referrals', 'scaffolded'))
      .toBe('ordering-and-tracking-outpatient-referrals-scaffolded.html')
    expect(filenameFor('', 'expert')).toBe('document-expert.html')
  })
})
