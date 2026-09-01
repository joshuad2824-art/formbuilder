/**
 * PDF — §13.2. **Print the HTML. Do not build a second layout engine.**
 *
 * The canonical output is the self-contained HTML file; PDF is that file sent
 * to the print dialog, so the two can never disagree about where a page breaks.
 * Everything that makes the PDF correct — page boxes, bleed, keep-together,
 * reading order — is already in the HTML's own print CSS.
 *
 * What the browser cannot do from here is PDF/X with CMYK separations and a
 * preflight pass. That is a press requirement rather than a desk one, and §13.2
 * expects it at the point the file goes to a printer; the honest position is
 * that this produces a correct, tagged, screen-resolution PDF and the press
 * step happens downstream.
 */

export interface PrintHandle {
  /** Closes the hidden frame. Always call it. */
  dispose: () => void
}

/**
 * Opens the print dialog on a rendered document without navigating away from
 * the app. The document is written into a hidden same-origin frame, so it
 * carries its own print CSS and its own page boxes.
 */
export function printDocument(html: string, title = 'document'): Promise<PrintHandle> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    frame.title = title

    const dispose = () => frame.remove()

    frame.onload = () => {
      const view = frame.contentWindow
      if (!view) {
        dispose()
        reject(new Error('The document could not be prepared for printing.'))
        return
      }
      // Give the frame a beat to lay out and load its inlined images before the
      // dialog snapshots it.
      view.requestAnimationFrame(() => {
        view.requestAnimationFrame(() => {
          view.focus()
          view.print()
          resolve({ dispose })
        })
      })
    }

    document.body.appendChild(frame)
    const doc = frame.contentDocument
    if (!doc) {
      dispose()
      reject(new Error('The document could not be prepared for printing.'))
      return
    }
    doc.open()
    doc.write(html)
    doc.close()
  })
}

/**
 * Hands the reader a file to save. Everything is already inline, so this is a
 * blob of the same bytes the renderer produced — no packaging step, nothing
 * fetched, nothing uploaded.
 */
export function downloadDocument(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.html') ? filename : `${filename}.html`
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next turn so the download has picked the blob up.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** A filename someone can find again, from the document's own title. */
export function filenameFor(title: string, variant: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'document'
  return `${slug}-${variant}.html`
}

/**
 * How the formats are named on screen — deltas §13. By what the user would do
 * with them, with the file type as a sub-label, because "PDF / HTML / DOCX" is
 * a list of file formats and not a list of choices anyone is actually making.
 */
export const FORMAT_COPY = [
  {
    id: 'print',
    title: 'For printing',
    sub: 'PDF',
    note: 'Opens your print box. Everything is already laid out.',
  },
  {
    id: 'web',
    title: 'For sharing a link',
    sub: 'Web page',
    note: 'One file. It works offline and needs nothing installed.',
  },
  {
    id: 'word',
    title: 'If someone must edit it',
    sub: 'Word',
    // The Word card carries its own caveat in plain voice.
    note: 'Once it opens in Word, how it looks is out of our hands.',
  },
] as const
