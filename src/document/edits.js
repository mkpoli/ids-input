// @ts-check
// Identity-preserving edits over a layer document. Every function works on a clone, validates the
// result and leaves the caller's document untouched.
import { allocatorFor, annotateMarks, assertDocument, findLayer, fromSequence, hoistMarks, toSequence } from './model.js'
import { DocumentError } from './model.js'
import { arity } from '../core/ids.js'

/** @typedef {import('./model.js').Document} Document */
/** @typedef {import('./model.js').Node} Node */
/** @typedef {import('./model.js').Content} Content */
/** @typedef {import('./model.js').Allocator} Allocator */
/** @typedef {import('./model.js').OperatorNode} OperatorNode */

/** @param {Node} node @returns {Record<string, unknown>} */
function common(node) {
  /** @type {Record<string, unknown>} */
  const out = { id: node.id }
  if (node.name !== undefined) out.name = node.name
  if (node.transform !== undefined) out.transform = node.transform
  if (node.extensions !== undefined) out.extensions = node.extensions
  return out
}

/** @param {Node} base @param {Node} replacement */
function keepIdentity(base, replacement) {
  return /** @type {Node} */ ({ ...common(base), ...replacement, id: base.id })
}

/** @param {Node} node @param {Allocator} allocator @param {string} [id] @returns {Node} */
function assignIds(node, allocator, id) {
  const copy = /** @type {Node} */ (structuredClone(node))
  const walk = (/** @type {Node} */ current, /** @type {boolean} */ root) => {
    current.id = root && id !== undefined ? id : allocator.next()
    if (current.kind === 'operator') current.children.forEach(child => walk(child, false))
    else if (current.kind === 'group') walk(current.child, false)
  }
  walk(copy, true)
  return copy
}

/** @param {Node} node @param {Allocator} allocator @returns {Node} */
export function duplicateSubtree(node, allocator) {
  return assignIds(node, allocator)
}

/** @param {Content} content @param {Allocator} allocator @param {string} id @returns {Node} */
function contentNode(content, allocator, id) {
  if (!content || typeof content !== 'object') throw new DocumentError([{ path: '', message: 'content must be an object' }])
  if (content.kind === 'component') {
    if (typeof content.char !== 'string') throw new DocumentError([{ path: '', message: 'component content needs char' }])
    return { id, kind: 'component', char: content.char }
  }
  if (content.kind === 'slot') return { id, kind: 'slot' }
  if (content.kind === 'group') {
    if (!content.child) throw new DocumentError([{ path: '', message: 'group content needs child' }])
    return { id, kind: 'group', child: contentNode(content.child, allocator, allocator.next()) }
  }
  if (content.kind === 'operator') {
    if (typeof content.op !== 'string' || !Array.isArray(content.children)) throw new DocumentError([{ path: '', message: 'operator content needs op and children' }])
    /** @type {import('./model.js').OperatorNode} */
    const node = { id, kind: 'operator', op: content.op, children: content.children.map(child => contentNode(child, allocator, allocator.next())) }
    return { ...node, ...(content.note ? { note: content.note } : {}), ...(typeof content.marks === 'string' && content.marks ? { marks: content.marks } : {}) }

  }
  throw new DocumentError([{ path: '', message: 'unknown layer kind' }])
}

/** Replace a layer's content, keeping its ID, name and transform. @param {Document} document @param {string} id @param {Content} content @param {{ allocator?: Allocator }} [options] @returns {Document} */
export function replaceNode(document, id, content, { allocator = allocatorFor(document) } = {}) {
  assertDocument(document)
  const copy = /** @type {Document} */ (structuredClone(document))
  const hit = findLayer(copy.root, id)
  if (!hit) throw new DocumentError([{ path: '', message: `no layer ${id}` }])
  const replacement = keepIdentity(hit.node, contentNode(content, allocator, id))
  if (hit.parent?.kind === 'operator') hit.parent.children[hit.index] = replacement
  else if (hit.parent?.kind === 'group') hit.parent.child = replacement
  else copy.root = replacement
  return assertDocument(hoistMarks(copy))
}

/** Replace a layer with a sequence, keeping its ID, name and transform. @param {Document} document @param {string} id @param {string} sequence @param {{ allocator?: Allocator }} [options] */
export function replaceWithSequence(document, id, sequence, { allocator = allocatorFor(document) } = {}) {
  assertDocument(document)
  const copy = /** @type {Document} */ (structuredClone(document))
  const hit = findLayer(copy.root, id)
  if (!hit) throw new DocumentError([{ path: '', message: `no layer ${id}` }])
  const imported = fromSequence(sequence, { id, allocator }).root
  const replacement = keepIdentity(hit.node, imported)
  if (hit.parent?.kind === 'operator') hit.parent.children[hit.index] = replacement
  else if (hit.parent?.kind === 'group') hit.parent.child = replacement
  else copy.root = replacement
  return assertDocument(hoistMarks(copy))
}

/** Turn a component into its operator, keeping the layer ID and transform. @param {Document} document @param {string} id @param {string} sequence @param {{ allocator?: Allocator }} [options] */
export function decompose(document, id, sequence, { allocator = allocatorFor(document) } = {}) {
  const next = replaceWithSequence(document, id, sequence, { allocator })
  const layer = findLayer(next.root, id)
  if (!layer || layer.node.kind !== 'operator') throw new DocumentError([{ path: '', message: `${sequence} is not an operator description` }])
  return next
}

/** Wrap a layer in a new operator, keeping the layer's ID and transform. @param {Document} document @param {string} id @param {string} op @param {{ allocator?: Allocator }} [options] @returns {{ document: Document, id: string }} */
export function wrapNode(document, id, op, { allocator = allocatorFor(document) } = {}) {
  assertDocument(document)
  const copy = /** @type {Document} */ (structuredClone(document))
  const hit = findLayer(copy.root, id)
  if (!hit) throw new DocumentError([{ path: '', message: `no layer ${id}` }])
  const count = arity(op)
  if (!count) throw new DocumentError([{ path: '', message: `unknown operator ${op}` }])
  const newId = allocator.next()
  const children = [hit.node, ...Array.from({ length: count - 1 }, () => ({ id: allocator.next(), kind: 'slot' }))]
  const wrapped = /** @type {OperatorNode} */ ({ id: newId, kind: 'operator', op, children })
  if (hit.parent?.kind === 'operator') hit.parent.children[hit.index] = wrapped
  else if (hit.parent?.kind === 'group') hit.parent.child = wrapped
  else copy.root = wrapped
  return { document: assertDocument(hoistMarks(copy)), id: newId }
}

/** Turn an operator into a group, keeping its ID and transform; the first filled operand is retained.
 * @param {Document} document @param {string} id @returns {Document} */
export function unwrapNode(document, id) {
  assertDocument(document)
  const copy = /** @type {Document} */ (structuredClone(document))
  const hit = findLayer(copy.root, id)
  if (!hit || hit.node.kind !== 'operator') throw new DocumentError([{ path: '', message: `${id} is not an operator` }])
  const node = /** @type {OperatorNode} */ (hit.node)
  const kept = /** @type {Node[]} */ (node.children).find(child => toSequence(child) !== '⬚') ?? node.children[0]
  // The operator's loose marks go to the part that stands in its place.
  const retained = annotateMarks(kept, node.marks ?? '')
  const replacement = /** @type {Node} */ ({ ...common(node), kind: 'group', child: retained })
  if (hit.parent?.kind === 'operator') hit.parent.children[hit.index] = replacement
  else if (hit.parent?.kind === 'group') hit.parent.child = replacement
  else copy.root = replacement
  return assertDocument(hoistMarks(copy))
}

/** Delete a layer; an operator parent gets a fresh slot in its place. Root and group children are refused.
 * @param {Document} document @param {string} id @param {{ allocator?: Allocator }} [options] @returns {Document} */
export function deleteLayer(document, id, { allocator = allocatorFor(document) } = {}) {
  assertDocument(document)
  const copy = /** @type {Document} */ (structuredClone(document))
  const hit = findLayer(copy.root, id)
  if (!hit) throw new DocumentError([{ path: '', message: `no layer ${id}` }])
  if (!hit.parent) throw new DocumentError([{ path: '', message: 'the root cannot be deleted' }])
  if (hit.parent.kind !== 'operator') throw new DocumentError([{ path: '', message: 'a group child cannot be deleted on its own; unwrap the group first' }])
  hit.parent.children[hit.index] = { id: allocator.next(), kind: 'slot' }
  return assertDocument(copy)
}

/** Change an operator's op, keeping its ID and the children it still takes.
 * @param {Document} document @param {string} id @param {string} op @param {{ allocator?: Allocator }} [options] */
export function changeOperator(document, id, op, { allocator = allocatorFor(document) } = {}) {
  assertDocument(document)
  const copy = /** @type {Document} */ (structuredClone(document))
  const hit = findLayer(copy.root, id)
  if (!hit || hit.node.kind !== 'operator') throw new DocumentError([{ path: '', message: `${id} is not an operator` }])
  const count = arity(op)
  if (!count) throw new DocumentError([{ path: '', message: `unknown operator ${op}` }])
  const node = /** @type {OperatorNode} */ (hit.node)
  if (/** @type {Node[]} */ (node.children).slice(count).some(child => toSequence(child) !== '⬚')) {
    throw new DocumentError([{ path: '', message: 'the new operator would discard a filled operand' }])
  }
  const children = Array.from({ length: count }, (_, i) => node.children[i] ?? { id: allocator.next(), kind: 'slot' })
  // A modifier belongs to the operator it follows; a different operator starts without one.
  if (op !== node.op) delete node.note
  node.op = op
  node.children = children
  return assertDocument(copy)
}

export { DocumentError }
