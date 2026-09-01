/**
 * Controlled vocabularies — spec §9.1.
 *
 * This is the single highest-value thing the app does. The reviewed library
 * carries 15 uncontrolled strings meaning roughly four audiences, and six
 * different labels for one date field. Every field here is a select, never
 * an input.
 *
 * `support_presets` is deliberately absent: the deltas file deletes it, along
 * with every hardcoded email address and phone number. Contact details are an
 * ordinary author-written section.
 */

export const AUDIENCES = [
  { id: 'physicians', label: 'Physicians' },
  { id: 'providers', label: 'Providers (including APRN and PA)' },
  { id: 'ed_providers', label: 'Emergency department providers' },
  { id: 'nurses', label: 'Nurses' },
  { id: 'case_management', label: 'Case management' },
  { id: 'scribes', label: 'Scribes' },
  { id: 'all_clinical_staff', label: 'All clinical staff' },
  { id: 'all_associates', label: 'All associates' },
] as const

export type AudienceId = (typeof AUDIENCES)[number]['id']

/** Tiered by how central the system is to the environment, per §9.1. */
export const SYSTEMS = [
  { id: 'cerner_powerchart', label: 'Cerner PowerChart', tier: 1 },
  { id: 'cerner_firstnet', label: 'Cerner FirstNet', tier: 1 },
  { id: 'perfectserve', label: 'PerfectServe', tier: 1 },
  { id: 'dragon_dmo', label: 'Dragon Medical One', tier: 2 },
  { id: 'imprivata_id', label: 'Imprivata ID', tier: 2 },
  { id: 'imprivata_confirm_id', label: 'Imprivata Confirm ID', tier: 2 },
  { id: 'lightning_bolt', label: 'Lightning Bolt', tier: 2 },
  { id: 'wellsheet', label: 'Wellsheet', tier: 2 },
  { id: 'servicenow', label: 'ServiceNow', tier: 3 },
  { id: 'citrix_workspace', label: 'Citrix Workspace', tier: 3 },
  { id: 'google_workspace', label: 'Google Workspace', tier: 3 },
  { id: 'network', label: 'Network', tier: 4 },
  { id: 'mobile_device', label: 'Mobile device', tier: 4 },
  { id: 'none', label: 'None', tier: 4 },
] as const

export type SystemId = (typeof SYSTEMS)[number]['id']

/**
 * One date field, one stored value. The six labels observed in the library
 * become a display choice that never changes the field — §9.1.
 */
export const DATE_SUBLABELS = [
  { id: 'effective', label: 'Effective' },
  { id: 'published', label: 'Published' },
  { id: 'go_live', label: 'Go-live' },
  { id: 'revision', label: 'Revision' },
] as const

export type DateSublabelId = (typeof DATE_SUBLABELS)[number]['id']

export const BLUEPRINTS = ['field_guide', 'quick_reference', 'huddle_card'] as const
export type BlueprintId = (typeof BLUEPRINTS)[number]

/** The entire section vocabulary. Five shapes — deltas §9.2. */
export const SHAPES = ['steps', 'paragraph', 'table', 'callout', 'figure'] as const
export type Shape = (typeof SHAPES)[number]

export const CALLOUT_LEVELS = ['note', 'important', 'requirements', 'tip'] as const
export type CalloutLevel = (typeof CALLOUT_LEVELS)[number]

/**
 * The author never sees NOTE / IMPORTANT / REQUIREMENTS / TIP while writing.
 * They answer this question instead; the rendered label appears afterwards as
 * a chip that shows how it will print. Deltas §7.4.
 */
export const CALLOUT_QUESTION = 'How strongly do you mean it?'

export const CALLOUT_ANSWERS: ReadonlyArray<{ level: CalloutLevel; answer: string }> = [
  { level: 'note', answer: 'Just so they know' },
  { level: 'important', answer: 'They must not miss this' },
  { level: 'requirements', answer: 'Required by policy' },
  { level: 'tip', answer: 'A shortcut worth knowing' },
]

/**
 * `register` is what makes the two-variant architecture one filter instead of
 * two templates — deltas §9.2, §12.4.
 */
export const REGISTERS = ['both', 'scaffolded', 'expert'] as const
export type Register = (typeof REGISTERS)[number]

export const VARIANTS = ['scaffolded', 'expert'] as const
export type Variant = (typeof VARIANTS)[number]

/** Plain-language blueprint names. No jargon reaches the screen — deltas §6. */
export const BLUEPRINT_COPY: Record<BlueprintId, { name: string; use: string }> = {
  field_guide: {
    name: 'A pocket booklet',
    use: 'Folded and stitched, carried in a coat pocket. Good for a long procedure someone works through.',
  },
  quick_reference: {
    name: 'A one-page sheet',
    use: 'Posted, laminated, or handed out. Flows to as many pages as the content needs.',
  },
  huddle_card: {
    name: 'A card to read at huddle',
    use: 'Read aloud to a room. Short, large type, one change and what to do about it.',
  },
}
