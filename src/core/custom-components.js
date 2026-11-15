// @ts-check
// The dictionary of components no code point names (`data/custom-components.json.gz`), looked up:
// what a component is, and a description with each of them written as something a composer draws.
import { isCustom } from './custom.js'
import { customsOf, isNode, leaves, parse, write } from './ids.js'

/**
 * @typedef {{ in: string, text: string, count: number, characters: string[], status: 'verified' | 'candidate', basis: 'difference' | 'inverse' }} CustomEquivalent
 * @typedef {{ text: string, kind: import('./custom.js').CustomKind, source: string, description?: string, fragment?: string,
 *   uses: number, examples: string[], subtractions?: string[], character?: CustomCharacter, draw?: string, drawApproximate?: boolean, id?: string, char?: string, equivalents: CustomEquivalent[] }} CustomComponent
 * @typedef {{ text: string, char: string, variant?: string, in: string, basis: 'editorial' }} CustomCharacter The encoded character a component is read as a form of, in the notation of `in` (𢎘z); `editorial` marks a reading no table states.
 * @typedef {{ id: string, char: string, names: string[] }} CustomForm One form under its identifier, with every name and confirmed expression it has.
 * @typedef {{ format: string, version: number, components: CustomComponent[], forms?: CustomForm[] }} CustomComponentsData
 * @typedef {{ text: string, id?: string, description?: string, names: { text: string, source: string | null, editorial?: boolean }[], subtractions: string[] }} CustomPart
 *   One component with the other ways its form is written: each table's name for it (`source`), the
 *   expressions two or more characters confirm (no `source`), the character it is read as a form
 *   of (`editorial`), and the subtractions that name it.
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
  // A form written as a character less its other parts: ㇯馬灬 for {51}.
  /** @type {Map<string, string>} */
  const subtracted = new Map()
  for (const row of data.components) for (const written of row.subtractions ?? []) if (row.id && !subtracted.has(written)) subtracted.set(written, `&${row.id};`)
  /** `part` with each subtraction that names a form written as that form's identifier, innermost
   * first. @param {import('./ids.js').Part} part @returns {import('./ids.js').Part} */
  const named = part => {
    if (!isNode(part)) return part
    const inner = { ...part, parts: part.parts.map(named) }
    return inner.op === '㇯' ? subtracted.get(write(inner)) ?? inner : inner
  }
  /** @type {Map<string, CustomForm>} */
  const formOf = new Map((data.forms ?? []).flatMap(form => [[`&${form.id};`, form], .../** @type {[string, CustomForm][]} */ (form.names.map(name => [name, form]))]))
  // What draws a component may stand in for its shape without being it: the one glyph of the
  // character it is read as a form of.
  /** @type {Set<string>} */
  const loose = new Set(data.components.filter(row => row.drawApproximate).flatMap(row => [row.text, ...(row.id && formDraw.get(`&${row.id};`) === row.draw ? [`&${row.id};`] : [])]))
  /** @param {string} text @returns {{ text: string, leaves: number[], approximate?: string[] }} */
  const swapped = text => {
    const read = /[{&#㇯]/.test(text) ? parse(text, { open: true }) : null
    if (!read || read.problem) return { text, leaves: [] }
    /** @type {number[]} */
    const from = []
    /** @type {string[]} */
    const approximate = []
    /** @param {string} name */
    const noted = name => { if (loose.has(name) && !approximate.includes(name)) approximate.push(name) }
    let place = 0
    /** @param {import('./ids.js').Part} part @returns {import('./ids.js').Part} */
    const swap = part => {
      // A subtraction that names a form draws as the form: its two parts are one place.
      const form = isNode(part) && part.op === '㇯' ? subtracted.get(write(part)) : undefined
      if (form !== undefined && isNode(part)) {
        const drawn = drawTree(form)
        if (drawn !== undefined) {
          noted(form)
          for (let k = leaves(drawn).length; k > 0; k--) from.push(place)
          place += leaves(part).length
          return drawn
        }
      }
      if (isNode(part)) return { ...part, parts: part.parts.map(swap) }
      const drawn = part !== null && isCustom(part) ? drawTree(part) ?? part : part
      if (part !== null && drawn !== part) noted(part)
      for (let k = leaves(drawn).length; k > 0; k--) from.push(place)
      place++
      return drawn
    }
    const tree = swap(read.tree)
    return { text: write(tree), leaves: from, ...(approximate.length ? { approximate } : {}) }
  }
  /** @type {Map<string, string[]>} */
  const formSubtractions = new Map()
  for (const row of data.components) {
    if (!row.id || !row.subtractions?.length) continue
    const list = formSubtractions.get(row.id) ?? []
    for (const written of row.subtractions) if (subtracted.get(written) === `&${row.id};` && !list.includes(written)) list.push(written)
    formSubtractions.set(row.id, list)
  }
  return {
    /**
     * A component, or a form's identifier, with the other ways the same form is written. Undefined
     * for a text the dictionary does not hold.
     * @param {string} text @returns {CustomPart | undefined}
     */
    describe(text) {
      const row = by.get(text), form = formOf.get(text)
      if (!row && !form) return undefined
      const id = form?.id ?? row?.id
      /** @type {CustomPart['names']} */
      const names = (form?.names ?? []).filter(name => name !== text).map(name => ({ text: name, source: by.get(name)?.source ?? null }))
      const read = [row, ...(form?.names ?? []).map(name => by.get(name))].map(one => one?.character).find(Boolean)
      if (read && read.text !== text && !names.some(name => name.text === read.text)) names.push({ text: read.text, source: read.in, editorial: true })
      const description = row?.description ?? form?.names.map(name => by.get(name)?.description).find(Boolean)
      // The shortest subtractions first: one part taken from a common character reads soonest.
      const subtractions = [...(id ? formSubtractions.get(id) ?? [] : [])].sort((a, b) => [...a].length - [...b].length)
      return { text, ...(id ? { id } : {}), ...(description ? { description } : {}), names, subtractions }
    },
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
     * `text` with each subtraction that names a form written as the form's identifier: ㇯馬灬 as
     * &X-00051;, ⿰木㇯鸟一 as ⿰木&X-00053;. A text that does not read, or names none, is answered
     * as it is.
     * @param {string} text @returns {string}
     */
    normalize(text) {
      if (!text.includes('㇯')) return text
      const read = parse(text, { open: true })
      if (read.problem) return text
      const next = named(read.tree)
      // Nothing named: the text as it was typed, slots unwritten and all.
      return write(next) === write(read.tree) ? text : write(next)
    },
    /** The subtractions that name a form, each with the form's identifier as a component. */
    subtractions: subtracted,
    /**
     * The same, with where each component of the answer comes from: `leaves[i]` is the place, in
     * reading order, of the component of `text` that the answer's component `i` draws. A custom
     * component drawn by a description gives several places the same number. `approximate` names
     * the components drawn by something that only stands in for their shape.
     * @param {string} text @returns {{ text: string, leaves: number[], approximate?: string[] }}
     */
    drawableLeaves: text => swapped(text),
  }
}
