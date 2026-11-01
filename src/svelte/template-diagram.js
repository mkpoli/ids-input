// @ts-check
import { parse } from '../core/ids.js'
import { pyramidRows } from '../core/pyramid.js'
import { pyramidCells } from '../composer/pyramid.js'

/** @typedef {{ kind: 'slot', x: number, y: number, width: number, height: number, accent: boolean } | { kind: 'frame', d: string, accent: boolean, decorative?: boolean }} Shape */
const AXIS = new Map([['⿰', 0], ['⿲', 0], ['⿱', 1], ['⿳', 1]])
/** @type {Record<string, { inside: number[], outline: number[][] }>} */
const ENCLOSURES = {
  '⿴': { inside: [.24, .24, .76, .76], outline: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]] },
  '⿵': { inside: [.24, .24, .76, 1], outline: [[0, 1], [0, 0], [1, 0], [1, 1]] },
  '⿶': { inside: [.24, 0, .76, .76], outline: [[0, 0], [0, 1], [1, 1], [1, 0]] },
  '⿷': { inside: [.24, .24, 1, .76], outline: [[1, 0], [0, 0], [0, 1], [1, 1]] },
  '⿼': { inside: [0, .24, .76, .76], outline: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  '⿽': { inside: [0, 0, .72, .72], outline: [[1, 0], [1, 1], [0, 1]] },
  '⿸': { inside: [.28, .28, 1, 1], outline: [[1, 0], [0, 0], [0, 1]] },
  '⿹': { inside: [0, .28, .72, 1], outline: [[0, 0], [1, 0], [1, 1]] },
  '⿺': { inside: [.28, 0, 1, .72], outline: [[0, 0], [0, 1], [1, 1]] },
}

/** A pyramid of `layers` layers of equal square cells, as template slots in the 24-unit square.
 * @param {number} layers
 * @param {{ direction?: 'top' | 'bottom' | 'left' | 'right' }} [options]
 * @returns {Shape[]}
 */
export function pyramidDiagram(layers, { direction = 'top' } = {}) {
  return pyramidCells([2, 2, 22, 22], layers, { direction })
    .map(([x0, y0, x1, y1]) => ({ kind: 'slot', x: x0, y: 24 - y1, width: x1 - x0, height: y1 - y0, accent: false }))
}

/** A template icon in a 24-unit square. Frames stand for enclosure hosts; offset slots show overlays.
 * @param {string} sequence
 * @returns {Shape[]}
 */
export function templateDiagram(sequence) {
  const parsed = parse(sequence, { open: true })
  if (parsed.problem || parsed.tree === undefined) return []
  const pyramid = pyramidRows(parsed.tree)
  if (pyramid) return pyramidDiagram(pyramid.layers, { direction: pyramid.direction })
  /** @type {Shape[]} */
  const shapes = []
  /** @param {import('../core/ids.js').Part} node @param {number[]} box @param {boolean} accent */
  function draw(node, box, accent) {
    const [x, y, width, height] = box
    if (node === null || typeof node === 'string') {
      shapes.push({ kind: 'slot', x: x + .65, y: y + .65, width: width - 1.3, height: height - 1.3, accent })
      return
    }
    const axis = AXIS.get(node.op)
    if (axis !== undefined) {
      /** @param {import('../core/ids.js').Part} part */
      const mirrored = part => typeof part === 'object' && part !== null && part.op === '⿾'
      const turned = node.parts.length === 2 && node.parts.filter(mirrored).length === 1 ? node.parts.findIndex(mirrored) : -1
      node.parts.forEach((part, i) => {
        const child = [...box], span = child[axis + 2] / node.parts.length
        child[axis] += i * span; child[axis + 2] = span
        draw(turned === i && part && typeof part === 'object' ? part.parts[0] : part, child, accent || turned === i)
      })
      if (turned !== -1) {
        // A mirrored pair reads as two slots with the axis between them; the unary operand's own
        // axis would sit inside one slot and look like a split slot.
        const path = axis === 0
          ? `M${x + width / 2} ${y + 2}V${y + height - 2}`
          : `M${x + 2} ${y + height / 2}H${x + width - 2}`
        shapes.push({ kind: 'frame', d: path, accent: true, decorative: true })
      }
    } else if (node.op === '⿻') {
      draw(node.parts[0], [x, y, width * .68, height * .68], accent)
      draw(node.parts[1], [x + width * .32, y + height * .32, width * .68, height * .68], true)
    } else if (node.op === '⿾') {
      draw(node.parts[0], box, accent)
      // The reflected operand keeps one slot; a vertical line shows the axis it turns about.
      shapes.push({ kind: 'frame', d: `M${x + width / 2} ${y + 2}V${y + height - 2}`, accent: true, decorative: true })
    } else if (node.op === '⿿') {
      // Half a turn has no reflection axis; the operand keeps its slot unmarked.
      draw(node.parts[0], box, accent)
    } else if (ENCLOSURES[node.op]) {
      const { inside: [a, b, c, d], outline } = ENCLOSURES[node.op]
      const path = outline.map(([u, v], i) => `${i ? 'L' : 'M'}${x + .65 + u * (width - 1.3)} ${y + .65 + v * (height - 1.3)}`).join(' ')
      shapes.push({ kind: 'frame', d: path, accent })
      draw(node.parts[1], [x + a * width, y + b * height, (c - a) * width, (d - b) * height], accent)
    }
  }
  draw(parsed.tree, [2, 2, 20, 20], false)
  return shapes
}
