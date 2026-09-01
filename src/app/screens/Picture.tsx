/**
 * Screen 5 — "Add a picture." Design artifact `3d`.
 *
 * The pipeline from §14, in the order it happens: drop → PHI acknowledgment at
 * the drop point → crop → annotate → alt text → caption.
 *
 * Three things the design makes explicit and this screen keeps:
 *
 *  - **"The picture never leaves this computer" sits next to the drop zone**, at
 *    the same size as everything else. It is the claim that makes the app
 *    usable without a security review, so it is not fine print.
 *  - **The acknowledgment lists what to look for** rather than asking for a
 *    blanket attestation.
 *  - **"Skip the picture" is a visible, ordinary-looking option.** Optional
 *    things that look mandatory are how forms get abandoned.
 */

import { useCallback, useRef, useState } from 'react'
import { Field, Footer, Screen } from '../chrome'
import { COLOR } from '../theme'
import type { Screenshot } from '../../model/content'
import type { LoadedKit } from '../../brandkit/types'
import { frame as resolveFrame, type FrameId } from '../../geometry/blueprints'
import {
  addCallout, bake, confirmPhi, review, setAlt, setCaption, setCrop, startDraft,
  toScreenshot, type Draft,
} from '../../screenshot/pipeline'
import { MAX_CALLOUTS, checkPlacement, type ImagePixels } from '../../screenshot/annotate'
import { RETAIN_CONTEXT_GUIDANCE } from '../../screenshot/resolution'
import { CLIENT_SIDE_PROMISE, PHI_CHECKLIST, PHI_CONFIRMATION, PHI_PROMPT, SKIP_LABEL } from '../../screenshot/phi'
import { newAssetId, putAsset } from '../../screenshot/assets'

export function Picture({
  kit,
  frameId,
  stepText,
  onDone,
  onSkip,
  onBack,
}: {
  kit: LoadedKit
  frameId: FrameId
  stepText?: string
  onDone: (screenshot: Screenshot) => void
  onSkip: () => void
  onBack: () => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pixels, setPixels] = useState<ImagePixels | null>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const frame = resolveFrame(frameId)

  const accept = useCallback(async (file: File | undefined) => {
    if (!file) return
    const source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('That file could not be read.'))
      // Read locally. There is no upload path in this app at all.
      reader.readAsDataURL(file)
    })
    const image = new Image()
    image.src = source
    await image.decode()
    setDraft(startDraft(source, { width: image.naturalWidth, height: image.naturalHeight }))
    setPixels(samplePixels(image))
  }, [])

  const findings = draft ? review(draft, { frame, kit: kit.kit, pixels: pixels ?? undefined, stepText }) : []
  const blocking = findings.filter((f) => f.blocking)

  async function attach() {
    if (!draft) return
    setBusy(true)
    try {
      const { print, preview } = await bake(draft, frame)
      const id = newAssetId()
      await putAsset(id, { print, preview, alt: draft.alt })
      const screenshot = toScreenshot(draft, id)
      if (screenshot) onDone(screenshot)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Screen
        title="Add a picture"
        lede="A picture of the screen they will be looking at. One is usually enough per step."
      >
        {!draft ? (
          <div className="stack-lg">
            <div
              className="dropzone"
              data-over={over}
              onDragOver={(e) => { e.preventDefault(); setOver(true) }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); void accept(e.dataTransfer.files[0]) }}
            >
              <p style={{ margin: 0, fontWeight: 500, fontSize: 15.5 }}>Drag the picture here</p>
              <p className="caption" style={{ margin: '10px 0' }}>or</p>
              <button type="button" className="btn" onClick={() => input.current?.click()}>
                Choose a picture
              </button>
            </div>

            {/* At the same size as everything else. Not fine print. */}
            <p className="row" style={{ gap: 10, margin: 0 }}>
              <span aria-hidden style={{ color: COLOR.success }}>✓</span>
              <span>{CLIENT_SIDE_PROMISE}</span>
            </p>
          </div>
        ) : (
          <div className="stack-lg">
            {!draft.phi.confirmed ? (
              <PhiGate onConfirm={() => setDraft(confirmPhi(draft))} preview={draft.source} />
            ) : (
              <Editor
                draft={draft}
                pixels={pixels}
                kit={kit}
                onDraft={setDraft}
              />
            )}

            {draft.phi.confirmed ? (
              <div className="stack">
                {findings.map((finding, index) => (
                  <div
                    key={index}
                    className="panel"
                    style={{ borderLeft: `2px solid ${finding.blocking ? COLOR.blocking : COLOR.warning}` }}
                  >
                    <p style={{ margin: 0, fontWeight: 500 }}>{finding.message}</p>
                    {finding.because ? (
                      <p className="caption" style={{ margin: '8px 0 0' }}>{finding.because}</p>
                    ) : null}
                    {/* A blocker with no way out is a dead end. Where the app
                        can find a spot that reads, it offers to move the label
                        rather than leaving the author to guess. */}
                    {finding.fix ? (
                      <button
                        type="button"
                        className="btn"
                        style={{ marginTop: 14 }}
                        onClick={() => setDraft(finding.fix!.apply(draft))}
                      >
                        {finding.fix.label}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void accept(e.target.files?.[0])}
        />
      </Screen>

      <Footer onBack={onBack} action={
        draft?.phi.confirmed ? (
          <button
            type="button"
            className="btn btn-accent"
            disabled={blocking.length > 0 || busy}
            onClick={() => void attach()}
          >
            {busy ? 'Getting it ready…' : 'Add this picture'}
          </button>
        ) : undefined
      }>
        {/* An ordinary-looking option, not a greyed-out afterthought. */}
        <button type="button" className="btn" onClick={onSkip}>
          {SKIP_LABEL}
        </button>
      </Footer>
    </>
  )
}

/** The acknowledgment, at the drop point, listing what to look for. */
function PhiGate({ onConfirm, preview }: { onConfirm: () => void; preview: string }) {
  return (
    <div className="panel stack-lg">
      <div>
        <p style={{ margin: 0, fontWeight: 500, fontSize: 15.5 }}>{PHI_PROMPT}</p>
        <ul className="stack" style={{ margin: '14px 0 0', paddingLeft: 20 }}>
          {PHI_CHECKLIST.map((item) => (
            <li key={item} style={{ marginTop: 6 }}>{item}</li>
          ))}
        </ul>
      </div>
      <img
        src={preview}
        alt=""
        style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: COLOR.well }}
      />
      <button type="button" className="btn btn-primary" onClick={onConfirm}>
        {PHI_CONFIRMATION}
      </button>
    </div>
  )
}

function Editor({
  draft,
  pixels,
  kit,
  onDraft,
}: {
  draft: Draft
  pixels: ImagePixels | null
  kit: LoadedKit
  onDraft: (draft: Draft) => void
}) {
  const [placing, setPlacing] = useState(false)
  const [label, setLabel] = useState('')

  return (
    <div className="stack-lg">
      <div className="well stack">
        <p className="mono" style={{ margin: 0 }}>The picture</p>
        <Canvas
          draft={draft}
          pixels={pixels}
          kit={kit}
          placing={placing}
          onPlace={(x, y) => {
            if (!label.trim()) return
            onDraft(addCallout(draft, { x, y, label: label.trim() }))
            setLabel('')
            setPlacing(false)
          }}
          onCrop={(crop) => onDraft(setCrop(draft, crop))}
        />
        <p className="caption" style={{ margin: 0 }}>{RETAIN_CONTEXT_GUIDANCE}</p>
      </div>

      <div className="stack">
        <p className="label" style={{ margin: 0 }}>
          Point at something on the picture{' '}
          <span className="caption">
            — up to {MAX_CALLOUTS}, and {draft.callouts.length} so far
          </span>
        </p>
        <div className="row">
          <input
            className="field"
            style={{ flex: 1 }}
            value={label}
            placeholder="Reconcile and Sign"
            onChange={(e) => setLabel(e.target.value)}
            aria-label="What to call this label"
          />
          <button
            type="button"
            className="btn"
            disabled={!label.trim() || draft.callouts.length >= MAX_CALLOUTS}
            onClick={() => setPlacing(true)}
          >
            {placing ? 'Now click the picture' : 'Place it'}
          </button>
        </div>
        {draft.callouts.length > 0 ? (
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {draft.callouts.map((callout, index) => (
              <button
                key={index}
                type="button"
                className="btn btn-quiet"
                onClick={() =>
                  onDraft({ ...draft, callouts: draft.callouts.filter((_, i) => i !== index) })
                }
              >
                {callout.label} ×
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Required, with the reason in the same breath. */}
      <Field
        id="picture-alt"
        label="What does the picture show?"
        hint="One sentence. Someone using a screen reader gets this instead of the picture, and it is the one thing that has to be filled in."
        value={draft.alt}
        multiline
        onChange={(alt) => onDraft(setAlt(draft, alt))}
        placeholder="The Orders window, with Reconcile and Sign at the bottom right."
      />

      <Field
        id="picture-caption"
        label="A caption, if it needs one"
        hint="Optional. Skip it if it would only repeat the step."
        value={draft.caption ?? ''}
        onChange={(caption) => onDraft(setCaption(draft, caption || null))}
      />
    </div>
  )
}

/**
 * The picture, with the crop box and the labels on it. Labels sit **on the
 * image at the anchor point** — never in a legend beside it — and their
 * contrast is checked against the pixels actually beneath them.
 */
function Canvas({
  draft,
  pixels,
  kit,
  placing,
  onPlace,
  onCrop,
}: {
  draft: Draft
  pixels: ImagePixels | null
  kit: LoadedKit
  placing: boolean
  onPlace: (x: number, y: number) => void
  onCrop: (crop: { x: number; y: number; width: number; height: number }) => void
}) {
  const box = useRef<HTMLDivElement>(null)

  const annotationFill = kit.kit.color[kit.kit.annotation?.box_color ?? 'ink']?.hex ?? '#1a1a1a'
  const annotationInk = kit.kit.annotation?.label_text === 'white' ? '#fff' : '#fff'

  return (
    <div
      ref={box}
      className="anno-layer"
      style={{ position: 'relative', cursor: placing ? 'crosshair' : 'default' }}
      onClick={(event) => {
        if (!placing || !box.current) return
        const rect = box.current.getBoundingClientRect()
        onPlace(
          (event.clientX - rect.left) / rect.width,
          (event.clientY - rect.top) / rect.height,
        )
      }}
    >
      <img src={draft.source} alt="" style={{ width: '100%', display: 'block' }} />

      {/* The crop, drawn as what will be kept rather than what is thrown away. */}
      <div
        style={{
          position: 'absolute',
          left: `${draft.crop.x * 100}%`,
          top: `${draft.crop.y * 100}%`,
          width: `${draft.crop.width * 100}%`,
          height: `${draft.crop.height * 100}%`,
          border: `2px solid ${COLOR.accent}`,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />

      {draft.callouts.map((callout, index) => {
        const readable = pixels
          ? checkPlacement(pixels, { x: callout.x, y: callout.y, label: callout.label }, kit.kit).ok
          : true
        return (
          <span
            key={index}
            className="anno-label"
            style={{
              position: 'absolute',
              left: `${callout.x * 100}%`,
              top: `${callout.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              background: annotationFill,
              color: annotationInk,
              fontWeight: 700,
              fontSize: 12,
              padding: '2px 7px',
              // A label that will not read where it sits says so here, not in a
              // report after the fact.
              outline: readable ? 'none' : `2px solid ${COLOR.blocking}`,
            }}
          >
            {callout.label}
          </span>
        )
      })}

      <CropHandles crop={draft.crop} onCrop={onCrop} />
    </div>
  )
}

/** Four corners. A crop is a rectangle; it does not need more than this. */
function CropHandles({
  crop,
  onCrop,
}: {
  crop: { x: number; y: number; width: number; height: number }
  onCrop: (crop: { x: number; y: number; width: number; height: number }) => void
}) {
  const corners: Array<[string, 'x' | 'w', 'y' | 'h']> = [
    ['nw', 'x', 'y'],
    ['ne', 'w', 'y'],
    ['sw', 'x', 'h'],
    ['se', 'w', 'h'],
  ]
  return (
    <>
      {corners.map(([id, horizontal, vertical]) => (
        <button
          key={id}
          type="button"
          aria-label={`Move the ${id} corner of the crop`}
          onPointerDown={(event) => {
            event.stopPropagation()
            const parent = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
            const move = (e: PointerEvent) => {
              const fx = Math.min(1, Math.max(0, (e.clientX - parent.left) / parent.width))
              const fy = Math.min(1, Math.max(0, (e.clientY - parent.top) / parent.height))
              const next = { ...crop }
              if (horizontal === 'x') {
                next.width = Math.max(0.05, crop.x + crop.width - fx)
                next.x = Math.min(fx, crop.x + crop.width - 0.05)
              } else {
                next.width = Math.max(0.05, fx - crop.x)
              }
              if (vertical === 'y') {
                next.height = Math.max(0.05, crop.y + crop.height - fy)
                next.y = Math.min(fy, crop.y + crop.height - 0.05)
              } else {
                next.height = Math.max(0.05, fy - crop.y)
              }
              onCrop(next)
            }
            const up = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
          }}
          style={{
            position: 'absolute',
            left: `${(horizontal === 'x' ? crop.x : crop.x + crop.width) * 100}%`,
            top: `${(vertical === 'y' ? crop.y : crop.y + crop.height) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 16,
            height: 16,
            background: COLOR.accent,
            border: 0,
            padding: 0,
            cursor: 'grab',
          }}
        />
      ))}
    </>
  )
}

/** The pixels an annotation has to survive, read once when the file lands. */
function samplePixels(image: HTMLImageElement): ImagePixels | null {
  const canvas = document.createElement('canvas')
  // A modest raster is plenty: contrast is sampled over a patch, not a pixel.
  const width = Math.min(600, image.naturalWidth)
  const scale = width / image.naturalWidth
  canvas.width = width
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const data = context.getImageData(0, 0, canvas.width, canvas.height)
  return { data: data.data, width: canvas.width, height: canvas.height }
}
