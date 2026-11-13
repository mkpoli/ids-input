// @ts-check
// The dictionary of components no code point names (`data/custom-components.json.gz`), looked up:
// what a component is, and a description with each of them written as something a composer draws.
import { isCustom } from './custom.js'
import { customsOf, isNode, leaves, parse, write } from './ids.js'

/**
 * @typedef {{ in: string, text: string, count: number, characters: string[], status: 'verified' | 'candidate', basis: 'difference' | 'inverse' }} CustomEquivalent
 * @typedef {{ text: string, kind: import('./custom.js').CustomKind, source: string, description?: string, fragment?: string,
 *   uses: number, examples: string[], subtraction?: string, draw?: string, id?: string, char?: string, equivalents: CustomEquivalent[] }} CustomComponent
 * @typedef {{ id: string, char: string, names: string[] }} CustomForm One form under its identifier, with every name and confirmed expression it has.
 * @typedef {{ format: string, version: number, components: CustomComponent[], forms?: CustomForm[] }} CustomComponentsData
 */

/**
 * @param {CustomComponentsData} data
 */
export function createCustomComponents(data) {
  if (data?.format !== 'ids-input/custom-components' || data.version !== 1) throw new Error('custom components: unknown format')
  const by = new Map(data.components.map(row => [row.text, row]))
  // A form's identifier reads as a component too: &X-00053; is whatever carries that number, the
  // first of its names that draws, else an expression no source names.
  /** @type {Map<string, string>} */
  const formDraw = new Map()
  for (const row of data.components) if (row.id && row.draw && !formDraw.has(`&${row.id};`)) formDraw.set(`&${row.id};`, row.draw)
  /** @type {Map<string, string[]>} */
  const formNames = new Map((data.forms ?? []).map(form => [`&${form.id};`, form.names]))
  /** @type {Map<string, import('./ids.js').Part>} */
  const drawn = new Map()
  /** @param {string} text @returns {import('./ids.js').Part | undefined} */
  const drawTree = text => {
    if (drawn.has(text)) return drawn.get(text)
    let draw = by.get(text)?.draw ?? formDraw.get(text)
    if (draw === undefined && formNames.has(text)) {
      // An unnamed form is its expression, where every component of that draws in turn.
      const expression = formNames.get(text)?.find(name => !by.has(name))
      const written = expression === undefined ? null : swapped(expression)
      if (written && !customsOf(parse(written.text, { open: true }).tree ?? null).length) draw = written.text
    }
    const read = draw === undefined ? null : parse(draw, { open: true })
    const tree = read && !read.problem ? read.tree : undefined
    if (tree !== undefined) drawn.set(text, tree)
    return tree
  }
  /** @type {Map<string, CustomForm>} */
  const formOf = new Map((data.forms ?? []).flatMap(form => [[`&${form.id};`, form], .../** @type {[string, CustomForm][]} */ (form.names.map(name => [name, form]))]))
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
    /** The form a name, a confirmed expression or an identifier (&X-00053;) is.
     * @param {string} text @returns {CustomForm | undefined} */
    form: text => formOf.get(text),
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
