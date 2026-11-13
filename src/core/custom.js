// @ts-check
// Components no code point names, as three IDS tables write them. Each is one component of a
// description, kept in its source's own spelling:
//
// - `{53}`: a numbered component of BabelStone IDS (IDS.TXT note 6), the outside of 鸟.
// - `&CDP-8BD0;`: an entity reference of CHISE IDS, a glyph of the CHISE character ontology.
// - `#(-𠃌㇉)`: a stroke chain of zi.tools (白式 IDS §5), strokes written in order and joined.
//
// Sources: Andrew West, IDS.TXT, <https://www.babelstone.co.uk/CJK/IDS.TXT>; CHISE IDS,
// <https://gitlab.chise.org/CHISE/ids>; NightFurySL2001, （白式）IDS 延展语法导论,
// <https://nightfurysl2001.github.io/bai-ids/>, and its `yiids.ebnf`.

/** @typedef {'numbered' | 'entity' | 'chain'} CustomKind */

/** The longest custom component, in code points. */
const LONGEST = 48
const NUMBER = /^[0-9]{1,4}$/
const ENTITY = /^[A-Za-z][A-Za-z0-9+_-]*$/
/** A chain's contents: strokes and the characters that stand for them, stroke letters, the reversal
 * sign, crossing indexes. Brackets, spaces and the other notations' delimiters end no chain. */
const CHAIN = /^[^\s()[\]{}#&;]+$/u

/** @type {ReadonlyArray<readonly [CustomKind, string, string, RegExp]>} */
const FORMS = [
  ['numbered', '{', '}', NUMBER],
  ['entity', '&', ';', ENTITY],
  ['chain', '#(', ')', CHAIN],
]

/**
 * The custom component that starts at `chars[at]`, and where it ends, or null where none starts
 * there.
 * @param {string[]} chars @param {number} [at]
 * @returns {{ text: string, kind: CustomKind, end: number } | null}
 */
export function customAt(chars, at = 0) {
  for (const [kind, open, close, inside] of FORMS) {
    if (chars[at] !== open[0] || (open.length > 1 && chars[at + 1] !== open[1])) continue
    const start = at + open.length
    const end = chars.indexOf(close, start)
    if (end < 0 || end - at > LONGEST) return null
    const body = chars.slice(start, end).join('')
    return inside.test(body) ? { text: open + body + close, kind, end: end + 1 } : null
  }
  return null
}

/** How many UTF-16 units the custom component at `text[at]` takes, 0 where none starts there.
 * @param {string} text @param {number} [at] @returns {number} */
export function customLength(text, at = 0) {
  if (text[at] !== '{' && text[at] !== '&' && text[at] !== '#') return 0
  return customAt([...text.slice(at, at + LONGEST * 2 + 4)])?.text.length ?? 0
}

/**
 * Which notation a component is written in, or null for a character.
 * @param {string | null | undefined} component @returns {CustomKind | null}
 */
export function customKind(component) {
  const chars = [...(component ?? '')]
  const found = customAt(chars)
  return found && found.end === chars.length ? found.kind : null
}

/** The text a component is looked up by: a custom component whole, a character without what
 * follows it. @param {string | null | undefined} component @returns {string} */
export const customOrFirst = component => customKind(component) !== null ? /** @type {string} */ (component) : [...(component ?? '')][0] ?? ''

/** Whether a component is a custom one. @param {string | null | undefined} component */
export const isCustom = component => customKind(component) !== null
