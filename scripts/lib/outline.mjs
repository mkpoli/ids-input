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
