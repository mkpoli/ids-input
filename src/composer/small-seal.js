// @ts-nocheck
// Unicode Small Seal glyphs for the supported CHISE descriptions and their components.
import { bundledSource } from './bundled.js'
import { unpack } from './loader.js'

export const hasSmallSeal = text => /[\u{3D000}-\u{3FC3F}]/u.test(text)
const loadOutlines = async () => {
  const response = await fetch(new URL('../../data/small-seal-outlines.json.gz', import.meta.url))
  if (!response.ok) throw new Error(`Small Seal outlines: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}
export function smallSealSource({ load = loadOutlines, fallback = null } = {}) {
  return bundledSource({ load, matches: hasSmallSeal, fallback })
}
