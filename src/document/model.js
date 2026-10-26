// @ts-check
// The layer document: an IDS tree with stable layer IDs, transforms and a rendering recipe.
//
// This is the model layer of docs/document-format.md. It reads and writes the JSON shape, validates
// it, projects a document to IDS and builds one from IDS. A renderer, storage and the editor binding
// are separate; nothing here reaches into the current canvas-space Drawing or the positional core
// tree beyond the IDS projection boundary.
import { arity, isComponent, isSelector, parse } from '../core/ids.js'
import { inspectJson } from './json.js'

export const FORMAT = 'ids-input/document'
export const VERSION = 1
export const MAX_BYTES = 1024 * 1024
export const MAX_SEQUENCE = 64
export const MAX_LAYERS = 1000
export const MAX_DEPTH = 64
export const MAX_EDITS = 1000
export const MAX_OPERATIONS = 64
export const MAX_ASSETS = 128

const ID = /^[A-Za-z0-9_-]{1,80}$/
const DIGEST = /^[0-9a-f]{64}$/
const SLOT = '⬚'

/** @typedef {{ type: 'affine', matrix: number[], extensions?: Record<string, unknown> }} Affine */
/** @typedef {{ type: 'projective', matrix: number[], extensions?: Record<string, unknown> }} Projective */
/** @typedef {{ type: 'mobius', a: number[], b: number[], c: number[], d: number[], extensions?: Record<string, unknown> }} Mobius */
/** @typedef {Record<string, unknown> & { type: string }} UnknownOperation */
/** @typedef {Affine | Projective | Mobius | UnknownOperation} Operation */
/** @typedef {Operation[]} Chain */
/** @typedef {Record<string, unknown>} Extensions */
/** @typedef {{ id: string, name?: string, transform?: Chain, extensions?: Extensions }} Layer */
/** @typedef {Layer & { kind: 'component', char: string }} Component */
/** @typedef {Layer & { kind: 'operator', op: string, children: Node[] }} OperatorNode */
/** @typedef {Layer & { kind: 'slot' }} Slot */
/** @typedef {Layer & { kind: 'group', child: Node }} Group */
/** @typedef {Component | OperatorNode | Slot | Group} Node */
/** @typedef {{ kind: 'component', char: string } | { kind: 'operator', op: string, children: Content[] } | { kind: 'slot' } | { kind: 'group', child: Content }} Content */
/** @typedef {{ mode: 'unbound', extensions?: Extensions } | { mode: 'pinned', engine: string, revision: string, options: Record<string, unknown>, assets: { role: string, sha256: string, uri?: string }[], extensions?: Extensions }} Render */
/** @typedef {{ kind: 'contour', piece: number, contour: number } | { kind: 'stroke', id: string }} Target */
/** @typedef {{ id: string, node: string, geometry: string, target: Target, transform: Chain, extensions?: Extensions }} GeometryEdit */
/** @typedef {{ format: string, version: number, root: Node, render: Render, geometryEdits?: GeometryEdit[], title?: string, created?: string, modified?: string, extensions?: Extensions }} Document */
/** @typedef {{ path: string, message: string }} Issue */
/** @typedef {{ next: () => string, reserve: (id: string) => void, ids: Set<string> }} Allocator */

/** An invalid document, its issues named by their JSON path. */
export class DocumentError extends Error {
  /** @param {Issue[]} issues */
  constructor(issues) {
    super(issues.map(issue => `${issue.path || '(document)'}: ${issue.message}`).join('\n'))
    this.name = 'DocumentError'
    this.issues = issues
  }
}

/** An allocator over opaque layer IDs, seeded with IDs that must not be reused. @param {Iterable<string>} [seed] @param {string} [prefix] @returns {Allocator} */
export function createAllocator(seed = [], prefix = 'l') {
  if (!/^[A-Za-z0-9_-]{0,70}$/.test(prefix)) throw new DocumentError([{ path: '', message: 'allocator prefix must be 0 to 70 ID characters' }])
  const ids = new Set(seed)
  let count = 0
  return {
    ids,
    reserve(id) { ids.add(id) },
    next() {
      let id
      do id = `${prefix}${(++count).toString(36)}`
      while (ids.has(id))
      if (id.length > 80) throw new DocumentError([{ path: '', message: 'the allocator has no ID of at most 80 characters left' }])
      ids.add(id)
      return id
    },
  }
}

/** Every layer ID and geometry-edit ID a document holds, for an allocator that must not reuse them.
 *  Geometry-edit node references are reserved too, so a removed target cannot return by a new ID.
 * @param {Document} document @returns {string[]} */
export function documentIds(document) {
  /** @type {string[]} */
  const out = []
  /** @param {Node} node */
  const walk = node => {
    out.push(node.id)
    if (node.kind === 'operator') node.children.forEach(walk)
    else if (node.kind === 'group') walk(node.child)
  }
  walk(document.root)
  for (const edit of document.geometryEdits ?? []) out.push(edit.id, edit.node)
  return out
}

/** An allocator seeded with a document's current IDs and any retained history IDs. @param {Document} document @param {Iterable<string>} [reserved] */
export const allocatorFor = (document, reserved = []) => createAllocator([...documentIds(document), ...reserved])

/** A document whose root is a slot. @param {string} [id] @returns {Document} */
export function emptyDocument(id = 'root') {
  if (!ID.test(id)) throw new DocumentError([{ path: '/root/id', message: 'invalid layer ID' }])
  return { format: FORMAT, version: VERSION, root: { id, kind: 'slot' }, render: { mode: 'unbound' } }
}

/** @param {string} id @param {string} sequence @param {Allocator} allocator @returns {Node} */
function nodeFromTree(id, sequence, allocator) {
  /** @param {any} part @returns {Node} */
  const read = part => {
    if (part === null) return { id: allocator.next(), kind: 'slot' }
    if (typeof part === 'string') return { id: allocator.next(), kind: 'component', char: part }
    return { id: allocator.next(), kind: 'operator', op: part.op, children: part.parts.map(read) }
  }
  if (sequence === '') return { id, kind: 'slot' }
  const found = parse(sequence, { open: true })
  if (found.problem) throw new DocumentError([{ path: '/root', message: `not an IDS draft: ${found.problem}` }])
  if (found.tree === null) return { id, kind: 'slot' }
  const root = read(found.tree)
  root.id = id
  return root
}

/** A document imported from IDS, with fresh IDs for every layer. @param {string} sequence @param {{ id?: string, allocator?: Allocator }} [options] @returns {Document} */
export function fromSequence(sequence, { id = 'root', allocator = createAllocator() } = {}) {
  if (typeof sequence !== 'string') throw new DocumentError([{ path: '', message: 'sequence must be a string' }])
  if (!ID.test(id)) throw new DocumentError([{ path: '/root/id', message: 'invalid layer ID' }])
  allocator.reserve(id)
  return assertDocument({ format: FORMAT, version: VERSION, root: nodeFromTree(id, sequence, allocator), render: { mode: 'unbound' } })
}

/** The IDS projection of a layer: groups pass their child through, slots are `⬚`. @param {Node} node @returns {string} */
export function toSequence(node) {
  if (node.kind === 'component') return node.char
  if (node.kind === 'slot') return SLOT
  if (node.kind === 'group') return toSequence(node.child)
  return node.op + node.children.map(toSequence).join('')
}

/** A layer and its descendants as `{ node, parent, key, index }`, or null. @param {Node} root @param {string} id
 *  @returns {{ node: Node, parent: OperatorNode | Group | null, key: 'children' | 'child' | null, index: number } | null} */
export function findLayer(root, id) {
  /** @param {Node} node @param {OperatorNode | Group | null} parent @param {'children' | 'child' | null} key @param {number} index
   *  @returns {{ node: Node, parent: OperatorNode | Group | null, key: 'children' | 'child' | null, index: number } | null} */
  const search = (node, parent, key, index) => {
    if (node.id === id) return { node, parent, key, index }
    if (node.kind === 'operator') {
      for (let i = 0; i < node.children.length; i++) {
        const hit = search(node.children[i], node, 'children', i)
        if (hit) return hit
      }
    } else if (node.kind === 'group') {
      const hit = search(node.child, node, 'child', 0)
      if (hit) return hit
    }
    return null
  }
  return search(root, null, null, -1)
}

/** A layer and its descendants in reading order. @param {Node} root @returns {Node[]} */
export function layers(root) {
  return [root, ...(root.kind === 'operator' ? root.children.flatMap(layers) : root.kind === 'group' ? layers(root.child) : [])]
}

// ------------------------------------------------------------------ validation

/** @param {unknown} value @returns {value is number} */
const finite = value => typeof value === 'number' && Number.isFinite(value)
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const object = value => typeof value === 'object' && value !== null && !Array.isArray(value)
/** @param {unknown} value @returns {value is unknown[]} */
const array = value => Array.isArray(value)

/** @param {number[][]} m */
function determinant3(m) {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
}

/** @param {string} path @param {unknown} value @param {string[]} allowed @param {Issue[]} issues */
function closedFields(value, allowed, path, issues) {
  if (!object(value)) return
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push({ path: `${path}/${key}`, message: 'unknown field' })
}

/** @param {unknown} value @param {string} path @param {Issue[]} issues @returns {boolean} */
export function validateChain(value, path = '', issues = []) {
  if (!array(value)) { issues.push({ path, message: 'transform must be an array' }); return false }
  const before = issues.length
  if (value.length > MAX_OPERATIONS) issues.push({ path, message: `at most ${MAX_OPERATIONS} operations` })
  value.forEach((op, i) => validateOperation(op, `${path}/${i}`, issues))
  return issues.length === before
}

/** @param {unknown} value @param {string} path @param {Issue[]} issues */
function validateOperation(value, path, issues) {
  if (!object(value) || typeof value.type !== 'string' || value.type.length < 1 || value.type.length > 200) {
    issues.push({ path, message: 'operation needs a type' })
    return
  }
  if (value.type === 'affine' || value.type === 'projective') {
    const size = value.type === 'affine' ? 6 : 9
    closedFields(value, ['type', 'matrix', 'extensions'], path, issues)
    if (!array(value.matrix) || value.matrix.length !== size || !value.matrix.every(finite)) {
      issues.push({ path: `${path}/matrix`, message: `a ${value.type} matrix has ${size} finite numbers` })
      return
    }
    const m = value.matrix
    if (value.type === 'affine') {
      if (m[0] * m[3] - m[1] * m[2] === 0) issues.push({ path: `${path}/matrix`, message: 'singular affine matrix' })
    } else {
      const rows = [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]]
      if (determinant3(rows) === 0) issues.push({ path: `${path}/matrix`, message: 'singular projective matrix' })
    }
    if (value.extensions !== undefined && !object(value.extensions)) issues.push({ path: `${path}/extensions`, message: 'extensions must be an object' })
    return
  }
  if (value.type === 'mobius') {
    closedFields(value, ['type', 'a', 'b', 'c', 'd', 'extensions'], path, issues)
    for (const key of /** @type {const} */ (['a', 'b', 'c', 'd'])) {
      const pair = value[key]
      if (!array(pair) || pair.length !== 2 || !pair.every(finite)) issues.push({ path: `${path}/${key}`, message: 'a complex coefficient is [real, imaginary]' })
    }
    if (['a', 'b', 'c', 'd'].every(key => array(value[key]) && value[key].length === 2 && value[key].every(finite))) {
      const [a, b, c, d] = /** @type {number[][]} */ (['a', 'b', 'c', 'd'].map(key => value[key]))
      const re = a[0] * d[0] - a[1] * d[1] - (b[0] * c[0] - b[1] * c[1])
      const im = a[0] * d[1] + a[1] * d[0] - (b[0] * c[1] + b[1] * c[0])
      if (re === 0 && im === 0) issues.push({ path, message: 'singular Möbius coefficients' })
    }
    if (value.extensions !== undefined && !object(value.extensions)) issues.push({ path: `${path}/extensions`, message: 'extensions must be an object' })
    return
  }
  // An unknown operation is preserved; only its type is checked.
}

/** @param {unknown} value @param {string} path @param {Issue[]} issues */
function validateLayerFields(value, path, issues) {
  if (!object(value)) { issues.push({ path, message: 'layer must be an object' }); return }
  if (typeof value.id !== 'string' || !ID.test(value.id)) issues.push({ path: `${path}/id`, message: 'invalid layer ID' })
  if (value.name !== undefined && (typeof value.name !== 'string' || [...value.name].length > 80)) issues.push({ path: `${path}/name`, message: 'name must be at most 80 characters' })
  if (value.transform !== undefined) validateChain(value.transform, `${path}/transform`, issues)
  if (value.extensions !== undefined && !object(value.extensions)) issues.push({ path: `${path}/extensions`, message: 'extensions must be an object' })
}

/** Validate a node and its descendants. @param {unknown} value @param {string} path @param {number} depth @param {Set<string>} ids @param {Issue[]} issues */
function validateNode(value, path, depth, ids, issues) {
  if (!object(value)) { issues.push({ path, message: 'node must be an object' }); return }
  if (depth > MAX_DEPTH) issues.push({ path, message: `layer depth over ${MAX_DEPTH}` })
  if (typeof value.id === 'string') {
    if (ids.has(value.id)) issues.push({ path: `${path}/id`, message: `duplicate layer ID ${value.id}` })
    ids.add(value.id)
  }
  validateLayerFields(value, path, issues)
  if (value.kind === 'component') {
    closedFields(value, ['id', 'kind', 'char', 'name', 'transform', 'extensions'], path, issues)
    if (typeof value.char !== 'string' || [...value.char].length < 1 || [...value.char].length > 2) {
      issues.push({ path: `${path}/char`, message: 'a component is one character and at most one selector' })
    } else {
      const [first, second] = [...value.char]
      if (!isComponent(first)) issues.push({ path: `${path}/char`, message: 'not a component' })
      if (second !== undefined && !isSelector(second)) issues.push({ path: `${path}/char`, message: 'not a variation selector' })
    }
    return
  }
  if (value.kind === 'slot') {
    closedFields(value, ['id', 'kind', 'name', 'transform', 'extensions'], path, issues)
    return
  }
  if (value.kind === 'group') {
    closedFields(value, ['id', 'kind', 'child', 'name', 'transform', 'extensions'], path, issues)
    if (!object(value.child)) issues.push({ path: `${path}/child`, message: 'a group needs a child' })
    else validateNode(value.child, `${path}/child`, depth + 1, ids, issues)
    return
  }
  if (value.kind === 'operator') {
    closedFields(value, ['id', 'kind', 'op', 'children', 'name', 'transform', 'extensions'], path, issues)
    const op = value.op
    if (typeof op !== 'string' || arity(op) === 0) issues.push({ path: `${path}/op`, message: 'unknown operator' })
    if (!array(value.children) || value.children.length !== (typeof op === 'string' ? arity(op) : 0)) {
      issues.push({ path: `${path}/children`, message: 'wrong number of operands' })
    } else value.children.forEach((child, i) => validateNode(child, `${path}/children/${i}`, depth + 1, ids, issues))
    return
  }
  issues.push({ path: `${path}/kind`, message: 'unknown layer kind' })
}

/** @param {unknown} value @param {string} path @param {Issue[]} issues */
function validateRender(value, path, issues) {
  if (!object(value)) { issues.push({ path, message: 'render is required' }); return }
  if (value.mode === 'unbound') {
    closedFields(value, ['mode', 'extensions'], path, issues)
    if (value.extensions !== undefined && !object(value.extensions)) issues.push({ path: `${path}/extensions`, message: 'extensions must be an object' })
    return
  }
  if (value.mode === 'pinned') {
    closedFields(value, ['mode', 'engine', 'revision', 'options', 'assets', 'extensions'], path, issues)
    for (const key of ['engine', 'revision']) {
      if (typeof value[key] !== 'string' || !value[key]) issues.push({ path: `${path}/${key}`, message: 'required' })
      else if (value[key].length > 200) issues.push({ path: `${path}/${key}`, message: 'at most 200 characters' })
    }
    if (!object(value.options)) issues.push({ path: `${path}/options`, message: 'options must be an object' })
    if (!array(value.assets) || value.assets.length < 1 || value.assets.length > MAX_ASSETS) issues.push({ path: `${path}/assets`, message: `1 to ${MAX_ASSETS} assets` })
    else {
      const roles = new Set()
      value.assets.forEach((asset, i) => {
        const at = `${path}/assets/${i}`
        if (!object(asset)) { issues.push({ path: at, message: 'asset must be an object' }); return }
        closedFields(asset, ['role', 'sha256', 'uri'], at, issues)
        if (typeof asset.role !== 'string' || !asset.role || asset.role.length > 200) issues.push({ path: `${at}/role`, message: '1 to 200 characters' })
        else if (roles.has(asset.role)) issues.push({ path: `${at}/role`, message: `duplicate asset role ${asset.role}` })
        else roles.add(asset.role)
        if (typeof asset.sha256 !== 'string' || !DIGEST.test(asset.sha256)) issues.push({ path: `${at}/sha256`, message: 'lowercase SHA-256' })
        if (asset.uri !== undefined) {
          if (typeof asset.uri !== 'string' || asset.uri.length > 2048) issues.push({ path: `${at}/uri`, message: 'a URI of at most 2048 characters' })
          else try { new URL(asset.uri) } catch { issues.push({ path: `${at}/uri`, message: 'must be a URI' }) }
        }
      })
    }
    if (value.extensions !== undefined && !object(value.extensions)) issues.push({ path: `${path}/extensions`, message: 'extensions must be an object' })
    return
  }
  issues.push({ path: `${path}/mode`, message: 'unbound or pinned' })
}

/** @param {unknown} value @param {string} path @param {Issue[]} issues */
function validateEdit(value, path, issues) {
  if (!object(value)) { issues.push({ path, message: 'geometry edit must be an object' }); return }
  closedFields(value, ['id', 'node', 'geometry', 'target', 'transform', 'extensions'], path, issues)
  if (typeof value.id !== 'string' || !ID.test(value.id)) issues.push({ path: `${path}/id`, message: 'invalid edit ID' })
  if (typeof value.node !== 'string' || !ID.test(value.node)) issues.push({ path: `${path}/node`, message: 'invalid layer reference' })
  if (typeof value.geometry !== 'string' || !DIGEST.test(value.geometry)) issues.push({ path: `${path}/geometry`, message: 'lowercase SHA-256' })
  if (!object(value.target)) issues.push({ path: `${path}/target`, message: 'target must be an object' })
  else if (value.target.kind === 'contour') {
    closedFields(value.target, ['kind', 'piece', 'contour'], `${path}/target`, issues)
    if (typeof value.target.piece !== 'number' || !Number.isInteger(value.target.piece) || value.target.piece < 0) issues.push({ path: `${path}/target/piece`, message: 'non-negative integer' })
    if (typeof value.target.contour !== 'number' || !Number.isInteger(value.target.contour) || value.target.contour < 0) issues.push({ path: `${path}/target/contour`, message: 'non-negative integer' })
  } else if (value.target.kind === 'stroke') {
    closedFields(value.target, ['kind', 'id'], `${path}/target`, issues)
    if (typeof value.target.id !== 'string' || !value.target.id || value.target.id.length > 200) issues.push({ path: `${path}/target/id`, message: 'source stroke ID' })
  } else issues.push({ path: `${path}/target/kind`, message: 'contour or stroke' })
  validateChain(value.transform, `${path}/transform`, issues)
  if (value.extensions !== undefined && !object(value.extensions)) issues.push({ path: `${path}/extensions`, message: 'extensions must be an object' })
}

/** Structural and semantic issues; an empty array is a valid document. @param {unknown} document @returns {Issue[]} */
export function validateDocument(document) {
  /** @type {Issue[]} */
  const issues = []
  if (!object(document)) return [{ path: '', message: 'document must be an object' }]
  closedFields(document, ['format', 'version', 'root', 'render', 'geometryEdits', 'title', 'created', 'modified', 'extensions'], '', issues)
  if (document.format !== FORMAT) issues.push({ path: '/format', message: `expected ${FORMAT}` })
  if (document.version !== VERSION) issues.push({ path: '/version', message: `expected ${VERSION}` })
  if (document.title !== undefined && (typeof document.title !== 'string' || [...document.title].length > 200)) issues.push({ path: '/title', message: 'at most 200 characters' })
  for (const key of ['created', 'modified']) {
    if (document[key] === undefined) continue
    const value = document[key]
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
      issues.push({ path: `/${key}`, message: 'RFC 3339 date-time' })
    }
  }
  if (document.extensions !== undefined && !object(document.extensions)) issues.push({ path: '/extensions', message: 'extensions must be an object' })
  validateRender(document.render, '/render', issues)
  const ids = new Set()
  let rootValid = false
  if (!object(document.root)) issues.push({ path: '/root', message: 'root is required' })
  else {
    const before = issues.length
    validateNode(document.root, '/root', 0, ids, issues)
    rootValid = issues.length === before
  }
  if (array(document.geometryEdits)) {
    if (document.geometryEdits.length > MAX_EDITS) issues.push({ path: '/geometryEdits', message: `at most ${MAX_EDITS} edits` })
    if (document.geometryEdits.length && object(document.render) && document.render.mode !== 'pinned') issues.push({ path: '/geometryEdits', message: 'geometry edits need a pinned recipe' })
    const editIds = new Set()
    document.geometryEdits.forEach((edit, i) => {
      validateEdit(edit, `/geometryEdits/${i}`, issues)
      if (object(edit) && typeof edit.id === 'string') {
        if (editIds.has(edit.id)) issues.push({ path: `/geometryEdits/${i}/id`, message: `duplicate edit ID ${edit.id}` })
        editIds.add(edit.id)
      }
    })
  } else if (document.geometryEdits !== undefined) issues.push({ path: '/geometryEdits', message: 'must be an array' })
  if (rootValid && object(document.root)) {
    const count = layers(/** @type {Node} */ (document.root)).length
    if (count > MAX_LAYERS) issues.push({ path: '/root', message: `at most ${MAX_LAYERS} layers` })
    const sequence = toSequence(/** @type {Node} */ (document.root))
    if ([...sequence].length > MAX_SEQUENCE) issues.push({ path: '/root', message: `IDS projection over ${MAX_SEQUENCE} code points` })
    else {
      const read = parse(sequence, { open: true })
      if (read.problem) issues.push({ path: '/root', message: `IDS projection does not parse: ${read.problem}` })
    }
  }
  return issues
}

/** @param {Document} document @returns {Document} */
export function assertDocument(document) {
  const issues = validateDocument(document)
  if (issues.length) throw new DocumentError(issues)
  return document
}

/** Parse and validate a `.ids.json` file. @param {string} text @returns {Document} */
export function readDocument(text) {
  if (typeof text !== 'string') throw new DocumentError([{ path: '', message: 'document text must be a string' }])
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new DocumentError([{ path: '', message: `over ${MAX_BYTES} bytes` }])
  let parsed
  try { parsed = JSON.parse(text) } catch (error) { throw new DocumentError([{ path: '', message: `invalid JSON: ${error instanceof Error ? error.message : error}` }]) }
  let inspected
  try { inspected = inspectJson(text) } catch (error) { throw new DocumentError([{ path: '', message: `invalid JSON: ${error instanceof Error ? error.message : error}` }]) }
  const problems = [
    ...inspected.duplicateKeys.map(key => ({ path: '', message: `duplicate object key ${key}` })),
    ...inspected.numbers.map(number => ({ path: '', message: `number outside finite binary64: ${number}` })),
  ]
  if (problems.length) throw new DocumentError(problems)
  return assertDocument(/** @type {Document} */ (parsed))
}

/** Serialize a document as a `.ids.json` file. @param {Document} document @returns {string} */
export function writeDocument(document) {
  assertDocument(document)
  const text = `${JSON.stringify(document, null, 2)}\n`
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new DocumentError([{ path: '', message: `over ${MAX_BYTES} bytes` }])
  return text
}

export { SLOT }
