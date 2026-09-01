/**
 * The app shell.
 *
 * The screens are not built yet — build order §15 puts the form UI at step 6,
 * after the renderer is proven. What this shows for now is the engine's own
 * output, so the geometry can be inspected in a browser rather than trusted.
 *
 * The chrome that will go around it is a deliberately different visual system
 * from the documents it produces: quiet, recessive chrome around a bright,
 * high-contrast page, so the document looks like it is sitting on the app
 * rather than made of it. It also wears no one's brand — chrome carrying
 * Ascension's identity would implicitly claim to be an Ascension product.
 */

import { useMemo, useState } from 'react'
import { reportAll } from '../geometry/verify'
import { CanvasMeasurer } from '../geometry/measure'
import { defaultKit } from '../brandkit/default'
import { summarise } from '../brandkit/parse'

const GROUND = '#121A16'
const PANEL = '#142A2B'
const INK = '#E9E6DF'
const QUIET = '#9CB1B2'
const HAIRLINE = 'rgba(246,243,236,0.10)'

export function App() {
  const [measured] = useState(() => new CanvasMeasurer())
  const reports = useMemo(() => reportAll(measured), [measured])
  const kit = useMemo(() => summarise(defaultKit()), [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: GROUND,
        color: INK,
        fontFamily: 'Archivo, system-ui, -apple-system, sans-serif',
        padding: '44px 24px',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontSize: 31, lineHeight: 1.25, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>
          Form Builder
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: QUIET, marginTop: 12 }}>
          The geometry engine and the renderer are built and tested. The screens are not
          written yet. What follows is the engine reporting its own geometry — measured in
          this browser, in the real face, rather than stated.
        </p>

        <section style={{ background: PANEL, padding: 24, marginTop: 32, border: `1px solid ${HAIRLINE}` }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 12px' }}>Using the plain look</h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: QUIET, margin: 0 }}>
            {kit.name} · headings in {kit.headingFace}, everything else in {kit.bodyFace},{' '}
            {kit.bodySizePt} point · boxes labelled {kit.calloutLabels.join(', ')} ·{' '}
            {kit.pageShapes} page shapes · no marks.
          </p>
        </section>

        {reports.map((report) => (
          <section
            key={report.id}
            style={{ background: PANEL, padding: 24, marginTop: 16, border: `1px solid ${HAIRLINE}` }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{report.label}</h2>
            <p
              style={{
                fontFamily: '"Courier Prime", "Courier New", monospace',
                fontSize: 12,
                color: QUIET,
                lineHeight: 1.8,
                marginTop: 10,
                whiteSpace: 'pre-wrap',
              }}
            >
              {`${report.trim}   live ${report.liveIn.w} × ${report.liveIn.h} in\n` +
                `${report.units} × ${report.unitPt} pt` +
                (report.firstPageUnits ? `  ·  page 1: ${report.firstPageUnits} units` : '') +
                `\n${report.columns} × ${report.columnWidthIn} in, gutter ${report.gutterIn} in → ${report.cpl} CPL\n` +
                `bottom margin ${report.marginsIn.bottom} in (derived)`}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', fontSize: 13.5 }}>
              {report.checks.map((check) => (
                <li key={check.name} style={{ color: check.ok ? '#81A569' : '#DE6A58', lineHeight: 1.7 }}>
                  {check.ok ? '✓' : '✗'} {check.name}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
