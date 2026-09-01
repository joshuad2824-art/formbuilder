/**
 * Where pictures live.
 *
 * Images are far too large for the autosave that carries the rest of the
 * document — a couple of screenshots would blow a localStorage quota and take
 * the whole draft down with them. So they go to IndexedDB, keyed by asset id,
 * and the document JSON carries only the id.
 *
 * They stay on this computer either way. Nothing here is uploaded, which is the
 * claim the first screen and the drop zone both make.
 */

const DB_NAME = 'form-builder'
const DB_VERSION = 1
const STORE = 'assets'

let counter = 0

export function newAssetId(): string {
  return `a${Date.now().toString(36)}${(++counter).toString(36)}`
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Storage is unavailable.'))
  })
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = work(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Storage failed.'))
        transaction.oncomplete = () => db.close()
      }),
  )
}

/**
 * Two renditions per asset: the print one at 300 PPI for the width it will
 * print at, and a smaller one for the screen. Downsampled for preview, never
 * the reverse.
 */
export interface StoredAsset {
  print: string
  preview: string
  alt: string
}

export async function putAsset(id: string, asset: StoredAsset): Promise<void> {
  await run('readwrite', (store) => store.put(asset, id))
}

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  return run('readonly', (store) => store.get(id) as IDBRequest<StoredAsset | undefined>)
}

export async function deleteAsset(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id))
}

export async function allAssetIds(): Promise<string[]> {
  const keys = await run('readonly', (store) => store.getAllKeys())
  return keys.map(String)
}

/**
 * The map the renderer wants: id to the rendition for this output. Print gets
 * the 300 PPI one; anything on screen gets the small one.
 */
export async function assetMap(ids: string[], rendition: 'print' | 'preview' = 'print') {
  const map = new Map<string, string>()
  for (const id of ids) {
    try {
      const asset = await getAsset(id)
      if (asset) map.set(id, asset[rendition])
    } catch {
      // A browser with storage blocked. The document still renders; the
      // picture is simply absent rather than the export failing.
    }
  }
  return map
}

/** Every asset id the document refers to, so an export can fetch just those. */
export function referencedAssets(sections: Array<{ content: unknown }>): string[] {
  const ids: string[] = []
  for (const section of sections) {
    const content = section.content as {
      shape: string
      screenshot?: { asset_id: string } | null
      steps?: Array<{ screenshot?: { asset_id: string } | null }>
    }
    if (content.shape === 'figure' && content.screenshot) ids.push(content.screenshot.asset_id)
    if (content.shape === 'steps') {
      for (const step of content.steps ?? []) {
        if (step.screenshot) ids.push(step.screenshot.asset_id)
      }
    }
  }
  return ids
}
