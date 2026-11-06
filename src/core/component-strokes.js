// @ts-check
// The stroke count a description draws: its components' own counts added up, a component used
// twice adding twice. An empty slot or ？ leaves the total unknown, and so does a component without
// a recorded count. Loose marks and a variation selector belong to the component, not to its count.
import { UNKNOWN, isSelector, leaves } from './ids.js'
import { withoutMarks } from './marks.js'

/**
 * The components a description draws, the strokes they add up to, and whether every part is
 * filled. `strokes` is null unless every component has a recorded count; `filled` is false while
 * an empty slot or ？ stands in the description.
 * @param {import('./ids.js').Part} tree
 * @param {(char: string) => number | null | undefined} count
 * @returns {{ components: number, strokes: number | null, filled: boolean }}
 */
export function componentStrokes(tree, count) {
  let components = 0, total = 0, complete = true, filled = true
  for (const { char } of leaves(tree)) {
    if (typeof char !== 'string' || char === UNKNOWN) { complete = false; filled = false; continue }
    components++
    const base = withoutMarks(char)
    if (typeof base !== 'string') { complete = false; continue }
    const chars = [...base]
    while (chars.length > 1 && isSelector(chars[chars.length - 1])) chars.pop()
    const strokes = count(chars.join(''))
    if (strokes == null) complete = false
    else total += strokes
  }
  return { components, strokes: complete && components > 0 ? total : null, filled }
}

/**
 * The count the output shows. A single component is its own character; a description that names an
 * encoded character uses the count they agree on; otherwise the components are added up and marked
 * approximate. Null while the description has an empty slot or no component.
 * @param {import('./ids.js').Part} tree
 * @param {(char: string) => number | null | undefined} count
 * @param {(number | null)[]} [encoded] The recorded count of each encoded character, null where none.
 * @returns {{ components: number, strokes: number | null, approximate: boolean } | null}
 */
export function characterStrokes(tree, count, encoded = []) {
  const counted = componentStrokes(tree, count)
  if (!counted.filled || counted.components === 0) return null
  const known = encoded.filter(strokes => strokes != null)
  let recorded = null
  if (counted.components === 1 && counted.strokes !== null) recorded = counted.strokes
  else if (encoded.length > 0 && known.length === encoded.length && known.every(strokes => strokes === known[0])) recorded = known[0]
  const strokes = recorded ?? counted.strokes
  return { components: counted.components, strokes, approximate: strokes !== null && recorded === null }
}
