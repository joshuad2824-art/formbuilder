/**
 * The app's chrome — §5, as amended by the deltas file.
 *
 * The governing rule: the app's own aesthetic and the document's brand must be
 * **visibly different systems**. Quiet, recessive chrome around a bright,
 * high-contrast page, so the document looks like it is sitting on the app
 * rather than being made of it. Word, InDesign and Figma all solve it this way.
 *
 * It is also the ownership argument. This tool is meant to serve facilities
 * beyond one hospital, and chrome wearing Ascension's brand would implicitly
 * claim to be an Ascension product. The chrome wears no one's brand — which is
 * consistent with a first screen that names no facility.
 *
 * One interface family throughout. Editorial faces belong to a reading column
 * and a signpost, not a control surface; `6a` in the design file shows the
 * version that got this wrong beside the version that got it right.
 */

export const COLOR = {
  ground: '#121A16',
  bar: '#0C2223',
  panel: '#142A2B',
  well: '#001011',
  ink: '#E9E6DF',
  heading: '#f6f3ec',
  muted: '#C1D4D4',
  quiet: '#9CB1B2',
  disabled: '#748B8C',
  hairline: 'rgba(246,243,236,0.10)',
  border: 'rgba(246,243,236,0.20)',
  /** Exactly one per screen, always the forward action. */
  accent: '#C6862F',
  accentInk: '#051B1C',
  primary: '#f6f3ec',
  primaryInk: '#142A2B',
  success: '#81A569',
  warning: '#C28245',
  blocking: '#DE6A58',
} as const

/**
 * Archivo is named first and a system stack carries it otherwise. The face is
 * not bundled and nothing is fetched: the app makes no external request at all,
 * which is the same promise the screenshot pipeline makes about images.
 */
export const FONT =
  'Archivo, "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

/** Only where numbers must line up: page counts, word counts, file names. */
export const MONO = '"Courier Prime", "Courier New", Courier, monospace'

export const CHROME_CSS = `
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: ${COLOR.ground};
  color: ${COLOR.ink};
  font-family: ${FONT};
  font-size: 14.5px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

/* Nothing is rounded. */
button, input, textarea, select, .plate { border-radius: 0; }

button, input, textarea, select { font: inherit; color: inherit; }

/* A 2 px page-coloured gap, then a 2 px amber ring. Never a browser-blue
   outline. */
:focus-visible {
  outline: 2px solid ${COLOR.accent};
  outline-offset: 2px;
}

/* Fades and short vertical translates only. No bounce, no spring, no parallax,
   no looping animation. */
.motion-transform { transition: transform 90ms ease; }
.motion-color { transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease; }
.motion-surface { transition: opacity 240ms ease, transform 240ms ease; }

.screen-enter { animation: screen-in 420ms ease both; }
@keyframes screen-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

/* ---- layout ---------------------------------------------------------- */

.app {
  /* A fixed frame with exactly one scrolling region. The footer carries the
     forward action, so it must never scroll out of reach — whatever a screen
     exists to do belongs in persistent chrome. */
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  height: 56px;
  flex: 0 0 56px;
  background: ${COLOR.bar};
  border-bottom: 1px solid ${COLOR.hairline};
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
}

.progress {
  min-height: 44px;
  background: ${COLOR.bar};
  border-bottom: 1px solid ${COLOR.hairline};
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 24px;
  font-size: 12.5px;
  color: ${COLOR.quiet};
}

.content { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 44px 24px 32px; }
.column { max-width: 720px; margin: 0 auto; }
.column-wide { max-width: 1040px; margin: 0 auto; }

.footer {
  height: 76px;
  flex: 0 0 76px;
  background: ${COLOR.bar};
  border-top: 1px solid ${COLOR.hairline};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 24px;
}

/* ---- type ------------------------------------------------------------ */

h1.screen { font-size: 31px; line-height: 1.25; font-weight: 600; letter-spacing: -0.01em; color: ${COLOR.heading}; margin: 0; }
h2.section { font-size: 19px; line-height: 1.3; font-weight: 600; color: ${COLOR.heading}; margin: 0; }
p.lede { font-size: 15.5px; line-height: 1.6; color: ${COLOR.muted}; margin: 12px 0 0; }
.label { font-size: 14.5px; font-weight: 500; color: ${COLOR.ink}; }
.caption { font-size: 13.5px; color: ${COLOR.quiet}; }
.meta { font-size: 12.5px; color: ${COLOR.quiet}; }
.mono {
  font-family: ${MONO};
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${COLOR.quiet};
}
.wordmark { font-weight: 600; font-size: 15px; color: ${COLOR.heading}; letter-spacing: -0.01em; }

/* ---- controls -------------------------------------------------------- */

.btn {
  min-height: 44px;
  padding: 0 20px;
  white-space: nowrap;
  flex: 0 0 auto;
  border: 1px solid ${COLOR.border};
  background: transparent;
  color: ${COLOR.ink};
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
.btn:hover:not(:disabled) { border-color: ${COLOR.ink}; }
.btn:disabled { color: ${COLOR.disabled}; border-color: ${COLOR.hairline}; cursor: not-allowed; }

.btn-quiet { border-color: transparent; color: ${COLOR.muted}; padding: 0 8px; }
.btn-quiet:hover:not(:disabled) { color: ${COLOR.ink}; border-color: transparent; }

/* A routed sign board. */
.btn-primary { background: ${COLOR.primary}; color: ${COLOR.primaryInk}; border-color: ${COLOR.primary}; font-weight: 600; }
.btn-primary:hover:not(:disabled) { background: #fff; border-color: #fff; }

/* Exactly one per screen. */
.btn-accent {
  min-height: 48px;
  background: ${COLOR.accent};
  color: ${COLOR.accentInk};
  border-color: ${COLOR.accent};
  font-weight: 600;
}
.btn-accent:hover:not(:disabled) { background: #d9973c; border-color: #d9973c; }
.btn-accent:disabled { background: transparent; color: ${COLOR.disabled}; border-color: ${COLOR.hairline}; }

.panel { background: ${COLOR.panel}; border: 1px solid ${COLOR.hairline}; padding: 24px; }
.well { background: ${COLOR.well}; border: 1px solid ${COLOR.hairline}; padding: 20px; }

.option {
  display: block;
  width: 100%;
  min-height: 52px;
  text-align: left;
  padding: 14px 16px;
  background: ${COLOR.panel};
  border: 1px solid ${COLOR.border};
  color: ${COLOR.ink};
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
.option:hover { border-color: ${COLOR.ink}; }
.option[aria-pressed="true"], .option[aria-checked="true"] {
  background: ${COLOR.primary};
  color: ${COLOR.primaryInk};
  border-color: ${COLOR.primary};
}
.option[aria-pressed="true"] .caption, .option[aria-checked="true"] .caption { color: #3c5152; }

.field {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  background: ${COLOR.well};
  border: 1px solid ${COLOR.border};
  color: ${COLOR.ink};
}
.field:hover { border-color: ${COLOR.muted}; }
textarea.field { min-height: 96px; resize: vertical; line-height: 1.6; }

.stack > * + * { margin-top: 12px; }
.stack-lg > * + * { margin-top: 24px; }
.row { display: flex; align-items: center; gap: 12px; }
.spread { display: flex; align-items: center; justify-content: space-between; gap: 16px; }

.rule { height: 1px; background: ${COLOR.hairline}; border: 0; margin: 24px 0; }
.rule-strong { height: 2px; background: ${COLOR.border}; border: 0; margin: 24px 0; }

/* The chip that shows how a callout will print — the moment the brand file
   becomes visible in the writing. */
.chip {
  display: inline-block;
  padding: 4px 10px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Shadows appear only under the white page previews and under frames. Chrome
   surfaces get hairlines and 2 px rules instead. */
.page-preview { background: #fff; box-shadow: 0 18px 36px rgba(0,0,0,0.55); }
.plate { box-shadow: 3px 3px 0 0 rgba(246,243,236,0.26); }

.dropzone {
  border: 2px dashed ${COLOR.border};
  background: ${COLOR.well};
  padding: 48px 24px;
  text-align: center;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.dropzone[data-over="true"] { border-color: ${COLOR.accent}; background: #041a1b; }

.link {
  color: ${COLOR.ink};
  background: none;
  border: 0;
  border-bottom: 1px solid ${COLOR.border};
  padding: 0;
  cursor: pointer;
  font: inherit;
}
.link:hover { border-bottom-color: ${COLOR.ink}; }

.divider-add {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  background: none;
  border: 0;
  color: ${COLOR.quiet};
  font: inherit;
  font-size: 13.5px;
  padding: 8px 0;
  cursor: pointer;
}
.divider-add::before, .divider-add::after {
  content: '';
  flex: 1;
  height: 1px;
  background: ${COLOR.hairline};
}
.divider-add:hover { color: ${COLOR.ink}; }
`
