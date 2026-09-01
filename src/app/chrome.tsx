/**
 * Shared chrome.
 *
 * Two rules shape all of it:
 *
 *  - **Whatever a screen exists to do belongs in persistent chrome**, not in a
 *    scroll region. Completed work collapses; the current task and the primary
 *    action stay visible.
 *  - **Exactly one accent element per screen**, always the forward action. If
 *    everything is emphasised, nothing is.
 */

import type { ReactNode } from 'react'
import { COLOR } from './theme'
import { SCREEN_ORDER, SCREEN_TITLE, type ScreenId } from './state'

export function TopBar({
  savedText,
  title,
  onFinishLater,
}: {
  savedText: string
  title?: string
  onFinishLater?: () => void
}) {
  return (
    <header className="topbar">
      <span className="wordmark">Form Builder</span>
      {title ? (
        <>
          <span aria-hidden style={{ color: COLOR.hairline }}>│</span>
          <span className="caption" style={{ color: COLOR.muted }}>
            {title}
          </span>
        </>
      ) : null}
      <span style={{ flex: 1 }} />
      <span className="meta" aria-live="polite">
        <span aria-hidden style={{ color: COLOR.success, marginRight: 6 }}>✓</span>
        {savedText}
      </span>
      {onFinishLater ? (
        <button type="button" className="btn btn-quiet" onClick={onFinishLater}>
          Save and finish later
        </button>
      ) : null}
    </header>
  )
}

/**
 * Where you are. Not a wizard's numbered pipeline — the steps are named, and a
 * step you have not reached is not presented as a promise about how long this
 * will take.
 */
export function Progress({ screen }: { screen: ScreenId }) {
  const index = SCREEN_ORDER.indexOf(screen)
  return (
    <nav className="progress" aria-label="Where you are">
      {SCREEN_ORDER.map((id, at) => (
        <span key={id} className="row" style={{ gap: 8 }}>
          {at > 0 ? (
            <span aria-hidden style={{ color: COLOR.hairline }}>
              ›
            </span>
          ) : null}
          <span
            aria-current={id === screen ? 'step' : undefined}
            style={{
              color: at === index ? COLOR.ink : at < index ? COLOR.quiet : COLOR.disabled,
              fontWeight: at === index ? 500 : 400,
            }}
          >
            {SCREEN_TITLE[id]}
          </span>
        </span>
      ))}
    </nav>
  )
}

/**
 * Back on the left, the forward action on the right, on every screen. The fear
 * of a one-way door does not end at the last step.
 */
export function Footer({
  onBack,
  backLabel = 'Back',
  children,
  action,
}: {
  onBack?: () => void
  backLabel?: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <footer className="footer">
      <div className="row">
        {onBack ? (
          <button type="button" className="btn" onClick={onBack}>
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        {children}
      </div>
      <div className="row">{action}</div>
    </footer>
  )
}

export function Screen({
  title,
  lede,
  children,
  wide,
}: {
  title: string
  lede?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  return (
    <main className="content">
      <div className={wide ? 'column-wide screen-enter' : 'column screen-enter'}>
        <h1 className="screen">{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
        <div style={{ marginTop: 32 }}>{children}</div>
      </div>
    </main>
  )
}

export function Option({
  selected,
  onSelect,
  title,
  detail,
  aside,
}: {
  selected: boolean
  onSelect: () => void
  title: ReactNode
  detail?: ReactNode
  aside?: ReactNode
}) {
  return (
    <button type="button" className="option" aria-pressed={selected} onClick={onSelect}>
      <span className="spread">
        <span>
          <span style={{ fontWeight: 500 }}>{title}</span>
          {detail ? (
            <span className="caption" style={{ display: 'block', marginTop: 4 }}>
              {detail}
            </span>
          ) : null}
        </span>
        {aside}
      </span>
    </button>
  )
}

export function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  multiline,
  id,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  id: string
}) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <div>
      <label className="label" htmlFor={id} style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {hint ? (
        <p className="caption" style={{ margin: '0 0 8px' }}>
          {hint}
        </p>
      ) : null}
      <Tag
        id={id}
        className="field"
        value={value}
        placeholder={placeholder}
        onChange={(event: { target: { value: string } }) => onChange(event.target.value)}
      />
    </div>
  )
}

/**
 * A warning card. States what, then why in one sentence, then offers a fix the
 * app performs — with a decline as easy to press as the accept. A warning that
 * cannot be comfortably declined is a block wearing a friendlier hat.
 */
export function OfferCard({
  what,
  why,
  fixLabel,
  declineLabel,
  onFix,
  onDecline,
  blocking,
}: {
  what: string
  why?: string | null
  fixLabel?: string | null
  declineLabel?: string | null
  onFix?: () => void
  onDecline?: () => void
  blocking?: boolean
}) {
  return (
    <div
      className="panel"
      style={{ borderLeft: `2px solid ${blocking ? COLOR.blocking : COLOR.warning}` }}
    >
      <p style={{ margin: 0, fontWeight: 500 }}>{what}</p>
      {why ? (
        <p className="caption" style={{ margin: '8px 0 0' }}>
          {why}
        </p>
      ) : null}
      {fixLabel || declineLabel ? (
        <div className="row" style={{ marginTop: 16 }}>
          {fixLabel ? (
            <button type="button" className="btn" onClick={onFix}>
              {fixLabel}
            </button>
          ) : null}
          {declineLabel ? (
            <button type="button" className="btn" onClick={onDecline}>
              {declineLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Page shapes at true relative proportion — never a generic document icon. */
export function PageShape({
  widthIn,
  heightIn,
  scale = 26,
  label,
}: {
  widthIn: number
  heightIn: number
  scale?: number
  label?: string
}) {
  return (
    <span
      aria-hidden
      title={label}
      style={{
        display: 'inline-block',
        width: widthIn * scale,
        height: heightIn * scale,
        background: '#fff',
        boxShadow: '0 6px 14px rgba(0,0,0,0.45)',
      }}
    />
  )
}
