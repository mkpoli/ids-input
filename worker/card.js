// The share card uses the workshop palette. IDC characters are text; button icons never enter it.
import { drawingSvg } from '../src/core/preview.js'
import { scopesSvg } from '../src/document/svg.js'

export const SIZE = { width: 1200, height: 630 }
/** @param {string} character */
export const codePoint = (character) => `U+${/** @type {number} */ (character.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`
// Keep these values aligned with demo/app.css; the card tests check both schemes.
export const PALETTES = {
  light: { bg: '#f3f3f6', surface: '#ffffff', subtle: '#f6f6f9', ink: '#1c1c22', muted: '#686874', line: '#e1e1e8', strong: '#c2c2cc', accent: '#2944c7', soft: '#e9edfd' },
  dark: { bg: '#111114', surface: '#1b1b20', subtle: '#16161a', ink: '#ececf2', muted: '#9d9daa', line: '#2e2e36', strong: '#4a4a55', accent: '#8ea8ff', soft: '#232c4c' },
}
const COLUMN = { left: 568, width: 540 }
const FRAME = { x: 64, y: 130, side: 432, pad: 42 }
const SEQUENCE_BOX = { centerY: 288, height: 144, leading: 1.22 }
const MAX_SIZE = 88
const MIN_SIZE = 26
const cluster = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
/** @param {string} sequence */
const cells = sequence => [...cluster.segment(sequence)].map(({ segment }) => segment)
/** @param {string} text */
export const escaped = text => text.replace(/[&<>"']/g, mark => /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[mark])

// Fit full-width grapheme cells continuously. Wrap before shrinking below a legible size;
// exceptionally long descriptions end with an ellipsis inside the same fixed-height region.
/** @param {string} sequence */
export function sequenceLayout(sequence) {
  const characters = cells(sequence)
  if (!characters.length) return { size: MAX_SIZE, lines: [], truncated: false }
  let best = { size: 0, columns: 1 }
  for (const rows of [1, 2, 3]) {
    const columns = Math.ceil(characters.length / rows)
    const heightLimit = SEQUENCE_BOX.height / (1 + (rows - 1) * SEQUENCE_BOX.leading)
    const size = Math.floor(Math.min(MAX_SIZE, COLUMN.width / columns, heightLimit) * 10) / 10
    // The largest fitting layout is monotonic in length. Ties keep fewer lines.
    if (size > best.size) best = { size, columns }
  }
  if (best.size >= MIN_SIZE) return { size: best.size, lines: chunk(characters, best.columns), truncated: false }
  const columns = Math.floor(COLUMN.width / MIN_SIZE), capacity = columns * 3
  return { size: MIN_SIZE, lines: chunk([...characters.slice(0, capacity - 1), '…'], columns), truncated: true }
}
/** @param {string[]} characters @param {number} columns */
const chunk = (characters, columns) => {
  const lines = []
  for (let at = 0; at < characters.length; at += columns) lines.push(characters.slice(at, at + columns))
  return lines
}

/** @param {Parameters<typeof drawingSvg>[0] | null} drawing @param {typeof PALETTES.light} palette */
/** A drawing placed in the frame, or the ordinal of a unit that has none. @param {any} drawing @param {typeof PALETTES.light} palette @param {number} [ordinal] */
function glyph(drawing, palette, ordinal) {
  const { x, y, side, pad } = FRAME
  const box = side - 2 * pad, inset = 16, span = 1000 + 2 * inset
  if (!drawing) {
    const mark = ordinal === undefined ? 'Preview unavailable' : `Unit ${ordinal} unavailable`
    return `<text x="${x + side / 2}" y="${y + side / 2 + 8}" text-anchor="middle" font-size="20" fill="${palette.muted}">${mark}</text>`
  }
  return drawingSvg(drawing, { ink: palette.ink, padding: inset / 1000, placeholders: true, size: box })
    .replace(/^<svg[^>]*>/, `<svg x="${x + pad}" y="${y + pad}" width="${box}" height="${box}" viewBox="${-inset} ${-inset} ${span} ${span}">`)
}

/**
 * A document's scoped drawing in the frame, or its sequence drawing where the layers have no scoped
 * form. The scoped drawing keeps the document's layer transforms.
 * @param {{ scopes: any, drawing: any, palette: typeof PALETTES.light }} given
 */
function documentGlyph({ scopes, drawing, palette }) {
  if (!scopes) return glyph(drawing, palette)
  const { x, y, side, pad } = FRAME
  const box = side - 2 * pad, inset = 16, span = 1000 + 2 * inset
  const slots = Array.isArray(drawing?.slots) ? drawing.slots.map((/** @type {any} */ slot) => slot.box) : []
  return scopesSvg(scopes, {
    ink: palette.ink, padding: inset / 1000, size: box, idPrefix: 'og-document', slots,
    emoji: drawing?.emoji ?? null, cut: drawing?.cut ?? '',
    cutLeaf: drawing?.parts?.find((/** @type {any} */ part) => part.cut)?.leaf ?? null,
  }).replace(/^<svg[^>]*>/, `<svg x="${x + pad}" y="${y + pad}" width="${box}" height="${box}" viewBox="${-inset} ${-inset} ${span} ${span}">`)
}

/** A document title set in one line: the size the column gives it, with an ellipsis past 27 cells.
 *  @param {string} text */
function titleLine(text) {
  const characters = cells(text)
  const size = Math.min(40, Math.max(20, Math.floor(COLUMN.width / Math.max(1, characters.length))))
  const shown = characters.length > 27 ? [...characters.slice(0, 26), '…'] : characters
  return { text: shown.join(''), size }
}

const GAP = 14
/**
 * The units of a named sequence set side by side in the frame: each character the sequence writes,
 * composed on its own, then the character the sequence draws. Two units stand at the frame's height;
 * more wrap into rows of two to four. A unit with no drawing is set as its character.
 * @param {{ units: string[], drawings: (any | null)[], palette: typeof PALETTES.light }} given
 */
function unitsGlyph({ units, drawings, palette }) {
  const { x, y, side, pad } = FRAME
  const box = side - 2 * pad
  const columns = units.length <= 2 ? units.length : units.length <= 6 ? 3 : 4
  const rows = Math.ceil(units.length / columns)
  const cell = Math.min(box, (box - GAP * (columns - 1)) / columns)
  const height = Math.min(cell, (box - GAP * (rows - 1)) / rows)
  const across = height * columns + GAP * (columns - 1)
  const left0 = x + pad + (box - across) / 2
  const top0 = y + pad + (box - (height * rows + GAP * (rows - 1))) / 2
  return units.map((unit, at) => {
    const left = left0 + (at % columns) * (height + GAP)
    const top = top0 + Math.floor(at / columns) * (height + GAP)
    const drawn = drawings[at]
    if (!drawn) {
      return `<text x="${(left + height / 2).toFixed(1)}" y="${(top + height / 2 + height / 5).toFixed(1)}" text-anchor="middle" font-size="${(height / 2.5).toFixed(1)}" fill="${palette.muted}">${escaped(unit)}</text>`
    }
    return drawingSvg(drawn, { ink: palette.ink, placeholders: true, size: Math.round(height) })
      .replace(/^<svg[^>]*>/, `<svg x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${height.toFixed(1)}" height="${height.toFixed(1)}" viewBox="-8 -8 1016 1016">`)
  }).join('')
}

/** @param {typeof PALETTES.light} p */
function frame(p) {
  const { x, y, side } = FRAME
  return `<rect x="${x + 8}" y="${y + 8}" width="${side}" height="${side}" rx="22" fill="${p.soft}"/>`
    + `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="22" fill="${p.surface}" stroke="${p.line}"/>`
    + `<rect x="${x + 20}" y="${y + 20}" width="${side - 40}" height="${side - 40}" rx="8" fill="none" stroke="${p.line}"/>`
    + `<path d="M${x + 20} ${y + 52}V${y + 28}Q${x + 20} ${y + 20} ${x + 28} ${y + 20}H${x + 52}M${x + side - 52} ${y + side - 20}H${x + side - 28}Q${x + side - 20} ${y + side - 20} ${x + side - 20} ${y + side - 28}V${y + side - 52}" fill="none" stroke="${p.accent}" stroke-width="3" stroke-linecap="round"/>`
}

/**
 * The glyphemes of a description: an operator with the character it joins is one grapheme, so the
 * halves of a pair are never set apart. @param {string} sequence
 */
const glyphemes = sequence => [...cluster.segment(sequence)].map(({ segment }) => segment)

const isOperator = (/** @type {string} */ cell) => /^[⿰-⿿〾㇯]$/u.test(cell) || cell === '\u{303E}' || cell === '\u{31EF}'
/** @param {string} unit */
const cellOf = unit => isOperator(unit) ? unit : [...unit][0]
/**
 * The face each unit is set in, as the font table answers for it: an operator in the IDC face, a
 * character in its own face. `familyOf` answers for a character, so a description is asked for its
 * units.
 * @param {{ units: string[], familyOf: (character: string) => string }} given
 */
function faces({ units: given, familyOf }) {
  const sample = given.map(cellOf).find(cell => !isOperator(cell)) ?? ''
  return (/** @type {string | undefined} */ cell) => {
    if (cell === undefined || isOperator(cell)) return faceOfOperator(familyOf, cell ?? sample)
    return familyOf(cell)
  }
}
/** The face an operator is set in; the characters of the sequence keep theirs beside it. @param {(character: string) => string} familyOf @param {string} cell */
function faceOfOperator(familyOf, cell) {
  const face = cell ? familyOf(cell) : 'IDS Operators'
  return face
}

/**
 * @param {{ sequence: string, drawing?: any, char?: string | null, familyOf?: (character: string) => string,
 *   units?: string[], drawings?: (any | null)[], theme?: 'light' | 'dark', codepoint?: string,
 *   document?: { scopes: any, title: string | null } | null }} card
 */
export function cardSvg({ sequence, drawing = null, char = null, familyOf = () => 'Noto Sans CJK JP', units: shown, drawings = [], theme = 'light', codepoint, document = null }) {
  const p = PALETTES[theme]
  // A sequence read with a character it does not compose draws only the cells of that character.
  const faceOf = faces({ units: shown ?? (char && codepoint ? [char] : glyphemes(sequence)), familyOf })
  const { size, lines } = sequenceLayout(sequence)
  const height = size * (1 + (lines.length - 1) * SEQUENCE_BOX.leading)
  const first = SEQUENCE_BOX.centerY - height / 2 + size * 0.8
  const text = lines.map((line, row) => line.map((character, col) =>
    `<text data-sequence="true" x="${(COLUMN.left + (col + 0.5) * size).toFixed(1)}" y="${(first + row * size * SEQUENCE_BOX.leading).toFixed(1)}" text-anchor="middle" font-family="${escaped(faceOf(cellOf(character)))}" font-size="${size}" fill="${p.ink}">${escaped(character)}</text>`).join('')).join('')
  const point = codepoint ?? (char ? codePoint(char) : null)
  /** @param {string} character */
  const family = (character) => escaped(faceOf(character))
  const characterIdentity = char
    ? `<text x="568" y="398" font-size="14" fill="${p.muted}">Character</text>`
      + `<text data-character="true" x="568" y="441" font-family="${family(char)}" font-size="40" fill="${p.ink}">${escaped(char)}</text>`
      + `<path d="M628 397V437" stroke="${p.line}"/>`
      + `<text x="650" y="402" font-size="14" fill="${p.muted}">Unicode</text>`
      + `<text data-codepoint="true" x="650" y="433" font-size="22" letter-spacing="1.1" fill="${p.ink}">${escaped(point ?? '')}</text>`
    : `<text x="568" y="398" font-size="14" fill="${p.muted}">Composes</text>`
      + `<text x="568" y="436" font-size="20" fill="${p.muted}">No character at this code point</text>`
  // A document with a title says that; one without keeps the character its sequence names.
  const identity = document
    ? document.title
      ? (() => {
          const line = titleLine(document.title)
          return `<text x="568" y="398" font-size="14" fill="${p.muted}">Document</text>`
            + `<text data-document="true" x="568" y="441" font-size="${line.size}" fill="${p.ink}">${escaped(line.text)}</text>`
        })()
      : char ? characterIdentity : ''
    : characterIdentity
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Noto Sans CJK JP">`
    + `<rect width="1200" height="630" fill="${p.bg}"/>`
    + `<rect x="24" y="24" width="1152" height="582" rx="28" fill="${p.surface}" stroke="${p.line}"/>`
    + `<rect x="56" y="54" width="5" height="26" rx="2.5" fill="${p.accent}"/><text x="76" y="77" font-size="26" fill="${p.ink}">IDS Workshop</text>`
    + `<text x="1120" y="75" text-anchor="end" font-size="18" fill="${p.muted}">ids.mkpo.li</text>`
    + `<path d="M56 103H1144" stroke="${p.line}"/>`
    + frame(p)
    + (document ? documentGlyph({ scopes: document.scopes, drawing, palette: p }) : shown ? unitsGlyph({ units: shown, drawings: drawings.length ? drawings : [drawing, ...shown.slice(1).map(() => null)], palette: p }) : glyph(drawing, p))
    + `<text x="568" y="${shown ? 160 : 193}" font-size="19" fill="${p.muted}">${document ? 'Shared document' : shown ? 'Characters of the description, each drawn on its own' : 'Ideographic description sequence'}</text>`
    + text + identity
    + `<path d="M568 479H1108" stroke="${p.line}"/>`
    + `<text x="568" y="520" font-size="20" fill="${p.muted}">Open in IDS Workshop</text>`
    + `<path d="M1081 513H1105M1097 505L1105 513L1097 521" fill="none" stroke="${p.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    + '</svg>'
}
