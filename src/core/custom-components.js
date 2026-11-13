// @ts-check
// The dictionary of components no code point names (`data/custom-components.json.gz`), looked up:
// what a component is, and a description with each of them written as something a composer draws.
import { isCustom } from './custom.js'
import { isNode, leaves, parse, write } from './ids.js'

/**
 * @typedef {{ in: string, text: string, count: number, characters: string[], status: 'verified' | 'candidate', basis: 'difference' | 'inverse' }} CustomEquivalent
 * @typedef {{ text: string, kind: import('./custom.js').CustomKind, source: string, description?: string, fragment?: string,
 *   uses: number, examples: string[], subtraction?: string, draw?: string, equivalents: CustomEquivalent[] }} CustomComponent
 * @typedef {{ format: string, version: number, components: CustomComponent[] }} CustomComponentsData
 */

/**
 * @param {CustomComponentsData} data
 */
export function createCustomComponents(data) {
  if (data?.format !== 'ids-input/custom-components' || data.version !== 1) throw new Error('custom components: unknown format')
  const by = new Map(data.components.map(row => [row.text, row]))
  /** @type {Map<string, import('./ids.js').Part>} */
  const drawn = new Map()
  /** @param {string} text @returns {import('./ids.js').Part | undefined} */
  const drawTree = text => {
    if (drawn.has(text)) return drawn.get(text)
    const draw = by.get(text)?.draw
    const read = draw === undefined ? null : parse(draw, { open: true })
    const tree = read && !read.problem ? read.tree : undefined
    if (tree !== undefined) drawn.set(text, tree)
    return tree
  }
  /** @param {string} text @returns {{ text: string, leaves: number[] }} */
  const swapped = text => {
    const read = /[{&#]/.test(text) ? parse(text, { open: true }) : null
    if (!read || read.problem) return { text, leaves: [] }
    /** @type {number[]} */
    const from = []
    let place = 0
    /** @param {import('./ids.js').Part} part @returns {import('./ids.js').Part} */
    const swap = part => {
      if (isNode(part)) return { ...part, parts: part.parts.map(swap) }
      const drawn = part !== null && isCustom(part) ? drawTree(part) ?? part : part
      for (let k = leaves(drawn).length; k > 0; k--) from.push(place)
      place++
      return drawn
    }
    const tree = swap(read.tree)
    return { text: write(tree), leaves: from }
  }
  return {
    /** Every component, the most used of each source first. */
    components: data.components,
    /** One component by its text. @param {string} text @returns {CustomComponent | undefined} */
    get: text => by.get(text),
    /**
     * `text` with each custom component written as what draws it: a character, a private-use glyph
     * or a description. A component with nothing to draw it stays as it is, as does a text that
     * does not read.
     * @param {string} text @returns {string}
     */
    drawable: text => swapped(text).text,
    /**
     * The same, with where each component of the answer comes from: `leaves[i]` is the place, in
     * reading order, of the component of `text` that the answer's component `i` draws. A custom
     * component drawn by a description gives several places the same number.
     * @param {string} text @returns {{ text: string, leaves: number[] }}
     */
    drawableLeaves: text => swapped(text),
  }
}
