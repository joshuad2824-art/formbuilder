/**
 * The Brand Kit file format — §10, as amended by the deltas file.
 *
 * A single HTML file that is simultaneously a machine-readable token set, the
 * CSS that renders documents, and a live specimen page that opens in any
 * browser. **The app parses the JSON block and never parses arbitrary HTML.**
 *
 * The kit is dropped in by the user on the first screen. It does not ship with
 * the app — which is what makes the app carry no organisation's brand until
 * someone hands it one.
 */

export interface KitColor {
  hex: string
  pantone?: string
  cmyk?: [number, number, number, number]
  role?: string
  text_on?: 'white' | 'black'
  white_ok?: 'any' | 'large_only' | 'never'
  contrast_white_on?: number
  contrast_black_on?: number
  status?: string
}

export interface KitCallout {
  key: string
  label: string
  color: string
  text: 'white' | 'black'
  status?: string
  meaning?: string
  note?: string
}

export interface KitTypeFamily {
  primary: string | null
  office: string
  web?: string
  fallback?: string
  use?: string
}

export interface KitType {
  serif: KitTypeFamily
  sans: KitTypeFamily
  condensed?: KitTypeFamily
  body_family: 'serif' | 'sans' | 'condensed'
  body_size_pt: number
  heading_family: 'serif' | 'sans' | 'condensed'
  callout_label_family: 'serif' | 'sans' | 'condensed'
  callout_label_weight: number
  scale_ratio: Record<string, number>
  max_ratio_narrow?: number
  min_size_pt: number
  body_min_pt: number
  table_cell_min_pt: number
  numerals?: { body: string; tables: string }
  justify: boolean
}

export interface KitAsset {
  src: string
  source_file?: string
  cut?: string
  aspect?: number
  min_print_height_in?: number
  min_digital_height_px?: number
  use?: string
  clear_space?: string
}

export interface BrandKit {
  kit_version: string
  id: string
  name: string
  org: string | null
  org_unit: string | null
  source: string
  color: Record<string, KitColor>
  type: KitType
  callouts: KitCallout[]
  annotation?: {
    box_color: string
    arrow_color: string
    label_text: string
    min_contrast_vs_sampled_pixels: number
    max_callouts_per_image: number
  }
  /** Declares that a shared callout fill is deliberate — deltas §10. */
  monochrome?: boolean
  blueprints: string[]
  sections_enabled: string[] | null
  footer_template: string
  system_version_default?: string | null
  assets: Record<string, KitAsset | string | null>
  prohibitions?: unknown
  [key: string]: unknown
}

export interface LoadedKit {
  kit: BrandKit
  /** The kit's own <style> block, carried through to the rendered document. */
  css: string
  /** Where it came from, for the "using the plain look" state. */
  origin: 'default' | 'dropped-in'
}
