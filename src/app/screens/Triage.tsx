/**
 * Screen 2 — "Is a document the right fix?" Design artifact `3a`.
 *
 * Three questions adapted from Mager & Pipe's acid test, reworded out of the
 * jargon they arrived in. `[CITED — Adult Learning 07; evidence grade: weak,
 * practitioner heuristic]`
 *
 * **This screen never blocks.** It is a `WARNING` and the highest-leverage one
 * in the app, because it is the only place that prevents the wrong artifact
 * from being made at all — but the evidence behind it is a practitioner
 * heuristic, and a heuristic does not get to stop someone's afternoon.
 */

import { useState } from 'react'
import { Footer, Option, Screen } from '../chrome'
import { COLOR } from '../theme'

interface Question {
  id: string
  ask: string
  detail: string
  answers: Array<{ value: string; label: string; suggestsTraining?: boolean }>
}

const QUESTIONS: Question[] = [
  {
    id: 'capability',
    ask: 'Could they do this if it really mattered?',
    detail:
      'If someone knows how but forgets the order of things, a document helps. If they have never been shown, a document is not what is missing.',
    answers: [
      { value: 'yes', label: 'Yes — they know how, they just need the steps to hand' },
      { value: 'no', label: 'No — they have not been shown how to do this', suggestsTraining: true },
    ],
  },
  {
    id: 'frequency',
    ask: 'How often do they do it?',
    detail: 'Something done once a month is looked up. Something done hourly is remembered.',
    answers: [
      { value: 'rare', label: 'Now and then, or once in a while' },
      { value: 'often', label: 'Several times a day, every day' },
    ],
  },
  {
    id: 'volatility',
    ask: 'How often does it change?',
    detail: 'A procedure that changes with every build is worth writing down. A stable one may already be known.',
    answers: [
      { value: 'changes', label: 'It changes — with upgrades, or policy' },
      { value: 'stable', label: 'It has been the same for a long time' },
    ],
  },
]

export function Triage({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const skillGap = QUESTIONS.some((q) =>
    q.answers.some((a) => a.suggestsTraining && answers[q.id] === a.value),
  )

  return (
    <>
      <Screen
        title="Is a document the right fix?"
        lede="Three quick questions. Nothing here stops you — they just sometimes save someone writing the wrong thing."
      >
        <div className="stack-lg">
          {QUESTIONS.map((question) => (
            <fieldset key={question.id} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ padding: 0, fontSize: 15.5 }}>
                {question.ask}
              </legend>
              <p className="caption" style={{ margin: '8px 0 12px' }}>
                {question.detail}
              </p>
              <div className="stack">
                {question.answers.map((answer) => (
                  <Option
                    key={answer.value}
                    selected={answers[question.id] === answer.value}
                    onSelect={() => setAnswers((a) => ({ ...a, [question.id]: answer.value }))}
                    title={answer.label}
                  />
                ))}
              </div>
            </fieldset>
          ))}

          {skillGap ? (
            // Flagged, never blocked. The forward action stays exactly as
            // available as it was.
            <div className="panel" style={{ borderLeft: `2px solid ${COLOR.warning}` }}>
              <p style={{ margin: 0, fontWeight: 500 }}>
                This sounds like it might need teaching rather than a handout.
              </p>
              <p className="caption" style={{ margin: '8px 0 0' }}>
                A document is very good at reminding someone of an order of steps, and not good at
                showing them something for the first time. Worth a word with whoever runs training —
                but carry on if you already know that.
              </p>
            </div>
          ) : null}
        </div>
      </Screen>

      <Footer
        onBack={onBack}
        action={
          <button type="button" className="btn btn-accent" onClick={onNext}>
            Carry on
          </button>
        }
      />
    </>
  )
}
