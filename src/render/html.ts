/**
 * The HTML renderer — §13.1. The spine; the other two emitters derive from it.
 *
 * Output is a single self-contained file: CSS inlined, images as data URIs,
 * nothing fetched. That is what drops straight into booklet imposition, and it
 * is what PDF is printed from.
 *
 * The renderer marries content + blueprint + brand kit at output time. That is
 * why a new facility needs a new kit file and nothing else.
 */

import type { DocumentBody, Screenshot, Section, Step } from '../model/content'
import { tokenize, microTypography, uiMarksApply } from '../model/inline'
import { cut, stepsRenderAs } from '../model/register'
import type { Variant } from '../model/vocabularies'
import { AUDIENCES, SYSTEMS, DATE_SUBLABELS } from '../model/vocabularies'
import { frame as resolveFrame, type FrameId } from '../geometry/blueprints'
import type { LoadedKit } from '../brandkit/types'
import { inlineGeometry, largePrintCss, pageCss } from './css'

export interface RenderOptions {
  variant: Variant
  frameId: FrameId
  largePrint?: boolean
  /** Draft output shows the author's unconfirmed markers; final output does not. */
  draft?: boolean
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

function inline(source: string, allowUiMarks: boolean): string {
  return tokenize(microTypography(source))
    .map((token) => {
      const text = escapeHtml(token.text)
      if (token.kind === 'ui') return allowUiMarks ? `<b class="ui">${text}</b>` : text
      if (token.kind === 'literal') return `<code class="literal">${text}</code>`
      return text
    })
    .join('')
}

function renderScreenshot(shot: Screenshot, assets: Map<string, string>): string {
  const src = assets.get(shot.asset_id)
  if (!src) return ''
  // Callout labels render on the image at the anchor point. No separate legend,
  // no numbered key — HARD, §12.1, spatial contiguity.
  // Maximum four labels — Cowan's ~4-chunk limit, §7.6. They render on the
  // image at the anchor point, using the kit's own annotation classes.
  const marks = shot.callouts
    .slice(0, 4)
    .map(
      (c) =>
        `<span class="anno-label" style="left:${(c.x * 100).toFixed(2)}%;top:${(c.y * 100).toFixed(2)}%">${escapeHtml(c.label)}</span>`,
    )
    .join('')
  const caption = shot.caption
    ? `<figcaption>${inline(shot.caption, false)}</figcaption>`
    : ''
  return `<figure><div class="anno-layer"><img src="${src}" alt="${escapeHtml(shot.alt)}">${marks}</div>${caption}</figure>`
}

function renderStep(step: Step, index: number, assets: Map<string, string>, uiMarks: boolean): string {
  const parts: string[] = [`<p>${inline(step.action, uiMarks)}</p>`]
  if (step.path.length > 0) {
    // `path` renders as an arrow chain rather than four separate steps — §9.3.
    parts.push(`<p class="fineprint">${step.path.map((p) => escapeHtml(p)).join(' → ')}</p>`)
  }
  if (step.system_response) {
    // Verbatim system messages render in italics and are never paraphrased.
    parts.push(`<p class="sysmsg">${inline(step.system_response, uiMarks)}</p>`)
  }
  for (const sub of step.substeps) {
    parts.push(`<p class="substep substep--${sub.kind}">${inline(sub.text, uiMarks)}</p>`)
  }
  if (step.screenshot) parts.push(renderScreenshot(step.screenshot, assets))
  // The kit lays `.steps > li` out as a two-cell grid — a number cell and the
  // body. Emitting anything else collapses the body into the number column.
  // The step and its screenshot are one unbreakable unit.
  return `<li class="keep-together"><span class="n">${index}</span><div>${parts.join('')}</div></li>`
}

function renderSection(
  section: Section,
  assets: Map<string, string>,
  uiMarks: boolean,
  variant: Variant,
  startNumber: number,
): { html: string; nextNumber: number } {
  const heading = `<h2>${escapeHtml(microTypography(section.title))}</h2>`
  const content = section.content

  switch (content.shape) {
    case 'paragraph':
      return { html: `<section>${heading}<p>${inline(content.body, uiMarks)}</p></section>`, nextNumber: startNumber }

    case 'callout': {
      // `important` and `requirements` are byte-identical in both cuts. The one
      // thing the expert path may not touch — and exempt from any
      // simplification or truncation.
      return {
        html:
          `<section><aside class="callout callout--${content.level}">` +
          `<span class="label">${escapeHtml(section.title || content.level)}</span>` +
          `<p>${inline(content.body, uiMarks)}</p></aside></section>`,
        nextNumber: startNumber,
      }
    }

    case 'table': {
      // Whitespace or banding, never both — and banding only at six rows or
      // more, at 8% ink or less. §7.3.
      const banded = content.rows.length >= 6
      const head = content.columns.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('')
      const body = content.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell, uiMarks)}</td>`).join('')}</tr>`)
        .join('')
      return {
        html: `<section>${heading}<table${banded ? ' data-banded' : ''}><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`,
        nextNumber: startNumber,
      }
    }

    case 'figure':
      return {
        html: `<section>${heading}${content.screenshot ? renderScreenshot(content.screenshot, assets) : ''}</section>`,
        nextNumber: startNumber,
      }

    case 'steps': {
      const start = content.numbering === 'continue' ? startNumber : 1
      // The expert cut renders step lists as tables rather than lists — §12.4.
      if (stepsRenderAs(variant) === 'table') {
        const rows = content.steps
          .map(
            (step, i) =>
              `<tr><td>${start + i}. ${inline(step.intent, uiMarks)}</td><td>${inline(step.action, uiMarks)}</td></tr>`,
          )
          .join('')
        return {
          html: `<section>${heading}<table><thead><tr><th scope="col">What to do</th><th scope="col">Where to click</th></tr></thead><tbody>${rows}</tbody></table></section>`,
          nextNumber: start + content.steps.length,
        }
      }
      const items = content.steps
        .map((step, i) => renderStep(step, start + i, assets, uiMarks))
        .join('')
      return {
        html: `<section>${heading}<ol class="steps" start="${start}">${items}</ol></section>`,
        nextNumber: start + content.steps.length,
      }
    }
  }
}

/** The document shell is app-owned and is not an author section — deltas §9.2. */
function renderShell(
  document: DocumentBody,
  kit: LoadedKit['kit'],
): { head: string; changeLog: string; footer: string } {
  const { meta } = document
  const label = DATE_SUBLABELS.find((d) => d.id === meta.effective_date_sublabel)?.label ?? 'Effective'
  const audiences = meta.audience
    .map((id) => AUDIENCES.find((a) => a.id === id)?.label ?? id)
    .join(', ')
  const systems = meta.systems.map((id) => SYSTEMS.find((s) => s.id === id)?.label ?? id).join(', ')
  const version = meta.system_version ?? kit.system_version_default ?? null

  const rows: Array<[string, string]> = []
  if (audiences) rows.push(['Audience', audiences])
  if (systems) rows.push(['System', version ? `${systems} ${version}` : systems])
  if (meta.effective_date) rows.push([label, meta.effective_date])
  if (meta.owner) rows.push(['Owner', meta.owner])
  rows.push(['Version', meta.version])

  const head =
    `<header><p class="eyebrow">${escapeHtml(kit.org_unit ?? '')}</p>` +
    `<h1 class="doc-title">${escapeHtml(microTypography(document.title))}</h1>` +
    `<div class="rule-brand"></div>` +
    `<dl class="meta">${rows.map(([k, v]) => `<dt class="eyebrow">${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl></header>`

  const footer = (kit.footer_template ?? '')
    .replace('{org_unit}', kit.org_unit ?? '')
    .replace('{org}', kit.org ?? '')
    .trim()

  const changeLog =
    document.change_log.length > 0
      ? `<section class="change-log"><h2>Change log</h2><table><thead><tr><th scope="col">Version</th><th scope="col">Date</th><th scope="col">What changed</th></tr></thead><tbody>${document.change_log
          .map(
            (e) =>
              `<tr><td>${escapeHtml(e.version)}</td><td>${escapeHtml(e.date)}</td><td>${escapeHtml(e.summary)}</td></tr>`,
          )
          .join('')}</tbody></table></section>`
      : ''

  return {
    head,
    changeLog,
    footer: `<footer class="source-footer">${escapeHtml(footer)}</footer>`,
  }
}

export function renderDocument(
  body: DocumentBody,
  loaded: LoadedKit,
  options: RenderOptions,
  assets: Map<string, string> = new Map(),
): string {
  const document = cut(body, options.variant)
  const frame = resolveFrame(options.frameId)
  const uiMarks = uiMarksApply(document.blueprint)
  const { head, changeLog, footer } = renderShell(document, loaded.kit)

  let number = 1
  const sections = document.sections
    .map((section) => {
      const rendered = renderSection(section, assets, uiMarks, options.variant, number)
      number = rendered.nextNumber
      return rendered.html
    })
    .join('\n')

  const title = escapeHtml(document.title || 'Untitled')

  // The kit styles documents through this contract: the blueprint on the root,
  // an optional layout variant, and the large-print and draft flags.
  const attributes = [
    `class="doc"`,
    `data-blueprint="${document.blueprint}"`,
    options.frameId === 'letter_prose' ? 'data-variant="prose"' : '',
    options.largePrint ? 'data-large-print' : '',
    options.draft ? 'data-draft' : '',
    // The engine's derived geometry, written inline so it wins over any value
    // a kit hardcodes for this blueprint. Layout figures are generated from
    // layout, never typed — build rule 1, applied to the kit as well.
    `style="${inlineGeometry(frame)}"`,
  ]
    .filter(Boolean)
    .join(' ')

  // The prose geometry is a 2/3 reading column beside a 1/3 rail, with
  // metadata and support moved off the reading column — deltas §7.2. The change
  // log stays in the reading column: it is a three-column table, and a 2.25 in
  // rail cannot hold one without crushing its headers.
  const flow =
    options.frameId === 'letter_prose'
      ? `<div class="body-grid"><div class="flow">${sections}${changeLog}</div>` +
        `<aside class="rail">${footer}</aside></div>`
      : `<div class="flow">${sections}</div>${changeLog}${footer}`

  const spine = document.blueprint === 'huddle_card' ? ' spine' : ''

  // Everything is inlined. Nothing is fetched. The file opens offline, on any
  // machine, forever — which is what drops straight into booklet imposition
  // and what PDF is printed from.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${loaded.css}
</style>
<style>
${pageCss(frame)}

${largePrintCss(frame)}
</style>
</head>
<body>
<article ${attributes}>
<div class="page${spine}">
${head}
${flow}
</div>
</article>
</body>
</html>`
}

/**
 * Both variants and the large-print cut are produced on every export and
 * offered unasked — as gifts, not settings. "A short version for people who
 * already know the steps."
 */
export interface ExportSet {
  scaffolded: string
  expert: string
  largePrint: string
}

export function renderExportSet(
  body: DocumentBody,
  loaded: LoadedKit,
  frameId: FrameId,
  assets?: Map<string, string>,
): ExportSet {
  return {
    scaffolded: renderDocument(body, loaded, { variant: 'scaffolded', frameId }, assets),
    expert: renderDocument(body, loaded, { variant: 'expert', frameId }, assets),
    largePrint: renderDocument(
      body,
      loaded,
      { variant: 'scaffolded', frameId, largePrint: true },
      assets,
    ),
  }
}
