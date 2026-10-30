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
const FONT_SIZE = [80, 68, 56, 44, 36, 28, 22, 18]
const cluster = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const cells = sequence => [...cluster.segment(sequence)].map(({ segment }) => segment)
export const escaped = text => text.replace(/[&<>"']/g, mark => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[mark])

function measured(sequence) {
  const characters = cells(sequence)
  for (const count of [1, 2]) {
    for (const size of FONT_SIZE) {
      const columns = Math.floor(COLUMN.width / size)
      if (characters.length <= columns * count) return { size, lines: chunk(characters, columns) }
    }
  }
  const size = FONT_SIZE.at(-1), columns = Math.floor(COLUMN.width / size)
  return { size, lines: chunk([...characters.slice(0, 2 * columns - 1), '…'], columns) }
}
const chunk = (characters, columns) => {
  const lines = []
  for (let at = 0; at < characters.length; at += columns) lines.push(characters.slice(at, at + columns))
  return lines
}

function glyph(drawing, palette) {
  const { x, y, side, pad } = FRAME
  const box = side - 2 * pad, inset = 16, span = 1000 + 2 * inset
  if (!drawing) return `<text x="${x + side / 2}" y="${y + side / 2 + 8}" text-anchor="middle" font-size="20" fill="${palette.muted}">Preview unavailable</text>`
  return drawingSvg(drawing, { ink: palette.ink, padding: inset / 1000, placeholders: true, size: box })
    .replace(/^<svg[^>]*>/, `<svg x="${x + pad}" y="${y + pad}" width="${box}" height="${box}" viewBox="${-inset} ${-inset} ${span} ${span}">`)
}

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
  const { size, lines } = measured(sequence)
  const first = 304 - (lines.length - 1) * size * 0.65
  const text = lines.map((line, row) => line.map((character, col) =>
    `<text data-sequence="true" x="${COLUMN.left + col * size}" y="${Math.round(first + row * size * 1.3)}" font-family="${escaped(familyOf(character))}" font-size="${size}" fill="${p.ink}">${escaped(character)}</text>`).join('')).join('')
  const identity = char
    ? `<text x="568" y="411" font-family="${escaped(familyOf(char))}" font-size="44" fill="${p.ink}">${escaped(char)}</text><rect x="636" y="376" width="164" height="44" rx="9" fill="${p.soft}"/><text x="654" y="405" font-size="23" fill="${p.accent}">U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}</text>`
    : `<text x="568" y="405" font-size="23" fill="${p.muted}">No Unicode match</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Noto Sans CJK JP">`
    + `<rect width="1200" height="630" fill="${p.bg}"/>`
    + `<rect x="24" y="24" width="1152" height="582" rx="28" fill="${p.surface}" stroke="${p.line}"/>`
    + `<rect x="56" y="54" width="5" height="26" rx="2.5" fill="${p.accent}"/><text x="76" y="77" font-size="26" fill="${p.ink}">IDS Workshop</text>`
    + `<text x="1120" y="75" text-anchor="end" font-size="18" fill="${p.muted}">ids.mkpo.li</text>`
    + `<path d="M56 103H1144" stroke="${p.line}"/>`
    + frame(p) + glyph(drawing, p)
    + `<text x="568" y="202" font-size="18" fill="${p.muted}">IDEOGRAPHIC DESCRIPTION</text>`
    + text + identity
    + `<path d="M568 479H1108" stroke="${p.line}"/>`
    + `<text x="568" y="520" font-size="20" fill="${p.muted}">Open in IDS Workshop</text>`
    + `<path d="M1081 513H1105M1097 505L1105 513L1097 521" fill="none" stroke="${p.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    + '</svg>'
}
