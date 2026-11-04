// @ts-check
// Geometry edits over a rendered component's local pieces. Each edit names one contour or one
// source stroke group and carries a transform chain; the renderer applies the edits in order,
// before the component's own layer transform.
import { transformPath } from './transform.js'
import { sha256Hex } from './sha256.js'

/** @typedef {import('./model.js').GeometryEdit} GeometryEdit */
/** @typedef {{ d: string, fillRule?: 'nonzero' | 'evenodd', cut?: boolean }} Piece */
/** @typedef {{ pieces: Piece[], strokes?: { id: string, pieces: number[] }[] }} Geometry */

/** JCS-canonical descriptor for one piece. */
function pieceText(piece) {
  return `{"cut":${piece.cut === true},"d":${JSON.stringify(piece.d)},"fillRule":${JSON.stringify(piece.fillRule ?? 'nonzero')}}`
}

/**
 * The lowercase SHA-256 of the JCS-encoded unedited descriptor: 1000-unit pieces in renderer order
 * and the source stroke groups. Path text is hashed exactly.
 * @param {Geometry} geometry
 */
export function fingerprintGeometry(geometry) {
  const strokes = (geometry.strokes ?? []).map(stroke => `{"id":${JSON.stringify(stroke.id)},"pieces":[${stroke.pieces.join(',')}]}`)
  return sha256Hex(`{"pieces":[${geometry.pieces.map(pieceText).join(',')}],"strokes":[${strokes.join(',')}],"units":1000}`)
}

/** The closed subpaths of a piece, each starting at M. @param {string} d @returns {string[]} */
export function splitSubpaths(d) {
  return d.match(/M[^M]*/g) ?? []
}

/** @param {string[]} subpaths */
const joinSubpaths = subpaths => subpaths.join('')

/**
 * Apply the edits that belong to `node` to `geometry`. A contour edit transforms one subpath in its
 * own piece; a stroke edit transforms every piece in the named stroke group. Edits whose target is
 * absent stay unresolved and are reported, not broadened to the whole component.
 * @param {Geometry} geometry @param {GeometryEdit[]} edits @param {string} node
 * @param {{ tolerance?: number }} [options]
 * @returns {{ geometry: Geometry, applied: string[], unresolved: GeometryEdit[] }}
 */
export function applyGeometryEdits(geometry, edits, node, { tolerance = 0.1 } = {}) {
  /** @type {Piece[]} */
  const pieces = geometry.pieces.map(piece => ({ ...piece }))
  const strokes = geometry.strokes ?? []
  const applied = []
  /** @type {GeometryEdit[]} */
  const unresolved = []
  const base = fingerprintGeometry(geometry)
  for (const edit of edits) {
    if (edit.node !== node) continue
    if (edit.geometry !== base) { unresolved.push(edit); continue }
    if (edit.target.kind === 'contour') {
      const piece = pieces[edit.target.piece]
      if (!piece) { unresolved.push(edit); continue }
      const subpaths = splitSubpaths(piece.d)
      if (!subpaths[edit.target.contour]) { unresolved.push(edit); continue }
      subpaths[edit.target.contour] = transformPath(subpaths[edit.target.contour], edit.transform, { tolerance }).d
      piece.d = joinSubpaths(subpaths)
      applied.push(edit.id)
      continue
    }
    const group = strokes.find(stroke => stroke.id === edit.target.id)
    if (!group) { unresolved.push(edit); continue }
    let ok = true
    for (const index of group.pieces) {
      const piece = pieces[index]
      if (!piece) { ok = false; break }
    }
    if (!ok) { unresolved.push(edit); continue }
    for (const index of group.pieces) {
      pieces[index] = { ...pieces[index], d: transformPath(pieces[index].d, edit.transform, { tolerance }).d }
    }
    applied.push(edit.id)
  }
  return { geometry: { ...geometry, pieces }, applied, unresolved }
}
