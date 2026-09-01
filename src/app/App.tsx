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
import { frameFor, SCREEN_TITLE, useStore, type PictureTarget, type ScreenId } from './state'
import type { DocumentBody, Screenshot } from '../model/content'
import { BrandFile } from './screens/BrandFile'
import { Triage } from './screens/Triage'
import { Blueprint } from './screens/Blueprint'
import { Sections } from './screens/Sections'
import { Picture } from './screens/Picture'
import { Review } from './screens/Review'
import { Done } from './screens/Done'
import { frame as resolveFrame } from '../geometry/blueprints'
import { pageCount } from '../geometry/paginate'
import { CanvasMeasurer } from '../geometry/measure'

// Adding a picture is a detour off the writing screen rather than a step in
// the linear flow, so it does not appear here.
const FLOW: ScreenId[] = ['brand', 'triage', 'blueprint', 'sections', 'review', 'done']

/**
 * The step's own words, so the caption warning can tell whether a caption is
 * about to repeat them.
 */
function stepTextFor(document: DocumentBody, target: PictureTarget | null): string | undefined {
  if (target?.kind !== 'step') return undefined
  const section = document.sections.find((s) => s.id === target.sectionId)
  if (section?.content.shape !== 'steps') return undefined
  return section.content.steps.find((s) => s.id === target.stepId)?.action
}

function attachScreenshot(
  document: DocumentBody,
  target: PictureTarget | null,
  screenshot: Screenshot,
): DocumentBody {
  if (!target) return document
  return {
    ...document,
    sections: document.sections.map((section) => {
      if (section.id !== target.sectionId) return section
      if (target.kind === 'section') {
        return { ...section, content: { shape: 'figure', screenshot } }
      }
      if (section.content.shape !== 'steps') return section
      return {
        ...section,
        content: {
          ...section.content,
          steps: section.content.steps.map((step) =>
            step.id === target.stepId ? { ...step, screenshot } : step,
          ),
        },
      }
    }),
  }
}

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
      {screen === 'brand' || screen === 'done' || screen === 'picture' ? null : (
        <Progress screen={screen} />
      )}

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
          retrieval={doc.retrieval}
          onSections={store.setSections}
          onRetrieval={(retrieval) => store.updateDocument((d) => ({ ...d, retrieval }))}
          onPicture={store.startPicture}
          onBack={back}
          onNext={next}
        />
      ) : screen === 'picture' ? (
        <Picture
          kit={kit}
          frameId={frameId}
          stepText={stepTextFor(doc, store.state.pictureTarget)}
          onDone={(screenshot) => {
            store.updateDocument((d) => attachScreenshot(d, store.state.pictureTarget, screenshot))
            store.endPicture()
          }}
          onSkip={store.endPicture}
          onBack={store.endPicture}
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
