/**
 * DOCX — §13.3. **Ship last, and frame it as an editable copy rather than the
 * deliverable.** The moment the file opens in Word, brand fidelity is out of
 * the app's hands, and the UI says so in plain voice.
 *
 * The one rule that makes it worth shipping at all: **map sections to Word
 * styles rather than direct formatting**, so a user's edits inherit the design
 * instead of fighting it. Someone who changes "Heading 2" in Word gets every
 * section heading; someone handed direct formatting gets a document that comes
 * apart the first time they touch it.
 *
 * The library is loaded on demand — it is large, and most people never take
 * this format.
 */

import type { DocumentBody, Section } from '../model/content'
import { plainText, tokenize, microTypography, uiMarksApply } from '../model/inline'
import { cut } from '../model/register'
import type { Variant } from '../model/vocabularies'
import { AUDIENCES, DATE_SUBLABELS, SYSTEMS } from '../model/vocabularies'
import type { LoadedKit } from '../brandkit/types'

/** Word's own style ids, so edits inherit rather than fight. */
const STYLE = {
  title: 'Title',
  heading1: 'Heading1',
  heading2: 'Heading2',
  body: 'Normal',
  caption: 'Caption',
  quote: 'IntenseQuote',
} as const

type DocxModule = typeof import('docx')

/**
 * Inline runs. `[[double brackets]]` become bold and backticked strings become
 * a monospace run — the same two marks the HTML renderer honours, and the same
 * blueprint exception: the huddle card bolds dates and credentials, never a UI
 * control.
 */
function runs(docx: DocxModule, source: string, uiMarks: boolean) {
  return tokenize(microTypography(source)).map((token) => {
    if (token.kind === 'ui' && uiMarks) return new docx.TextRun({ text: token.text, bold: true })
    if (token.kind === 'literal') {
      return new docx.TextRun({ text: token.text, font: 'Consolas' })
    }
    return new docx.TextRun({ text: token.text })
  })
}

function sectionParagraphs(
  docx: DocxModule,
  section: Section,
  uiMarks: boolean,
  startNumber: number,
): { children: unknown[]; nextNumber: number } {
  const children: unknown[] = [
    new docx.Paragraph({ text: plainText(section.title), style: STYLE.heading2 }),
  ]
  const content = section.content

  switch (content.shape) {
    case 'paragraph':
      children.push(new docx.Paragraph({ children: runs(docx, content.body, uiMarks) }))
      return { children, nextNumber: startNumber }

    case 'callout':
      // A callout keeps its label, because the label is the whole signal and
      // Word will not carry the kit's fill. No meaning by colour alone applies
      // here more than anywhere.
      children.push(
        new docx.Paragraph({
          style: STYLE.quote,
          children: [
            new docx.TextRun({ text: `${content.level.toUpperCase()}  `, bold: true }),
            ...runs(docx, content.body, uiMarks),
          ],
        }),
      )
      return { children, nextNumber: startNumber }

    case 'table': {
      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: [
            new docx.TableRow({
              tableHeader: true,
              children: content.columns.map(
                (column) =>
                  new docx.TableCell({
                    children: [new docx.Paragraph({ children: [new docx.TextRun({ text: column, bold: true })] })],
                  }),
              ),
            }),
            ...content.rows.map(
              (row) =>
                new docx.TableRow({
                  children: row.map(
                    (cell) =>
                      new docx.TableCell({
                        children: [new docx.Paragraph({ children: runs(docx, cell, uiMarks) })],
                      }),
                  ),
                }),
            ),
          ],
        }),
      )
      return { children, nextNumber: startNumber }
    }

    case 'figure':
      // Images are deliberately not carried across. A screenshot placed by Word
      // is a screenshot the app no longer controls the size or position of, and
      // §7.6's whole point is that a mis-scaled capture prints its own UI text
      // at six point. The alt text goes instead, so nothing is silently lost.
      if (content.screenshot) {
        children.push(
          new docx.Paragraph({
            style: STYLE.caption,
            text: `[Picture: ${content.screenshot.alt}]`,
          }),
        )
      }
      return { children, nextNumber: startNumber }

    case 'steps': {
      const start = content.numbering === 'continue' ? startNumber : 1
      content.steps.forEach((step, index) => {
        children.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({ text: `${start + index}.  `, bold: true }),
              ...runs(docx, step.action, uiMarks),
            ],
          }),
        )
        if (step.path.length > 0) {
          children.push(
            new docx.Paragraph({ style: STYLE.caption, text: step.path.join('  →  ') }),
          )
        }
        if (step.system_response) {
          children.push(
            new docx.Paragraph({
              children: [new docx.TextRun({ text: plainText(step.system_response), italics: true })],
            }),
          )
        }
        for (const sub of step.substeps) {
          children.push(new docx.Paragraph({ children: runs(docx, sub.text, uiMarks) }))
        }
        if (step.screenshot) {
          children.push(
            new docx.Paragraph({ style: STYLE.caption, text: `[Picture: ${step.screenshot.alt}]` }),
          )
        }
      })
      return { children, nextNumber: start + content.steps.length }
    }
  }
}

export async function renderDocx(
  body: DocumentBody,
  loaded: LoadedKit,
  variant: Variant = 'scaffolded',
): Promise<Blob> {
  const docx = await import('docx')
  const document = cut(body, variant)
  const uiMarks = uiMarksApply(document.blueprint)
  const kit = loaded.kit

  const children: unknown[] = [
    new docx.Paragraph({ text: plainText(document.title), style: STYLE.title }),
  ]

  // Metadata, as a plain list — Word has no rail and inventing one would be a
  // layout the app cannot hold on to.
  const meta = document.meta
  const dateLabel =
    DATE_SUBLABELS.find((d) => d.id === meta.effective_date_sublabel)?.label ?? 'Effective'
  const rows: Array<[string, string]> = []
  const audience = meta.audience.map((id) => AUDIENCES.find((a) => a.id === id)?.label ?? id)
  const systems = meta.systems.map((id) => SYSTEMS.find((s) => s.id === id)?.label ?? id)
  if (audience.length) rows.push(['Audience', audience.join(', ')])
  if (systems.length) {
    rows.push(['System', [systems.join(', '), meta.system_version].filter(Boolean).join(' ')])
  }
  if (meta.effective_date) rows.push([dateLabel, meta.effective_date])
  if (meta.owner) rows.push(['Owner', meta.owner])
  rows.push(['Version', meta.version])
  for (const [key, value] of rows) {
    children.push(
      new docx.Paragraph({
        style: STYLE.caption,
        children: [new docx.TextRun({ text: `${key}: `, bold: true }), new docx.TextRun({ text: value })],
      }),
    )
  }

  let number = 1
  for (const section of document.sections) {
    const rendered = sectionParagraphs(docx, section, uiMarks, number)
    number = rendered.nextNumber
    children.push(...rendered.children)
  }

  if (variant === 'scaffolded' && document.retrieval.length > 0) {
    const ready = document.retrieval.filter((q) => q.question.trim() && q.answer.trim())
    if (ready.length > 0) {
      children.push(new docx.Paragraph({ text: 'Check yourself', style: STYLE.heading2 }))
      ready.forEach((question, index) => {
        children.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({ text: `${index + 1}.  `, bold: true }),
              new docx.TextRun({ text: plainText(question.question), bold: true }),
            ],
          }),
        )
        children.push(new docx.Paragraph({ text: plainText(question.answer) }))
      })
    }
  }

  if (document.change_log.length > 0) {
    children.push(new docx.Paragraph({ text: 'Change log', style: STYLE.heading2 }))
    for (const entry of document.change_log) {
      children.push(
        new docx.Paragraph({
          style: STYLE.caption,
          text: `${entry.version} · ${entry.date} · ${entry.summary}`,
        }),
      )
    }
  }

  const footer = (kit.footer_template ?? '')
    .replace('{org_unit}', kit.org_unit ?? '')
    .replace('{org}', kit.org ?? '')
    .trim()
  if (footer) children.push(new docx.Paragraph({ style: STYLE.caption, text: footer }))

  // Styles carry the kit's Office substitutes and its body size, so an edited
  // copy still looks like the house style rather than like Word's defaults.
  const bodyFamily = kit.type[kit.type.body_family] ?? kit.type.sans
  const headingFamily = kit.type[kit.type.heading_family] ?? kit.type.serif
  const bodyFace = bodyFamily.office ?? 'Calibri'
  const headingFace = headingFamily.office ?? 'Georgia'
  // Word measures type in half-points.
  const halfPoints = (pt: number) => Math.round(pt * 2)
  const base = kit.type.body_size_pt

  const file = new docx.Document({
    title: plainText(document.title),
    description: 'An editable copy. The laid-out version is the PDF.',
    styles: {
      default: {
        document: { run: { font: bodyFace, size: halfPoints(base) } },
      },
      paragraphStyles: [
        {
          id: STYLE.title,
          name: 'Title',
          basedOn: 'Normal',
          quickFormat: true,
          run: { font: headingFace, size: halfPoints(base * 2.4), bold: true },
          paragraph: { spacing: { after: 200 } },
        },
        {
          id: STYLE.heading2,
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: headingFace, size: halfPoints(base * 1.55), bold: true },
          paragraph: { spacing: { before: 280, after: 120 }, keepNext: true },
        },
        {
          id: STYLE.caption,
          name: 'Caption',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: bodyFace, size: halfPoints(base * 0.82), color: '4A4A4A' },
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: children as never[],
      },
    ],
  })

  return docx.Packer.toBlob(file)
}

/** The caveat the Word card carries, in the app's own voice. */
export const DOCX_CAVEAT =
  'Once it opens in Word, how it looks is out of our hands. Pictures are named rather than ' +
  'placed, because a picture Word resizes stops being readable.'
