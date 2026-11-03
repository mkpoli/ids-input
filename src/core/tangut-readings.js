// @ts-check
// The reconstructions the Tangut records carry, and the search over them. The systems and the
// folding follow tangut-input's reading search (MIT): a query is folded to plain letters with a
// final digit kept as the tone, so diacritics, IPA letters and separators do not tell readings
// apart, and a looser spelling drops the medials and prenasals that systems disagree on.

/** The systems a reader can type in, in the order the card lists them.
 *  @typedef {{ key: string, short: string, name: string, zh: string, tones: boolean }} ReadingSystem */
export const READING_SYSTEMS = /** @type {const} */ ([
  { key: 'li_fanwen', short: 'Li', name: 'Li Fanwen 2008', zh: '李範文2008', tones: true },
  { key: 'gong_huangcheng', short: 'Gong', name: 'Gong Hwang-cherng', zh: '龔煌城', tones: false },
  { key: 'gong_xun_202411', short: 'GX', name: 'Gong Xun 2024-11', zh: '龔勛2024-11', tones: true },
  { key: 'arakawa_shintaro', short: 'Ar', name: 'Arakawa Shintarō', zh: '荒川慎太郎', tones: false },
  { key: 'miyake', short: 'My', name: 'Marc Miyake', zh: '三宅', tones: true },
  { key: 'nishida', short: 'Ni', name: 'Nishida 1966', zh: '西田龍雄1966', tones: true },
  { key: 'kychanov', short: 'Ky', name: 'Kychanov 2006', zh: '克恰諾夫2006', tones: true },
  { key: 'sofronov', short: 'So', name: 'Sofronov 1968', zh: '索弗羅諾夫1968', tones: true },
])

/** The two sound glosses, in the card's order. @typedef {{ key: string, name: string, zh: string }} SoundSystem */
export const SOUND_SYSTEMS = /** @type {const} */ ([
  { key: 'li_fanwen', name: 'Li Fanwen', zh: '李範文' },
  { key: 'nie_lishan', name: 'Nie Lishan', zh: '聶歷山' },
])

/** @typedef {{ char: string, system: string, systemShort: string, systemName: string, raw: string, folded: string, loose: string, tone: string }} Reading */

const LETTERS = /** @type {Record<string, string>} */ ({
  ɨ: 'i', ɪ: 'i', ʉ: 'u', ɯ: 'u', ə: 'e', ɛ: 'e', ɔ: 'o', ɑ: 'a', æ: 'ae',
  ŋ: 'ng', ɣ: 'gh', ʁ: 'r', ɲ: 'ny', ȵ: 'ny', ɱ: 'm', ʷ: 'w', ⁿ: 'n', ł: 'l', ɡ: 'g',
  ʟ: 'l', ᴛ: 't', ɢ: 'g', ʙ: 'b', ᴄ: 'c', ʜ: 'h', ꜰ: 'f', ᴜ: 'u',
  ʔ: '', ɦ: '',
})

/**
 * Plain letters and the tone, if the reading ends in a digit.
 * @param {string} value
 * @returns {{ folded: string, tone: string }}
 */
export function foldReading(value) {
  const text = value.trim().toLowerCase()
  const tone = /([0-9])\s*$/.exec(text)?.[1] ?? ''
  const letters = [...text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')]
    .map(char => LETTERS[char] ?? char)
    .join('')
    .replace(/[^a-z]/g, '')
  return { folded: letters, tone }
}

/**
 * A looser spelling for near matches: medial j and y are dropped, and a prenasal before a stop
 * (Kychanov's nd-, mb- against Li's d-, b-) goes too.
 * @param {string} folded
 */
export function loosenReading(folded) {
  return folded.replace(/^n(?=d|t|g|k|dz|ts)/, '').replace(/^m(?=b|p)/, '').replace(/[jy]/g, '')
}

/**
 * Every reading in a character-info document's Tangut entries, folded once.
 * @param {Record<string, { readings?: Record<string, string> }>} entries
 * @returns {Reading[]}
 */
export function indexReadings(entries) {
  /** @type {Reading[]} */
  const readings = []
  for (const [char, entry] of Object.entries(entries)) {
    for (const system of READING_SYSTEMS) {
      const raw = entry.readings?.[system.key]?.trim()
      if (!raw) continue
      const { folded, tone } = foldReading(raw)
      if (!folded) continue
      readings.push({ char, system: system.key, systemShort: system.short, systemName: system.name, raw, folded, loose: loosenReading(folded), tone })
    }
  }
  return readings
}

/** A character a reading query found, with the readings that matched at the closest tier.
 *  @typedef {{ char: string, tier: number, readings: Reading[] }} ReadingHit */

/**
 * The characters with a reading like the query, best first: by tier, then by how many systems
 * agree, then by code point. A query with a tone keeps to that tone; a query without one accepts
 * every tone.
 * @param {Reading[]} readings
 * @param {string} query
 * @param {{ limit?: number }} [options]
 * @returns {ReadingHit[]}
 */
export function searchReadings(readings, query, { limit = 24 } = {}) {
  const { folded, tone } = foldReading(query)
  if (!folded || limit <= 0) return []
  const loose = loosenReading(folded)
  /** @type {Map<string, ReadingHit>} */
  const hits = new Map()
  for (const reading of readings) {
    if (tone && reading.tone && reading.tone !== tone) continue
    let tier = -1
    if (reading.folded === folded) tier = 0
    else if (reading.folded.startsWith(folded)) tier = 1
    else if (loose && reading.loose === loose) tier = 2
    else if (loose.length > 1 && reading.loose.startsWith(loose)) tier = 3
    if (tier < 0) continue
    const hit = hits.get(reading.char)
    if (!hit || tier < hit.tier) hits.set(reading.char, { char: reading.char, tier, readings: [reading] })
    else if (tier === hit.tier) hit.readings.push(reading)
  }
  return [...hits.values()].sort((a, b) => a.tier - b.tier || b.readings.length - a.readings.length
    || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0)).slice(0, limit)
}
