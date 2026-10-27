// @ts-check
// Layer traversal for a document renderer. A host supplies the base layout as an affine placement
// for each operator child and local geometry for each component; this module composes those with the
// authored layer transforms, applies them to the geometry, and reports what it could not evaluate.
// Compositing (the ㇯ subtraction and the union of operators) belongs to the consumer of the pieces.
import { TransformError, chainIsAffine, affineForChain, transformPieces } from './transform.js'

/** @typedef {import('./model.js').Document} Document */
/** @typedef {import('./model.js').Node} Node */
/** @typedef {import('./model.js').Chain} Chain */
/** @typedef {import('./model.js').OperatorNode} OperatorNode */
/** @typedef {import('./transform.js').Piece} Piece */
/** @typedef {{ d: string, fillRule?: 'nonzero' | 'evenodd', cut?: boolean }} LocalPiece */
/** @typedef {{ pieces: LocalPiece[] }} Geometry */
/** @typedef {{ geometry: (node: Node) => Geometry | null, placement: (parent: OperatorNode, child: Node, index: number) => number[] | null }} LayerSource */
/** @typedef {{ node: string, reason: 'geometry' | 'placement' | 'transform', message: string }} LayerIssue */
/** @typedef {{ pieces: (Piece & { node: string, approximate: boolean })[], complete: boolean, issues: LayerIssue[] }} LayerDrawing */
/** @typedef {{ kind: 'component', node: string, positive: Piece[], negative: Piece[] }} ComponentScope */
/** @typedef {{ kind: 'operator', node: string, op: string, children: Scope[] }} OperatorScope */
/** @typedef {{ kind: 'group', node: string, child: Scope }} GroupScope */
/** @typedef {{ kind: 'slot', node: string }} SlotScope */
/** @typedef {ComponentScope | OperatorScope | GroupScope | SlotScope} Scope */
/** @typedef {{ root: Scope, complete: boolean, issues: LayerIssue[] }} ScopeTree */

/** @param {unknown} value @returns {value is number[]} */
const matrix = value => Array.isArray(value) && value.length === 6 && value.every(entry => typeof entry === 'number' && Number.isFinite(entry))

/**
 * Draw the transformed local pieces of a document. `source.geometry(node)` answers a component's
 * local pieces in its 1000-unit frame; `source.placement(parent, child, index)` answers the affine
 * placement of an operator child in the parent's local frame. Groups use the identity placement.
 * The result keeps pieces in tree order, with the layer ID and whether a nonlinear transform
 * flattened them. Missing geometry, missing placement and unsupported transforms make it incomplete
 * rather than silent.
 * @param {Document} document @param {LayerSource} source @param {{ tolerance?: number }} [options] @returns {LayerDrawing}
 */
export function renderLayers(document, source, { tolerance = 0.1 } = {}) {
  /** @type {(Piece & { node: string, approximate: boolean })[]} */
  const pieces = []
  /** @type {LayerIssue[]} */
  const issues = []
  /** @param {Node} node @param {Chain} parentChain */
  const visit = (node, parentChain) => {
    const authored = node.transform ?? []
    const chain = [...authored, ...parentChain]
    if (node.kind === 'component') {
      let geometry
      try { geometry = source.geometry(node) } catch (error) {
        issues.push({ node: node.id, reason: 'geometry', message: error instanceof Error ? error.message : String(error) })
        return
      }
      if (!geometry || !Array.isArray(geometry.pieces)) {
        issues.push({ node: node.id, reason: 'geometry', message: `no geometry for ${node.id}` })
        return
      }
      try {
        for (const piece of transformPieces(geometry.pieces, chain, { tolerance })) {
          pieces.push({ ...piece, node: node.id, approximate: Boolean(piece.approximate) })
        }
      } catch (error) {
        issues.push({ node: node.id, reason: 'transform', message: error instanceof TransformError ? error.message : String(error) })
      }
      return
    }
    if (node.kind === 'slot') return
    if (node.kind === 'group') {
      visit(node.child, chain)
      return
    }
    // operator
    node.children.forEach((child, index) => {
      let placement
      try { placement = source.placement(node, child, index) } catch (error) {
        issues.push({ node: child.id, reason: 'placement', message: error instanceof Error ? error.message : String(error) })
        return
      }
      if (!matrix(placement)) {
        issues.push({ node: child.id, reason: 'placement', message: `no placement for ${child.id}` })
        return
      }
      visit(child, [{ type: 'affine', matrix: placement }, ...chain])
    })
  }
  visit(document.root, [])
  return { pieces, complete: issues.length === 0, issues }
}

/**
 * Build the scoped drawing for compositing: each component keeps its positive and cut pieces apart,
 * and each operator keeps its children. Pieces are already transformed. `source` is the same one
 * `renderLayers` takes. A missing piece or unsupported transform makes the tree incomplete.
 * @param {Document} document @param {LayerSource} source @param {{ tolerance?: number }} [options] @returns {ScopeTree}
 */
export function renderScopes(document, source, { tolerance = 0.1 } = {}) {
  /** @type {LayerIssue[]} */
  const issues = []
  /** @param {Node} node @param {Chain} parentChain @returns {Scope | null} */
  const visit = (node, parentChain) => {
    const chain = [...(node.transform ?? []), ...parentChain]
    if (node.kind === 'slot') return { kind: 'slot', node: node.id }
    if (node.kind === 'component') {
      let geometry
      try { geometry = source.geometry(node) } catch (error) {
        issues.push({ node: node.id, reason: 'geometry', message: error instanceof Error ? error.message : String(error) })
        return null
      }
      if (!geometry || !Array.isArray(geometry.pieces)) {
        issues.push({ node: node.id, reason: 'geometry', message: `no geometry for ${node.id}` })
        return null
      }
      try {
        const transformed = transformPieces(geometry.pieces, chain, { tolerance })
        /** @type {ComponentScope} */
        const scope = { kind: 'component', node: node.id, positive: [], negative: [] }
        for (const piece of transformed) (piece.cut ? scope.negative : scope.positive).push(piece)
        return scope
      } catch (error) {
        issues.push({ node: node.id, reason: 'transform', message: error instanceof TransformError ? error.message : String(error) })
        return null
      }
    }
    if (node.kind === 'group') {
      const child = visit(node.child, chain)
      return child ? { kind: 'group', node: node.id, child } : null
    }
    /** @type {Scope[]} */
    const children = []
    node.children.forEach((child, index) => {
      let placement
      try { placement = source.placement(node, child, index) } catch (error) {
        issues.push({ node: child.id, reason: 'placement', message: error instanceof Error ? error.message : String(error) })
        children.push({ kind: 'slot', node: child.id })
        return
      }
      if (!matrix(placement)) {
        issues.push({ node: child.id, reason: 'placement', message: `no placement for ${child.id}` })
        children.push({ kind: 'slot', node: child.id })
        return
      }
      const childScope = visit(child, [{ type: 'affine', matrix: placement }, ...chain])
      children.push(childScope ?? { kind: 'slot', node: child.id })
    })
    return { kind: 'operator', node: node.id, op: node.op, children }
  }
  const root = visit(document.root, []) ?? { kind: 'slot', node: document.root.id }
  return { root, complete: issues.length === 0, issues }
}

export { chainIsAffine, affineForChain }
