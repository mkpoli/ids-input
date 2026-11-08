// @ts-check
import { decomposable, lookupChar } from './decompose.js'
import { isNode, partAt, parse, paths, replaceAt, splitMarks, withMarks, write } from './ids.js'
import { subtractionRemainders } from './subtraction.js'

/** @typedef {import('./ids.js').Part} Part */
/** @typedef {'results' | 'states' | 'depth' | 'work' | 'lookups' | 'lookup'} AlternativeCut */
/** @typedef {'expand' | 'merge' | 'both'} AlternativeOperation */
/** @typedef {{ type: 'alternative', tree: Part, operation: AlternativeOperation } | { type: 'truncated', reasons: AlternativeCut[] }} AlternativeEvent */

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

/** Bound one adapter call and signal it to stop on timeout or cancellation.
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} start
 * @param {AbortSignal | undefined} signal
 * @param {number} timeoutMs
 * @returns {Promise<T>} */
async function lookup(start, signal, timeoutMs) {
  signal?.throwIfAborted()
  const controller = new AbortController()
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer
  /** @type {() => void} */
  let onAbort = () => {}
  const stop = new Promise((_, reject) => {
    onAbort = () => {
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
      controller.abort(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => {
      reject(new Error('Adapter lookup timed out'))
      controller.abort()
    }, timeoutMs)
  })
  try {
    return /** @type {T} */ (await Promise.race([Promise.resolve().then(() => start(controller.signal)), stop]))
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Enumerate one-step rewrites breadth first, visiting deeper parts first, so changes to separate parts combine independently.
 * The input is excluded. Every replacement comes from structure or an exact encoded lookup; a
 * description must be complete. Notes and marks are retained, so a subtree with a note or internal
 * marks cannot be merged. Results must round-trip through IDS text without changing their tree;
 * this excludes, for example, a loose mark inside a larger description. Lookups use the literal
 * component, including any variation selector.
 *
 * Each alternative names the operations that built it from the input: 'expand' where components
 * were opened into descriptions, 'merge' where subtrees became characters, 'both' for a mix.
 * Limits bound results, retained states, rewrite distance, inspected paths/candidates and lookups. If a
 * limit excludes work, the last event reports it; stopping iteration early omits that event.
 * Failed or timed-out lookups are reported as 'lookup' and other paths continue; cancellation propagates.
 * @param {Part} part
 * @param {Pick<import('../adapter/types.js').IdsAdapter, 'structure' | 'encoded'>} adapter
 * @param {{ maxResults?: number, maxStates?: number, maxDepth?: number, maxWork?: number, maxLookups?: number, lookupTimeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {AsyncGenerator<AlternativeEvent, void, unknown>}
 */
export async function* recursiveAlternatives(part, adapter, { maxResults = 128, maxStates = 512, maxDepth = 4, maxWork = 8192, maxLookups = 64, lookupTimeoutMs = 5000, signal } = {}) {
  for (const [name, value, minimum] of /** @type {[string, number, number][]} */ ([['maxResults', maxResults, 0], ['maxStates', maxStates, 1], ['maxDepth', maxDepth, 0], ['maxWork', maxWork, 1], ['maxLookups', maxLookups, 0]])) {
    if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError(`${name} must be an integer >= ${minimum}`)
  }
  if (!Number.isSafeInteger(lookupTimeoutMs) || lookupTimeoutMs < 1 || lookupTimeoutMs > 2147483647) throw new RangeError('lookupTimeoutMs must be an integer between 1 and 2147483647')
  /** @type {{ tree: Part, depth: number, expand: boolean, merge: boolean }[]} */
  const queue = [{ tree: part, depth: 0, expand: false, merge: false }]
  const seen = new Set([write(part)])
  /** @type {Map<string, Promise<import('./decompose.js').Sequence[]>>} */
  const structures = new Map()
  /** @type {Map<string, Promise<string[]>>} */
  const encoded = new Map()
  /** @type {Set<AlternativeCut>} */
  const cuts = new Set()
  let work = 0, results = 0, lookups = 0
  /** The parsed descriptions of the characters in `part` and of theirs, a few characters deep, so a
   * subtraction can be read in one step instead of waiting for its own expansions. The structure
   * cache and lookup budget are those the expansions use.
   * @param {Part} part @param {number} [levels] @returns {Promise<Map<string, Part[]>>} */
  async function describeParts(part, levels = 3) {
    /** @type {Map<string, Part[]>} */
    const found = new Map()
    /** @type {Part[]} */
    let frontier = [part]
    for (let level = 0; level < levels && frontier.length; level++) {
      /** @type {Set<string>} */
      const characters = new Set()
      /** @param {Part} tree */
      const collect = tree => {
        if (typeof tree === 'string') {
          const base = lookupChar(tree)
          if (decomposable(base)) characters.add(base)
        } else if (tree !== null) tree.parts.forEach(collect)
      }
      for (const tree of frontier) collect(tree)
      /** @type {Part[]} */
      const next = []
      for (const base of characters) {
        if (found.has(base)) continue
        if (!structures.has(base)) {
          if (lookups >= maxLookups) { cuts.add('lookups'); break }
          lookups++
          const findStructure = adapter.structure.bind(adapter)
          structures.set(base, lookup(requestSignal => findStructure(base, { signal: requestSignal }), signal, lookupTimeoutMs))
        }
        const list = await /** @type {Promise<import('./decompose.js').Sequence[]>} */ (structures.get(base))
        signal?.throwIfAborted()
        /** @type {Part[]} */
        const parsed = []
        for (const entry of list) {
          const read = parse(entry.text, { open: true })
          if (!read.problem && read.tree !== null) parsed.push(read.tree)
        }
        found.set(base, parsed)
        next.push(...parsed)
      }
      frontier = next
    }
    return found
  }
  outer: for (let i = 0; i < queue.length; i++) {
    const { tree, depth, expand: expanded, merge: merged } = queue[i]
    for (const path of paths(tree).sort((a, b) => b.length - a.length)) {
      signal?.throwIfAborted()
      if (++work > maxWork) { cuts.add('work'); break outer }
      const current = partAt(tree, path)
      if (current === undefined || current === null) continue
      /** @type {Iterable<string>} */
      let choices = []
      /** @type {(text: string) => Part | undefined} */
      let replacementFor = () => undefined
      /** @type {'expand' | 'merge' | 'normalize' | null} */
      let step = null
      let normalized = false
      try {
        if (isNode(current) && current.op === '㇯' && !current.note && !current.marks
          && current.parts.length === 2 && current.parts[0] !== null && current.parts[1] !== null) {
          const [from, take] = current.parts
          const described = await describeParts(from)
          const remainders = subtractionRemainders(from, take, char => described.get(char) ?? [])
          if (remainders.length) {
            step = 'normalize'
            normalized = true
            choices = remainders.map(write)
            replacementFor = text => {
              const parsed = parse(text, { open: true })
              if (parsed.problem || parsed.tree === null) return undefined
              return parsed.tree
            }
          }
        }
        if (!normalized && typeof current === 'string' && decomposable(current)) {
          step = 'expand'
          const { base, marks } = splitMarks(current)
          if (typeof base !== 'string') continue
          if (!structures.has(base)) {
            if (lookups >= maxLookups) { cuts.add('lookups'); continue }
            lookups++
            structures.set(base, lookup(requestSignal => adapter.structure(base, { signal: requestSignal }), signal, lookupTimeoutMs))
          }
          const found = await /** @type {Promise<import('./decompose.js').Sequence[]>} */ (structures.get(base))
          signal?.throwIfAborted()
          choices = (function* () { for (const entry of found) yield entry.text })()
          replacementFor = text => {
            const parsed = parse(text, { open: true })
            if (parsed.problem || parsed.tree === null || paths(parsed.tree).some(p => partAt(parsed.tree, p) === null)) return undefined
            return withMarks(parsed.tree, marks)
          }
        } else if (!normalized && isNode(current) && adapter.encoded && mergeable(current)) {
          step = 'merge'
          const { base, marks } = splitMarks(current)
          const sequence = write(base)
          if (!encoded.has(sequence)) {
            if (lookups >= maxLookups) { cuts.add('lookups'); continue }
            lookups++
            const findEncoded = adapter.encoded.bind(adapter)
            encoded.set(sequence, lookup(requestSignal => findEncoded(sequence, { exact: true, signal: requestSignal }), signal, lookupTimeoutMs))
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
        if (step === null) continue
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
        const expand = expanded || step === 'expand', merge = merged || step === 'merge' || step === 'normalize'
        seen.add(text)
        queue.push({ tree: next, depth: depth + 1, expand, merge })
        results++
        yield { type: 'alternative', tree: next, operation: expand && merge ? 'both' : expand ? 'expand' : 'merge' }
      }
    }
  }
  if (cuts.size) yield { type: 'truncated', reasons: [...cuts] }
}
