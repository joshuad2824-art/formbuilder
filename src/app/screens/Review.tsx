/**
 * Screen 6 — "Suggestions before you finish." Design artifact `3e`.
 *
 * **Offers, not a report.** The one blocking item sits first and the declinable
 * suggestions scroll below it: the mandatory item is never last in a list of
 * optional ones.
 *
 * Nothing here is a modal and nothing is a wall of red. Each card states what,
 * then why in one sentence, then offers a fix the app performs itself — with a
 * decline as easy to press as the accept.
 */

import { useMemo, useState } from 'react'
import { Footer, OfferCard, Screen } from '../chrome'
import { COLOR } from '../theme'
import type { DocumentBody } from '../../model/content'
import type { LoadedKit } from '../../brandkit/types'
import { frame as resolveFrame, type FrameId } from '../../geometry/blueprints'
import { blockers, checkHard } from '../../rules/hard'
import { reviewDocument, type Offer } from '../../rules/warnings'

export function Review({
  document,
  kit,
  frameId,
  onDocument,
  onBack,
  onNext,
}: {
  document: DocumentBody
  kit: LoadedKit
  frameId: FrameId
  onDocument: (document: DocumentBody) => void
  onBack: () => void
  onNext: () => void
}) {
  const [declined, setDeclined] = useState<string[]>([])

  const frame = useMemo(() => resolveFrame(frameId), [frameId])
  const blocking = useMemo(
    () => blockers(checkHard(document, kit.kit, frame)),
    [document, kit, frame],
  )
  const offers = useMemo(
    () => reviewDocument(document).filter((o) => !declined.includes(key(o))),
    [document, declined],
  )

  const canExport = blocking.length === 0

  return (
    <>
      <Screen
        title="Before you finish"
        lede={
          canExport
            ? 'Nothing is stopping you. These are worth a look, and every one of them can be left alone.'
            : 'One thing needs doing before this can go out. The rest are only suggestions.'
        }
      >
        <div className="stack-lg">
          {/* Blocking first, always. */}
          {blocking.map((violation, index) => (
            <OfferCard key={`${violation.rule}-${index}`} blocking what={violation.message} />
          ))}

          {offers.map((offer) => (
            <OfferCard
              key={key(offer)}
              what={offer.what}
              why={offer.why}
              fixLabel={offer.fix?.label ?? null}
              declineLabel={offer.decline}
              onFix={() => {
                if (offer.fix) onDocument(offer.fix.apply(document))
                setDeclined((d) => [...d, key(offer)])
              }}
              onDecline={() => setDeclined((d) => [...d, key(offer)])}
            />
          ))}

          {blocking.length === 0 && offers.length === 0 ? (
            <p className="row" style={{ gap: 10, margin: 0 }}>
              <span aria-hidden style={{ color: COLOR.success }}>✓</span>
              <span>Nothing to suggest. This reads well.</span>
            </p>
          ) : null}
        </div>
      </Screen>

      <Footer
        onBack={onBack}
        action={
          <button type="button" className="btn btn-accent" onClick={onNext} disabled={!canExport}>
            Make my document
          </button>
        }
      />
    </>
  )
}

function key(offer: Offer): string {
  return `${offer.id}:${offer.where}`
}
