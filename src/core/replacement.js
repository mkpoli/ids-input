// @ts-check
// zi.tools' replacement expression: resolve it into ordinary editable IDS before rendering.
import { EMPTY_MARKS, UNKNOWN, isComponent, isNode, isSelector, leaves, parse, place, write } from './ids.js'
import { lookupChar } from './decompose.js'

/** @typedef {{ source: string, target: string, replacement: string }} Replacement */
/** Whether text starts with a zi.tools replacement operator. @param {string} text */
export const replacementPrefix = text => /^\s*(?:🔄[\uFE0E\uFE0F]?|rp)/iu.test(text ?? '')
/** Read the three single-component operands of 🔄 or its zi.tools alias RP.
 * @param {string} text @returns {Replacement | null} */
export function replacementQuery(text) {
  const input = (text ?? '').trim()
  const rest = /^rp/i.test(input) ? input.slice(2) : input.replace(/^🔄[\uFE0E\uFE0F]?/u, '')
  if (rest === input) return null
  /** @type {string[]} */
  const parts = []
  for (const char of rest) {
    if (isSelector(char) && parts.length) parts[parts.length - 1] += char
    else parts.push(char)
  }
  const component = (/** @type {string} */ part) => {
    const chars = [...part]
    return (chars.length === 1 || (chars.length === 2 && isSelector(chars[1])))
      && isComponent(chars[0]) && chars[0] !== UNKNOWN && !EMPTY_MARKS.includes(chars[0])
  }
  if (parts.length !== 3 || !parts.every(component)) return null
  return { source: parts[0], target: parts[1], replacement: parts[2] }
}

/** Maximum candidate decompositions explored for a replacement. */
export const REPLACEMENT_STATES = 128

/** Resolve a replacement through descriptions, preferring fewer opened components. Among equally
 * shallow occurrences, replace the last one, as zi.tools does for 🔄林木火. Returns null when the
 * target is not found; the original input should then remain available to the user.
 * @param {Replacement} query
 * @param {(char: string) => Promise<{ text: string }[]>} structure
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<import('./ids.js').Part | null>} */
export async function resolveReplacement({ source, target, replacement }, structure, { signal } = {}) {
  /** @type {{ tree: import('./ids.js').Part, opened: number }[]} */
  const queue = [{ tree: source, opened: 0 }]
  const seen = new Set([source])
  /** @type {Map<string, Promise<{ text: string }[]>>} */
  const descriptions = new Map()
  /** Shortest path first, then the rightmost occurrence at that depth.
   * @param {number[]} a @param {number[]} b */
  const order = (a, b) => {
    if (a.length !== b.length) return a.length - b.length
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return b[k] - a[k]
    return 0
  }
  for (let i = 0; i < queue.length && i < REPLACEMENT_STATES;) {
    signal?.throwIfAborted()
    const opened = queue[i].opened
    let end = i
    while (end < queue.length && queue[end].opened === opened) end++
    /** @type {{ tree: import('./ids.js').Part, path: number[] } | null} */
    let best = null
    for (let j = i; j < end; j++) for (const part of leaves(queue[j].tree)) {
      if (part.char === target && (!best || order(part.path, best.path) < 0)) best = { tree: queue[j].tree, path: part.path }
    }
    if (best) return place(best.tree, best.path, replacement).tree
    if (opened < 8) for (let j = i; j < end && queue.length < REPLACEMENT_STATES; j++) {
      const tree = queue[j].tree
      const parts = leaves(tree).filter(part => part.char !== null).sort((a, b) => order(a.path, b.path))
      for (const part of parts) {
        if (queue.length >= REPLACEMENT_STATES) break
        signal?.throwIfAborted()
        const char = lookupChar(part.char)
        if (!descriptions.has(char)) descriptions.set(char, structure(char))
        const entries = await /** @type {Promise<{ text: string }[]>} */ (descriptions.get(char))
        signal?.throwIfAborted()
        for (const description of entries) {
          const read = parse(description.text)
          if (read.problem || !isNode(read.tree)) continue
          const expanded = place(tree, part.path, read.tree).tree
          const key = write(expanded)
          if (seen.has(key)) continue
          seen.add(key)
          queue.push({ tree: expanded, opened: opened + 1 })
          if (queue.length >= REPLACEMENT_STATES) break
        }
      }
    }
    i = end
  }
  return null
}
