// The stroke counts of the characters the composer can draw, loaded once from `data/han-parts.json.gz`
// and shared by the search boxes that narrow their results by stroke count and the tooltips that
// say how many strokes a character has and which stroke it begins with.
import { unpack } from '../composer/loader.js'

/** @typedef {{ strokes: number | null, first: '横' | '豎' | '撇' | '點' | '折' | null }} StrokeRecord */

/** @type {Promise<Map<string, StrokeRecord>> | null} */
let reading = null

/**
 * Each Han character with its stroke count and the class of its first stroke, where either is
 * recorded. A character the table leaves out is not Han, or has no count.
 * @returns {Promise<Map<string, StrokeRecord>>}
 */
export function loadStrokeRecords() {
  reading ??= fetch(new URL('../../data/han-parts.json.gz', import.meta.url))
    .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('strokes')))
    .then(unpack).then(JSON.parse).then((/** @type {{ keys: string[], strokes: (number | null)[], firsts?: ('横' | '豎' | '撇' | '點' | '折' | null)[] }} */ data) => {
      const keys = data.keys, strokes = data.strokes, firsts = data.firsts ?? []
      return new Map(keys.map((key, index) => [key, { strokes: strokes[index] ?? null, first: firsts[index] ?? null }]))
    })
    .catch(error => { reading = null; throw error })
  return reading
}

/** @type {Promise<Map<string, number | null>> | null} */
let loading = null

/** The stroke count of each character, null where none is recorded. @returns {Promise<Map<string, number | null>>} */
export function loadStrokes() {
  loading ??= loadStrokeRecords().then(records => new Map([...records].map(([key, record]) => [key, record.strokes])))
    .catch(error => { loading = null; throw error })
  return loading
}
