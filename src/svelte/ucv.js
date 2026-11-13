// The UCV and NUCV lists and the outlines of their forms, each loaded once when first asked for:
// `data/ucv.json` (the entries) and `data/ucv-forms.json.gz` (765 KB of drawings, wanted only where a
// form is shown).
import { unpack } from '@han-compose/composer'
import { download } from '@han-compose/composer/retry'
import { createUcvIndex } from '../core/ucv.js'

/** @param {URL} url */
const read = url => download(url)
  .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error(url.pathname)))
  .then(unpack).then(JSON.parse)

/** @type {Promise<import('../core/ucv.js').UcvIndex> | null} */
let index = null
/** The lists as an index. */
export function loadUcvIndex() {
  index ??= read(new URL('../../data/ucv.json', import.meta.url)).then(createUcvIndex)
    .catch(error => { index = null; throw error })
  return index
}

/** @type {Promise<Record<string, string>> | null} */
let outlines = null
/** Each form's outline by its glyph name, as an SVG path in a 200-unit square. */
export function loadUcvOutlines() {
  outlines ??= read(new URL('../../data/ucv-forms.json.gz', import.meta.url))
    .catch(error => { outlines = null; throw error })
  return outlines
}
