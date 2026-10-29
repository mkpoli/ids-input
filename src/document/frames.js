// @ts-check
// Layer frames for the preview and the inspector: the layout box of a layer, the affine map from
// its own 1000-unit frame into the canvas, the frame used to convert canvas gestures into local
// edits, and whether every authored chain on the way is affine.
import { affineForChain, applyAffine, invertAffine, multiplyAffine } from './transform.js'

/** @typedef {import('./model.js').Document} Document */
/** @typedef {import('./model.js').Node} Node */
/** @typedef {import('./render.js').LayerSource} LayerSource */
/** @typedef {[number, number, number, number]} Box */
/** @typedef {{ box: number[] }} SketchLeaf */
/** @typedef {{ node: Node, box: Box, canvas: number[], frame: number[], supported: boolean }} LayerFrame */

const IDENTITY = [1, 0, 0, 1, 0, 0]
const CANVAS = /** @type {Box} */ ([0, 0, 1000, 1000])

/** @param {Box} a @param {Box} b @returns {Box} */
const unionBox = (a, b) => {
  const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1])
  const x1 = Math.max(a[0] + a[2], b[0] + b[2]), y1 = Math.max(a[1] + a[3], b[1] + b[3])
  return [x, y, x1 - x, y1 - y]
}

/** The four corners of `box` after `matrix`, as an axis-aligned box. @param {number[]} matrix @param {number[]} box @returns {Box} */
export function boxCorners(matrix, box) {
  const [x, y, width, height] = box
  const points = /** @type {[number, number][]} */ ([[x, y], [x + width, y], [x, y + height], [x + width, y + height]]).map(point => applyAffine(matrix, point))
  const xs = points.map(point => point[0]), ys = points.map(point => point[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
}

/**
 * Compute one frame per layer from a document, its `LayerSource` placements and the composer sketch.
 * The root frame is the canvas. A group forwards its child's box and path; an operator combines its
 * children. If a chain is nonlinear or a placement is missing, the layer remains in the map with
 * `supported: false` so the inspector can still select it.
 * @param {Document} document @param {LayerSource} source @param {SketchLeaf[]} sketch
 * @returns {Map<string, LayerFrame>}
 */
export function layerFrames(document, source, sketch) {
  /** @type {Map<string, LayerFrame>} */
  const out = new Map()
  let leaf = 0
  /** @param {Node} node @param {number[]} parentP @param {number[]} parentC @param {number[]} edge @param {boolean} parentSupported @returns {Box | null} */
  const walk = (node, parentP, parentC, edge, parentSupported) => {
    const region = node.kind === 'component' || node.kind === 'slot'
      ? (() => {
        const box = sketch[leaf++]?.box
        return Array.isArray(box) && box.length >= 4 && Number.isFinite(box[2]) && box[2] > 0 && Number.isFinite(box[3]) && box[3] > 0
          ? /** @type {Box} */ (box.slice(0, 4)) : null
      })()
      : null
    const P = multiplyAffine(parentP, edge)
    const frame = multiplyAffine(parentC, P)
    const inverse = invertAffine(P)
    const E = affineForChain(node.transform ?? [])
    const supported = parentSupported && Boolean(E && inverse)
    const C = E && inverse ? multiplyAffine(parentC, multiplyAffine(P, multiplyAffine(E, inverse))) : parentC
    let box = region
    if (node.kind === 'operator') {
      for (const [index, child] of node.children.entries()) {
        const placement = source.placement(node, child, index)
        if (!placement) continue
        const childBox = walk(child, P, C, placement, supported)
        if (childBox) box = box ? unionBox(box, childBox) : childBox
      }
    } else if (node.kind === 'group') {
      const childBox = walk(node.child, P, C, IDENTITY, supported)
      if (childBox) box = childBox
    }
    const finalBox = node.id === document.root.id ? CANVAS : box
    if (finalBox) out.set(node.id, { node, box: finalBox, canvas: C, frame, supported })
    return finalBox
  }
  walk(document.root, IDENTITY, IDENTITY, IDENTITY, true)
  return out
}
