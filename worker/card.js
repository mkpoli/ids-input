// The share card uses the workshop palette. IDC characters are text; button icons never enter it.
import { drawingSvg } from '../src/core/preview.js'

export const SIZE = { width: 1200, height: 630 }
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
function glyph(drawing, palette) {
  const { x, y, side, pad } = FRAME
  const box = side - 2 * pad, inset = 16, span = 1000 + 2 * inset
  if (!drawing) return `<text x="${x + side / 2}" y="${y + side / 2 + 8}" text-anchor="middle" font-size="20" fill="${palette.muted}">Preview unavailable</text>`
  return drawingSvg(drawing, { ink: palette.ink, padding: inset / 1000, placeholders: true, size: box })
    .replace(/^<svg[^>]*>/, `<svg x="${x + pad}" y="${y + pad}" width="${box}" height="${box}" viewBox="${-inset} ${-inset} ${span} ${span}">`)
}

/** @param {typeof PALETTES.light} p */
function frame(p) {
  const { x, y, side } = FRAME
  return `<rect x="${x + 8}" y="${y + 8}" width="${side}" height="${side}" rx="22" fill="${p.soft}"/>`
    + `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="22" fill="${p.surface}" stroke="${p.line}"/>`
    + `<rect x="${x + 20}" y="${y + 20}" width="${side - 40}" height="${side - 40}" rx="8" fill="none" stroke="${p.line}"/>`
    + `<path d="M${x + 20} ${y + 52}V${y + 28}Q${x + 20} ${y + 20} ${x + 28} ${y + 20}H${x + 52}M${x + side - 52} ${y + side - 20}H${x + side - 28}Q${x + side - 20} ${y + side - 20} ${x + side - 20} ${y + side - 28}V${y + side - 52}" fill="none" stroke="${p.accent}" stroke-width="3" stroke-linecap="round"/>`
}

/** @param {{ sequence: string, drawing?: any, char?: string | null, familyOf?: (character: string) => string, theme?: 'light' | 'dark' }} card */
export function cardSvg({ sequence, drawing = null, char = null, familyOf = () => 'Noto Sans CJK JP', theme = 'light' }) {
  const p = PALETTES[theme]
  const { size, lines } = sequenceLayout(sequence)
  const height = size * (1 + (lines.length - 1) * SEQUENCE_BOX.leading)
  const first = SEQUENCE_BOX.centerY - height / 2 + size * 0.8
  const text = lines.map((line, row) => line.map((character, col) =>
    `<text data-sequence="true" x="${(COLUMN.left + (col + 0.5) * size).toFixed(1)}" y="${(first + row * size * SEQUENCE_BOX.leading).toFixed(1)}" text-anchor="middle" font-family="${escaped(familyOf(character))}" font-size="${size}" fill="${p.ink}">${escaped(character)}</text>`).join('')).join('')
  const identity = char
    ? `<text x="568" y="435" font-family="${escaped(familyOf(char))}" font-size="40" fill="${p.ink}">${escaped(char)}</text><path d="M628 397V437" stroke="${p.line}"/><text x="650" y="402" font-size="14" fill="${p.muted}">Unicode</text><text data-codepoint="true" x="650" y="433" font-size="22" letter-spacing="1.1" fill="${p.ink}">U+${(/** @type {number} */ (char.codePointAt(0))).toString(16).toUpperCase().padStart(4, '0')}</text>`
    : `<text x="568" y="426" font-size="20" fill="${p.muted}">No Unicode match</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Noto Sans CJK JP">`
    + `<rect width="1200" height="630" fill="${p.bg}"/>`
    + `<rect x="24" y="24" width="1152" height="582" rx="28" fill="${p.surface}" stroke="${p.line}"/>`
    + `<rect x="56" y="54" width="5" height="26" rx="2.5" fill="${p.accent}"/><text x="76" y="77" font-size="26" fill="${p.ink}">IDS Workshop</text>`
    + `<text x="1120" y="75" text-anchor="end" font-size="18" fill="${p.muted}">ids.mkpo.li</text>`
    + `<path d="M56 103H1144" stroke="${p.line}"/>`
    + frame(p) + glyph(drawing, p)
    + `<text x="568" y="193" font-size="19" fill="${p.muted}">Ideographic description sequence</text>`
    + text + identity
    + `<path d="M568 479H1108" stroke="${p.line}"/>`
    + `<text x="568" y="520" font-size="20" fill="${p.muted}">Open in IDS Workshop</text>`
    + `<path d="M1081 513H1105M1097 505L1105 513L1097 521" fill="none" stroke="${p.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    + '</svg>'
}
