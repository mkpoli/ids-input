// The palette's character stroke counts, loaded once and shared by the search boxes that narrow
// their results by stroke count.
import { unpack } from '../composer/loader.js'

/** @type {Promise<Map<string, number | null>> | null} */
let loading = null

/** @returns {Promise<Map<string, number | null>>} */
export function loadStrokes() {
  loading ??= fetch(new URL('../../data/han-parts.json.gz', import.meta.url))
    .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('strokes')))
    .then(unpack).then(JSON.parse).then(data => {
      /** @type {string[]} */ const keys = data.keys
      /** @type {(number | null)[]} */ const strokes = data.strokes
      return new Map(keys.map((key, index) => [key, strokes[index] ?? null]))
    })
  return loading
}
