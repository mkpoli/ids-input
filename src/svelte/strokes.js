// The stroke counts of the characters a description can draw, loaded once from `data/han-parts.json.gz`
// and shared by the search boxes that narrow their results by stroke count and the tooltips that
// say how many strokes a character has and which stroke it begins with.
import { unpack } from '@han-compose/composer'
import { download } from '@han-compose/composer/retry'

/**
 * @typedef {object} StrokeRecord
 * @property {number | null} strokes How many strokes the character is drawn in, where counted.
 * @property {'横' | '豎' | '撇' | '點' | '折' | null} first The class of its first stroke.
 */

/** @type {Promise<Map<string, StrokeRecord>> | null} */
let reading = null

/**
 * Each Han character with its stroke count and the class of its first stroke, where either is
 * recorded. A character the table leaves out has no count.
 * @returns {Promise<Map<string, StrokeRecord>>}
 */
export function loadStrokeRecords() {
  reading ??= download(new URL('../../data/han-parts.json.gz', import.meta.url))
    .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('strokes')))
    .then(unpack).then(JSON.parse).then((/** @type {{ keys: string[], strokes: (number | null)[], firsts?: ('横' | '豎' | '撇' | '點' | '折' | null)[] }} */ data) => {
      const keys = data.keys, strokes = data.strokes, firsts = data.firsts ?? []
      return new Map(keys.map((key, index) => [key, { strokes: strokes[index] ?? null, first: firsts[index] ?? null }]))
    })
    .catch(error => { reading = null; throw error })
  return reading
}

/** @type {Promise<Map<string, number>> | null} */
let tangut = null

/**
 * The stroke count of each Tangut character, from `data/tangut-strokes.json.gz`. The table records
 * no writing order, so a record has a count and no first stroke.
 * @returns {Promise<Map<string, number>>}
 */
export function loadTangutStrokes() {
  tangut ??= download(new URL('../../data/tangut-strokes.json.gz', import.meta.url))
    .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('Tangut strokes')))
    .then(unpack).then(JSON.parse).then((/** @type {{ values: Record<string, number> }} */ data) => new Map(Object.entries(data.values)))
    .catch(error => { tangut = null; throw error })
  return tangut
}

/** Each Jurchen stroke code letter as its class: h 横, s 豎, p 撇, d 點, z 折; b closes a radical. */
const JURCHEN_CLASS = /** @type {Record<string, '横' | '豎' | '撇' | '點' | '折'>} */ ({ h: '横', s: '豎', p: '撇', d: '點', z: '折' })

/** @type {Promise<Map<string, StrokeRecord>> | null} */
let jurchen = null

/**
 * Each Jurchen character and radical with its stroke count and first stroke. Alari's stroke code
 * gives the first four strokes and the last, so its first letter is the class of the first stroke;
 * the count comes from the character's own row.
 * @returns {Promise<Map<string, StrokeRecord>>}
 */
export function loadJurchenStrokes() {
  jurchen ??= download(new URL('../../data/jurchen.json.gz', import.meta.url))
    .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('Jurchen strokes')))
    .then(unpack).then(JSON.parse).then((/** @type {{ parts: { part: string, strokes?: number | null, jurCode?: string }[] }} */ data) =>
      new Map(data.parts.map(part => [part.part, {
        strokes: part.strokes ?? null,
        first: part.jurCode ? JURCHEN_CLASS[part.jurCode[0]] ?? null : null,
      }])))
    .catch(error => { jurchen = null; throw error })
  return jurchen
}

/** @type {Promise<Map<string, number>> | null} */
let kana = null

/**
 * The stroke count of each kana, from `data/kana-strokes.json.gz`. KanjiVG records the strokes but
 * names no class for them, so a kana has a count and no first stroke.
 * @returns {Promise<Map<string, number>>}
 */
export function loadKanaStrokes() {
  kana ??= download(new URL('../../data/kana-strokes.json.gz', import.meta.url))
    .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('Kana strokes')))
    .then(unpack).then(JSON.parse).then((/** @type {{ keys: string[], strokes: number[] }} */ data) =>
      new Map(data.keys.map((key, index) => [key, data.strokes[index]])))
    .catch(error => { kana = null; throw error })
  return kana
}

/** @type {Promise<Map<string, number | null>> | null} */
let loading = null

/** The stroke count of each character, null where none is recorded. @returns {Promise<Map<string, number | null>>} */
export function loadStrokes() {
  loading ??= loadStrokeRecords().then(records => new Map([...records].map(([key, record]) => [key, record.strokes])))
    .catch(error => { loading = null; throw error })
  return loading
}
