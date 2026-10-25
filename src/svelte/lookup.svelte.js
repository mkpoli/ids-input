// What an adapter answered for each character met so far, shared by the editor and "Take parts
// from": its descriptions (or that they are loading or failed), and the components that can stand in
// place of each component in them. Each character is asked once, again only after a failure.
import { lookupChar, decomposable, variants } from '../core/decompose.js'
import { leaves } from '../core/ids.js'

/**
 * @typedef {import('../adapter/types.js').IdsAdapter} IdsAdapter
 * @typedef {import('../adapter/types.js').Swap} Swap
 * @typedef {import('../core/decompose.js').Entry} Entry
 */

/** The most swaps asked for at once after a character's descriptions load. */
const SWAP_PARTS = 16

/** @param {() => IdsAdapter} adapter */
export function createLookup(adapter) {
  /** @type {Record<string, Entry>} */
  let known = $state({})
  /** @type {Record<string, Swap[]>} */
  let swaps = $state({})
  /** @type {Map<string, Promise<Entry | null>>} */
  const asking = new Map()
  /** @type {Set<string>} */
  const swapping = new Set()

  /** The components that can stand in place of `part`, asked once. @param {string} part */
  function swapsOf(part) {
    const c = lookupChar(part), ask = adapter().variants
    if (!ask || !c || swapping.has(c)) return
    swapping.add(c)
    ask(c).then(found => { if (found?.length) swaps = { ...swaps, [c]: found } }, () => swapping.delete(c))
  }

  /**
   * A character's descriptions, asked once; with `again`, asked again after a failure.
   * @param {string} c
   * @param {{ again?: boolean }} [options]
   * @returns {Promise<Entry | null>}
   */
  function read(c, { again = false } = {}) {
    if (!c) return Promise.resolve(null)
    const had = asking.get(c)
    if (had && !(again && known[c]?.status === 'failed')) return had
    known = { ...known, [c]: { status: 'loading' } }
    const asked = adapter().structure(c).then(sequences => {
      /** @type {Entry} */
      const entry = { status: 'ready', sequences: sequences ?? [] }
      known = { ...known, [c]: entry }
      swapsOf(c)
      const parts = variants(entry).flatMap(found => found.tree ? leaves(found.tree).map(leaf => leaf.char) : [])
      for (const part of [...new Set(parts)].filter(decomposable).slice(0, SWAP_PARTS)) swapsOf(part)
      return entry
    }, () => {
      /** @type {Entry} */
      const entry = { status: 'failed' }
      known = { ...known, [c]: entry }
      return entry
    })
    asking.set(c, asked)
    return asked
  }

  return {
    get known() { return known },
    get swaps() { return swaps },
    read,
    swapsOf,
  }
}

/** @typedef {ReturnType<typeof createLookup>} Lookup */
