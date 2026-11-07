// @ts-check
// Shared visual forms: descriptions that name one intended component, drawn from donor outlines.
//
// A form matches a description by the operands above its base. The pattern lists those operands as
// an IDS prefix; the remaining text is the base, drawn by the ordinary composer. Every recipe piece
// names a donor glyph in the pinned export and a contour of it, so the form keeps the face's stroke
// weights and terminals.
import { makePart, mapped, placed } from './geometry.js'
import catalog from './visual-forms.json' with { type: 'json' }

/** @typedef {{ donor: string, contour: number | null, box: number[], origin: string }} Piece */
/** @typedef {{ bottom: number[], pieces: Piece[] }} Face */
/** @typedef {{ id: string, patterns: string[], faces: Record<string, Face> }} Form */

/** @type {Form[]} */
const FORMS = catalog.forms
const FACE = [0, 0, 1000, 1000]

/** Patterns longest first, so a more specific form wins. */
const MATCHERS = FORMS.flatMap(form => form.patterns.map(prefix => ({ form, prefix })))
  .sort((a, b) => b.prefix.length - a.prefix.length)

/**
 * The form whose prefix `key` begins with, and the base that follows it. A description with an
 * operator annotation or a variation selector carries it in the key, so it does not match.
 * @param {string} key
 * @returns {{ form: Form, base: string } | null}
 */
export function matchVisualForm(key) {
  for (const { form, prefix } of MATCHERS) {
    if (!key.startsWith(prefix)) continue
    const base = key.slice(prefix.length)
    if (!base) continue
    return { form, base }
  }
  return null
}

/**
 * The parts of a matched form: each donor piece placed into `region`, then the base drawn below it.
 * The caller supplies the composer, whose glyph lookup and parsing decide availability.
 * @param {any} composer
 * @param {any} node
 * @param {number[]} region
 * @param {(node: any) => string} keyOf
 * @returns {any[] | null}
 */
export function visualFormParts(composer, node, region, keyOf) {
  if (typeof node === 'string' || composer.separate) return null
  // The registered prefix is literal, so a cheap spelling check keeps normalization out of every node.
  const written = matchVisualForm(keyOf(node))
  if (!written) return null
  const match = matchVisualForm(composer.renderKey(node))
  if (!match || match.form.id !== written.form.id) return null
  const face = /** @type {Face | undefined} */ (match.form.faces[composer.fontStyle])
  if (!face) return null
  let base
  try { base = composer.parse(match.base) } catch { return null }
  const pieces = []
  for (const piece of face.pieces) {
    if (composer.excluded(piece.donor)) return null
    const glyph = composer.glyph(piece.donor)
    if (!glyph) return null
    const contours = piece.contour === null ? glyph.contours : [glyph.contours[piece.contour]]
    if (!contours[0]) return null
    const part = makePart(contours)
    pieces.push({ ...placed(part, part.box, mapped(piece.box, FACE, region), composer.ink(piece.donor), piece.origin), fixed: true })
  }
  return [...pieces, ...composer.node(base, mapped(face.bottom, FACE, region), false)]
}

export { FORMS }
