/**
 * The geometry verifier.
 *
 * Build rule 1 says layout figures are generated from layout, never typed.
 * This module is how that rule is enforced against the engine itself: it
 * recomputes every geometry and reports where the result disagrees with the
 * figure the handoff states, so a stated number can never quietly drift away
 * from the layout it describes.
 *
 * It is also what the tests assert against, and what the app calls to render
 * its own annotated geometry table.
 */

import {
  CPL_HARD_MAX,
  CPL_MAX_MULTICOL,
  CPL_MAX_SINGLE,
  CPL_MIN_MULTICOL,
  CPL_MIN_SINGLE,
} from './constants'
import { FRAMES, measureOf, resolveFrame, type Frame, type FrameId } from './blueprints'
import { CalibratedMeasurer, type Measurer } from './measure'

export interface GeometryReport {
  id: FrameId
  label: string
  trim: string
  marginsIn: { inner: number; outer: number; top: number; bottom: number }
  liveIn: { w: number; h: number }
  livePt: { w: number; h: number }
  unitPt: number
  units: number
  firstPageUnits: number | null
  columns: number
  columnWidthIn: number
  gutterIn: number
  cpl: number
  leading: number
  /** Every check that must hold for the geometry to be legal. */
  checks: Array<{ name: string; ok: boolean; detail: string }>
}

const round = (n: number, places = 4) => Number(n.toFixed(places))

export function report(frame: Frame, measurer: Measurer, family = 'Calibri'): GeometryReport {
  const cpl = measureOf(frame, measurer, family)
  const multi = frame.column.count > 1
  const lo = multi ? CPL_MIN_MULTICOL : CPL_MIN_SINGLE
  const hi = multi ? CPL_MAX_MULTICOL : CPL_MAX_SINGLE

  const exact = frame.liveHPt / frame.unitPt
  const checks: GeometryReport['checks'] = [
    {
      name: 'live height is an exact integer multiple of its own unit',
      ok: Math.abs(exact - Math.round(exact)) < 1e-9,
      detail: `${round(frame.liveHPt, 3)} pt / ${round(frame.unitPt, 4)} pt = ${round(exact, 6)}`,
    },
    {
      name: 'measure inside its band',
      ok: cpl >= lo && cpl <= hi,
      detail: `${round(cpl, 2)} CPL against ${lo}–${hi}`,
    },
    {
      name: 'measure under the WCAG 1.4.8 ceiling',
      ok: cpl <= CPL_HARD_MAX,
      detail: `${round(cpl, 2)} CPL against ${CPL_HARD_MAX}`,
    },
    {
      name: 'columns and gutters fill the live width',
      ok:
        Math.abs(
          frame.column.count * frame.column.widthIn +
            (frame.column.count - 1) * frame.column.gutterIn +
            frame.railIn +
            (frame.railIn > 0 ? frame.column.gutterIn : 0) -
            frame.liveWIn,
        ) < 1e-9 || frame.input.maxColumnWidthIn !== undefined,
      detail: `${frame.column.count} × ${round(frame.column.widthIn)} in + gutters in ${round(frame.liveWIn)} in`,
    },
    {
      name: 'bottom margin is positive',
      ok: frame.bottomMarginIn > 0,
      detail: `${round(frame.bottomMarginIn)} in`,
    },
  ]

  if (frame.input.mirrored) {
    checks.push({
      name: 'inner margin exceeds outer by at least 0.125 in (the fold)',
      ok: frame.input.innerMarginIn - frame.input.outerMarginIn >= 0.125 - 1e-9,
      detail: `inner ${frame.input.innerMarginIn} − outer ${frame.input.outerMarginIn}`,
    })
  }

  if (frame.firstPage) {
    const firstExact = frame.firstPage.liveHPt / frame.unitPt
    checks.push({
      name: 'first-page live height is its own exact multiple',
      ok: Math.abs(firstExact - Math.round(firstExact)) < 1e-9,
      detail: `${round(frame.firstPage.liveHPt, 3)} pt = ${round(firstExact, 6)} units`,
    })
  }

  return {
    id: frame.input.id,
    label: frame.input.label,
    trim: `${frame.input.trimWIn} × ${frame.input.trimHIn} in`,
    marginsIn: {
      inner: frame.input.innerMarginIn,
      outer: frame.input.outerMarginIn,
      top: frame.input.topMarginIn,
      bottom: round(frame.bottomMarginIn),
    },
    liveIn: { w: round(frame.liveWIn), h: round(frame.liveHIn) },
    livePt: { w: round(frame.liveWPt, 2), h: round(frame.liveHPt, 2) },
    unitPt: round(frame.unitPt, 4),
    units: frame.input.units,
    firstPageUnits: frame.firstPage?.units ?? null,
    columns: frame.column.count,
    columnWidthIn: round(frame.column.widthIn),
    gutterIn: frame.column.gutterIn,
    cpl: round(cpl, 2),
    leading: round(frame.input.leading, 4),
    checks,
  }
}

export function reportAll(measurer: Measurer = new CalibratedMeasurer()): GeometryReport[] {
  return (Object.keys(FRAMES) as FrameId[]).map((id) => report(resolveFrame(FRAMES[id]!), measurer))
}

/** A plain-text table, for the console and for the build log. */
export function formatReports(reports: GeometryReport[]): string {
  const lines: string[] = []
  for (const r of reports) {
    lines.push(`${r.label}  (${r.trim})`)
    lines.push(
      `  margins   inner ${r.marginsIn.inner} · outer ${r.marginsIn.outer} · ` +
        `top ${r.marginsIn.top} · bottom ${r.marginsIn.bottom}   [bottom derived]`,
    )
    lines.push(`  live      ${r.liveIn.w} × ${r.liveIn.h} in   (${r.livePt.w} × ${r.livePt.h} pt)`)
    lines.push(
      `  units     ${r.units} × ${r.unitPt} pt` +
        (r.firstPageUnits ? `   ·  page 1: ${r.firstPageUnits} units` : ''),
    )
    lines.push(
      `  columns   ${r.columns} × ${r.columnWidthIn} in, gutter ${r.gutterIn} in   ` +
        `→ ${r.cpl} CPL   leading ${r.leading}`,
    )
    for (const c of r.checks) lines.push(`  ${c.ok ? '✓' : '✗'} ${c.name} — ${c.detail}`)
    lines.push('')
  }
  return lines.join('\n')
}
