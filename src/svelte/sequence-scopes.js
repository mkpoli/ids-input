// @ts-check
import { arity } from '../core/ids.js'
/** @typedef {import('./tokens.js').Token} Token */
/** @typedef {{left:number, right:number}} Bounds */
/** @typedef {{token:Token, box:Bounds, children:ScopeNode[], operator:boolean, height:number, right:number}} ScopeNode */
/** Scope lanes use subtree height: every parent sits below its children.
 * Bounds come from rendered token spans, in unscrolled text coordinates.
 * @param {Token[]} tokens @param {Bounds[]} bounds
 */
export function sequenceScopes(tokens, bounds) {
  /** @type {ScopeNode[]} */ const nodes = []
  /** @type {Map<string, ScopeNode>} */ const paths = new Map()
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index], box = bounds[index]
    if (!token.text || !box || box.right <= box.left) continue
    const key = token.path.join('.')
    // Loose marks reuse the root path; they do not add a second structural node.
    if (paths.has(key)) continue
    /** @type {ScopeNode} */
    const node = {token, box, children: [], operator: Boolean(arity(Array.from(token.text)[0]) && token.end > token.tokenEnd), height: 0, right: box.right}
    paths.set(key, node)
    nodes.push(node)
    if (token.path.length) paths.get(token.path.slice(0, -1).join('.'))?.children.push(node)
  }
  // Tokens are preorder. One reverse pass caches subtree extents and lane heights.
  for (let index = nodes.length - 1; index >= 0; index--) {
    const node = nodes[index]
    let childHeight = 0
    for (const child of node.children) {
      childHeight = Math.max(childHeight, child.height)
      node.right = Math.max(node.right, child.right)
    }
    node.height = node.operator ? childHeight + 1 : 0
  }
  return nodes.filter(node => node.operator).map(({token, box, children, height}) => {
    const lane = height - 1
    const y = 4 + lane * 6
    const segments = children.map(child => {
      const left = child.box.left + 1.5, right = Math.max(left, child.right - 1.5)
      return `M ${left} ${y} H ${right}`
    })
    const start = box.left + Math.min(6, (box.right - box.left) / 2)
    const end = children[0]?.box.left ?? box.right
    return { path: token.path, lane, lead: `M ${start} 0 C ${start} ${y}, ${end - 4} ${y}, ${end} ${y}`, segments }
  })
}
