// @ts-check
// The dictionary of components no code point names (`data/custom-components.json.gz`), looked up:
// what a component is, and a description with each of them written as something a composer draws.
import { isCustom } from './custom.js'
import { isNode, parse, write } from './ids.js'

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
    drawable(text) {
      if (!/[{&#]/.test(text)) return text
      const read = parse(text, { open: true })
      if (read.problem) return text
      /** @param {import('./ids.js').Part} part @returns {import('./ids.js').Part} */
      const swap = part => isNode(part) ? { ...part, parts: part.parts.map(swap) }
        : part !== null && isCustom(part) ? drawTree(part) ?? part : part
      return write(swap(read.tree))
    },
  }
}
