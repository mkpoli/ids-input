// @ts-nocheck
import { bundledSource } from './bundled.js'
import { unpack } from './loader.js'

export const hasBopomofo = text => /[\u3105-\u312F\u31A0-\u31BF]/u.test(text)
const loadOutlines = async () => {
  const response = await fetch(new URL('../../data/bopomofo-outlines.json.gz', import.meta.url))
  if (!response.ok) throw new Error(`Bopomofo outlines: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}
export const bopomofoSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasBopomofo, fallback })
