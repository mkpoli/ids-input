// @ts-nocheck
// The card behind a shared link: the drawing in a framed square on the left, the sequence, its
// character and code point, and the site's name on the right. Built as SVG here and rasterized by
// `render.js`.
import { drawingSvg } from '../src/core/preview.js'
import { OPERATORS } from './operators.js'

export const SIZE = { width: 1200, height: 630 }
const PAPER = '#f4efe4'
const INK = '#17171b'
const MUTED = '#7b7267'
const LINE = '#d5cbb9'
const ACCENT = '#b3402c'
const COLUMN = { left: 606, width: 530 }
const FRAME = { x: 64, y: 72, side: 486, pad: 44 }
const FONT_SIZE = [96, 76, 60, 48, 38, 30, 24, 20]

/** Text as SVG text, with the characters XML needs escaped. @param {string} text */
export const escaped = text => text.replace(/[&<>"']/g, mark => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[mark])

// A sequence is one em to the character in every face used here, so its width can be counted: the
// largest size that keeps it on one line, then the largest that keeps it to two, then the shortest
// end of the ladder cut with an ellipsis.
/** @param {string} sequence */
const cluster = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
/** A sequence as the cells it is set in: a base with its marks is one. @param {string} sequence */
const cells = sequence => [...cluster.segment(sequence)].map(({ segment }) => segment)

function measured(sequence) {
  const characters = cells(sequence)
  for (const lines of [1, 2]) {
    for (const size of FONT_SIZE) {
      const columns = Math.floor(COLUMN.width / size)
      if (Math.ceil(characters.length / columns) <= lines) return { size, lines: chunk(characters, columns) }
    }
  }
  const size = FONT_SIZE.at(-1), columns = Math.floor(COLUMN.width / size)
  const cut = characters.slice(0, 2 * columns - 1)
  if (characters.length > 2 * columns) cut.push('…')
  return { size, lines: chunk(cut, columns) }
}

/** @param {string[]} characters @param {number} size */
const chunk = (characters, size) => {
  const lines = []
  for (let at = 0; at < characters.length; at += size) lines.push(characters.slice(at, at + size).join(''))
  return lines
}

/** The drawing in the frame, or the empty-slot mark where there is none. @param {any} drawing */
function glyph(drawing) {
  const { x, y, side, pad } = FRAME
  const box = side - 2 * pad, inset = 16, span = 1000 + 2 * inset
  if (!drawing) {
    return `<text x="${x + side / 2}" y="${y + side / 2 + 84}" font-family="'Noto Sans CJK JP'" font-size="230" fill="${LINE}" text-anchor="middle">⬚</text>`
  }
  return drawingSvg(drawing, { ink: INK, padding: inset / 1000, placeholders: true, size: box })
    .replace(/^<svg[^>]*>/, `<svg x="${x + pad}" y="${y + pad}" width="${box}" height="${box}" viewBox="${-inset} ${-inset} ${span} ${span}">`)
}

/** The frame's hairline with its corner marks. */
function frame() {
  const { x, y, side } = FRAME, end = x + side, foot = y + side, tick = 26
  return [
    `<rect x="${x}" y="${y}" width="${side}" height="${side}" fill="none" stroke="${ACCENT}" stroke-width="3"/>`,
    `<path d="M${x} ${y + tick}V${y}H${x + tick}M${end - tick} ${y}H${end}V${y + tick}M${end} ${foot - tick}V${foot}H${end - tick}M${x + tick} ${foot}H${x}V${foot - tick}" fill="none" stroke="${INK}" stroke-width="9"/>`,
  ].join('')
}

/**
 * One character of the sequence at `x`, its baseline at `y`: an operator as its own icon, anything
 * else as text in the face chosen for it.
 * @param {string} character @param {number} x @param {number} y @param {number} size @param {(character: string) => string} familyOf
 */
function set(character, x, y, size, familyOf) {
  const icon = OPERATORS[character]
  if (icon) {
    const box = size * 0.8
    return `<g transform="translate(${Math.round(x + (size - box) / 2)} ${Math.round(y - size * 0.9)}) scale(${box / 24})">${icon}</g>`
  }
  return `<text x="${x}" y="${y}" font-family="${familyOf(character)}" font-size="${size}" fill="${INK}">${escaped(character)}</text>`
}

// The row under the sequence: the character with its code point, or the word for having none yet,
// so the column keeps its rhythm either way.
/** @param {string | null} char @param {(character: string) => string} familyOf */
function ident(char, familyOf) {
  if (!char) return `<text x="${COLUMN.left}" y="442" font-family="'Noto Sans CJK JP'" font-size="24" fill="${MUTED}" letter-spacing="1.6">UNENCODED</text>`
  const code = `U+${/** @type {number} */ (char.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`
  return `<text x="${COLUMN.left}" y="442" font-family="${familyOf(char)}" font-size="52" fill="${INK}">${escaped(char)}</text>`
    + `<text x="${COLUMN.left + 74}" y="442" font-family="'Noto Sans CJK JP'" font-size="25" fill="${MUTED}">${code}</text>`
}

/**
 * The card for `sequence`, drawn from `drawing` where one was composed. `char` is the character the
 * sequence describes, when there is one; `familyOf` names the face for a character.
 * @param {{ sequence: string, drawing?: any, char?: string | null, familyOf?: (character: string) => string }} card
 */
export function cardSvg({ sequence, drawing = null, char = null, familyOf = () => "'Noto Sans CJK JP'" }) {
  const { size, lines } = measured(sequence)
  const leading = size * 1.3
  const first = 300 - (lines.length - 1) * leading / 2
  const sequence_ = lines.map((line, at) => {
    const baseline = Math.round(first + at * leading)
    return cells(line).map((character, column) => set(character, COLUMN.left + Math.round(column * size), baseline, size, familyOf)).join('')
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE.width}" height="${SIZE.height}" viewBox="0 0 ${SIZE.width} ${SIZE.height}">`
    + `<rect width="${SIZE.width}" height="${SIZE.height}" fill="${PAPER}"/>`
    + frame() + glyph(drawing)
    + `<rect x="${COLUMN.left}" y="112" width="15" height="15" fill="${ACCENT}"/>`
    + `<text x="${COLUMN.left + 28}" y="126" font-family="'Noto Sans CJK JP'" font-size="21" letter-spacing="3.4" fill="${INK}">IDS WORKSHOP</text>`
    + `<rect x="${COLUMN.left}" y="150" width="${COLUMN.width}" height="2" fill="${LINE}"/>`
    + sequence_ + ident(char, familyOf)
    + `<text x="${COLUMN.left}" y="552" font-family="'Noto Sans CJK JP'" font-size="21" fill="${MUTED}">ids.mkpo.li</text>`
    + '</svg>'
}
