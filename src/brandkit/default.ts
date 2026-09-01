/**
 * The default kit.
 *
 * `unbranded-v1` is the default, not a test fixture. It loads when no brand
 * file is present, and "carry on with a plain look" on the first screen is a
 * supported path — a document picks the brand up retroactively, because
 * content is data and nothing is retyped.
 *
 * It is also the right kit to draft on and to test against: anything that
 * reads correctly on this kit reads correctly on every kit.
 *
 * The app ships with this and nothing else. It carries no organisation's brand
 * until someone hands it one.
 */

import raw from '../../kits/unbranded-v1.html?raw'
import { parseKitFile } from './parse'
import type { LoadedKit } from './types'

let cached: LoadedKit | null = null

export function defaultKit(): LoadedKit {
  if (cached) return cached
  const { kit } = parseKitFile(raw, 'default')
  if (!kit) throw new Error('The bundled plain kit failed to load — this is a build error.')
  cached = kit
  return kit
}

export const DEFAULT_KIT_SOURCE = raw
