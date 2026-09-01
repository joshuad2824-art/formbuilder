/**
 * WCAG 2.1 relative luminance and contrast — §12.1.
 *
 * All text clears 4.5:1 against its *actual rendered background*, including
 * callout fills. Large text clears 3:1. This is a HARD rule: the renderer
 * enforces it silently and the author is never offered a choice about it.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export function parseHex(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  let body = match[1]!
  if (body.length === 3) body = body.split('').map((c) => c + c).join('')
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  }
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export function contrastHex(a: string, b: string): number | null {
  const first = parseHex(a)
  const second = parseHex(b)
  if (!first || !second) return null
  return contrast(first, second)
}

export const WHITE = '#ffffff'
export const BLACK = '#000000'

/**
 * Large text is 14 pt bold or 18 pt. Below that a pairing needs the full 4.5:1
 * — which is exactly what rules white-on-Ascension-green out at body size: it
 * clears the large-text floor by one hundredth of a point, so treat it as
 * unavailable in practice and use black on green. Deltas §7.4.
 */
export function isLarge(sizePt: number, bold: boolean): boolean {
  return sizePt >= 18 || (bold && sizePt >= 14)
}

export function requiredRatio(sizePt: number, bold: boolean): number {
  return isLarge(sizePt, bold) ? 3 : 4.5
}

/**
 * Sample the actual pixels beneath an annotation and check 3:1 — §7.6.
 * Averaging the region is the honest reading of "against the pixels beneath":
 * an annotation sits over a patch, not over one pixel.
 */
export function averageRegion(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Rgb {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      const i = (row * width + col) * 4
      r += pixels[i] ?? 0
      g += pixels[i + 1] ?? 0
      b += pixels[i + 2] ?? 0
      n++
    }
  }
  return n === 0 ? { r: 0, g: 0, b: 0 } : { r: r / n, g: g / n, b: b / n }
}
