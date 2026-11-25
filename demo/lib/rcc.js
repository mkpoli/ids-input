// Rare Character Compendium (珍字集覽): public R+XXXX codes, entry links and live IDS lookup.
// The code format follows unencoded-db's src/lib/code.ts: uppercase hex padded to at least four
// digits, growing past four the way U+10000 does.

export const RCC_ORIGIN = 'https://rare.glyphatlas.org'

const RCC_LOCALES = new Set(['en', 'ja', 'zh-Hant', 'zh-Hans', 'ko', 'vi'])
const MAX_QUERY_LENGTH = 200

/** @typedef {{ id: number, ids?: string | null, layout?: string | null, cover_key?: string | null }} RccMatch */

/** @type {Map<string, RccMatch[]>} */
const cache = new Map()

/** Format an RCC record id as its public R+ code (R+0001, R+0831, R+10000). @param {number} id */
export function rccCode(id) {
  return `R+${id.toString(16).toUpperCase().padStart(4, '0')}`
}

/** Link to an RCC record in the reader's locale. @param {number} id @param {string} [locale] */
export function rccUrl(id, locale = 'en') {
  const lang = RCC_LOCALES.has(locale) ? locale : 'en'
  return `${RCC_ORIGIN}/${lang}/entry/${id}`
}

/**
 * Normalize raw `/api/match` rows to distinct positive-integer record matches in ascending id order.
 * @param {unknown} rows
 * @returns {RccMatch[]}
 */
export function parseRccMatches(rows) {
  if (!Array.isArray(rows)) return []
  /** @type {Map<number, RccMatch>} */
  const unique = new Map()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const id = /** @type {{ id?: unknown }} */ (row).id
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) continue
    if (!unique.has(id)) {
      const record = /** @type {{ id: number, ids?: unknown, layout?: unknown, cover_key?: unknown }} */ (row)
      unique.set(id, {
        id,
        ids: typeof record.ids === 'string' ? record.ids : null,
        layout: typeof record.layout === 'string' ? record.layout : null,
        cover_key: typeof record.cover_key === 'string' ? record.cover_key : null,
      })
    }
  }
  return [...unique.values()].sort((a, b) => a.id - b.id)
}

/**
 * Ask the Rare Character Compendium whether a description has records. Caches successful answers
 * for the session; network errors or aborts resolve to an empty list without caching.
 * @param {string} sequence
 * @param {{ signal?: AbortSignal, fetch?: typeof globalThis.fetch, origin?: string, cache?: Map<string, RccMatch[]> }} [options]
 * @returns {Promise<RccMatch[]>}
 */
export async function matchRcc(sequence, options = {}) {
  const text = sequence.trim()
  if ([...text].length < 2 || text.length > MAX_QUERY_LENGTH) return []
  const store = options.cache ?? cache
  const origin = options.origin ?? RCC_ORIGIN
  const key = `${origin}\0${text}`
  const cached = store.get(key)
  if (cached) return cached
  const fetcher = options.fetch ?? globalThis.fetch
  if (!fetcher) return []
  try {
    const response = await fetcher(`${origin}/api/match?ids=${encodeURIComponent(text)}`, { signal: options.signal })
    if (!response.ok) return []
    const matches = parseRccMatches(await response.json())
    store.set(key, matches)
    return matches
  } catch {
    return []
  }
}
