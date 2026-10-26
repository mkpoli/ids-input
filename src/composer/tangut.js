// @ts-nocheck: the same exported glyph records and source interface as loader.js.
// Tangut outlines ship with the package. Pure Tangut compositions use the composer's geometric
// layout; mixed descriptions also read Han records and layout from the host's export.
import { bundledSource } from './bundled.js'
import { leaves, parse } from '../core/ids.js'
import { unpack } from './loader.js'

export const hasTangut = text => /[\u{17000}-\u{18AFF}\u{18D00}-\u{18DFF}]/u.test(text)
export const onlyTangut = sequence => {
  const result = parse(sequence, { open: true })
  return !result.problem && hasTangut(sequence) && leaves(result.tree).every(({ char }) => char === null || hasTangut(char))
}

const loadOutlines = async () => {
  const response = await fetch(new URL('../../data/tangut-outlines.json.gz', import.meta.url))
  if (!response.ok) throw new Error(`Tangut outlines: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}

export function tangutSource({ load = loadOutlines, fallback = null } = {}) {
  return bundledSource({ load, matches: hasTangut, fallback })
}
