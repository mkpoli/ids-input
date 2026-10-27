// @ts-check
// zi.tools' replacement expression: resolve it into ordinary editable IDS before rendering.
import { LONGEST, UNKNOWN, descriptionEnd, isNode, leaves, parse, partAt, paths, place, write } from './ids.js'
import { lookupChar } from './decompose.js'

/** @typedef {{ source: string, target: string, replacement: string }} Replacement */
/** Whether text starts with a zi.tools replacement operator. @param {string} text */
export const replacementPrefix = text => /^\s*(?:🔄[\uFE0E\uFE0F]?|rp)/iu.test(text ?? '')
/** Read the three IDS operands of 🔄 or its zi.tools alias RP. Each operand can be a component or
 * a complete ordinary IDS. Unknown and empty operands are not replacement patterns.
 * @param {string} text @returns {Replacement | null} */
export function replacementQuery(text) {
  const input = (text ?? '').trim()
  const rest = /^rp/i.test(input) ? input.slice(2) : input.replace(/^🔄[\uFE0E\uFE0F]?/u, '')
  if (rest === input) return null
  const chars = [...rest]
  if (chars.length > LONGEST) return null
  /** @type {string[]} */
  const parts = []
  let at = 0
  for (let i = 0; i < 3; i++) {
    const end = descriptionEnd(chars, at)
    if (end < 0) return null
    const operand = chars.slice(at, end).join('')
    const found = parse(operand, { open: true })
    if (found.problem || found.tree === null || leaves(found.tree).some(part => part.char?.startsWith(UNKNOWN))) return null
    parts.push(operand)
    at = end
  }
  return at === chars.length ? { source: parts[0], target: parts[1], replacement: parts[2] } : null
}

/** Maximum candidate decompositions explored for a replacement. */
export const REPLACEMENT_STATES = 128

/** Resolve a replacement through descriptions, preferring fewer opened components. Among equally
 * shallow occurrences, an explicit structured source prefers the first immediate match; opened
 * descriptions prefer the last. Returns null when the target is not found; the original input remains available.
 * @param {Replacement} query
 * @param {(char: string) => Promise<{ text: string }[]>} structure
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<import('./ids.js').Part | null>} */
export async function resolveReplacement({ source, target, replacement }, structure, { signal } = {}) {
  const sourceTree = parse(source, { open: true }).tree, targetTree = parse(target, { open: true }).tree, replacementTree = parse(replacement, { open: true }).tree
  if (sourceTree == null || targetTree == null || replacementTree == null) return null
  const targetText = write(targetTree)
  const structured = isNode(sourceTree)
  /** @type {{ tree: import('./ids.js').Part, opened: number }[]} */
  const queue = [{ tree: sourceTree, opened: 0 }]
  const seen = new Set([write(sourceTree)])
  /** @type {Map<string, Promise<{ text: string }[]>>} */
  const descriptions = new Map()
  /** Shortest path first, then the preferred occurrence at that depth.
   * @param {number[]} a @param {number[]} b */
  const order = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number} */ opened) => {
    if (a.length !== b.length) return a.length - b.length
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return structured && opened === 0 ? a[k] - b[k] : b[k] - a[k]
    return 0
  }
  for (let i = 0; i < queue.length && i < REPLACEMENT_STATES;) {
    signal?.throwIfAborted()
    const opened = queue[i].opened
    let end = i
    while (end < queue.length && queue[end].opened === opened) end++
    /** @type {{ tree: import('./ids.js').Part, path: number[] } | null} */
    let best = null
    for (let j = i; j < end; j++) for (const path of paths(queue[j].tree)) {
      const part = partAt(queue[j].tree, path)
      if (part === undefined || part === null || write(part) !== targetText || (best && order(path, best.path, opened) >= 0)) continue
      const result = place(queue[j].tree, path, replacementTree).tree
      if (!parse(write(result), { open: true }).problem) best = { tree: result, path }
    }
    if (best) return best.tree
    if (opened < 8) for (let j = i; j < end && queue.length < REPLACEMENT_STATES; j++) {
      const tree = queue[j].tree
      const parts = leaves(tree).filter(part => part.char !== null).sort((a, b) => order(a.path, b.path, opened))
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
          // One final replacement can remove at most LONGEST code points and adds at least one.
          if ([...key].length > 2 * LONGEST - 1 || seen.has(key)) continue
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
