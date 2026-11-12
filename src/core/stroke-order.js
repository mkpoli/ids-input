// @ts-check
// Finding a part by the strokes it is written with. A part's order is one or more codes of the
// five stroke classes, a letter each (h 横, s 豎, p 撇, n 點, z 折), as `data/stroke-orders.json.gz`
// records them; what is typed is the start of a code.

/** The five classes in their traditional order, each with the CJK stroke that stands for it. */
export const STROKE_KEYS = /** @type {const} */ ([
  { letter: 'h', stroke: '㇐' }, { letter: 's', stroke: '㇑' }, { letter: 'p', stroke: '㇒' },
  { letter: 'n', stroke: '㇔' }, { letter: 'z', stroke: '㇕' },
])

/**
 * How many strokes the part is written with when one of its codes starts with `typed`: the length
 * of the shortest such code, so a part written exactly as typed gives `typed.length`. Null when no
 * code starts that way.
 * @param {readonly string[] | undefined} codes
 * @param {string} typed
 * @returns {number | null}
 */
export function strokesFrom(codes, typed) {
  let found = null
  for (const code of codes ?? []) if (code.startsWith(typed) && (found === null || code.length < found)) found = code.length
  return found
}

/**
 * The parts whose order starts with `typed`, fewest strokes first; parts of one count keep the
 * order they came in.
 * @template {{ part: string }} T
 * @param {readonly T[]} parts
 * @param {Map<string, string[]>} orders
 * @param {string} typed
 * @returns {{ part: T, strokes: number }[]}
 */
export function findByStrokes(parts, orders, typed) {
  const found = []
  for (const part of parts) {
    const strokes = strokesFrom(orders.get(part.part), typed)
    if (strokes !== null) found.push({ part, strokes })
  }
  return found.sort((a, b) => a.strokes - b.strokes)
}

/**
 * The letters some part goes on with after `typed`.
 * @param {Iterable<{ part: string }>} parts
 * @param {Map<string, string[]>} orders
 * @param {string} typed
 * @returns {Set<string>}
 */
export function nextStrokes(parts, orders, typed) {
  const next = new Set()
  for (const part of parts) for (const code of orders.get(part.part) ?? []) {
    if (code.length > typed.length && code.startsWith(typed)) next.add(code[typed.length])
  }
  return next
}
