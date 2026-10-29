// @ts-check
// The cells of a pyramid preview: one square per component, with the same gap between every row
// and every column. Rows are centred, so the silhouette is an isosceles triangle even when the
// IDS tree groups rows and row components in halves.

/** The gap between cells, as a share of a cell. 0.13 keeps the six-cell pyramid's old spacing. */
export const PYRAMID_GAP = 0.13

/**
 * The cells of a `layers`-row pyramid inside `region` ([x0, y0, x1, y1], y up), in reading order.
 * Each cell is square and all cells are the same size. The pyramid fills the shorter side of the
 * region and is centred in it.
 * @param {number[]} region
 * @param {number} layers
 * @param {{ reverse?: boolean }} [options] Place the widest row at the top.
 * @returns {number[][]}
 */
export function pyramidCells(region, layers, { reverse = false } = {}) {
  const [x0, y0, x1, y1] = region
  const span = Math.min(x1 - x0, y1 - y0)
  if (!(layers > 0) || !(span > 0)) return []
  const cell = span / (layers + PYRAMID_GAP * (layers - 1))
  const gap = cell * PYRAMID_GAP
  const cx = (x0 + x1) / 2, top = (y0 + y1) / 2 + ((layers - 1) / 2) * (cell + gap)
  const cells = []
  for (let row = 0; row < layers; row++) {
    const count = reverse ? layers - row : row + 1
    const width = count * cell + (count - 1) * gap
    const y = top - row * (cell + gap)
    for (let i = 0; i < count; i++) {
      const x = cx - width / 2 + i * (cell + gap)
      cells.push([x, y - cell / 2, x + cell, y + cell / 2])
    }
  }
  return cells
}
