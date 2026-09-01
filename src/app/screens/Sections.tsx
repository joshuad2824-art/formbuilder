/**
 * Screen 4 — "Write your sections." Design artifacts `5b` and `4b`.
 *
 * The core screen, and the one that replaced both the two-pane builder and the
 * per-section wizard. What makes it work:
 *
 *  - **The author names each section.** The app never supplies a section name.
 *    Naming a clinical expert's own content for them was the part of §9.2 that
 *    had no justification.
 *  - **Two questions, no jargon.** What goes in here, and — only for a
 *    watch-out box — how strongly you mean it. The words NOTE, IMPORTANT,
 *    REQUIREMENTS and TIP never appear while writing; the chip afterwards shows
 *    how it will print, which is the moment the brand file becomes visible in
 *    the writing.
 *  - **Add a section is always reachable** — in the footer, so it survives any
 *    scroll position, and again as a divider between every pair of sections.
 *    Adding in the middle is the common case: people remember the missing
 *    prerequisite *after* writing the steps.
 *  - **Page count is reported, never set.** "Pages appear as you need them."
 */

import { useState } from 'react'
import { Field, Footer, Option, Screen } from '../chrome'
import { COLOR } from '../theme'
import {
  emptyContent, insertSection, newSection, newStep, type Section, type Step,
} from '../../model/content'
import {
  CALLOUT_ANSWERS, CALLOUT_QUESTION, type CalloutLevel, type Shape,
} from '../../model/vocabularies'
import type { LoadedKit } from '../../brandkit/types'

/** The shape menu, in the author's words. "Shape" is never one of them. */
const SHAPE_COPY: Array<{ shape: Shape; label: string }> = [
  { shape: 'steps', label: 'Steps to follow' },
  { shape: 'paragraph', label: 'A paragraph' },
  { shape: 'table', label: 'A table' },
  { shape: 'callout', label: 'Something to watch out for' },
  { shape: 'figure', label: 'A picture' },
]

export function Sections({
  sections,
  kit,
  pageCount,
  onSections,
  onBack,
  onNext,
}: {
  sections: Section[]
  kit: LoadedKit
  pageCount: number
  onSections: (sections: Section[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const [adding, setAdding] = useState<number | null>(sections.length === 0 ? 0 : null)
  const [open, setOpen] = useState<string | null>(null)

  function add(at: number, title: string, shape: Shape, level?: CalloutLevel) {
    const section = newSection(title.trim() || 'Untitled', shape)
    if (shape === 'callout' && level) section.content = { shape: 'callout', level, body: '' }
    onSections(insertSection(sections, section, at))
    setAdding(null)
    setOpen(section.id)
  }

  function update(id: string, change: (section: Section) => Section) {
    onSections(sections.map((s) => (s.id === id ? change(s) : s)))
  }

  return (
    <>
      <Screen
        title="Write your sections"
        lede="Name each one however makes sense to you. Add as many as you need, anywhere you need them."
        wide
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 240px', gap: 32 }}>
          <div className="stack">
            {sections.length > 0 ? (
              <p className="mono" style={{ margin: '0 0 4px' }}>
                Already written
              </p>
            ) : null}

            <AddDivider at={0} adding={adding} setAdding={setAdding} onAdd={add} kit={kit} />

            {sections.map((section, index) => (
              <div key={section.id} className="stack">
                <SectionRow
                  section={section}
                  open={open === section.id}
                  kit={kit}
                  onToggle={() => setOpen(open === section.id ? null : section.id)}
                  onChange={(change) => update(section.id, change)}
                  onRemove={() => onSections(sections.filter((s) => s.id !== section.id))}
                />
                <AddDivider at={index + 1} adding={adding} setAdding={setAdding} onAdd={add} kit={kit} />
              </div>
            ))}
          </div>

          {/* Reported, never set. No page-size, column or margin control. */}
          <aside>
            <div className="panel">
              <p className="mono" style={{ margin: 0 }}>
                Your sheet · {pageCount} page{pageCount === 1 ? '' : 's'}
              </p>
              <div className="row" style={{ gap: 6, marginTop: 14 }}>
                {Array.from({ length: Math.min(pageCount, 6) }, (_, i) => (
                  <span key={i} className="page-preview" style={{ width: 34, height: 44 }} />
                ))}
              </div>
              <p className="caption" style={{ margin: '14px 0 0' }}>
                Pages appear as you need them. Nothing to set up.
              </p>
            </div>
          </aside>
        </div>
      </Screen>

      <Footer
        onBack={onBack}
        action={
          <button
            type="button"
            className="btn btn-accent"
            onClick={onNext}
            disabled={sections.length === 0}
          >
            Review and finish
          </button>
        }
      >
        {/* The screen exists to add sections, so adding lives in persistent
            chrome and survives any scroll position. */}
        <button type="button" className="btn" onClick={() => setAdding(sections.length)}>
          Add a section
        </button>
      </Footer>
    </>
  )
}

function AddDivider({
  at,
  adding,
  setAdding,
  onAdd,
  kit,
}: {
  at: number
  adding: number | null
  setAdding: (at: number | null) => void
  onAdd: (at: number, title: string, shape: Shape, level?: CalloutLevel) => void
  kit: LoadedKit
}) {
  if (adding === at) {
    return <NewSection kit={kit} onCancel={() => setAdding(null)} onAdd={(t, s, l) => onAdd(at, t, s, l)} />
  }
  return (
    <button type="button" className="divider-add" onClick={() => setAdding(at)}>
      Add a section here
    </button>
  )
}

/** Two questions. Never more, and never the word "type". */
function NewSection({
  kit,
  onAdd,
  onCancel,
}: {
  kit: LoadedKit
  onAdd: (title: string, shape: Shape, level?: CalloutLevel) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [shape, setShape] = useState<Shape | null>(null)
  const [level, setLevel] = useState<CalloutLevel | null>(null)

  const ready = shape !== null && (shape !== 'callout' || level !== null)

  return (
    <div className="panel stack-lg">
      <p className="mono" style={{ margin: 0 }}>
        Adding a section
      </p>

      <Field
        id="new-section-title"
        label="Give this section a name"
        value={title}
        onChange={setTitle}
        placeholder="Placing the referral"
      />

      <div>
        <p className="label" style={{ margin: '0 0 10px' }}>
          What goes in here?
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {SHAPE_COPY.map((option) => (
            <button
              key={option.shape}
              type="button"
              className="option"
              style={{ width: 'auto' }}
              aria-pressed={shape === option.shape}
              onClick={() => setShape(option.shape)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {shape === 'callout' ? (
        <div>
          {/* The author never sees NOTE / IMPORTANT / REQUIREMENTS / TIP while
              writing — only these four plain answers. */}
          <p className="label" style={{ margin: '0 0 10px' }}>
            {CALLOUT_QUESTION}
          </p>
          <div className="stack">
            {CALLOUT_ANSWERS.map((answer) => (
              <Option
                key={answer.level}
                selected={level === answer.level}
                onSelect={() => setLevel(answer.level)}
                title={answer.answer}
              />
            ))}
          </div>
          {level ? <PrintChip level={level} kit={kit} /> : null}
        </div>
      ) : null}

      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready}
          onClick={() => onAdd(title, shape!, level ?? undefined)}
        >
          Add it
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * The chip does real work: it is the moment the brand file becomes visible in
 * the writing, so the author learns the house style by using it rather than by
 * being told.
 */
function PrintChip({ level, kit }: { level: CalloutLevel; kit: LoadedKit }) {
  const callout = kit.kit.callouts.find((c) => c.key === level)
  if (!callout) return null
  const fill = kit.kit.color[callout.color]?.hex ?? COLOR.primary
  return (
    <p className="row" style={{ gap: 10, marginTop: 14 }}>
      <span className="chip" style={{ background: fill, color: callout.text === 'black' ? '#000' : '#fff' }}>
        {callout.label}
      </span>
      <span className="caption">is how it will print</span>
    </p>
  )
}

function SectionRow({
  section,
  open,
  kit,
  onToggle,
  onChange,
  onRemove,
}: {
  section: Section
  open: boolean
  kit: LoadedKit
  onToggle: () => void
  onChange: (change: (section: Section) => Section) => void
  onRemove: () => void
}) {
  const shapeLabel = SHAPE_COPY.find((s) => s.shape === section.shape)?.label ?? ''

  return (
    <div className="panel" style={{ padding: open ? 24 : 14 }}>
      <div className="spread">
        <button
          type="button"
          className="link"
          style={{ borderBottom: 0, textAlign: 'left' }}
          onClick={onToggle}
          aria-expanded={open}
        >
          <span aria-hidden style={{ color: COLOR.disabled, marginRight: 12 }}>⠿</span>
          <span style={{ fontWeight: 500 }}>{section.title}</span>
          <span className="caption" style={{ marginLeft: 12 }}>
            {shapeLabel}
          </span>
        </button>
        <button type="button" className="btn btn-quiet" onClick={onRemove}>
          Remove
        </button>
      </div>

      {/* Completed work collapses; the current task stays visible. */}
      {open ? (
        <div style={{ marginTop: 20 }}>
          <SectionEditor section={section} kit={kit} onChange={onChange} />
        </div>
      ) : null}
    </div>
  )
}

function SectionEditor({
  section,
  kit,
  onChange,
}: {
  section: Section
  kit: LoadedKit
  onChange: (change: (section: Section) => Section) => void
}) {
  const content = section.content

  switch (content.shape) {
    case 'paragraph':
      return (
        <Field
          id={`${section.id}-body`}
          label="What does it say?"
          value={content.body}
          multiline
          onChange={(body) => onChange((s) => ({ ...s, content: { shape: 'paragraph', body } }))}
        />
      )

    case 'callout':
      return (
        <div className="stack-lg">
          <Field
            id={`${section.id}-body`}
            label="What do they need to know?"
            value={content.body}
            multiline
            onChange={(body) => onChange((s) => ({ ...s, content: { ...content, body } }))}
          />
          <PrintChip level={content.level} kit={kit} />
        </div>
      )

    case 'steps':
      return (
        <StepsEditor
          steps={content.steps}
          onChange={(steps) => onChange((s) => ({ ...s, content: { ...content, steps } }))}
        />
      )

    case 'table':
      return (
        <p className="caption" style={{ margin: 0 }}>
          Tables are written in the next pass — the section is kept and will render.
        </p>
      )

    case 'figure':
      return (
        <p className="caption" style={{ margin: 0 }}>
          Pictures are added on the next screen.
        </p>
      )
  }
}

function StepsEditor({ steps, onChange }: { steps: Step[]; onChange: (steps: Step[]) => void }) {
  return (
    <div className="stack-lg">
      {steps.map((step, index) => (
        <div key={step.id} className="well stack">
          <p className="mono" style={{ margin: 0 }}>
            Step {index + 1}
          </p>
          <Field
            id={`${step.id}-intent`}
            label="What are they doing?"
            hint="A few words. “Open the orders list”."
            value={step.intent}
            onChange={(intent) =>
              onChange(steps.map((s) => (s.id === step.id ? { ...s, intent } : s)))
            }
          />
          <Field
            id={`${step.id}-action`}
            label="How do they do it?"
            hint="Write the names of buttons and tabs plainly — they get picked out in the printed version."
            value={step.action}
            multiline
            onChange={(action) =>
              onChange(steps.map((s) => (s.id === step.id ? { ...s, action } : s)))
            }
          />
          <div className="row">
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => onChange(steps.filter((s) => s.id !== step.id))}
            >
              Remove this step
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...steps, newStep()])}>
        Add a step
      </button>
    </div>
  )
}

export { emptyContent }
