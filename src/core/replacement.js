// @ts-check
// zi.tools' replacement expression: resolve it into ordinary editable IDS before rendering.
import { LONGEST, UNKNOWN, descriptionEnd, isNode, leaves, parse, partAt, paths, place, write } from './ids.js'
import { lookupChar } from './decompose.js'

/** @typedef {{ source: string, target: string, replacement: string, index?: number, variant?: string }} Replacement */
/** The source regions a variant letter can name, after the guide's `Unicode_Sources`. */
export const SOURCE_VARIANTS = 'BGHJKMPSTUVQ'
/** Whether text starts with a zi.tools replacement operator. @param {string} text */
export const replacementPrefix = text => /^\s*(?:🔄[\uFE0E\uFE0F]?|rp)/iu.test(text ?? '')
/** Read the three IDS operands of 🔄 or its zi.tools alias RP, after an optional `[n]` occurrence
 * index. A region letter after the source names that source's variant; a Latin operand keeps its
 * plain reading when no variant leaves three operands. Each operand can be a component or a
 * complete ordinary IDS. Unknown and empty operands are not replacement patterns.
 * @param {string} text @returns {Replacement | null} */
export function replacementQuery(text) {
  const input = (text ?? '').trim()
  const rest = /^rp/i.test(input) ? input.slice(2) : input.replace(/^🔄[\uFE0E\uFE0F]?/u, '')
  if (rest === input) return null
  const chars = [...rest]
  if (chars.length > LONGEST) return null
  let at = 0
  /** @type {number | undefined} */
  let index
  const indexed = /^\[(\d{1,2})\]/u.exec(rest)
  if (indexed) { index = Number(indexed[1]); at = indexed[0].length }
  /** @param {string} operand @returns {boolean} */
  const usable = operand => {
    const found = parse(operand, { open: true })
    return !found.problem && found.tree !== null && !leaves(found.tree).some(part => part.char?.startsWith(UNKNOWN))
  }
  /** @param {number} start @param {number} count @returns {{ parts: string[], end: number } | null} */
  const operands = (start, count) => {
    /** @type {string[]} */
    const parts = []
    let cursor = start
    for (let i = 0; i < count; i++) {
      const end = descriptionEnd(chars, cursor)
      if (end < 0) return null
      const operand = chars.slice(cursor, end).join('')
      if (!usable(operand)) return null
      parts.push(operand)
      cursor = end
    }
    return { parts, end: cursor }
  }
  const firstEnd = descriptionEnd(chars, at)
  if (firstEnd < 0) return null
  const source = chars.slice(at, firstEnd).join('')
  if (!usable(source)) return null
  /** @type {string | undefined} */
  let variant
  /** @type {{ parts: string[], end: number } | null} */
  let following = null
  if ([...source].length === 1 && SOURCE_VARIANTS.includes(chars[firstEnd] ?? '')) {
    following = operands(firstEnd + 1, 2)
    if (following) variant = chars[firstEnd]
  }
  following ??= operands(firstEnd, 2)
  if (!following || following.end !== chars.length) return null
  /** @type {Replacement} */
  const query = { source, target: following.parts[0], replacement: following.parts[1] }
  if (index !== undefined) query.index = index
  if (variant !== undefined) query.variant = variant
  return query
}

/** Maximum candidate decompositions explored for a replacement. */
export const REPLACEMENT_STATES = 128

/** Left to right, then shorter first: the reading order of two paths.
 * @param {number[]} a @param {number[]} b */
const readingOrder = (a, b) => {
  for (let k = 0; k < Math.min(a.length, b.length); k++) if (a[k] !== b[k]) return a[k] - b[k]
  return a.length - b.length
}

/** The descriptions that can stand for `variant`: a region letter matches a description whose
 * regions include it. Descriptions without regions cannot be chosen or ruled out by it, so they
 * remain when nothing matches.
 * @param {{ text: string, regions?: string }[]} entries @param {string} variant */
function variantEntries(entries, variant) {
  const known = entries.filter(entry => entry.regions)
  if (!known.length) return entries
  const matched = known.filter(entry => entry.regions?.includes(variant))
  return matched.length ? matched : entries
}

/** Resolve a replacement through descriptions, preferring fewer opened components. Among equally
 * shallow occurrences, an explicit structured source prefers the first immediate match; opened
 * descriptions prefer the last. `index` chooses an occurrence in reading order, expanding further
 * until that many exist;
 * `variant` restricts the descriptions to the source region it names. Returns null when the target
 * is not found; the original input remains available.
 * @param {Replacement} query
 * @param {(char: string) => Promise<{ text: string, regions?: string }[]>} structure
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<import('./ids.js').Part | null>} */
export async function resolveReplacement({ source, target, replacement, index, variant }, structure, { signal } = {}) {
  const sourceTree = parse(source, { open: true }).tree, targetTree = parse(target, { open: true }).tree, replacementTree = parse(replacement, { open: true }).tree
  if (sourceTree == null || targetTree == null || replacementTree == null) return null
  const targetText = write(targetTree)
  const structured = isNode(sourceTree)
  /** @type {{ tree: import('./ids.js').Part, opened: number }[]} */
  const queue = [{ tree: sourceTree, opened: 0 }]
  const seen = new Set([write(sourceTree)])
  /** @type {Map<string, Promise<{ text: string, regions?: string }[]>>} */
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
    /** @type {{ tree: import('./ids.js').Part, path: number[] }[]} */
    const indexed = []
    for (let j = i; j < end; j++) for (const path of paths(queue[j].tree)) {
      const part = partAt(queue[j].tree, path)
      if (part === undefined || part === null || write(part) !== targetText) continue
      if (index === undefined && best && order(path, best.path, opened) >= 0) continue
      const result = place(queue[j].tree, path, replacementTree).tree, text = write(result)
      if ([...text].length > LONGEST || parse(text, { open: true }).problem) continue
      if (index === undefined) best = { tree: result, path }
      else indexed.push({ tree: result, path })
    }
    if (index !== undefined) {
      if (indexed.length > index) return indexed.sort((a, b) => readingOrder(a.path, b.path))[index].tree
    } else if (best) return best.tree
    if (opened < 8) for (let j = i; j < end && queue.length < REPLACEMENT_STATES; j++) {
      const tree = queue[j].tree
      const parts = leaves(tree).filter(part => part.char !== null).sort((a, b) => order(a.path, b.path, opened))
      for (const part of parts) {
        if (queue.length >= REPLACEMENT_STATES) break
        signal?.throwIfAborted()
        const char = lookupChar(part.char)
        if (!descriptions.has(char)) descriptions.set(char, structure(char))
        const found = await /** @type {Promise<{ text: string, regions?: string }[]>} */ (descriptions.get(char))
        const entries = variant ? variantEntries(found, variant) : found
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
