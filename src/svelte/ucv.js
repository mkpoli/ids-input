// The UCV and NUCV lists and the outlines of their forms, loaded once when the list is first shown:
// `data/ucv.json` (320 KB) and `data/ucv-forms.json.gz` (765 KB).
import { unpack } from '@han-compose/composer'
import { download } from '@han-compose/composer/retry'
import { createUcvIndex } from '../core/ucv.js'

/** @type {Promise<{ index: import('../core/ucv.js').UcvIndex, groups: import('../core/ucv.js').UcvData['groups'], outlines: Record<string, string> }> | null} */
let reading = null

/** @param {URL} url */
const read = url => download(url)
  .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error(url.pathname)))
  .then(unpack).then(JSON.parse)

/** The lists as an index, their groups, and each form's outline as an SVG path in a 200-unit square. */
export function loadUcv() {
  reading ??= Promise.all([read(new URL('../../data/ucv.json', import.meta.url)), read(new URL('../../data/ucv-forms.json.gz', import.meta.url))])
    .then(([data, outlines]) => ({ index: createUcvIndex(data), groups: data.groups, outlines }))
    .catch(error => { reading = null; throw error })
  return reading
}
