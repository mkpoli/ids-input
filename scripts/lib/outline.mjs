// Outlines of straight lines as the component variation build reads them: a GlyphWiki drawing is
// either its strokes, each a polygon that overlaps its neighbours, or one shape with its counters
// cut out as polygons wound the other way.

/** The polygons of an outline of straight lines. @param {string} d @returns {[number, number][][]} */
export function polygonsOf(d) {
  if (/[^MLZ\d\s.-]/.test(d)) throw new Error('an outline with curves')
  return d.split('Z').filter(part => part.trim()).map(part => {
    const numbers = (part.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    /** @type {[number, number][]} */
    const points = []
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]])
    return points
  })
}

/** Twice a polygon's signed area. @param {[number, number][]} points */
export function area(points) {
  let sum = 0
  points.forEach(([x, y], i) => { const [nx, ny] = points[(i + 1) % points.length]; sum += x * ny - nx * y })
  return sum
}

/** Whether a point is strictly inside a polygon: a point on its edge is not. @param {[number, number]} point @param {[number, number][]} polygon */
function inside([x, y], polygon) {
  let odd = false
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i], [x2, y2] = polygon[(i + 1) % polygon.length]
    // On the edge: collinear with it and between its ends.
    if (Math.abs((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) < 1e-9 && Math.min(x1, x2) <= x && x <= Math.max(x1, x2) && Math.min(y1, y2) <= y && y <= Math.max(y1, y2)) return false
    if ((y1 > y) !== (y2 > y) && x < x1 + (y - y1) * (x2 - x1) / (y2 - y1)) odd = !odd
  }
  return odd
}

/**
 * Which polygons of an outline are counters: cut out of the shape, where every other polygon adds
 * to it. A counter lies wholly inside the polygon it is cut from, touching none of its edges, and
 * is wound the other way; a stroke that overlaps another is neither, however it is wound.
 * @param {[number, number][][]} polygons @returns {boolean[]}
 */
export function counters(polygons) {
  const areas = polygons.map(area)
  return polygons.map((polygon, at) => {
    // The polygons this one lies inside, the smallest of them being the one it would be cut from.
    const around = polygons.map((_, other) => other).filter(other => other !== at && Math.abs(areas[other]) > Math.abs(areas[at]) && polygon.every(point => inside(point, polygons[other])))
    if (around.length % 2 === 0) return false
    const from = around.reduce((least, other) => Math.abs(areas[other]) < Math.abs(areas[least]) ? other : least)
    return Math.sign(areas[from]) !== Math.sign(areas[at])
  })
}

/** The side of the square a GlyphWiki drawing is made in. */
export const SQUARE = 200

/**
 * The cells of the drawing square that polygons cover when they are filled as one shape: a cell is
 * ink where the polygons around its centre do not cancel out.
 * @param {[number, number][][]} polygons
 */
export function cells(polygons) {
  const grid = new Uint8Array(SQUARE * SQUARE)
  for (let row = 0; row < SQUARE; row++) {
    const y = row + 0.5
    /** @type {[number, number][]} */
    const crossings = []
    for (const points of polygons) points.forEach(([x1, y1], i) => {
      const [x2, y2] = points[(i + 1) % points.length]
      if ((y1 <= y) !== (y2 <= y)) crossings.push([x1 + (y - y1) * (x2 - x1) / (y2 - y1), y2 > y1 ? 1 : -1])
    })
    crossings.sort((a, b) => a[0] - b[0])
    let winding = 0
    for (let i = 0; i + 1 < crossings.length; i++) {
      winding += crossings[i][1]
      if (winding === 0) continue
      for (let col = Math.max(0, Math.ceil(crossings[i][0] - 0.5)); col <= Math.min(SQUARE - 1, Math.floor(crossings[i + 1][0] - 0.5)); col++) grid[row * SQUARE + col] = 1
    }
  }
  return grid
}

/** Polygons wound as a record winds them: with the shape, and a counter against it. @param {[number, number][][]} polygons */
export function wound(polygons) {
  const cut = counters(polygons)
  return polygons.map((polygon, at) => (area(polygon) < 0) !== cut[at] ? [...polygon].reverse() : polygon)
}

/**
 * How far two drawings are one: the lesser share of each one's ink that lies within `near` cells of
 * the other's. @param {Uint8Array} a @param {Uint8Array} b @param {number} near
 */
export function alike(a, b, near) {
  const widened = (/** @type {Uint8Array} */ grid) => {
    const out = new Uint8Array(grid.length)
    for (let row = 0; row < SQUARE; row++) for (let col = 0; col < SQUARE; col++) {
      if (!grid[row * SQUARE + col]) continue
      for (let y = Math.max(0, row - near); y <= Math.min(SQUARE - 1, row + near); y++) {
        for (let x = Math.max(0, col - near); x <= Math.min(SQUARE - 1, col + near); x++) out[y * SQUARE + x] = 1
      }
    }
    return out
  }
  const share = (/** @type {Uint8Array} */ ink, /** @type {Uint8Array} */ beside) => {
    let all = 0, on = 0
    for (let i = 0; i < ink.length; i++) { all += ink[i]; on += ink[i] & beside[i] }
    return all ? on / all : 0
  }
  return Math.min(share(a, widened(b)), share(b, widened(a)))
}

/** How many separate regions of the drawing square are left blank: the ground around a drawing and each counter inside it. @param {Uint8Array} grid */
export function blanks(grid) {
  const seen = new Uint8Array(grid.length)
  let regions = 0
  for (let start = 0; start < grid.length; start++) {
    if (grid[start] || seen[start]) continue
    regions++
    const stack = [start]
    seen[start] = 1
    while (stack.length) {
      const at = /** @type {number} */ (stack.pop()), row = Math.floor(at / SQUARE), col = at % SQUARE
      for (const next of [row > 0 ? at - SQUARE : -1, row < SQUARE - 1 ? at + SQUARE : -1, col > 0 ? at - 1 : -1, col < SQUARE - 1 ? at + 1 : -1]) {
        if (next >= 0 && !grid[next] && !seen[next]) { seen[next] = 1; stack.push(next) }
      }
    }
  }
  return regions
}
