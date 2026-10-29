// @ts-check
// An editing session over one layer document: the current document, the chosen layer, one
// allocator whose IDs are never reused in the session, and undo/redo over whole documents. The
// session stays framework-free; a Svelte or storage binding can subscribe to `listen`.
import {
  DocumentError, allocatorFor, assertDocument, documentIds, emptyDocument, findLayer, fromSequence,
  toSequence, validateChain, validateDocument,
} from './model.js'
import {
  changeOperator, decompose, deleteLayer, replaceNode, replaceWithSequence, unwrapNode, wrapNode,
} from './edits.js'
import { syncDocument } from './project.js'

/** @typedef {import('./model.js').Document} Document */
/** @typedef {import('./model.js').Node} Node */
/** @typedef {import('./model.js').Chain} Chain */
/** @typedef {import('./model.js').Allocator} Allocator */
/** @typedef {import('./model.js').Issue} Issue */
/** @typedef {import('./model.js').Content} Content */
/** @typedef {{ document: Document, chosen: string | null, label: string, key?: string }} Step */
/** @typedef {{ done: string[], undone: string[] }} Steps */
/** @typedef {{ document: Document, chosen: string | null, done: Step[], undone: Step[], ids: string[] }} Snapshot */
/** @typedef {{ reserved?: Iterable<string>, label?: string, onListenerError?: (error: unknown, session: DocumentSession) => void }} SessionOptions */

/**
 * @typedef {object} DocumentSession
 * @property {Document} document A detached copy of the current document.
 * @property {string | null} chosen
 * @property {string} sequence
 * @property {string} projection
 * @property {Issue[]} issues
 * @property {Steps} steps
 * @property {boolean} canUndo
 * @property {boolean} canRedo
 * @property {Allocator} allocator
 * @property {(id: string | null) => boolean} choose
 * @property {(sequence: string) => void} reset
 * @property {(next: Document) => void} open
 * @property {(tree: import('../core/ids.js').Part) => boolean} sync
 * @property {() => boolean} undo
 * @property {() => boolean} redo
 * @property {() => Snapshot} snapshot
 * @property {(snapshot: Snapshot) => void} restore
 * @property {(sequence: string, id?: string) => string} replace
 * @property {(content: Content, id?: string) => string} replaceContent
 * @property {(sequence: string, id?: string) => string} decompose
 * @property {(op: string, id?: string) => string} wrap
 * @property {(id?: string) => string} unwrap
 * @property {(op: string, id?: string) => string} changeOperator
 * @property {(id?: string) => string | null} remove
 * @property {(id?: string) => string} clear
 * @property {(chain: Chain, id?: string, options?: { coalesce?: string }) => string} setTransform
 * @property {(id?: string) => string} clearTransform
 * @property {(listener: (session: DocumentSession) => void) => () => void} listen
 */

/**
 * Create a session over `initial`, a document (an empty slot by default). `reserved` adds IDs that
 * an editor's earlier sessions or retained history must not reuse. A listener exception is reported
 * to `onListenerError` (or `reportError`) after the edit commits; it does not fail the edit.
 * @param {Document} [initial] @param {SessionOptions} [options]
 * @returns {DocumentSession}
 */
export function createDocumentSession(initial = emptyDocument(), { reserved = [], label = 'Edit', onListenerError } = {}) {
  assertDocument(initial)
  /** @type {Allocator} */
  const allocator = allocatorFor(initial, reserved)
  /** @type {Document} */
  let document = /** @type {Document} */ (structuredClone(initial))
  /** @type {string | null} */
  let chosen = null
  /** @type {Step[]} */
  let done = []
  /** @type {Step[]} */
  let undone = []
  /** @type {((session: DocumentSession) => void)[]} */
  const listeners = []
  /** @type {DocumentSession} */
  let session

  /** @param {string} fallback */
  const name = fallback => ({ replace: `Replace ${fallback}`, decompose: `Decompose ${fallback}`, wrap: `Wrap ${fallback}`, unwrap: `Unwrap ${fallback}`, operator: `Change ${fallback}`, delete: `Delete ${fallback}`, transform: `Transform ${fallback}`, clear: `Clear ${fallback}` })

  /** @param {unknown} error */
  const reportListenerError = error => {
    try {
      if (onListenerError) onListenerError(error, session)
      else if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
      else console.error(error)
    } catch { /* The error path itself must not fail an edit. */ }
  }
  const notify = () => {
    for (const listener of [...listeners]) {
      try { listener(session) } catch (error) { reportListenerError(error) }
    }
  }
  /** @param {Document} next @param {string | null} nextChosen @param {string} action @param {string} [key] */
  function commit(next, nextChosen, action, key) {
    assertDocument(next)
    for (const id of documentIds(next)) allocator.reserve(id)
    const last = done.at(-1)
    if (key && last?.key === key) {
      document = next
      chosen = nextChosen && findLayer(document.root, nextChosen) ? nextChosen : null
      notify()
      return
    }
    done.push({ document, chosen, label: action, ...(key ? { key } : {}) })
    if (done.length > 100) done.shift()
    undone = []
    document = next
    chosen = nextChosen && findLayer(document.root, nextChosen) ? nextChosen : null
    notify()
  }
  /** @param {string | null} id */
  const chosenOr = id => id ?? chosen
  /** @param {string | null} id */
  const requireId = id => {
    const at = chosenOr(id)
    if (!at) throw new DocumentError([{ path: '', message: 'no layer is chosen' }])
    return at
  }
  /** @param {string} fallback */
  const action = fallback => label === 'Edit' ? fallback : `${label}: ${fallback}`

  session = {
    get document() { return /** @type {Document} */ (structuredClone(document)) },
    get chosen() { return chosen },
    get sequence() { return toSequence(document.root) },
    get projection() { return toSequence(document.root) },
    get issues() { return validateDocument(document) },
    get steps() { return { done: done.map(step => step.label), undone: undone.map(step => step.label) } },
    get canUndo() { return done.length > 0 },
    get canRedo() { return undone.length > 0 },
    get allocator() { return allocator },

    /** @param {string | null} id @returns {boolean} */
    choose(id) {
      if (id !== null && !findLayer(document.root, id)) return false
      chosen = id
      notify()
      return true
    },
    /** @param {string} sequence */
    reset(sequence) {
      const id = allocator.next()
      document = fromSequence(sequence, { id, allocator })
      chosen = null
      done = []; undone = []
      notify()
    },
    /** @param {Document} next */
    open(next) {
      assertDocument(next)
      for (const id of documentIds(next)) allocator.reserve(id)
      document = /** @type {Document} */ (structuredClone(next))
      chosen = null
      done = []; undone = []
      notify()
    },
    /** Reconcile an editor tree into the document. An unchanged tree is a no-op and keeps the
     *  session history; a structural change updates the projection and clears that history because
     *  the editor owns undo for structure. @param {import('../core/ids.js').Part} tree */
    sync(tree) {
      const next = syncDocument(document, tree, { allocator })
      if (JSON.stringify(next) === JSON.stringify(document)) return false
      document = /** @type {Document} */ (structuredClone(next))
      if (chosen && !findLayer(document.root, chosen)) chosen = null
      done = []; undone = []
      notify()
      return true
    },
    undo() {
      const step = done.pop()
      if (!step) return false
      for (const id of documentIds(document)) allocator.reserve(id)
      undone.push({ document, chosen, label: step.label })
      document = step.document
      chosen = step.chosen && findLayer(document.root, step.chosen) ? step.chosen : null
      notify()
      return true
    },
    redo() {
      const step = undone.pop()
      if (!step) return false
      for (const id of documentIds(document)) allocator.reserve(id)
      done.push({ document, chosen, label: step.label })
      document = step.document
      chosen = step.chosen && findLayer(document.root, step.chosen) ? step.chosen : null
      notify()
      return true
    },
    /** @returns {Snapshot} */
    snapshot() {
      return {
        document: /** @type {Document} */ (structuredClone(document)),
        chosen,
        done: done.map(step => ({ ...step, document: /** @type {Document} */ (structuredClone(step.document)) })),
        undone: undone.map(step => ({ ...step, document: /** @type {Document} */ (structuredClone(step.document)) })),
        ids: [...allocator.ids],
      }
    },
    /** @param {Snapshot} snapshot */
    restore(snapshot) {
      assertDocument(snapshot.document)
      for (const step of [...snapshot.done, ...snapshot.undone]) assertDocument(step.document)
      for (const id of snapshot.ids ?? []) allocator.reserve(id)
      for (const id of documentIds(snapshot.document)) allocator.reserve(id)
      for (const step of [...snapshot.done, ...snapshot.undone]) for (const id of documentIds(step.document)) allocator.reserve(id)
      document = /** @type {Document} */ (structuredClone(snapshot.document))
      chosen = snapshot.chosen && findLayer(document.root, snapshot.chosen) ? snapshot.chosen : null
      done = snapshot.done.map(step => ({ ...step, document: /** @type {Document} */ (structuredClone(step.document)) }))
      undone = snapshot.undone.map(step => ({ ...step, document: /** @type {Document} */ (structuredClone(step.document)) }))
      notify()
    },
    /** @param {string} sequence @param {string} [id] */
    replace(sequence, id) {
      const at = requireId(id ?? null)
      commit(replaceWithSequence(document, at, sequence, { allocator }), at, action(name(at).replace))
      return at
    },
    /** @param {Node['kind'] extends never ? never : import('./model.js').Content} content @param {string} [id] */
    replaceContent(content, id) {
      const at = requireId(id ?? null)
      commit(replaceNode(document, at, content, { allocator }), at, action(name(at).replace))
      return at
    },
    /** @param {string} sequence @param {string} [id] */
    decompose(sequence, id) {
      const at = requireId(id ?? null)
      commit(decompose(document, at, sequence, { allocator }), at, action(name(at).decompose))
      return at
    },
    /** @param {string} op @param {string} [id] */
    wrap(op, id) {
      const at = requireId(id ?? null)
      const result = wrapNode(document, at, op, { allocator })
      commit(result.document, result.id, action(name(at).wrap))
      return result.id
    },
    /** @param {string} [id] */
    unwrap(id) {
      const at = requireId(id ?? null)
      commit(unwrapNode(document, at), at, action(name(at).unwrap))
      return at
    },
    /** @param {string} op @param {string} [id] */
    changeOperator(op, id) {
      const at = requireId(id ?? null)
      commit(changeOperator(document, at, op, { allocator }), at, action(name(at).operator))
      return at
    },
    /** @param {string} [id] */
    remove(id) {
      const at = requireId(id ?? null)
      const found = findLayer(document.root, at)
      const parent = found?.parent?.id ?? null
      commit(deleteLayer(document, at, { allocator }), parent, action(name(at).delete))
      return parent
    },
    /** @param {string} [id] */
    clear(id) {
      const at = requireId(id ?? null)
      commit(replaceNode(document, at, { kind: 'slot' }, { allocator }), at, action(name(at).clear))
      return at
    },
    /** @param {Chain} chain @param {string} [id] @param {{ coalesce?: string }} [options] */
    setTransform(chain, id, { coalesce } = {}) {
      const at = requireId(id ?? null)
      /** @type {Issue[]} */
      const issues = []
      validateChain(chain, '/transform', issues)
      if (issues.length) throw new DocumentError(issues)
      const next = /** @type {Document} */ (structuredClone(document))
      const found = findLayer(next.root, at)
      if (!found) throw new DocumentError([{ path: '', message: `no layer ${at}` }])
      if (chain.length) found.node.transform = /** @type {Chain} */ (structuredClone(chain))
      else delete found.node.transform
      commit(next, at, action(name(at).transform), coalesce)
      return at
    },
    /** @param {string} [id] */
    clearTransform(id) {
      const at = requireId(id ?? null)
      const next = /** @type {Document} */ (structuredClone(document))
      const found = findLayer(next.root, at)
      if (!found) throw new DocumentError([{ path: '', message: `no layer ${at}` }])
      delete found.node.transform
      commit(next, at, action(name(at).transform))
      return at
    },
    /** @param {(session: DocumentSession) => void} listener */
    listen(listener) { listeners.push(listener); return () => { const at = listeners.indexOf(listener); if (at >= 0) listeners.splice(at, 1) } },
  }
  return session
}
