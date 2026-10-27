import { isNode } from '../core/ids.js'

/** @typedef {import('../core/ids.js').Part} Part */
/** @typedef {{ width: number, height: number }} Size */
/** @type {Record<string, string>} */
const LAYOUT = { '⿰': 'row', '⿲': 'row', '⿱': 'column', '⿳': 'column', '⿻': 'stack', '㇯': 'stack', '⿾': 'stack', '⿿': 'stack', '〾': 'stack' }
/** @param {string} op */
export const layout = op => LAYOUT[op] ?? 'enclosure'

/** A compound host needs its own panel so the contents cannot cover editable descendants.
 * @param {import('../core/ids.js').Node} part
 */
export const nodeLayout = part => layout(part.op) === 'enclosure' && isNode(part.parts[0]) ? 'column' : layout(part.op)

/**
 * Preferred sizes in leaf-sized units. Account for the axis of each split and for frame
 * space, so a nested group receives room for its contents rather than one equal share.
 * @param {Part} tree
 * @returns {Map<Part, Size>}
 */
export function treeSizes(tree) {
  /** @type {Map<Part, Size>} */
  const sizes = new Map()
  /** @param {Part} part @returns {Size} */
  function measure(part) {
    let size = { width: 1, height: 1 }
    if (isNode(part)) {
      const children = part.parts.map(measure)
      const gap = .15 * (children.length - 1)
      const mode = nodeLayout(part)
      if (mode === 'enclosure') {
        // The host overlaps the inset contents; reserve only a narrow surrounding band.
        size = { width: Math.max(children[0].width, children[1].width + .6), height: Math.max(children[0].height, children[1].height + .6) }
      } else {
        size = {
          width: mode === 'row' ? children.reduce((sum, child) => sum + child.width, 0) + gap : Math.max(...children.map(child => child.width)),
          height: mode === 'row' ? Math.max(...children.map(child => child.height)) : children.reduce((sum, child) => sum + child.height, 0) + gap,
        }
      }
      size = { width: size.width + .3, height: size.height + .7 }
    }
    sizes.set(part, size)
    return size
  }
  measure(tree)
  return sizes
}
