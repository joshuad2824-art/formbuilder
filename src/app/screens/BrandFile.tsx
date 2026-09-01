/**
 * Screen 1 — "Start by dropping in your brand file." Design artifact `5a`.
 *
 * This replaces §10's kit picker entirely. Three things get simpler: no kit
 * library, no governance problem (sharing the file directly *is* the
 * governance), and the ownership question answers itself — the app ships with
 * no organisation's brand in it and becomes their tool when someone drops in
 * their file.
 *
 * The screen names no facility. "You'll be sent one file", not who sends it.
 */

import { useRef, useState } from 'react'
import { parseKitFile, summarise } from '../../brandkit/parse'
import { defaultKit } from '../../brandkit/default'
import type { LoadedKit } from '../../brandkit/types'
import { Footer, Screen } from '../chrome'
import { COLOR } from '../theme'

export function BrandFile({
  kit,
  onKit,
  onNext,
}: {
  kit: LoadedKit
  onKit: (kit: LoadedKit) => void
  onNext: () => void
}) {
  const [over, setOver] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const loaded = kit.origin === 'dropped-in'

  async function accept(file: File | undefined) {
    if (!file) return
    setRefusal(null)
    const text = await file.text()
    const { kit: parsed, refusal: why } = parseKitFile(text, 'dropped-in')
    // A file that fails says so in one plain sentence and offers the plain look.
    if (!parsed) setRefusal(why)
    else onKit(parsed)
  }

  return (
    <>
      <Screen
        title={loaded ? `${kit.kit.name} is in` : 'Start by dropping in your brand file'}
        lede={
          loaded
            ? 'Everything you make from here on will use it. Here’s what came in the file.'
            : 'You’ll be sent one file. Drop it in once and everything you make here will carry your organisation’s look — the colours, the type, the logo, all of it.'
        }
      >
        {loaded ? (
          <KitReadout kit={kit} onReplace={() => input.current?.click()} />
        ) : (
          <div className="stack-lg">
            <div
              className="dropzone"
              data-over={over}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setOver(false)
                void accept(e.dataTransfer.files[0])
              }}
            >
              <p style={{ margin: 0, fontWeight: 500, fontSize: 15.5 }}>Drag the file here</p>
              <p className="caption" style={{ margin: '10px 0' }}>
                or
              </p>
              <button type="button" className="btn" onClick={() => input.current?.click()}>
                Choose the file
              </button>
              <p className="mono" style={{ marginTop: 16 }}>
                One file, ending in .html
              </p>
            </div>

            {/* The claim that makes this usable without a security review, at
                the same size as everything else. Not fine print. */}
            <p className="row" style={{ gap: 10, margin: 0 }}>
              <span aria-hidden style={{ color: COLOR.success }}>✓</span>
              <span>
                The file stays on this computer, like everything else here. You only need to do
                this once.
              </span>
            </p>

            {refusal ? (
              <div className="panel" style={{ borderLeft: `2px solid ${COLOR.blocking}` }}>
                <p style={{ margin: 0 }}>{refusal}</p>
                <p className="caption" style={{ margin: '8px 0 0' }}>
                  You can carry on with a plain look and drop a working file in later.
                </p>
              </div>
            ) : null}

            <p className="caption" style={{ margin: 0 }}>
              Haven’t got it yet?{' '}
              <button type="button" className="link" onClick={() => onKit(defaultKit())}>
                Carry on with a plain look
              </button>{' '}
              — you can drop the brand file in later and your document will pick it up.
            </p>
          </div>
        )}

        <input
          ref={input}
          type="file"
          accept=".html,text/html"
          hidden
          onChange={(e) => void accept(e.target.files?.[0])}
        />
      </Screen>

      <Footer
        action={
          <button type="button" className="btn btn-accent" onClick={onNext}>
            Start my first document
          </button>
        }
      />
    </>
  )
}

/** What the app read from the file, in plain language. No token names. */
function KitReadout({ kit, onReplace }: { kit: LoadedKit; onReplace: () => void }) {
  const summary = summarise(kit)
  return (
    <div className="stack-lg">
      <div className="panel stack-lg">
        <div>
          <p className="mono" style={{ margin: '0 0 10px' }}>
            Colours
          </p>
          <div className="row" style={{ gap: 8 }}>
            {summary.swatches.map((hex) => (
              <span
                key={hex}
                title={hex}
                style={{ width: 44, height: 44, background: hex, border: `1px solid ${COLOR.hairline}` }}
              />
            ))}
            {summary.swatches.length === 0 ? (
              <span className="caption">No colour — this look uses ink on paper only.</span>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mono" style={{ margin: '0 0 10px' }}>
            Type
          </p>
          <p style={{ margin: 0 }}>Headings in {summary.headingFace}</p>
          <p style={{ margin: '4px 0 0' }}>
            Everything else in {summary.bodyFace}, {summary.bodySizePt} point
          </p>
        </div>

        <div>
          <p className="mono" style={{ margin: '0 0 10px' }}>
            Boxes for things to watch out for
          </p>
          {/* Shown in the colours they will actually print in — this readout is
              "here's what came in the file", so a stand-in colour would be a
              small lie about the very thing being reported. */}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {kit.kit.callouts.map((callout) => (
              <span
                key={callout.key}
                className="chip"
                style={{
                  background: kit.kit.color[callout.color]?.hex ?? COLOR.primary,
                  color: callout.text === 'black' ? '#000' : '#fff',
                }}
              >
                {callout.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="stack">
        <p className="row" style={{ gap: 10, margin: 0 }}>
          <span aria-hidden style={{ color: COLOR.success }}>✓</span>
          <span>
            <strong style={{ fontWeight: 500 }}>{summary.hasLogo ? 'Logo' : 'No logo'}</strong> included ·{' '}
            <strong style={{ fontWeight: 500 }}>{summary.pageShapes}</strong> page shapes ·{' '}
            <strong style={{ fontWeight: 500 }}>Checked</strong> — every colour pairing is readable
          </span>
        </p>
        <p className="caption" style={{ margin: 0 }}>
          Working somewhere else, or for a different organisation?{' '}
          <button type="button" className="link" onClick={onReplace}>
            Use a different brand file
          </button>
          .
        </p>
      </div>
    </div>
  )
}
