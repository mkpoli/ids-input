// @ts-check
import { isNode, parse, write } from '../core/ids.js'
import { containsRepetition, isRepetition } from './repetition.js'
import { hasTangut } from './tangut.js'
import { hasBopomofo } from './bopomofo.js'

/** Whether every filled leaf has bundled outlines. @param {string} sequence */
export function onlyBundled(sequence) {
  const result = parse(sequence, { open: true })
  if (result.problem || result.tree === null || !(hasTangut(sequence) || hasBopomofo(sequence) || containsRepetition(sequence))) return false
  /** @param {import('../core/ids.js').Part} node */
  const local = node => node === null || isRepetition(write(node)) || (isNode(node)
    ? node.parts.every(local) : hasTangut(node) || hasBopomofo(node))
  return local(result.tree)
}
