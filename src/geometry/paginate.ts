/**
 * Page count — reported, never set.
 *
 * There is no page-size, column or margin control anywhere in the app, so the
 * only thing the author ever sees about pagination is how many pages their
 * writing currently makes. "Pages appear as you need them. Nothing to set up."
 *
 * This is an estimate made from the geometry's own numbers — lines at the real
 * measure, blocks at the real unit — not a layout pass. The renderer's print CSS
 * is what actually breaks pages; this only needs to be close enough to tell
 * someone whether they are writing a two-page sheet or a nine-page one.
 */

import type { Section, DocumentBody } from '../model/content'
import { plainText } from '../model/inline'
import { charactersPerLine, type Measurer, CalibratedMeasurer } from './measure'
import { inToPt } from './constants'
import { spacing, typeScale, type Frame } from './blueprints'

const FAMILY = 'Calibri'

/** Units a block of prose occupies at this measure. */
function proseUnits(text: string, frame: Frame, measurer: Measurer): number {
  const cpl = charactersPerLine(measurer, inToPt(frame.column.widthIn), FAMILY, frame.input.bodySizePt)
  const lines = Math.max(1, Math.ceil(plainText(text).length / Math.max(1, cpl)))
  return lines
}

function sectionUnits(section: Section, frame: Frame, measurer: Measurer): number {
  const space = spacing(frame)
  // Every section carries its own heading: space above plus the heading's line.
  const heading = space.aboveH2 / frame.unitPt + 1.5
  const content = section.content

  switch (content.shape) {
    case 'paragraph':
      return heading + proseUnits(content.body, frame, measurer) + 0.5

    case 'callout':
      // A ruled box with a label tab: the label line, the body, and its padding.
      return heading + proseUnits(content.body, frame, measurer) + 2.5

    case 'table':
      // Row height is two units for a single-line row — §7.3.
      return heading + (content.rows.length + 1) * 2 + 0.5

    case 'figure':
      // A figure at full measure, in a 4:3 crop, plus its caption.
      return heading + (frame.column.widthIn * 0.75 * 72) / frame.unitPt + 1.5

    case 'steps':
      return (
        heading +
        content.steps.reduce((sum, step) => {
          let units = proseUnits(step.action, frame, measurer) + 0.5
          if (step.path.length > 0) units += 1.5
          if (step.system_response) units += proseUnits(step.system_response, frame, measurer) + 0.5
          for (const sub of step.substeps) units += proseUnits(sub.text, frame, measurer) + 0.5
          // A step and its screenshot never straddle a break, so they count as
          // one block.
          if (step.screenshot) units += (frame.column.widthIn * 0.75 * 72) / frame.unitPt + 1.5
          return sum + units
        }, 0)
      )
  }
}

/** The title block, metadata, change log and source footer the app owns. */
function shellUnits(document: DocumentBody, frame: Frame): number {
  const scale = typeScale(frame)
  const title = (scale.docTitle * 1.05) / frame.unitPt
  const metaRows = 5
  const changeLog = document.change_log.length > 0 ? (document.change_log.length + 1) * 2 + 2 : 0
  return title + metaRows * 0.9 + changeLog + 2
}

export function pageCount(
  document: DocumentBody,
  frame: Frame,
  measurer: Measurer = new CalibratedMeasurer(),
): number {
  const total =
    shellUnits(document, frame) +
    document.sections.reduce((sum, section) => sum + sectionUnits(section, frame, measurer), 0)

  // The first page may lose units to a colour-field header; continuation pages
  // have their own live height. Both are counted with their own number.
  const first = frame.firstPage?.units ?? frame.input.units
  const rest = frame.input.units
  const columns = frame.column.count

  const firstCapacity = first * columns
  if (total <= firstCapacity) return 1
  return 1 + Math.ceil((total - firstCapacity) / (rest * columns))
}
