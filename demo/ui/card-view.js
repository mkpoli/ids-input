// @ts-check
/** A card frames its drawing's ink in a square, so a drawing that fills part of the 1000-unit box is
 *  not lost in it. Parts and text items carry the boxes to frame; a drawing with none keeps the box.
 *  @param {{ parts?: { box: number[] }[], emoji?: { box: number[] }[] } | undefined} drawing
 *  @returns {string} an SVG `viewBox` */
export function cardView(drawing) {
  const boxes = [...(drawing?.parts ?? []), ...(drawing?.emoji ?? [])]
    .map(item => item.box)
    .filter(box => Array.isArray(box) && box.length === 4 && box.every(value => Number.isFinite(Number(value))))
    .map(box => box.map(Number))
  if (!boxes.length) return '0 0 1000 1000'
  const x0 = Math.min(...boxes.map(box => box[0])), y0 = Math.min(...boxes.map(box => box[1]))
  const x1 = Math.max(...boxes.map(box => box[0] + box[2])), y1 = Math.max(...boxes.map(box => box[1] + box[3]))
  const side = Math.max(x1 - x0, y1 - y0) * 1.12
  if (!(side > 0)) return '0 0 1000 1000'
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  return `${(cx - side / 2).toFixed(1)} ${(cy - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`
}
