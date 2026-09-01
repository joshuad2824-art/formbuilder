/**
 * App state and autosave.
 *
 * **Autosave, always, with a visible state.** "Saved a moment ago" sits in the
 * top bar of every screen. Nothing is ever lost, and the user can leave via
 * "save and finish later" from anywhere.
 *
 * Everything lives in this browser. No accounts, no server storage — which is
 * the same promise the screenshot pipeline makes, and the reason this can be
 * used without a security review.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ContentDocument, DocumentBody, Section } from '../model/content'
import { emptyDocument } from '../model/content'
import type { BlueprintId } from '../model/vocabularies'
import type { LoadedKit } from '../brandkit/types'
import { defaultKit } from '../brandkit/default'

export type ScreenId = 'brand' | 'triage' | 'blueprint' | 'sections' | 'picture' | 'review' | 'done'

/** Linear, with a persistent way back from every one of them. */
export const SCREEN_ORDER: ScreenId[] = ['brand', 'triage', 'blueprint', 'sections', 'review', 'done']

export const SCREEN_TITLE: Record<ScreenId, string> = {
  brand: 'Your brand file',
  triage: 'Is a document the right fix?',
  blueprint: 'What you are making',
  sections: 'Writing it',
  picture: 'Adding a picture',
  review: 'Before you finish',
  done: 'Done',
}

const STORAGE_KEY = 'form-builder/draft/v1'

export interface Saved {
  document: ContentDocument
  screen: ScreenId
  /** The kit file's own text, so a reload keeps the brand without re-dropping. */
  kitSource: string | null
  savedAt: string
}

/**
 * Where a picture is headed. Adding one is a detour off the writing screen, not
 * a step in the linear flow — so the flow remembers where to come back to.
 */
export type PictureTarget =
  | { kind: 'section'; sectionId: string }
  | { kind: 'step'; sectionId: string; stepId: string }

export interface AppState {
  document: DocumentBody
  screen: ScreenId
  kit: LoadedKit
  savedAt: Date | null
  pictureTarget: PictureTarget | null
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    // A private window, cleared site data, or storage the browser refuses. The
    // app works without it; only the autosave promise is weaker.
    return null
  }
}

function persist(saved: Saved): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    return true
  } catch {
    return false
  }
}

export function clearSaved(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing to clear */
  }
}

/** "Saved a moment ago" — the phrasing the design settled on. */
export function savedLabel(at: Date | null, now = new Date()): string {
  if (!at) return 'Not saved yet'
  const seconds = Math.max(0, (now.getTime() - at.getTime()) / 1000)
  if (seconds < 90) return 'Saved a moment ago'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `Saved ${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  return `Saved ${hours} hour${hours === 1 ? '' : 's'} ago`
}

export interface Store {
  state: AppState
  setScreen: (screen: ScreenId) => void
  setBlueprint: (blueprint: BlueprintId) => void
  setTitle: (title: string) => void
  setSections: (sections: Section[]) => void
  updateDocument: (change: (document: DocumentBody) => DocumentBody) => void
  setKit: (kit: LoadedKit) => void
  startPicture: (target: PictureTarget) => void
  endPicture: () => void
  savedText: string
  /** Whether autosave is actually working, so the top bar never lies. */
  storageWorks: boolean
  restart: () => void
}

export function useStore(): Store {
  const [kit, setKitState] = useState<LoadedKit>(() => defaultKit())
  const [document, setDocument] = useState<DocumentBody>(
    () => emptyDocument('quick_reference').document,
  )
  const [screen, setScreenState] = useState<ScreenId>('brand')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [pictureTarget, setPictureTarget] = useState<PictureTarget | null>(null)
  const [storageWorks, setStorageWorks] = useState(true)
  const [tick, setTick] = useState(0)
  const restored = useRef(false)

  // Restore before the first paint's worth of edits, once.
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const saved = load()
    if (!saved) return
    setDocument(saved.document.document)
    setScreenState(saved.screen)
    setSavedAt(new Date(saved.savedAt))
  }, [])

  // Save on every change. There is no save button anywhere in the app.
  useEffect(() => {
    if (!restored.current) return
    const at = new Date()
    const ok = persist({
      document: { schema_version: '1.0', document },
      screen,
      kitSource: null,
      savedAt: at.toISOString(),
    })
    setStorageWorks(ok)
    if (ok) setSavedAt(at)
  }, [document, screen])

  // Keep the label honest as time passes, without a timer per keystroke.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const savedText = useMemo(
    () => (storageWorks ? savedLabel(savedAt) : 'This browser is not saving your work'),
    // `tick` is what re-renders the label as it ages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedAt, storageWorks, tick],
  )

  const updateDocument = useCallback(
    (change: (d: DocumentBody) => DocumentBody) => setDocument((d) => change(d)),
    [],
  )

  return {
    state: { document, screen, kit, savedAt, pictureTarget },
    setScreen: setScreenState,
    setBlueprint: (blueprint) => setDocument((d) => ({ ...d, blueprint })),
    setTitle: (title) => setDocument((d) => ({ ...d, title })),
    setSections: (sections) => setDocument((d) => ({ ...d, sections })),
    updateDocument,
    setKit: (next) => {
      setKitState(next)
      // A document picks the brand up retroactively — content is data, so
      // nothing is retyped.
      setDocument((d) => ({ ...d, brand_kit_id: next.kit.id }))
    },
    startPicture: (target) => {
      setPictureTarget(target)
      setScreenState('picture')
    },
    endPicture: () => {
      setPictureTarget(null)
      setScreenState('sections')
    },
    savedText,
    storageWorks,
    restart: () => {
      clearSaved()
      setDocument(emptyDocument('quick_reference').document)
      setScreenState('brand')
      setSavedAt(null)
    },
  }
}

/** Which frame a blueprint renders at. Quick reference offers two; prose is
 *  chosen when the document is mostly prose, which the app decides rather than
 *  asking — there is no layout control anywhere in the app. */
export function frameFor(document: DocumentBody): 'field_guide' | 'letter_two_column' | 'letter_prose' | 'huddle_card' {
  if (document.blueprint === 'field_guide') return 'field_guide'
  if (document.blueprint === 'huddle_card') return 'huddle_card'
  const prose = document.sections.filter((s) => s.content.shape === 'paragraph').length
  const structured = document.sections.filter(
    (s) => s.content.shape === 'steps' || s.content.shape === 'table',
  ).length
  return prose > structured ? 'letter_prose' : 'letter_two_column'
}
