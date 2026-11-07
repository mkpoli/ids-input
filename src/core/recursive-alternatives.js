// @ts-check
import { decomposable } from './decompose.js'
import { isNode, partAt, parse, paths, replaceAt, splitMarks, withMarks, write } from './ids.js'

/** @typedef {import('./ids.js').Part} Part */
/** @typedef {'results' | 'states' | 'depth' | 'work' | 'lookups' | 'lookup'} AlternativeCut */
/** @typedef {{ type: 'alternative', tree: Part } | { type: 'truncated', reasons: AlternativeCut[] }} AlternativeEvent */

/** @param {Part} part @returns {unknown} */
function identity(part) {
  return isNode(part) ? [part.op, part.note ?? '', part.marks ?? '', part.parts.map(identity)] : part
}

/** A merge cannot carry an operator's note or a descendant's marks on the resulting character.
 * @param {Part} part @param {boolean} [root] @returns {boolean} */
function mergeable(part, root = true) {
  if (part === null) return false
  if (typeof part === 'string') return !splitMarks(part).marks
  return !part.note && (root || !part.marks) && part.parts.every(child => mergeable(child, false))
}

/**
 * Enumerate one-step rewrites breadth first, visiting deeper parts first, so changes to separate parts combine independently.
 * The input is excluded. Every replacement comes from structure or an exact encoded lookup; a
 * description must be complete. Notes and marks are retained, so a subtree with a note or internal
 * marks cannot be merged. Results must round-trip through IDS text without changing their tree;
 * this excludes, for example, a loose mark inside a larger description. Lookups use the literal
 * component, including any variation selector.
 *
 * Limits bound results, retained states, rewrite distance, inspected paths/candidates and lookups. If a
 * limit excludes work, the last event reports it; stopping iteration early omits that event.
 * Failed lookups are reported as 'lookup' and other paths continue; cancellation propagates.
 * @param {Part} part
 * @param {Pick<import('../adapter/types.js').IdsAdapter, 'structure' | 'encoded'>} adapter
 * @param {{ maxResults?: number, maxStates?: number, maxDepth?: number, maxWork?: number, maxLookups?: number, signal?: AbortSignal }} [options]
 * @returns {AsyncGenerator<AlternativeEvent, void, unknown>}
 */
export async function* recursiveAlternatives(part, adapter, { maxResults = 128, maxStates = 512, maxDepth = 4, maxWork = 8192, maxLookups = 64, signal } = {}) {
  for (const [name, value, minimum] of /** @type {[string, number, number][]} */ ([['maxResults', maxResults, 0], ['maxStates', maxStates, 1], ['maxDepth', maxDepth, 0], ['maxWork', maxWork, 1], ['maxLookups', maxLookups, 0]])) {
    if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError(`${name} must be an integer >= ${minimum}`)
  }
  /** @type {{ tree: Part, depth: number }[]} */
  const queue = [{ tree: part, depth: 0 }]
  const seen = new Set([write(part)])
  /** @type {Map<string, Promise<import('./decompose.js').Sequence[]>>} */
  const structures = new Map()
  /** @type {Map<string, Promise<string[]>>} */
  const encoded = new Map()
  /** @type {Set<AlternativeCut>} */
  const cuts = new Set()
  let work = 0, results = 0, lookups = 0
  outer: for (let i = 0; i < queue.length; i++) {
    const { tree, depth } = queue[i]
    for (const path of paths(tree).sort((a, b) => b.length - a.length)) {
      signal?.throwIfAborted()
      if (++work > maxWork) { cuts.add('work'); break outer }
      const current = partAt(tree, path)
      if (current === undefined || current === null) continue
      /** @type {Iterable<string>} */
      let choices = []
      /** @type {(text: string) => Part | undefined} */
      let replacementFor = () => undefined
      try {
        if (typeof current === 'string' && decomposable(current)) {
          const { base, marks } = splitMarks(current)
          if (typeof base !== 'string') continue
          if (!structures.has(base)) {
            if (lookups >= maxLookups) { cuts.add('lookups'); continue }
            lookups++
            structures.set(base, adapter.structure(base, { signal }))
          }
          const found = await /** @type {Promise<import('./decompose.js').Sequence[]>} */ (structures.get(base))
          signal?.throwIfAborted()
          choices = (function* () { for (const entry of found) yield entry.text })()
          replacementFor = text => {
            const parsed = parse(text, { open: true })
            if (parsed.problem || parsed.tree === null || paths(parsed.tree).some(p => partAt(parsed.tree, p) === null)) return undefined
            return withMarks(parsed.tree, marks)
          }
        } else if (isNode(current) && adapter.encoded && mergeable(current)) {
          const { base, marks } = splitMarks(current)
          const sequence = write(base)
          if (!encoded.has(sequence)) {
            if (lookups >= maxLookups) { cuts.add('lookups'); continue }
            lookups++
            encoded.set(sequence, adapter.encoded(sequence, { exact: true, signal }))
          }
          const found = await /** @type {Promise<string[]>} */ (encoded.get(sequence))
          signal?.throwIfAborted()
          choices = found
          replacementFor = char => {
            const parsed = parse(char, { open: true })
            if (parsed.problem || typeof parsed.tree !== 'string' || !decomposable(parsed.tree)) return undefined
            return withMarks(parsed.tree, marks)
          }
        }
      } catch (error) {
        signal?.throwIfAborted()
        if (error instanceof Error && error.name === 'AbortError') throw error
        cuts.add('lookup')
        continue
      }
      for (const choice of choices) {
        signal?.throwIfAborted()
        if (++work > maxWork) { cuts.add('work'); break outer }
        const replacement = replacementFor(choice)
        if (replacement === undefined) continue
        const next = replaceAt(tree, path, replacement)
        const text = write(next)
        if (seen.has(text)) continue
        const roundTrip = parse(text, { open: true })
        if (roundTrip.problem || JSON.stringify(identity(roundTrip.tree)) !== JSON.stringify(identity(next))) continue
        if (depth >= maxDepth) { cuts.add('depth'); continue }
        if (results >= maxResults) { cuts.add('results'); break outer }
        if (queue.length >= maxStates) { cuts.add('states'); break outer }
        seen.add(text)
        queue.push({ tree: next, depth: depth + 1 })
        results++
        yield { type: 'alternative', tree: next }
      }
    }
  }
  if (cuts.size) yield { type: 'truncated', reasons: [...cuts] }
}
