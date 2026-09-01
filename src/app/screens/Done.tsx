/**
 * Screen 7 — "Your document is ready." Design artifact `3f`.
 *
 * Three formats, named by what you would do with them rather than by file type,
 * plus **the two extra variants offered unasked** — as gifts, not settings.
 * "A short version for people who already know the steps."
 *
 * The screen still offers a way back. The fear of a one-way door does not end
 * at the last step.
 */

import { useMemo } from 'react'
import { Footer, Screen } from '../chrome'
import { COLOR } from '../theme'
import type { DocumentBody } from '../../model/content'
import type { LoadedKit } from '../../brandkit/types'
import type { FrameId } from '../../geometry/blueprints'
import { renderDocument } from '../../render/html'
import { downloadDocument, filenameFor, printDocument, FORMAT_COPY } from '../../render/pdf'

export function Done({
  document,
  kit,
  frameId,
  pageCount,
  onBack,
  onRestart,
}: {
  document: DocumentBody
  kit: LoadedKit
  frameId: FrameId
  pageCount: number
  onBack: () => void
  onRestart: () => void
}) {
  const files = useMemo(
    () => ({
      scaffolded: renderDocument(document, kit, { variant: 'scaffolded', frameId }),
      expert: renderDocument(document, kit, { variant: 'expert', frameId }),
      large: renderDocument(document, kit, { variant: 'scaffolded', frameId, largePrint: true }),
    }),
    [document, kit, frameId],
  )

  return (
    <>
      <Screen
        title="Your document is ready"
        lede={`${pageCount} page${pageCount === 1 ? '' : 's'}, laid out and ready to go out.`}
      >
        <div className="stack-lg">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {FORMAT_COPY.map((format) => (
              <div key={format.id} className="panel stack">
                <p className="mono" style={{ margin: 0 }}>
                  {format.sub}
                </p>
                <p style={{ margin: 0, fontWeight: 500, fontSize: 15.5 }}>{format.title}</p>
                <p className="caption" style={{ margin: 0, flex: 1 }}>
                  {format.note}
                </p>
                <button
                  type="button"
                  className={format.id === 'print' ? 'btn btn-accent' : 'btn'}
                  disabled={format.id === 'word'}
                  onClick={() => {
                    if (format.id === 'print') void printDocument(files.scaffolded, document.title)
                    if (format.id === 'web')
                      downloadDocument(files.scaffolded, filenameFor(document.title, 'full'))
                  }}
                >
                  {format.id === 'word' ? 'Not ready yet' : 'Get it'}
                </button>
              </div>
            ))}
          </div>

          <hr className="rule-strong" />

          {/* Offered unasked. Gifts, not settings. */}
          <div className="stack">
            <p className="mono" style={{ margin: 0 }}>
              Also made for you
            </p>

            <div className="panel spread">
              <span>
                <span style={{ fontWeight: 500 }}>A short version</span>
                <span className="caption" style={{ display: 'block', marginTop: 4 }}>
                  For people who already know the steps. The things they must not miss are word for
                  word the same.
                </span>
              </span>
              <button
                type="button"
                className="btn"
                onClick={() => downloadDocument(files.expert, filenameFor(document.title, 'short'))}
              >
                Get it
              </button>
            </div>

            <div className="panel spread">
              <span>
                <span style={{ fontWeight: 500 }}>A large-print version</span>
                <span className="caption" style={{ display: 'block', marginTop: 4 }}>
                  Bigger type, one column, same words.
                </span>
              </span>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  downloadDocument(files.large, filenameFor(document.title, 'large-print'))
                }
              >
                Get it
              </button>
            </div>
          </div>

          <p className="row" style={{ gap: 10, margin: 0 }}>
            <span aria-hidden style={{ color: COLOR.success }}>✓</span>
            <span className="caption">
              Everything was made on this computer. Nothing was uploaded anywhere.
            </span>
          </p>
        </div>
      </Screen>

      <Footer onBack={onBack} backLabel="Go back and change something">
        <button type="button" className="btn btn-quiet" onClick={onRestart}>
          Start something new
        </button>
      </Footer>
    </>
  )
}
