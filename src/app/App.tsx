/**
 * The app.
 *
 * Navigation is linear with a persistent way back. Every screen carries Back in
 * the footer left and the forward action in the footer right — including the
 * last one, because the fear of a one-way door does not end at the last step.
 */

import { useEffect, useMemo } from 'react'
import { CHROME_CSS } from './theme'
import { Progress, TopBar } from './chrome'
import { frameFor, SCREEN_TITLE, useStore, type ScreenId } from './state'
import { BrandFile } from './screens/BrandFile'
import { Triage } from './screens/Triage'
import { Blueprint } from './screens/Blueprint'
import { Sections } from './screens/Sections'
import { Review } from './screens/Review'
import { Done } from './screens/Done'
import { frame as resolveFrame } from '../geometry/blueprints'
import { pageCount } from '../geometry/paginate'
import { CanvasMeasurer } from '../geometry/measure'

const FLOW: ScreenId[] = ['brand', 'triage', 'blueprint', 'sections', 'review', 'done']

export function App() {
  const store = useStore()
  const { document: doc, screen, kit } = store.state

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = CHROME_CSS
    document.head.append(style)
    return () => style.remove()
  }, [])

  const measurer = useMemo(() => new CanvasMeasurer(), [])
  const frameId = frameFor(doc)
  const pages = useMemo(
    () => pageCount(doc, resolveFrame(frameId), measurer),
    [doc, frameId, measurer],
  )

  const at = FLOW.indexOf(screen)
  const back = () => store.setScreen(FLOW[Math.max(0, at - 1)]!)
  const next = () => store.setScreen(FLOW[Math.min(FLOW.length - 1, at + 1)]!)

  return (
    <div className="app">
      <TopBar
        savedText={store.savedText}
        title={screen === 'brand' ? undefined : doc.title || SCREEN_TITLE[screen]}
        onFinishLater={screen === 'brand' ? undefined : () => store.setScreen('brand')}
      />
      {screen === 'brand' || screen === 'done' ? null : <Progress screen={screen} />}

      {screen === 'brand' ? (
        <BrandFile kit={kit} onKit={store.setKit} onNext={next} />
      ) : screen === 'triage' ? (
        <Triage onBack={back} onNext={next} />
      ) : screen === 'blueprint' ? (
        <Blueprint
          blueprint={doc.blueprint}
          title={doc.title}
          onBlueprint={store.setBlueprint}
          onTitle={store.setTitle}
          onBack={back}
          onNext={next}
        />
      ) : screen === 'sections' ? (
        <Sections
          sections={doc.sections}
          kit={kit}
          pageCount={pages}
          onSections={store.setSections}
          onBack={back}
          onNext={next}
        />
      ) : screen === 'review' ? (
        <Review
          document={doc}
          kit={kit}
          frameId={frameId}
          onDocument={(next) => store.updateDocument(() => next)}
          onBack={back}
          onNext={next}
        />
      ) : (
        <Done
          document={doc}
          kit={kit}
          frameId={frameId}
          pageCount={pages}
          onBack={back}
          onRestart={store.restart}
        />
      )}
    </div>
  )
}
