// What a parse of the zi.tools IDS Extension says, read off the grammar's tree: each description's
// shape (operators and the components they join, with the workshop's paths), its tokens in reading
// order, and what each token is. The rule names are those of data/baishi-ids.ebnf.
import { KINDS, SOURCES, STROKE_LETTERS } from './baishi.js'
import { textOf } from './baishi-parser.js'

/** @typedef {import('./baishi-parser.js').ParseNode} ParseNode */
/**
 * A description's shape: an operator with its components, or one component.
 * @typedef {{ kind: 'op', node: ParseNode, op: ParseNode, modifier: ParseNode | null, path: number[], children: Shape[] }
 *   | { kind: 'leaf', node: ParseNode, part: ParseNode, variant: ParseNode | null, chain: boolean, path: number[], index: number }} Shape
 */
/**
 * A token: what it is, where it is, and the path of the place it belongs to in the shape.
 * @typedef {{ kind: 'prefix' | 'operator' | 'overlap' | 'index' | 'char' | 'chain' | 'variant' | 'tags', start: number, end: number,
 *   text: string, path: number[], operator: boolean, node: ParseNode }} Token
 */
/**
 * One description of a row.
 * @typedef {{ node: ParseNode, text: string, start: number, end: number, prefix: ParseNode | null, shape: Shape,
 *   tags: ParseNode | null, tokens: Token[], leaves: (Shape & { kind: 'leaf' })[] }} Entry
 */

/** @param {ParseNode} node @param {string} rule */
const child = (node, rule) => node.children.find(one => one.rule === rule) ?? null
/** @param {ParseNode} node @param {string} rule */
const children = (node, rule) => node.children.filter(one => one.rule === rule)
/** The first node of `rule` at or under `node`. @param {ParseNode} node @param {string} rule @returns {ParseNode | null} */
function find(node, rule) {
  if (node.rule === rule) return node
  for (const one of node.children) { const got = find(one, rule); if (got) return got }
  return null
}
/** Every node of `rule` under `node`, outermost only. @param {ParseNode} node @param {string} rule @returns {ParseNode[]} */
function all(node, rule) {
  if (node.rule === rule) return [node]
  return node.children.flatMap(one => all(one, rule))
}

const OPERATORS = new Set(['unary operator', 'binary operator', 'overlap operator', 'indexed operator', 'ternary operator'])

/**
 * A row's headword and its groups: the default descriptions, then the alternative ones.
 * @param {ParseNode} tree a `row` @param {string[]} chars
 */
export function readRow(tree, chars) {
  const head = /** @type {ParseNode} */ (child(tree, 'headword'))
  const groups = ['primary group', 'alternative group'].flatMap(rule => {
    const group = child(tree, rule)
    return group ? [{ alternative: rule === 'alternative group', entries: readGroup(group, chars) }] : []
  })
  return { headword: textOf(head, chars), groups }
}

/** The descriptions of a group. @param {ParseNode} group @param {string[]} chars */
export const readGroup = (group, chars) => children(group, 'entry').map(entry => readEntry(entry, chars))

/** @param {ParseNode} entry @param {string[]} chars @returns {Entry} */
export function readEntry(entry, chars) {
  /** @type {Token[]} */
  const tokens = []
  /** @type {(Shape & { kind: 'leaf' })[]} */
  const leaves = []
  /** @param {Token['kind']} kind @param {ParseNode} node @param {number[]} path @param {boolean} [operator] */
  const add = (kind, node, path, operator = false) => tokens.push({ kind, start: node.start, end: node.end, text: textOf(node, chars), path, operator, node })
  const prefix = child(entry, 'uniqueness prefix')
  if (prefix) add('prefix', prefix, [])

  /** @param {ParseNode} node an `ids` or a `component` @param {number[]} path @returns {Shape} */
  function shape(node, path) {
    const inner = node.rule === 'component' ? child(node, 'ids') : node
    if (inner) {
      const chain = child(inner, 'stroke chain')
      if (chain) return leaf(node, chain, null, true, path)
      const op = /** @type {ParseNode} */ (inner.children.find(one => one.rule && OPERATORS.has(one.rule)))
      add('operator', op, path, true)
      const modifier = child(inner, 'overlap modifier') ?? child(inner, 'index modifier')
      if (modifier) add(modifier.rule === 'overlap modifier' ? 'overlap' : 'index', modifier, path, true)
      return { kind: 'op', node: inner, op, modifier, path, children: children(inner, 'component').map((one, i) => shape(one, [...path, i])) }
    }
    const part = node.children[0]
    return leaf(node, part, child(node, 'component variant'), false, path)
  }
  /** @param {ParseNode} node @param {ParseNode} part @param {ParseNode | null} variant @param {boolean} chain @param {number[]} path */
  function leaf(node, part, variant, chain, path) {
    add(chain ? 'chain' : 'char', part, path)
    if (variant) add('variant', variant, path)
    /** @type {Shape & { kind: 'leaf' }} */
    const one = { kind: 'leaf', node, part, variant, chain, path, index: leaves.length }
    leaves.push(one)
    return one
  }
  const top = shape(/** @type {ParseNode} */ (child(entry, 'ids')), [])
  const tags = child(entry, 'sequence variants')
  if (tags) add('tags', tags, [])
  return { node: entry, text: textOf(entry, chars), start: entry.start, end: entry.end, prefix, shape: top, tags, tokens, leaves }
}

/**
 * The structural places of an entry in preorder, for the scope lines: an operator with its
 * bracket, or a component with its identifier. Each names the tokens that make it.
 * @param {Token[]} tokens @returns {{ path: number[], text: string, members: number[] }[]}
 */
export function places(tokens) {
  /** @type {Map<string, { path: number[], text: string, members: number[] }>} */
  const out = new Map()
  tokens.forEach((token, index) => {
    if (token.kind === 'prefix' || token.kind === 'tags') return
    const key = token.path.join('.')
    const place = out.get(key)
    if (place) place.members.push(index)
    else out.set(key, { path: token.path, text: token.text, members: [index] })
  })
  return [...out.values()]
}

/**
 * What a variant identifier is: its kind by the first pattern it matches, and its parts.
 * @param {string} id
 */
export function readVariant(id) {
  const kind = KINDS.find(([, pattern]) => new RegExp(pattern, 'u').test(id))?.[0] ?? 'style'
  if (kind === 'source' || kind === 'wildcard') {
    const [, source, region] = /** @type {readonly [string, string, string]} */ (SOURCES.find(([letter]) => letter === id))
    return { kind, id, source, region }
  }
  if (kind === 'imaginary') return { kind, id, rules: id.slice(2).match(/\d{3}(?:z[a-z]|[a-z])?/gu) ?? [] }
  if (kind === 'ucv') {
    const [, lead, rule, glyph, suffix] = /** @type {RegExpExecArray} */ (/^([qpxy])(\d{3}(?:z[a-z]|[a-z])?)([1-9]|\d{2})([xy]?)$/u.exec(id))
    return { kind, id, lead, rule, glyph, suffix }
  }
  return { kind, id, letters: [...id] }
}

/** The identifiers of a `sequence variants` or `component variant` node. @param {ParseNode} node @param {string[]} chars */
export const variantIds = (node, chars) => all(node, 'variant id').map(one => textOf(one, chars))

/**
 * A stroke chain's parts: each stroke, reversed or not, with what follows it; and whether the chain
 * closes.
 * @param {ParseNode} chain @param {string[]} chars
 */
export function readChain(chain, chars) {
  const parts = children(chain, 'stroke part').map(part => {
    const stroke = /** @type {ParseNode} */ (child(part, 'stroke'))
    const letter = child(stroke, 'stroke letter')
    const crossing = child(part, 'crossing')
    return {
      start: part.start, end: part.end,
      reversed: Boolean(child(part, 'reversal')),
      stroke: textOf(stroke, chars),
      letter: letter ? readLetter(textOf(letter, chars)) : null,
      crosses: crossing ? Number(textOf(/** @type {ParseNode} */ (child(crossing, 'number')), chars)) : null,
      broken: Boolean(child(part, 'break')),
    }
  })
  const last = chain.children.at(-2)
  return { parts, closed: Boolean(last && last.rule === null && textOf(last, chars) === 'z') }
}

/**
 * A stroke letter: the base letter and its marks. `SHwg` is S with a rounded turn into the
 * horizontal and a hook; `Wg` and `Qa`–`Qd` are letters of their own.
 * @param {string} text
 */
export function readLetter(text) {
  const base = text === 'Wg' || text.startsWith('Q') ? text : text[0]
  const rest = text.slice(base.length)
  const row = STROKE_LETTERS.find(([letter]) => letter === base)
  return { text, base, stroke: row?.[1] ?? '', rounded: rest.startsWith('Hw'), hook: rest.endsWith('g') }
}

/**
 * An overlap bracket: one specification, or a forward and a reverse one after `|`. A specification
 * is a quick slice (its two bounds, absent where left out) or a crossing matrix (its rows of cells).
 * @param {ParseNode} modifier @param {string[]} chars
 */
export function readOverlap(modifier, chars) {
  return children(modifier, 'overlap spec').map(spec => {
    const slice = child(spec, 'slice')
    if (slice) {
      const [before, after] = (() => {
        const colon = slice.children.findIndex(one => one.rule === null)
        const bound = (/** @type {ParseNode | undefined} */ one) => one?.rule === 'slice bound' ? textOf(one, chars) : null
        return [bound(slice.children[colon - 1]), bound(slice.children[colon + 1])]
      })()
      return { kind: /** @type {const} */ ('slice'), top: before, bottom: after }
    }
    return { kind: /** @type {const} */ ('matrix'), rows: textOf(spec, chars).split(',').map(row => [...row]) }
  })
}

/** The number in an index bracket. @param {ParseNode} modifier @param {string[]} chars */
export const readIndex = (modifier, chars) => Number(textOf(/** @type {ParseNode} */ (child(modifier, 'number')), chars))

/**
 * A uniqueness prefix: the abstract shape it names, whether it marks a far source form (with its
 * digit), and the source it is limited to.
 * @param {ParseNode} prefix @param {string[]} chars
 */
export function readPrefix(prefix, chars) {
  const text = textOf(prefix, chars).slice(1, -1)
  const char = textOf(/** @type {ParseNode} */ (child(prefix, 'taggable char')), chars)
  const source = child(prefix, 'source letter')
  return { char, far: text.startsWith('?'), digit: /^\?(\d)/u.exec(text)?.[1] ?? '', source: source ? textOf(source, chars) : '' }
}

/** What kind of character a component is. @param {ParseNode} part @returns {'hanzi' | 'stroke' | 'curve' | 'kana'} */
export function charKind(part) {
  if (find(part, 'hanzi')) return 'hanzi'
  if (find(part, 'cjk stroke')) return 'stroke'
  if (find(part, 'curve')) return 'curve'
  return 'kana'
}
