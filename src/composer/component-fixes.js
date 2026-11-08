// @ts-nocheck: the corrections move placed parts, whose contours are the geometry module’s arrays.
// Corrections for a component the font draws as a cut, where a stroke of one operand runs into
// another, a bar is longer than the pair it belongs to, or a dot is taken from a 捺. Each names the
// description it corrects, the SHA-256 outlines of the glyphs it was read against, and the parts it
// changes; an export drawing other outlines keeps the font's cut. The parts are plain placed pieces,
// so the corrections work wherever the description is drawn, at any depth.
import { derived, mapped, partOf, placed, pointsBox, union } from './geometry.js'
import { hexOf } from './sha256.js'

/** The scale a placed part is drawn at, along x and y. */
const scaleOf = part => [(part.target[2] - part.target[0]) / Math.max(part.source[2] - part.source[0], 1),
  (part.target[3] - part.target[1]) / Math.max(part.source[3] - part.source[1], 1)]

/** A contour's box where the part is drawn: target units, y up. */
function boxIn(part, contour) {
  const [sx, sy] = scaleOf(part), b = pointsBox(contour.light), t = part.target, s = part.source
  return [t[0] + (b[0] - s[0]) * sx, t[1] + (b[1] - s[1]) * sy, t[0] + (b[2] - s[0]) * sx, t[1] + (b[3] - s[1]) * sy]
}
const boxOf = part => {
  const boxes = part.part.contours.map(contour => boxIn(part, contour))
  return [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])),
    Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))]
}
const widthOf = box => box[2] - box[0]
const heightOf = box => box[3] - box[1]
const centreX = box => (box[0] + box[2]) / 2
const centreY = box => (box[1] + box[3]) / 2

/** The part drawn from `origin`, where a description drew it so. */
const partFrom = (parts, origin) => parts.find(part => part.origin === origin)

/** The contours of a part as wide horizontals, by the box each is drawn in: bars of a glyph. */
function barsOf(part) {
  const width = widthOf(boxOf(part))
  return part.part.contours.map((contour, index) => ({ index, box: boxIn(part, contour) }))
    .filter(({ box }) => widthOf(box) > 0.5 * width && heightOf(box) < 0.2 * widthOf(box))
    .sort((a, b) => a.box[1] - b.box[1])
}

/** The lowest ink on the vertical line through `xTarget`: under a roof's legs, its bar's underside. */
function inkBottomAt(part, xTarget) {
  const [sx, sy] = scaleOf(part), x = part.source[0] + (xTarget - part.target[0]) / sx
  let low = Infinity
  for (const contour of part.part.contours) {
    const light = contour.light, n = light.length / 2
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, x1 = light[i * 2], y1 = light[i * 2 + 1], x2 = light[j * 2], y2 = light[j * 2 + 1]
      if (x1 === x2 || (x1 - x) * (x2 - x) > 0) continue
      const y = y1 + (y2 - y1) * (x - x1) / (x2 - x1)
      if (y < low) low = y
    }
  }
  return low === Infinity ? boxOf(part)[1] : part.target[1] + (low - part.source[1]) * sy
}

/** The lowest edge of a part's wide ink: its lowest bar, under any thin stroke that runs past it. */
function wideBottom(part) {
  const width = widthOf(boxOf(part))
  const boxes = part.part.contours.map(contour => boxIn(part, contour)).filter(box => widthOf(box) > 0.5 * width)
  return boxes.length ? Math.min(...boxes.map(box => box[1])) : boxOf(part)[1]
}

/** A part with some contours replaced; the part's box and flags stay. */
function revised(part, contours) {
  const out = derived(part.part, contours, part.part.box.slice())
  if (part.fixed) out.fixed = true
  if (part.strokes) out.strokes = part.strokes
  return { ...part, part: out }
}

/** `part` with the named contours' top (y above `yTarget`) cut off at that height. */
export function clippedAbove(part, indices, yTarget) {
  const [, sy] = scaleOf(part)
  const y = part.source[1] + (yTarget - part.target[1]) / sy
  const contours = part.part.contours.slice()
  for (const index of indices) {
    const contour = contours[index]
    const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
    for (let i = 1; i < light.length; i += 2) {
      if (light[i] > y) light[i] = y
      if (heavy[i] > y) heavy[i] = y
    }
    contours[index] = { ...contour, light, heavy }
  }
  return revised(part, contours)
}

/** `part` with the named contours' width changed about their centre, along x. */
export function narrowed(part, indices, factor) {
  const [sx] = scaleOf(part)
  const contours = part.part.contours.slice()
  for (const index of indices) {
    const contour = contours[index], box = pointsBox(contour.light), middle = (box[0] + box[2]) / 2
    const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
    for (let i = 0; i < light.length; i += 2) {
      light[i] = middle + (light[i] - middle) * factor
      heavy[i] = middle + (heavy[i] - middle) * factor
    }
    contours[index] = { ...contour, light, heavy }
  }
  return revised(part, contours)
}

/** `part` with the named contours raised by `rise` in the target, along y, keeping their columns. */
export function raised(part, indices, rise) {
  const [, sy] = scaleOf(part)
  if (!(rise > 0) || !(sy > 0)) return part
  const contours = part.part.contours.slice()
  for (const index of indices) {
    const contour = contours[index]
    const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
    for (let i = 1; i < light.length; i += 2) {
      light[i] = light[i] - rise / sy
      heavy[i] = heavy[i] - rise / sy
    }
    contours[index] = { ...contour, light, heavy }
  }
  return revised(part, contours)
}

/** `part` with the named contours' height changed about their centre, along y. */
export function heightened(part, indices, factor) {
  const contours = part.part.contours.slice()
  for (const index of indices) {
    const contour = contours[index], box = pointsBox(contour.light), middle = (box[1] + box[3]) / 2
    const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
    for (let i = 1; i < light.length; i += 2) {
      light[i] = middle + (light[i] - middle) * factor
      heavy[i] = middle + (heavy[i] - middle) * factor
    }
    contours[index] = { ...contour, light, heavy }
  }
  return revised(part, contours)
}

/** `part` with the named contour moved to span `from`–`to` in the target, along x, keeping its rows. */
export function respanned(part, index, from, to) {
  const [sx] = scaleOf(part), contour = part.part.contours[index]
  const box = pointsBox(contour.light)
  const at = part.source[0] + (from - part.target[0]) / sx
  const scale = ((to - from) / sx) / Math.max(box[2] - box[0], 1)
  const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
  for (let i = 0; i < light.length; i += 2) {
    light[i] = at + (light[i] - box[0]) * scale
    heavy[i] = at + (heavy[i] - box[0]) * scale
  }
  const contours = part.part.contours.slice()
  contours[index] = { ...contour, light, heavy }
  return revised(part, contours)
}

/** `part` without the named contours. */
export function withoutContours(part, indices) {
  const drop = new Set(indices)
  return revised(part, part.part.contours.filter((_, index) => !drop.has(index)))
}

/** The 丶 glyph in `band`: at its own em size where that fits, as large as the band allows
 *  otherwise, standing on the band's bottom as a dot does. A cut of a 丶 that the font drew as a
 *  捺 (遝's lower dot) keeps the slash's shape; the glyph has the dot's. */
export function dotIn(composer, band) {
  const glyph = composer.glyph('丶')
  if (!glyph) return null
  const width = glyph.box[2] - glyph.box[0], height = glyph.box[3] - glyph.box[1]
  const face = composer.face
  const fit = Math.min((band[2] - band[0]) / width, (band[3] - band[1]) / height)
  const em = Math.min(face[2] - face[0], face[3] - face[1]) / 1000
  const scale = Math.min(fit, em), middle = (band[0] + band[2]) / 2
  const target = [middle - width * scale / 2, band[1], middle + width * scale / 2, band[1] + height * scale]
  return placed(glyph, glyph.box, target, composer.ink('丶'), 'dot 丶')
}

/**
 * The corrections, by description. `glyphs` ties each to the outlines it was read against.
 * A correction that cannot find the parts it names leaves the drawing as it is.
 */
export const COMPONENT_FIXES = {
  // 𠷃 (BabelStone: ⿰口⿳穴𠆢又) has a broad, shallow 又. Its component's
  // proportions also occur in 𥔉. Keep both inner parts within 穴's outer span.
  '⿳穴𠆢又': {
    glyphs: { '𠷃': '18e21d569405fb626234310bc145e3f861505264b37a2389329c6325a47c089a' },
    apply(parts, composer) {
      // A native whole glyph already carries its own regional form.
      if (parts.length !== 3) return parts
      const frame = [328, -71, 974, 845]
      const target = union(parts.map(boxOf))
      const boxes = [[328, 457, 974, 845], [385, 267, 917, 544], [385, -71, 917, 273]]
      const host = partOf(composer.glyphRecord('𠷃'))
      const you = derived(host, [host.contours[4]])
      return parts.map((part, i) => i === 2
        ? placed(you, you.box, mapped(boxes[i], frame, target), 0, 'construct 𠷃 又')
        : { ...part, source: part.part.box, target: mapped(boxes[i], frame, target) })
    },
  },

  // As in 堇's lower body, 口 crosses the stem above both of 土's horizontal bars.
  '⿻口土': {
    glyphs: { '口': '412b5a81c5efb7a5f824853645e81e3aea284eb92b129004596757cdba72cc17',
      '土': '9c2d33ff79e57ea5d21a905b5a319697d917da892271e6cfffae7c5581898373' },
    apply(parts, composer) {
      const mouth = partFrom(parts, 'glyph 口'), earth = partFrom(parts, 'glyph 土')
      if (!mouth || !earth) return parts
      const [x, y, right, top] = composer.face, width = right - x, height = top - y
      const mouthTarget = [x + 0.14 * width, y + 0.46 * height, right - 0.14 * width, y + 0.86 * height]
      let body = { ...earth, target: [x + 0.02 * width, y, right - 0.02 * width, top] }
      const bars = barsOf(body)
      if (bars.length > 1) {
        const upper = bars.at(-1)
        body = respanned(body, upper.index, x + 0.08 * width, right - 0.08 * width)
        body = raised(body, [upper.index], centreY(upper.box) - (y + 0.25 * height))
      }
      return parts.map(part => part === mouth ? { ...part, target: mouthTarget } : part === earth ? body : part)
    },
  },
  // 卝's terminals must clear 干's first bar, as the right side of 哶 does.
  '⿱卝干': {
    glyphs: { '𢾴': '5dc3e052a5b511c54a17c19679d78a6756f156dbfa09307123502f0185e48c30',
      '竿': 'ed0a93ce3a2cf199af7b37f9c112a8b40b2ce037690b4e444474c9b1f49f5430' },
    apply(parts) {
      const cap = partFrom(parts, 'learned 𢾴'), stem = partFrom(parts, 'learned 竿')
      if (!cap || !stem) return parts
      const top = cap.target[3], bottom = stem.target[1], height = top - bottom
      return parts.map(part => part === cap
        ? { ...part, target: [cap.target[0], top - 0.30 * height, cap.target[2], top] }
        : part === stem ? { ...part, target: [stem.target[0], bottom, stem.target[2], top - 0.38 * height] } : part)
    },
  },
  // A whole 鰥 cut stretches the left strokes and carries a sweeping lower stroke.
  // Keep 遝’s left strokes and stem, and replace both right strokes with compact 丶 glyphs.
  '⿲𰀪丨⿱丶丶': {
    glyphs: { '鰥': '0a96f41e4dfd5fba37c9fdc66c5b0342cc3d84b830e3d8c299e86da38434fe95',
      '遝': '5ee607a1a197fb0a7402a0d2a273dd88f2e67a2dc275468db550229a2cad4fd9',
      '丶': '3f6db1c682c48dbf567323805ff695a723fb3b20bf05570ddc178a684c4cbbb7' },
    apply(parts, composer) {
      const compactDot = band => {
        const cx = centreX(band), cy = centreY(band)
        const w = widthOf(band) * 0.9, h = heightOf(band) * 0.9
        const dot = dotIn(composer, [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2])
        return dot
      }
      const whole = partFrom(parts, 'instance 鰥')
      if (whole && whole.part.contours.length === 5) {
        const glyph = composer.glyph('遝')
        if (!glyph) return parts
        const contours = [4, 5, 6, 11, 12].map(index => glyph.contours[index])
        const source = union(contours.map(contour => pointsBox(contour.light)))
        const dots = [5, 6].map(index => compactDot(mapped(pointsBox(glyph.contours[index].light), source, whole.target)))
        if (dots.some(dot => !dot)) return parts
        const piece = derived(glyph, [4, 11, 12].map(index => glyph.contours[index]), source)
        return [{ ...placed(piece, source, whole.target, composer.ink('遝'), 'body 遝'), fixed: true }, ...dots]
      }
      const dots = parts.filter(part => part.origin.endsWith(' 遝') && heightOf(part.target) < 0.6 * (composer.face[3] - composer.face[1]))
      return parts.map(part => dots.includes(part) ? compactDot(part.target) ?? part : part)
    },
  },
  // ⿻日丿: the 丿 comes from 屮, where it stands as tall as the glyph; over 日 it runs out above
  // the top horizontal. It is cut off at the underside of that bar.
  '⿻日丿': {
    glyphs: { '甲': 'db4b5893a98a4005abf097b7100d8f9cf6eff88240aceb25c7b474b1ce9ce3ef',
      '屮': '52041b363c2da211e721574b5136ec16e60fc243bffae7d6116ff071ac0498d1' },
    apply(parts) {
      const frame = partFrom(parts, 'overlay 甲'), slash = partFrom(parts, 'overlay 屮')
      if (!frame || !slash) return parts
      const bars = barsOf(frame)
      if (!bars.length) return parts
      const top = Math.max(...frame.part.contours.map(c => boxIn(frame, c)[3]))
      const thickness = Math.min(...bars.map(({ box }) => heightOf(box)))
      return parts.map(part => part === slash ? clippedAbove(part, part.part.contours.map((_, i) => i), top - thickness) : part)
    },
  },
  // ⿻二丿: 二 drawn on its own has its lower line sitting lower than 龵 draws the pair under a
  // 丿 — the font lifts that line towards the upper one. The lower bar keeps its width and rises.
  '⿻二丿': {
    glyphs: { '二': '9d4e472a9cc90b720b80a2218212a928d8893c03e2eb39ca8920661303c1182c',
      '屮': '52041b363c2da211e721574b5136ec16e60fc243bffae7d6116ff071ac0498d1' },
    apply(parts) {
      const two = partFrom(parts, 'glyph 二')
      if (!two) return parts
      const bars = barsOf(two)
      if (bars.length < 2) return parts
      const lower = bars[0], upper = bars.at(-1)
      // Raise the lower line by a tenth of the gap the two lines leave between them.
      const rise = Math.max(0, upper.box[1] - lower.box[3]) * 0.18
      return parts.map(part => part === two ? raised(part, [lower.index], rise) : part)
    },
  },
  // ⿻一止 keeps a visible stem above the bar. 正's joined top is only a reference
  // for stroke weight; the overlay must retain the protruding head of 止.
  '⿻一止': {
    glyphs: { '吏': '5a7ffe78ecbf47ea93467018d4150f9b0bee5632590a68d7ad17a278a5165fe1',
      '止': 'd9cf7eaf2648b8013a21bd390043e9d8f757f7af0f35af748ec96357a65ea6d0' },
    apply(parts, composer, region = composer.face) {
      const bar = partFrom(parts, 'overlay 吏'), stop = partFrom(parts, 'glyph 止')
      if (!bar || !stop) return parts
      const face = region, height = face[3] - face[1]
      const target = [bar.target[0], face[1] + 0.60 * height, bar.target[2], face[1] + 0.678 * height]
      // Lower the side strokes with 正's bar, while keeping the central stem's head.
      const sideBar = stop.part.contours.map((contour, index) => ({ index, box: boxIn(stop, contour) }))
        .filter(({ box }) => widthOf(box) > 3 * heightOf(box) && box[1] > face[1] + 0.3 * height)
      let body = raised(stop, sideBar.map(({ index }) => index), 0.02 * height)
      const left = body.part.contours.map((contour, index) => ({ index, box: boxIn(body, contour) }))
        .filter(({ box }) => heightOf(box) > 3 * widthOf(box) && centreX(box) < centreX(boxOf(body)) - 0.1 * widthOf(boxOf(body)))
      body = clippedAbove(body, left.map(({ index }) => index), target[1] - 0.04 * height)
      return parts.map(part => part === bar ? { ...part, target } : part === stop ? body : part)
    },
  },
  // ⿱𠂉一: the cut of 監's right side leaves the 一 short; as the component's lower line it runs
  // out to the face's right edge, five percent in from the left.
  '⿱𠂉一': {
    glyphs: { '監': 'ebb232713029973e133aa40ab2ba06f184299665b61e1e10640a9e78a0cf0094' },
    apply(parts) {
      const piece = partFrom(parts, 'instance 監')
      if (!piece) return parts
      const bars = barsOf(piece)
      if (!bars.length) return parts
      const target = piece.target, width = target[2] - target[0]
      return parts.map(part => part === piece
        ? respanned(part, bars[0].index, target[0] + 0.05 * width, target[2]) : part)
    },
  },
  // ⿱𠂉丶: the 丶 is taken from 遝, whose lower dot is a 捺, and fills the band as one. The 丶
  // glyph is reduced within the local face and lifted, as 今 and 厶 set the dot.
  '⿱𠂉丶': {
    glyphs: { '遝': '5ee607a1a197fb0a7402a0d2a273dd88f2e67a2dc275468db550229a2cad4fd9',
      '丶': '3f6db1c682c48dbf567323805ff695a723fb3b20bf05570ddc178a684c4cbbb7' },
    apply(parts, composer, region = composer.face) {
      const cut = partFrom(parts, 'learned 遝')
      if (!cut) return parts
      const [x, y, right, top] = region, width = right - x, height = top - y
      // A detached dot occupies roughly a quarter of the face, as in 今.
      const dot = dotIn(composer, [x + 0.25 * width, y + 0.26 * height,
        x + 0.50 * width, y + 0.48 * height])
      return dot ? parts.map(part => part === cut ? dot : part) : parts
    },
  },
  // ⿸⿹丅丿丨: the 丿 fills the left of the cell, so the opening the ⿹ leaves is the right side of
  // 丅's vertical. 丨 stands there, its head under the bar and its foot off the cell's bottom. Every
  // sample sets the fourth stroke right of the stem: in 𡉹 the stem runs x225–289 and the stroke
  // x352–416.
  '⿸⿹丅丿丨': {
    glyphs: { '丅': '78dcd9aa0146cd9317b3cb7455389db2cc8f21df17d072493358c5efb0ed98fd',
      '丿': 'be6e7c77ed22a138be59cae82446668db20e3f4a9ecd6cf3beaa3e60b9777751',
      '介': 'ef824bfb7b947774a641c0857cef37ea8e2bda4fffbeba4f38fe1a7e191e78aa' },
    apply(parts) {
      const stem = partFrom(parts, 'glyph 丅'), line = partFrom(parts, 'learned 介')
      if (!stem || !line) return parts
      const narrow = stem.part.contours.map(contour => boxIn(stem, contour))
        .filter(box => heightOf(box) > 0.6 * (stem.target[3] - stem.target[1]))
      if (!narrow.length) return parts
      const vertical = narrow[0], stemWidth = widthOf(vertical), stemHeight = heightOf(vertical)
      const width = stemWidth, height = 0.63 * stemHeight
      const left = vertical[2] + (63 / 64) * stemWidth, bottom = vertical[1] + 0.14 * stemHeight
      const target = [left, bottom, left + width, bottom + height]
      return parts.map(part => part === line ? { ...part, target, fixed: true } : part)
    },
  },
  // The vertical hook projects above the bent bar, including when used inside C078.
  '⿻乛亅': {
    glyphs: { '乛': 'a69b2b57b6cd11538bdc7c7167de84cd8a7230733fde05a719ad938a26e8eeee',
      '亅': '94220e40be5cc0d543297333f960bf55dee8a8f099224a03ca973429aeeab603' },
    apply(parts) {
      const bar = partFrom(parts, 'glyph 乛'), hook = partFrom(parts, 'glyph 亅')
      if (!bar || !hook) return parts
      // Lower the bar to expose the head without extending the glyph's bounds.
      const drop = 0.16 * widthOf(bar.target)
      const lowered = [bar.target[0], bar.target[1] - drop, bar.target[2], bar.target[3] - drop]
      const target = [...hook.target]
      target[3] = Math.max(target[3], lowered[3] + 0.22 * widthOf(bar.target))
      return parts.map(part => part === hook ? { ...part, target } : part === bar ? { ...part, target: lowered } : part)
    },
  },
  // 㐧 supplies the proportions: a long projecting hook head and a diagonal
  // starting under the bar. The generic surround shrinks this body twice.
  '⿹⿻乛亅㇒': {
    glyphs: { '乛': 'a69b2b57b6cd11538bdc7c7167de84cd8a7230733fde05a719ad938a26e8eeee',
      '亅': '94220e40be5cc0d543297333f960bf55dee8a8f099224a03ca973429aeeab603' },
    apply(parts, composer, region = composer.face) {
      const bar = partFrom(parts, 'glyph 乛'), hook = partFrom(parts, 'glyph 亅'), slash = partFrom(parts, 'glyph ㇒')
      if (!bar || !hook || !slash) return parts
      const [x, y, right, top] = region, width = right - x, height = top - y
      const targets = new Map([
        [bar, [x, y + 0.46 * height, right, y + 0.70 * height]],
        [hook, [x + 0.28 * width, y, x + 0.58 * width, top]],
        [slash, [x, y + 0.12 * height, x + 0.61 * width, y + 0.66 * height]],
      ])
      return parts.map(part => targets.has(part) ? { ...part, target: targets.get(part) } : part)
    },
  },
  // 鬲 supplies the complete lower frame. Fit it to the enclosing component’s full height.
  '⿵𦉪丅': {
    glyphs: { '鬲': '77e24fb157b9a4fff77f27a1a31f1fb9b9ca21bc332dd18809015d3f0214a9a6' },
    apply(parts, composer) {
      const frame = partFrom(parts, 'glyph 𦉪'), glyph = composer.glyph('鬲')
      if (!frame || !glyph) return parts
      const contours = [1, 2, 3, 4, 5, 8].map(index => glyph.contours[index])
      const source = union(contours.map(contour => pointsBox(contour.light)))
      const target = boxOf(frame)
      return [placed(derived(glyph, contours, source), source, target, composer.ink('鬲'), 'body 鬲')]
    },
  },
  // ⿰𠄠𠄠: the pair is set as one cell each, and the two 𠄠 meet with only a sliver between
  // them. 臼 sets its inner bars at 0.12 of the face apart; the pair keeps that distance, taking it
  // from their inner ends so the outer edges stay where the layout put them.
  '⿰𠄠𠄠': {
    glyphs: { '𠄠': 'cd8c6569945d1d15acf7c0bcd567dbb4491a257ac4ef5bb80a45aa409493fe7e' },
    apply(parts) {
      const pair = parts.filter(part => part.origin === 'glyph 𠄠')
      if (pair.length !== 2) return parts
      const [left, right] = [...pair].sort((a, b) => centreX(a.target) - centreX(b.target))
      const a = boxOf(left), b = boxOf(right), gap = b[0] - a[2]
      const want = 0.12 * (b[2] - a[0])
      if (!(want > gap)) return parts
      const extra = (want - gap) / 2
      const wider = [
        { ...left, target: [left.target[0], left.target[1], left.target[2] - extra, left.target[3]] },
        { ...right, target: [right.target[0] + extra, right.target[1], right.target[2], right.target[3]] },
      ]
      return parts.map(part => part === left ? wider[0] : part === right ? wider[1] : part)
    },
  },
  // ⿳𰀉冖木: the three host cuts meet at their boxes, but the 冖 is a roof, so its box's foot is
  // its legs while the wood under it starts at the bar's underside, leaving a band of white inside
  // the roof. The 冖 is raised to 𰀉's lowest bar where it stands short, and the 木 is stretched to
  // the bar's underside, so the three join and the wood still reaches the face's foot.
  '⿳𰀉冖木': {
    glyphs: { '叓': 'd518332db933c21ab9524e60429616fe716ac680b130fe826348294465fd9f71',
      '舜': '71d5ba49d5a9f766ee3fb5f0b0fc40374c3ee00bf62100d2e459265ba8f89969',
      '琹': 'f38ee20229faae11653c6b21024c1b7df32880d944f7a95bdf55a9e6043fcd08' },
    apply(parts) {
      const [top, middle, bottom] = ['host 叓', 'host 舜', 'host 琹'].map(origin => partFrom(parts, origin))
      if (!top || !middle || !bottom) return parts
      const gap = wideBottom(top) - boxOf(middle)[3]
      const roof = gap > 0 ? { ...middle, target: [middle.target[0], middle.target[1] + gap,
        middle.target[2], middle.target[3] + gap] } : middle
      // The 木 rises to the bar's underside at the cell's centre, not to the roof's legs' feet.
      const underside = inkBottomAt(roof, centreX(boxOf(roof)))
      if (!(underside > boxOf(bottom)[3])) return gap > 0 ? parts.map(part => part === middle ? roof : part) : parts
      const joined = { ...bottom, target: [bottom.target[0], bottom.target[1], bottom.target[2], underside] }
      return parts.map(part => part === middle ? roof : part === bottom ? joined : part)
    },
  },
  // ⿱𰀁口: the 口 is cut from 吂, where it fills the band below as a narrow, shallow box, so
  // under 𰀁 the top overhangs it as 亮 and 凉 never let it. The 口 takes the cell's foot and the
  // width and height 亮's 口 has; 𰀁 keeps a short stem below its lower bar, clear of 口.
  '⿱𰀁口': {
    glyphs: { '𤆖': 'e2341850ee010f94f376c8724147025f713626cbdb97a050d310fb33ed9d5c74',
      '吂': 'f5b707cdf67842858aacb756da8c6aeeb61982cfa5925930403ae59616acfa10' },
    apply(parts, composer, region = composer.face) {
      const top = partFrom(parts, 'learned 𤆖'), mouth = partFrom(parts, 'learned 吂')
      if (!top || !mouth) return parts
      const face = region, width = face[2] - face[0], height = face[3] - face[1]
      const middle = (face[0] + face[2]) / 2
      const lower = { ...mouth, target: [middle - 0.355 * width, face[1], middle + 0.355 * width,
        face[1] + 0.38 * height] }
      // 𤆖 joins both bars and the stem in one contour. Move the lower bar's
      // vertices together, including its stem junction, to preserve its thickness.
      const contours = top.part.contours.map(contour => {
        const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
        for (let i = 0; i < light.length; i += 2) {
          const x = contour.light[i], y = contour.light[i + 1]
          // Stop the stem at 口's top edge; it reaches the mouth without running inside it.
          if (y < 150) { light[i + 1] = 150; heavy[i + 1] = 116; continue }
          if (y !== 400 && y !== 471) continue
          const dx = x === 135 ? -63 : x === 884 ? 56 : 0
          light[i] += dx; heavy[i] += dx
          light[i + 1] -= 40; heavy[i + 1] -= 40
        }
        return { ...contour, light, heavy }
      })
      // The stem overlaps the 口's top edge, as 吉 joins its two parts.
      const upper = { ...revised(top, contours), target: [top.target[0], lower.target[3] - 0.03 * height,
        top.target[2], top.target[3]] }
      return parts.map(part => part === mouth ? lower : part === top ? upper : part)
    },
  },
  // ⿵冂丨: the 丨 is laid in the frame's lower middle with its top short of the bar. In 㒳 and
  // 麗 a vertical inside 冂 hangs from the top bar; this one is raised to the frame's top, where the
  // bar hides its end and the stroke reads as joined.
  '⿵冂丨': {
    glyphs: { '円': '86e9d56419bf78529599d260ae57dd0a9c3cd6c9ac4b4bbe853207586e403f23',
      '丨': '7a86fb1164e56134835216c1085defdbce640b035e60a788677eb53f6af77129' },
    apply(parts) {
      const frame = partFrom(parts, 'learned 円'), bar = partFrom(parts, 'glyph 丨')
      if (!frame || !bar) return parts
      const target = [bar.target[0], bar.target[1], bar.target[2], frame.target[3]]
      return parts.map(part => part === bar ? { ...part, target } : part)
    },
  },
  // ⿹丅丿: the ⿹ leaves its opening at the lower left, but 丿 is set on the right, floating clear
  // of the cross. In 第 and 弔's 𢎨 the falling stroke stands left of the stem, below the bar: a
  // short, shallow ㇒, not a 刀 cut squeezed upright. It is drawn from the ㇒ glyph at that lean.
  '⿹丅丿': {
    glyphs: { '丅': '78dcd9aa0146cd9317b3cb7455389db2cc8f21df17d072493358c5efb0ed98fd',
      '㇒': '68a459122af849188e5157353eaa9e3225ef69ba5a86867624c85237cafaa6bd' },
    apply(parts, composer) {
      const stem = partFrom(parts, 'glyph 丅')
      const slash = parts.find(part => part.origin === 'learned 刀' || part.origin === 'glyph 丿' || part.origin === 'glyph ㇒')
      if (!stem || !slash) return parts
      const glyph = composer.glyph('㇒')
      const bars = barsOf(stem)
      const narrow = stem.part.contours.map(contour => boxIn(stem, contour))
        .filter(box => heightOf(box) > 0.6 * (stem.target[3] - stem.target[1]))
      if (!glyph || !bars.length || !narrow.length) return parts
      // 第's falling stroke starts below the midpoint of the stem and runs to its lower left.
      // 丅's top bar must remain separate from that lower diagonal.
      const bar = bars[0].box, barWidth = widthOf(bar)
      const vertical = narrow[0], right = vertical[2]
      const width = Math.min(0.662 * barWidth, right - stem.target[0])
      const height = 0.29 * barWidth
      if (!(width > 0 && height > 0)) return parts
      const top = vertical[1] + 0.43 * heightOf(vertical)
      const target = [right - width, top - height, right, top]
      const piece = placed(glyph, glyph.box, target, composer.ink('㇒'), 'glyph ㇒')
      return parts.map(part => part === slash ? piece : part)
    },
  },
  // ⿵𠆢丶: the 丶 is cut from a 捺 and fills its band as a long slash. Under 𠆢 it is the dot
  // of 厶, as 能 and 熊 set it; the 丶 glyph stands in, sized to the band and standing on its foot.
  '⿵𠆢丶': {
    glyphs: { '𠆢': 'f0ce28285cd42f0a237600ccdf8a1dd636c8d83a219763495da65f6bbe87b0fe',
      '𭕴': 'fb55f20289cd66ff1361bfcaca9dfbcfb81530c4cb1aaa2349c491f1cb45cb1b',
      '丶': '3f6db1c682c48dbf567323805ff695a723fb3b20bf05570ddc178a684c4cbbb7' },
    apply(parts, composer) {
      const roof = partFrom(parts, 'glyph 𠆢'), cut = parts.find(part => part !== roof)
      if (!roof || !cut) return parts
      const dot = dotIn(composer, cut.target)
      return dot ? parts.map(part => part === cut ? dot : part) : parts
    },
  },
  // 𡱃 compresses the cap above a taller 巾; the centre stem reaches its falling tip.
  '⿱𠂊巾': {
    glyphs: { '𠂊': '41f8902e69fb7c48109d0935dde0b3fc82a67acaa6da876c97c8e2c15e8cab1e',
      '帋': '1596238105c1de5b9b639639250b978536c88d6505541c66ec518f7dd53cac60' },
    apply(parts) {
      const cap = partFrom(parts, 'glyph 𠂊'), body = partFrom(parts, 'learned 帋')
      if (!cap || !body) return parts
      const height = cap.target[3] - body.target[1]
      const CAP_HEIGHT = 0.36 * height, BODY_HEIGHT = 0.65 * height
      const capTarget = [cap.target[0], cap.target[3] - CAP_HEIGHT, cap.target[2], cap.target[3]]
      const bodyTarget = [body.target[0], body.target[1], body.target[2], body.target[1] + BODY_HEIGHT]
      return parts.map(part => part === cap ? { ...part, target: capTarget } : part === body ? { ...part, target: bodyTarget } : part)
    },
  },
  // 監 supplies either a single right-hand cut or two separate strokes. Split the cut before
  // sizing the pair, so 臣 stays compact and the lower 一 spans the right column.
  '⿰臣⿱𠂉一': {
    glyphs: { '監': 'ebb232713029973e133aa40ab2ba06f184299665b61e1e10640a9e78a0cf0094' },
    apply(parts, composer) {
      if (parts.length === 2) {
        const court = parts.reduce((a, b) => a.target[0] < b.target[0] ? a : b)
        const right = parts.find(part => part !== court)
        const bars = right.part.contours.map((contour, index) => ({ index, box: pointsBox(contour.light) }))
          .filter(({ box }) => widthOf(box) > 3 * heightOf(box)).sort((a, b) => a.box[1] - b.box[1])
        if (!bars.length) return parts
        const lower = bars[0].index
        const bar = revised(right, [right.part.contours[lower]])
        const cap = withoutContours(right, [lower])
        // Tight source boxes let each cut occupy its own target without the other's whitespace.
        parts = [court, cap, bar].map(part => {
          const source = union(part.part.contours.map(contour => pointsBox(contour.light)))
          return { ...part, target: boxOf(part), source }
        })
      }
      if (parts.length !== 3) return parts
      const court = parts.reduce((a, b) => a.target[0] < b.target[0] ? a : b)
      const others = parts.filter(part => part !== court)
      // The 一 is the wide, flat part of the right column; the 𠂉 is the other.
      const flat = (part) => (part.target[2] - part.target[0]) / Math.max(part.target[3] - part.target[1], 1)
      const bar = others.reduce((a, b) => flat(a) > flat(b) ? a : b)
      const cap = others.find(part => part !== bar)
      const left = court.target[0], right = Math.max(...parts.map(part => part.target[2]))
      const width = right - left, height = court.target[3] - court.target[1]
      const top = Math.max(court.target[3], cap.target[3])
      const column = left + width * 0.50
      const courtTarget = [left, top - height * 0.80, left + width * 0.40, top]
      const capTarget = [column, top - height * 0.40, right, top]
      // Leave a small gap below the falling tip, as in 監's right column.
      const barTop = capTarget[1] - height * 0.035
      const barTarget = [column, barTop - height * 0.075, right, barTop]
      // The whole description is centred in the face after its parts are set.
      const face = composer?.face
      const drawn = [courtTarget, capTarget, barTarget]
      const dy = face ? ((face[1] + face[3]) - (Math.min(...drawn.map(b => b[1])) + Math.max(...drawn.map(b => b[3])))) / 2 : 0
      const shift = (box) => [box[0], box[1] + dy, box[2], box[3] + dy]
      return parts.map(part => ({ ...part, target: shift(part === court ? courtTarget : part === cap ? capTarget : barTarget) }))
    },
  },

}

/** Whether `composer`'s glyphs are the outlines a correction was read against. */
function matches(fix, composer) {
  return Object.entries(fix.glyphs).every(([ch, digest]) => {
    const record = composer.glyphRecord(ch)
    return record && hexOf(JSON.stringify(record.p)) === digest
  })
}

/** `parts`, with the correction a description carries applied where the outlines are the ones it
 *  was read against. */
export function componentFix(sequence, parts, composer, region = composer.face) {
  const fix = COMPONENT_FIXES[sequence]
  return fix && matches(fix, composer) ? fix.apply(parts, composer, region) : parts
}
