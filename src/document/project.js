// @ts-check
// The bridge between the editor's positional core tree and the identified document. The core tree
// stays the projection the existing controls edit; this module reconciles it into a document at the
// same paths, keeping each layer's ID, name and transform through replacements and structural edits.
import { parse, write } from '../core/ids.js'
import { allocatorFor, assertDocument, fromSequence } from './model.js'

/** @typedef {import('../core/ids.js').Part} Part */
/** @typedef {import('../core/ids.js').Node} TreeNode */
/** @typedef {import('./model.js').Document} Document */
/** @typedef {import('./model.js').Node} Node */
/** @typedef {import('./model.js').Layer} Layer */
/** @typedef {import('./model.js').Allocator} Allocator */

/** The core tree a document projects to. Groups forward their child. @param {Document} document @returns {Part} */
export function treeFromDocument(document) {
  /** @param {Node} node @returns {Part} */
  const part = node => {
    if (node.kind === 'slot') return null
    if (node.kind === 'component') return node.char
    if (node.kind === 'group') return part(node.child)
    return { op: node.op, parts: node.children.map(part) }
  }
  return part(document.root)
}

/**
 * The layer fields a reconciled node keeps from its predecessor. New layers get a fresh ID.
 * @template {Node} T @param {Node | undefined} old @param {Allocator} allocator @param {T['kind']} kind @returns {T}
 */
function kept(old, allocator, kind) {
  /** @type {Record<string, unknown>} */
  const out = { id: old?.id ?? allocator.next(), kind }
  if (old?.name !== undefined) out.name = old.name
  if (old?.transform !== undefined) out.transform = structuredClone(old.transform)
  if (old?.extensions !== undefined) out.extensions = structuredClone(old.extensions)
  return /** @type {T} */ (out)
}

/** Reconcile one positional part with the node it had at the same path. @param {Node | undefined} old @param {Part} part @param {Allocator} allocator @returns {Node} */
function reconcile(old, part, allocator) {
  // A group has no core-tree path of its own: its child is the part at this path.
  if (old?.kind === 'group') {
    return { ...kept(old, allocator, 'group'), kind: 'group', child: reconcile(old.child, part, allocator) }
  }
  if (part === null) {
    if (old?.kind === 'slot') return old
    return { ...kept(old, allocator, 'slot'), kind: 'slot' }
  }
  if (typeof part === 'string') {
    if (old?.kind === 'component' && old.char === part) return old
    return { ...kept(old, allocator, 'component'), kind: 'component', char: part }
  }
  const oldChildren = old?.kind === 'operator' ? old.children : []
  const operator = /** @type {import('./model.js').OperatorNode} */ ({ ...kept(old, allocator, 'operator'), kind: 'operator', op: part.op })
  operator.children = part.parts.map((child, index) => reconcile(oldChildren[index], child, allocator))
  return operator
}

/**
 * Reconcile `tree` into `document`, preserving identity and transforms layer by layer. `allocator`
 * must be the long-lived allocator of the editing session so removed layers do not return; without
 * one, only the current document's IDs are reserved.
 * @param {Document} document @param {Part} tree @param {{ allocator?: Allocator }} [options] @returns {Document}
 */
export function syncDocument(document, tree, { allocator = allocatorFor(document) } = {}) {
  const root = reconcile(document.root, tree, allocator)
  const next = { ...document, root }
  assertDocument(next)
  return next
}

/**
 * Build a document from a core tree, with fresh IDs. @param {Part} tree @param {{ id?: string, allocator?: Allocator }} [options]
 * @returns {Document}
 */
export function documentFromTree(tree, { id = 'root', allocator } = {}) {
  return fromSequence(write(tree), { id, ...(allocator ? { allocator } : {}) })
}
