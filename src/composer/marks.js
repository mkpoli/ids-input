// @ts-nocheck
// Loose marks drawn after a description: a voicing dot, a tone mark, a tone letter or a superscript.
// The shapes come from the same outlines as components (Noto Sans CJK, Jigmo, Unifont and the other
// pinned faces); where they sit follows what the mark is. A combining mark sits over or under the
// whole drawing, centered. A kana voicing mark, a spacing accent, a tone letter and a superscript sit
// at the upper right, in a row. A Hangul tone mark sits at the left, where the syllable's tone is
// written. Sizes follow the drawing's character box, so a mark looks the same on any composition.
import { placed } from './geometry.js'

const KANA = /^[\u3099\u309A]$/u
const KANA_SPACING = /^[\u309B\u309C]$/u
const HANGUL = /^[\u302E\u302F]$/u
const ATTACHED = /^\p{M}$/u

/** How a loose mark is drawn: `attached` sits over or under the drawing, `kana`, `spacing` and
 *  `hangul` beside it. @param {string} char */
export function markKind(char) {
  if (KANA.test(char)) return 'kana'
  if (KANA_SPACING.test(char)) return 'spacing'
  if (HANGUL.test(char)) return 'hangul'
  return ATTACHED.test(char) ? 'attached' : 'spacing'
}

/** Whether a mark's outline lies below the baseline, so it hangs under the drawing. @param {*} part */
const hangsBelow = part => part.box[3] <= 0

/**
 * The loose marks of a description as placed parts: `placed` records the composer draws with everything
 * else, origin `mark <char>`. `frame` is the character box in font units (y up) the marks sit in; marks
 * with no outline in the loaded data are left out, so a preview keeps the drawing it has.
 * @param {import('./compose.js').Composer} composer
 * @param {string} marks
 * @param {number[]} [frame]
 */
export function markParts(composer, marks, frame = composer.face) {
  const [x0, y0, x1, y1] = frame
  const width = x1 - x0, height = y1 - y0
  const base = height / 900, inset = height * 0.02
  /** @type {{ char: string, part: any, kind: string }[]} */
  const glyphs = []
  for (const char of marks) {
    const part = composer.glyph(char)
    if (part) glyphs.push({ char, part, kind: markKind(char) })
  }
  if (!glyphs.length) return []
  /** @type {{ part: any, target: number[], char: string }[]} */
  const targets = []

  /** How large one mark is drawn against the character box. */
  const sizeOf = g => g.kind === 'kana' ? base : KANA_SPACING.test(g.char) ? base * 0.75 : base * 0.68

  /** A row of marks at the upper right, each top aligned, scaled to fit the room. */
  const upperRight = list => {
    const scale = Math.min(...list.map(sizeOf))
    const gap = width * 0.02
    let total = list.reduce((sum, g) => sum + (g.part.box[2] - g.part.box[0]) * scale, 0) + gap * (list.length - 1)
    const room = width * 0.5
    const fit = total > room ? room / total : 1
    const s = scale * fit
    let x = x1 - inset - total * fit
    for (const g of list) {
      const w = (g.part.box[2] - g.part.box[0]) * s, h = (g.part.box[3] - g.part.box[1]) * s
      targets.push({ ...g, target: [x, y1 - inset - h, x + w, y1 - inset] })
      x += w + gap * fit
    }
  }

  const row = glyphs.filter(g => g.kind === 'spacing' || g.kind === 'kana')
  if (row.length) upperRight(row)

  const above = glyphs.filter(g => g.kind === 'attached' && !hangsBelow(g.part))
  if (above.length) {
    let scale = base * 0.85
    const heights = above.map(g => (g.part.box[3] - g.part.box[1]) * scale)
    const total = heights.reduce((sum, h) => sum + h, 0)
    const room = height * 0.34
    if (total > room) scale *= room / total
    // The first mark sits closest to the drawing; the ones after it stack above it.
    let y = y1 - inset - total
    for (const g of above) {
      const h = (g.part.box[3] - g.part.box[1]) * scale, w = (g.part.box[2] - g.part.box[0]) * scale
      const x = (x0 + x1) / 2 - w / 2
      targets.push({ ...g, target: [x, y, x + w, y + h] })
      y += h
    }
  }

  const below = glyphs.filter(g => g.kind === 'attached' && hangsBelow(g.part))
  if (below.length) {
    let scale = base * 0.85
    const heights = below.map(g => (g.part.box[3] - g.part.box[1]) * scale)
    const total = heights.reduce((sum, h) => sum + h, 0)
    const room = height * 0.34
    if (total > room) scale *= room / total
    // The first mark hangs closest to the drawing; the ones after it below it. The stack's foot
    // stays in the character box, so a mark does not fall outside the drawing.
    let y = y0 + inset
    for (const g of [...below].reverse()) {
      const h = (g.part.box[3] - g.part.box[1]) * scale, w = (g.part.box[2] - g.part.box[0]) * scale
      const x = (x0 + x1) / 2 - w / 2
      targets.push({ ...g, target: [x, y, x + w, y + h] })
      y += h
    }
  }

  const hangul = glyphs.filter(g => g.kind === 'hangul')
  if (hangul.length) {
    const scale = base * 0.8, gap = height * 0.03
    let y = (y0 + y1) / 2 + (hangul.length - 1) * gap / 2
    for (const g of hangul) {
      const w = (g.part.box[2] - g.part.box[0]) * scale, h = (g.part.box[3] - g.part.box[1]) * scale
      targets.push({ ...g, target: [x0 + inset, y - h / 2, x0 + inset + w, y + h / 2] })
      y -= h + gap
    }
  }

  return targets.map(({ char, part, target }) => placed(part, part.box, target, 0, `mark ${char}`))
}
