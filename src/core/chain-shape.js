// @ts-check
// A zi.tools stroke chain drawn as the line it describes: each stroke starts where the last ended,
// in the direction its name gives, and the whole is fitted to a square. It is a diagram of the
// chain, not a glyph: a stroke's length and angle are a convention here, the same for every chain.
// Notation: NightFurySL2001, （白式）IDS 延展语法导论 §5, <https://nightfurysl2001.github.io/bai-ids/>.
import { STROKE_CHAINS } from '@han-compose/composer/tree'

/** A stroke letter as a step of the pen, y down. H 横, S 竖, P 撇, N 捺, D 点, T 提, J 提捺, Z leftward,
 * W 弯; Qa to Qd the four quarter circles, clockwise from the upper right. */
const STEP = /** @type {Record<string, [number, number]>} */ ({
  H: [1, 0], S: [0, 1], P: [-0.55, 0.9], N: [0.7, 0.8], D: [0.3, 0.4], T: [0.55, -0.3], Z: [-1, 0], W: [0.12, 1],
  Qa: [0.5, 0.5], Qb: [-0.5, 0.5], Qc: [-0.5, -0.5], Qd: [0.5, -0.5],
})
/** Where a quarter circle bends, as a share of its step: it leaves along one axis and arrives
 * along the other. */
const BEND = /** @type {Record<string, [number, number]>} */ ({ Qa: [0.5, 0], Qb: [0, 0.5], Qc: [-0.5, 0], Qd: [0, -0.5] })
/** The hook a stroke ends in, by the letter it follows. */
const HOOK = /** @type {Record<string, [number, number]>} */ ({ H: [-0.12, 0.25], Hw: [0, -0.32], S: [-0.25, -0.18], W: [-0.25, -0.18], P: [0.2, -0.12], N: [0.04, -0.28] })

/** The letters of each stroke a chain may name by its character: 𠃍 as HS. */
const LETTERS = new Map(Object.entries(STROKE_CHAINS).filter(([chain]) => /^[A-Za-z]+$/.test(chain)).map(([chain, char]) => [char, chain]))
// Strokes the chains use that the grammar's table leaves out, by their Unicode names (U+31C0..).
for (const [char, letters] of /** @type {[string, string][]} */ ([['㇆', 'HSg'], ['㇕', 'HS'], ['㇖', 'Hg'], ['㇗', 'SH'], ['㇙', 'ST'], ['㇚', 'Sg'], ['㇛', 'PD'], ['㇜', 'PH'], ['㇞', 'SHS'], ['㇟', 'SHwg'], ['㇠', 'HPHwg'], ['㇡', 'HSHSg'], ['㇐', 'H'], ['㇑', 'S'], ['㇒', 'P'], ['㇔', 'D'], ['㇏', 'N'], ['㇓', 'SP'], ['㇃', 'N'], ['◝', 'Qa'], ['◞', 'Qb'], ['◟', 'Qc'], ['◜', 'Qd']])) {
  if (!LETTERS.has(char)) LETTERS.set(char, letters)
}
/** One stroke written in letters, as the grammar gives it: HPHwg is H, then PHwg. */
const UNIT = /^(?:[SP]Hwg?|[HSPN]g?|[DTJZ]|Wg|Q[abcd])/

/** @typedef {[number, number] | [number, number, number, number]} Step A step of the pen, and for a curve where it bends. */
/** The steps of one stroke written in letters, or null where a letter is none.
 * @param {string} letters @returns {Step[] | null} */
function steps(letters) {
  /** @type {Step[]} */
  const out = []
  let last = ''
  for (let at = 0; at < letters.length; at++) {
    const two = letters.slice(at, at + 2)
    if (BEND[two]) { out.push([...STEP[two], ...BEND[two]]); last = two; at++; continue }
    const one = letters[at]
    // SHw and PHw round the join into H. Keep both endpoints so the next
    // stroke starts in the same place as it would after the angular form.
    if ((one === 'S' || one === 'P') && letters.startsWith('Hw', at + 1)) {
      const [dx, dy] = STEP[one]
      const radius = 0.5
      out.push([dx * (1 - radius), dy * (1 - radius)],
        [dx * radius + radius, dy * radius, dx * radius, dy * radius],
        [1 - radius, 0])
      last = 'Hw'
      at += 2
      continue
    }
    // ㇝ (提捺): lift toward the right before sweeping down into the na.
    if (one === 'J') {
      out.push([0.28, -0.12], [0.62, 0.57, 0.13, 0.45])
      last = one
      continue
    }
    if (one === 'g') { if (HOOK[last]) out.push(HOOK[last]); continue }
    if (!STEP[one]) return null
    out.push(STEP[one])
    last = one
  }
  return out
}

/** A stroke of a chain as written (`back` for a leading `-`, `mark` its `xN` or `b`) and the points
 * the pen reaches, the first being where the stroke starts; a curve's point carries where it bends.
 * @typedef {{ back: boolean, stroke: string, mark: string, points: number[][] }} Walked */
/**
 * A chain walked stroke by stroke, before it is fitted to the square; null where the text is no
 * chain or names a stroke this does not know.
 * @param {string} chain @returns {{ strokes: Walked[], closed: boolean } | null}
 */
function walk(chain) {
  const body = /^#\((.*)\)$/su.exec(chain)?.[1] ?? chain
  const chars = [...body]
  /** @type {Walked[]} */
  const strokes = []
  let x = 0, y = 0, closed = false
  for (let at = 0; at < chars.length; at++) {
    let char = chars[at], back = false
    if (char === '-') { back = true; char = chars[++at] }
    if (char === undefined) return null
    if (char === 'z' && at === chars.length - 1 && !back) { closed = true; break }
    let letters = LETTERS.get(char), stroke = char
    if (letters === undefined) {
      const unit = UNIT.exec(chars.slice(at).join(''))?.[0]
      if (!unit) return null
      at += unit.length - 1
      letters = stroke = unit
    }
    const moves = steps(letters)
    if (!moves || !moves.length) return null
    const points = [[x, y]]
    // Written backwards, a curve bends round the same corner seen from its other end.
    for (const [dx, dy, bx, by] of back ? moves.map(([a, b, c, d]) => c === undefined ? [-a, -b] : [-a, -b, c - a, /** @type {number} */ (d) - b]).reverse() : moves) {
      points.push(bx === undefined ? [x + dx, y + dy] : [x + dx, y + dy, x + bx, y + /** @type {number} */ (by)])
      x += dx; y += dy
    }
    let mark = ''
    if (chars[at + 1] === 'b') { at++; mark = 'b' }
    else if (chars[at + 1] === 'x') { at++; mark = 'x'; while (/[0-9]/.test(chars[at + 1] ?? '')) mark += chars[++at] }
    strokes.push({ back, stroke, mark, points })
  }
  return strokes.length ? { strokes, closed } : null
}

/** What sets walked points in the 1000-unit square: the line centred, its longer side 760 units.
 * @param {number[][]} points */
function fit(points) {
  const xs = points.map(point => point[0]), ys = points.map(point => point[1])
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0
  const scale = 760 / Math.max(w, h, 0.5), ox = 500 - (w * scale) / 2, oy = 500 - (h * scale) / 2
  /** @param {number} px @param {number} py @returns {[number, number]} */
  const place = (px, py) => [Math.round(ox + (px - x0) * scale), Math.round(oy + (py - y0) * scale)]
  /** @param {number[]} point @param {number} index */
  const to = (point, index) => index === 0 ? `M${place(point[0], point[1]).join(' ')}`
    : point.length > 2 ? `Q${place(point[2], point[3]).join(' ')} ${place(point[0], point[1]).join(' ')}` : `L${place(point[0], point[1]).join(' ')}`
  return { place, to }
}

/**
 * The line a stroke chain describes, as SVG path data to be stroked, in a 1000-unit square; null
 * where the text is no chain or names a stroke this does not know. `-` writes a stroke backwards,
 * `b` lifts the pen where it stands, `xN` (a crossing) moves nothing, a final `z` closes the line.
 * @param {string} chain `#(-𠃌㇉)`, or its contents.
 * @returns {string | null}
 */
export function chainPath(chain) {
  const walked = walk(chain)
  if (!walked) return null
  const lines = [[walked.strokes[0].points[0]]]
  for (const stroke of walked.strokes) {
    lines[lines.length - 1].push(...stroke.points.slice(1))
    if (stroke.mark === 'b') lines.push([/** @type {number[]} */ (stroke.points.at(-1)).slice(0, 2)])
  }
  const points = lines.flat()
  const { place, to } = fit(points)
  const drawn = lines.filter(line => line.length > 1)
  return drawn.map(line => line.map(to).join('') + (walked.closed && drawn.length === 1 ? 'Z' : '')).join('')
    + (walked.closed && drawn.length > 1 ? `L${place(points[0][0], points[0][1]).join(' ')}` : '')
}

/**
 * The same line stroke by stroke, in the same square: each stroke as the chain writes it, its own
 * path, and where the pen starts and ends it.
 * @param {string} chain `#(-𠃌㇉)`, or its contents.
 * @returns {{ strokes: { back: boolean, stroke: string, mark: string, d: string, from: [number, number], to: [number, number] }[], closed: boolean } | null}
 */
export function chainStrokes(chain) {
  const walked = walk(chain)
  if (!walked) return null
  const { place, to } = fit(walked.strokes.flatMap(stroke => stroke.points))
  return {
    closed: walked.closed,
    strokes: walked.strokes.map(({ back, stroke, mark, points }) => {
      const last = /** @type {number[]} */ (points.at(-1))
      return { back, stroke, mark, d: points.map(to).join(''), from: place(points[0][0], points[0][1]), to: place(last[0], last[1]) }
    }),
  }
}
