// @ts-check
// The recursive alternatives of an editor's chosen part, searched once per part and shared by every
// list that shows them (the part tools, the character card, the field's selection panel). A list
// asks for them with `load`; asking again for the same part and depth costs nothing. `more` searches
// deeper, with every limit doubled per step.
import { untrack } from 'svelte'
import { write } from '../core/ids.js'
import { recursiveAlternatives } from '../core/recursive-alternatives.js'

/** @typedef {{ text: string, tree: import('../core/ids.js').Part, operation: import('../core/recursive-alternatives.js').AlternativeOperation }} Alternative */

/**
 * @param {() => { at: import('../core/ids.js').Path | null, part: import('../core/ids.js').Part | undefined, adapter: import('../adapter/types.js').IdsAdapter }} source
 */
export function createAlternatives(source) {
  /** @type {Alternative[]} */
  let found = $state.raw([])
  let truncated = $state(false), failed = $state(false), loading = $state(false)
  /** The part the results belong to, read by every getter, and how deep its search has gone. */
  let key = $state(''), depth = -1
  let wanted = $state(0)
  /** @type {AbortController | null} */
  let controller = null
  /** @type {import('../adapter/types.js').IdsAdapter | null} */
  let asked = null

  const current = () => {
    const { at, part } = source()
    return at && part !== null && part !== undefined ? `${at.join('.')}\u0000${write(part)}` : ''
  }

  function load() {
    const { at, part, adapter } = source()
    const next = current(), level = wanted
    untrack(() => {
      if (next !== key || adapter !== asked) {
        controller?.abort()
        controller = null
        key = next; asked = adapter; depth = -1
        found = []; truncated = false; failed = false; loading = false
        if (wanted !== 0) { wanted = 0; return }
      }
      if (!next || !at || part === null || part === undefined || level <= depth) return
      depth = level
      controller?.abort()
      const signal = (controller = new AbortController()).signal
      loading = true
      ;(async () => {
        const scale = 2 ** level, seen = new Set(found.map(option => option.text))
        let cut = false, lost = false
        try {
          for await (const result of recursiveAlternatives(part, adapter, {
            signal, maxResults: 128 * scale, maxStates: 512 * scale,
            maxDepth: 4 + 2 * level, maxWork: 8192 * scale, maxLookups: 64 * scale,
          })) {
            if (signal.aborted) return
            if (result.type === 'alternative') {
              const text = write(result.tree)
              if (!seen.has(text)) { seen.add(text); found = [...found, { text, tree: result.tree, operation: result.operation }] }
            } else { cut = result.reasons.some(reason => reason !== 'lookup'); lost = result.reasons.includes('lookup') }
          }
          truncated = cut; failed = lost
        } catch { if (!signal.aborted) failed = true }
        finally { if (!signal.aborted) loading = false }
      })()
    })
  }

  return {
    /** What the search has found for the chosen part so far. */
    get found() { return current() === key ? found : [] },
    get truncated() { return current() === key && truncated },
    get failed() { return current() === key && failed },
    get loading() { return current() === key && loading },
    /** How many times the search has been widened for this part. */
    get level() { return wanted },
    load,
    more() { if (!loading) wanted += 1 },
  }
}

/** @typedef {ReturnType<typeof createAlternatives>} Alternatives */
