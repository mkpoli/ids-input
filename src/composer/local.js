// @ts-check
import { leaves, parse } from '../core/ids.js'
import { hasTangut } from './tangut.js'
import { hasBopomofo } from './bopomofo.js'

/** Whether every filled leaf has bundled outlines. @param {string} sequence */
export function onlyBundled(sequence) {
  const result = parse(sequence, { open: true })
  return !result.problem && (hasTangut(sequence) || hasBopomofo(sequence)) &&
    leaves(result.tree).every(({ char }) => char === null || hasTangut(char) || hasBopomofo(char))
}
