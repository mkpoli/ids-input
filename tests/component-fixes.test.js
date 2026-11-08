// The components whose font cut draws a stroke wrong: each correction is named by the description
// and tied to the outlines it was read against, so these tests exercise the correction itself on
// the shapes it was written for, and the guard that leaves another export's drawing alone.
import { describe, expect, it } from 'bun:test'
import { COMPONENT_FIXES, clippedAbove, componentFix, dotIn, narrowed, respanned, withoutContours } from '../src/composer/component-fixes.js'
import { makePart, partOf, placed, pointsBox } from '../src/composer/geometry.js'

/** A placed part of rectangular contours: `boxes` in font units, drawn from `source` into `target`. */
function part(origin, source, target, boxes) {
  const contours = boxes.map(([x0, y0, x1, y1]) => {
    const light = Float64Array.from([x0, y0, x1, y0, x1, y1, x0, y1])
    return { ops: [{ code: 'M' }, { code: 'L' }, { code: 'L' }, { code: 'L' }], light, heavy: light.slice(), width: null }
  })
  return placed(makePart(contours, source), source, target, 0, origin)
}

const box = contour => pointsBox(contour.light)
/** A contour's box where the part is drawn, in target units. */
const targetBox = (p, contour) => {
  const b = box(contour), s = p.source, t = p.target
  const sx = (t[2] - t[0]) / Math.max(s[2] - s[0], 1), sy = (t[3] - t[1]) / Math.max(s[3] - s[1], 1)
  return [t[0] + (b[0] - s[0]) * sx, t[1] + (b[1] - s[1]) * sy, t[0] + (b[2] - s[0]) * sx, t[1] + (b[3] - s[1]) * sy]
}
const widths = p => p.part.contours.map(c => box(c)[2] - box(c)[0])

/** A composer whose 丶 is a rectangle glyph and whose face is the usual one. */
function dotComposer() {
  const glyph = part('glyph 丶', [265, 211, 721, 616], [265, 211, 721, 616], [[265, 211, 721, 616]])
  return { face: [38, -81, 967, 840], glyph: () => glyph.part, ink: () => 1000 }
}

describe('a stroke correction', () => {
  it('cuts a contour off at a height in the box it is drawn into', () => {
    const slash = part('x', [0, 0, 100, 1000], [0, 0, 1000, 1000], [[20, 0, 80, 1000]])
    const cut = clippedAbove(slash, [0], 600)
    expect(targetBox(cut, cut.part.contours[0])[3]).toBeCloseTo(600, 6)
  })

  it('shortens a bar about its centre and moves another to a span', () => {
    const bar = part('x', [0, 0, 1000, 1000], [0, 0, 1000, 1000], [[100, 200, 900, 280], [100, 700, 900, 780]])
    expect(widths(narrowed(bar, [0], 0.5))[0]).toBeCloseTo(400, 6)
    expect(box(respanned(bar, [0], 200, 1000).part.contours[0])[0]).toBeCloseTo(200, 6)
    expect(box(respanned(bar, [0], 200, 1000).part.contours[0])[2]).toBeCloseTo(1000, 6)
  })

  it('drops a contour and places a 丶 at its own size on the band’s bottom', () => {
    const bar = part('x', [0, 0, 1000, 1000], [0, 0, 1000, 1000], [[100, 200, 900, 280], [100, 700, 900, 780]])
    expect(withoutContours(bar, [1]).part.contours).toHaveLength(1)
    const dot = dotIn(dotComposer(), [400, -80, 900, 500])
    const placed = targetBox(dot, dot.part.contours[0])
    expect(dot.origin).toBe('dot 丶')
    expect(placed[1]).toBeCloseTo(-80, 6)
    expect(placed[2] - placed[0]).toBeLessThanOrEqual(500)
  })
})

describe('a composition fix', () => {
  it('leaves the drawing alone unless the outlines are the ones the correction was read against', () => {
    const earth = part('glyph 土', [0, 0, 1000, 1000], [0, 0, 1000, 1000], [[100, 500, 900, 570]])
    expect(componentFix('⿻口土', [earth], { glyphRecord: () => null })).toEqual([earth])
    expect(componentFix('⿻土口', [earth], { glyphRecord: () => null })).toEqual([earth])
  })
})

describe('C052 ⿲𰀪丨⿱丶丶', () => {
  it('draws both right strokes as compact dots', () => {
    const composer = dotComposer()
    const stem = part('glyph 𰀪', [0, 0, 1000, 1000], [38, 40, 321, 922], [[0, 0, 1000, 1000]])
    const line = part('host 遝', [576, 49, 648, 560], [482, 40, 558, 922], [[576, 49, 648, 560]])
    const upper = part('learned 遝', [697, 339, 924, 535], [680, 398, 967, 840], [[697, 339, 924, 535]])
    const last = part('learned 遝', [689, 104, 937, 339], [680, -81, 967, 361], [[689, 104, 937, 339]])
    const out = COMPONENT_FIXES['⿲𰀪丨⿱丶丶'].apply([stem, line, upper, last], composer)
    expect(out.filter(p => p.origin === 'dot 丶')).toHaveLength(2)
    expect(out.at(-1).origin).toBe('dot 丶')
  })
})

describe('C087 ⿻日丿', () => {
  it('keeps 丿 under 日’s top bar', () => {
    const frame = part('overlay 甲', [126, 178, 877, 777], [38, 173, 967, 757],
      [[126, 178, 877, 777], [165, 468, 833, 539], [164, 233, 833, 305]])
    const slash = part('overlay 屮', [168, -82, 537, 832], [329, -81, 547, 830], [[168, -82, 537, 832]])
    const out = COMPONENT_FIXES['⿻日丿'].apply([frame, slash])
    const top = targetBox(out[1], out[1].part.contours[0])[3]
    expect(top).toBeLessThan(757 - 50)
    expect(top).toBeGreaterThan(650)
  })
})

describe('C082 ⿻二丿', () => {
  it('raises 二’s lower line under a 丿, keeping its width', () => {
    const two = part('glyph 二', [57, 20, 945, 697], [38, 188, 967, 725],
      [[142, 616, 860, 697], [57, 20, 945, 104]])
    const slash = part('overlay 屮', [168, -82, 537, 832], [84, -81, 547, 840], [[168, -82, 537, 832]])
    const out = COMPONENT_FIXES['⿻二丿'].apply([two, slash])
    // The lower bar keeps 二's width and rises towards the upper line.
    const before = targetBox(two, two.part.contours[1])
    const after = targetBox(out[0], out[0].part.contours[1])
    expect(after[2] - after[0]).toBeCloseTo(before[2] - before[0], 6)
    expect(after[1]).toBeLessThan(before[1])
  })
})

describe('C045 ⿱𠂉一', () => {
  it('runs 監’s short 一 out to the face’s right edge', () => {
    const piece = part('instance 監', [489, 377, 942, 836], [38, -81, 967, 840],
      [[579, 377, 917, 441], [490, 493, 693, 836], [590, 624, 942, 689]])
    const out = COMPONENT_FIXES['⿱𠂉一'].apply([piece])
    const lower = out[0].part.contours.map(contour => targetBox(out[0], contour)).sort((a, b) => a[1] - b[1])[0]
    expect(lower[0]).toBeCloseTo(38 + 0.05 * (967 - 38), 6)
    expect(lower[2]).toBeCloseTo(967, 6)
  })
})

describe('C080 ⿻一止', () => {
  it('leaves a clear stem above 一 in the 止 overlay', () => {
    const bar = part('overlay 吏', [71, 674, 935, 744], [65, 672, 931, 744], [[71, 674, 935, 744]])
    const stop = part('glyph 止', [49, -30, 949, 837], [38, -81, 967, 840], [[49, -30, 949, 44], [188, 9, 265, 620]])
    const [raised] = COMPONENT_FIXES['⿻一止'].apply([bar, stop], { face: [38, -81, 967, 840] })
    expect(raised).not.toBe(bar)
    // The bar keeps its span and rises to the cell's top band.
    expect(raised.target[0]).toBe(bar.target[0])
    expect(raised.target[2]).toBe(bar.target[2])
    expect(stop.target[3] - raised.target[3]).toBeGreaterThan(120)
    // The 止's head still reaches above the bar.
    expect(stop.target[3]).toBeGreaterThan(raised.target[3])
  })
})

describe('C046 ⿱𠂉丶', () => {
  it('draws 丶 as a dot, not 遝’s 捺, in 𠂉丶 and the last dot of ⿲𰀪丨⿱丶丶', () => {
    const composer = dotComposer()
    const learned = part('learned 遝', [689, 104, 937, 339], [435, -71, 911, 365], [[689, 104, 937, 339]])
    const [dot0] = COMPONENT_FIXES['⿱𠂉丶'].apply([learned], composer)
    expect(dot0.origin).toBe('dot 丶')
    expect(targetBox(dot0, dot0.part.contours[0])[3] - targetBox(dot0, dot0.part.contours[0])[1]).toBeLessThan(436)
    // The dot stands above the band's foot, not below it.
    expect(dot0.target[1]).toBeGreaterThan(learned.target[1] + 20)
  })
})

describe('C078 ⿹⿻乛亅㇒', () => {
  it('fills its local face with the projecting head and joined diagonal of 㐧', () => {
    const bar = part('glyph 乛', [94, 483, 930, 775], [143, 359, 800, 527], [[94, 697, 869, 771], [737, 483, 930, 775]])
    const hook = part('glyph 亅', [252, -63, 548, 808], [267, 45, 500, 546], [[252, -63, 548, 808]])
    const slash = part('glyph ㇒', [87, 255, 595, 774], [300, -83, 779, 279], [[87, 255, 595, 774]])
    for (const face of [[0, 0, 1000, 1000], [100, 200, 500, 700]]) {
      const [a, b, c] = COMPONENT_FIXES['⿹⿻乛亅㇒'].apply([bar, hook, slash], { face })
      const height = face[3] - face[1]
      expect(b.target[3] - a.target[3]).toBeCloseTo(0.3 * height)
      expect(b.target[1]).toBe(face[1])
      expect(a.target[0]).toBe(face[0])
      expect(a.target[2]).toBe(face[2])
      expect(c.target[2]).toBeGreaterThan(b.target[2])
      expect(c.target[3]).toBeLessThan(a.target[3])
      expect(c.target[3]).toBeGreaterThan(a.target[1])
    }
  })
})

describe('C073 ⿸⿹丅丿丨', () => {
  it('stands the ⿸⿹ inner 丨 in the opening right of 丅’s vertical, as 𡉹 sets it', () => {
    const stem = part('glyph 丅', [52, -80, 949, 748], [38, -81, 967, 840], [[52, 672, 949, 748], [456, -80, 536, 706]])
    const slash = part('glyph 丿', [220, -71, 588, 815], [38, -81, 425, 725], [[220, -71, 588, 815]])
    const line = part('learned 介', [638, -78, 715, 488], [556, -12, 631, 293], [[638, -78, 715, 488]])
    const out = COMPONENT_FIXES['⿸⿹丅丿丨'].apply([stem, slash, line])
    const [x0, y0, x1, y1] = out[2].target
    const [stemX0, stemY0, stemX1, stemY1] = targetBox(stem, stem.part.contours[1])
    // Right of 丅's vertical, in the space the 丿 leaves open.
    expect(x0).toBeGreaterThan(stemX1 + 60)
    expect(x1).toBeLessThan(stemX1 + 170)
    // Standing off the cell's bottom, its head under the bar, at the height of 𡉹’s right stroke.
    expect(y0).toBeGreaterThan(stemY0 + 40)
    expect(y1).toBeLessThan(stemY1 - 150)
    expect(y1 - y0).toBeCloseTo(0.63 * (stemY1 - stemY0), 6)
    expect(x1 - x0).toBeCloseTo(stemX1 - stemX0, 6)
  })
})


describe('C015 ⿰𠄠𠄠', () => {
  it('keeps 臼’s distance between the two 𠄠', () => {
    const left = part('glyph 𠄠', [56, 109, 469, 631], [56, 109, 469, 631],
      [[56, 109, 469, 171], [56, 569, 469, 631]])
    const right = part('glyph 𠄠', [537, 109, 950, 631], [537, 109, 950, 631],
      [[537, 109, 950, 171], [537, 569, 950, 631]])
    const out = COMPONENT_FIXES['⿰𠄠𠄠'].apply([left, right])
    const a = targetBox(out[0], out[0].part.contours[0]), b = targetBox(out[1], out[1].part.contours[0])
    expect(b[0] - a[2]).toBeCloseTo(0.12 * (b[2] - a[0]), 6)
    expect(b[0] - a[2]).toBeGreaterThan(100)
    expect(a[0]).toBeCloseTo(56, 6)
    expect(b[2]).toBeCloseTo(950, 6)
  })
})

describe('C062 ⿳𰀉冖木', () => {
  it('raises 冖 to 𰀉’s lowest bar and stretches 木 to the bar’s underside', () => {
    const top = part('host 叓', [38, 533, 967, 840], [38, 533, 967, 840],
      [[462, 533, 542, 840], [38, 752, 967, 788], [143, 587, 868, 714]])
    // A roof: a bar with a leg at either end, so its box foot is the legs, not the bar.
    const middle = part('host 舜', [38, 405, 967, 533], [38, 405, 967, 533],
      [[38, 464, 967, 533], [38, 405, 148, 464], [853, 405, 967, 464]])
    const bottom = part('host 琹', [38, -81, 967, 413], [38, -81, 967, 413], [[38, 413, 967, 455], [462, -81, 538, 413]])
    const out = COMPONENT_FIXES['⿳𰀉冖木'].apply([top, middle, bottom])
    expect(out[1].target[3]).toBeCloseTo(587, 6)
    expect(out[1].target[1]).toBeCloseTo(459, 6)
    // The wood reaches the roof's bar underside at 518, not its legs' foot at 459.
    expect(out[2].target[3]).toBeCloseTo(518, 6)
    expect(out[2].target[1]).toBeCloseTo(-81, 6)
  })
})

describe('C072 ⿵𦉪丅', () => {
  it('fits the complete native frame and hooks into the enclosing component', () => {
    const frame = part('glyph 𦉪', [0, 0, 800, 800], [100, 0, 900, 800], [[0, 0, 800, 800]])
    const glyph = part('glyph 鬲', [0, 0, 800, 1000], [0, 0, 800, 1000],
      Array.from({ length: 9 }, () => [0, 0, 800, 450])).part
    const [out] = COMPONENT_FIXES['⿵𦉪丅'].apply([frame], { glyph: () => glyph, ink: () => 1000 })
    expect(out.part.contours).toEqual([1, 2, 3, 4, 5, 8].map(i => glyph.contours[i]))
    expect((out.target[2] - out.target[0]) / (out.target[3] - out.target[1])).toBeCloseTo(1)
    expect(out.target).toEqual(frame.target)
  })
})
describe('C049 ⿱𰀁口', () => {
  it('gives the 口 the width and height 亮 sets, with 𰀁’s stem meeting its top', () => {
    const top = part('learned 𤆖', [72, 198, 940, 834], [66, 284, 935, 842], [[72, 198, 940, 834]])
    const mouth = part('learned 吂', [175, -79, 829, 309], [173, -80, 833, 266], [[175, -79, 829, 309]])
    const out = COMPONENT_FIXES['⿱𰀁口'].apply([top, mouth], { face: [38, -81, 967, 840] })
    const t = out[1].target
    expect(t[1]).toBeCloseTo(-81, 6)
    expect(t[2] - t[0]).toBeCloseTo(0.71 * 929, 6)
    expect(t[3] - t[1]).toBeCloseTo(0.38 * 921, 6)
    // 𰀁's stem overlaps the 口's top edge, so the pair joins.
    expect(out[0].target[1]).toBeLessThan(t[3])
  })
})

describe('C070 ⿵冂丨', () => {
  it('runs the 丨 up to the frame’s top bar', () => {
    const frame = part('learned 円', [90, -81, 916, 772], [94, -60, 926, 768], [[90, -81, 916, 772]])
    const bar = part('glyph 丨', [458, -80, 539, 839], [456, -27, 531, 509], [[458, -80, 539, 839]])
    const out = COMPONENT_FIXES['⿵冂丨'].apply([frame, bar])
    expect(out[1].target[3]).toBeCloseTo(768, 6)
    expect(out[1].target[1]).toBeCloseTo(-27, 6)
    expect(out[1].target[0]).toBeCloseTo(456, 6)
  })
})

describe('C079 ⿹丅丿', () => {
  it('sets the falling stroke halfway down 丅’s stem, as 第 does', () => {
    const stem = part('glyph 丅', [52, -80, 949, 748], [52, -80, 949, 748],
      [[52, 691, 949, 747], [456, -80, 537, 705]])
    const slash = part('learned 刀', [42, -84, 475, 713], [546, -81, 963, 595], [[42, -84, 475, 713]])
    const out = COMPONENT_FIXES['⿹丅丿'].apply([stem, slash], { glyph: () => part('glyph ㇒', [87, 255, 594, 774], [87, 255, 594, 774], [[87, 255, 594, 774]]).part, ink: () => 1000 })
    const [x0, y0, x1, y1] = out[1].target
    // The stroke leans like 𢎨's, not upright: wider than it is tall.
    expect((x1 - x0) / (y1 - y0)).toBeCloseTo(1.86, 1)
    expect(y1).toBeGreaterThan(250)
    expect(y1).toBeLessThan(280)
    expect(y0).toBeLessThan(30)
    // Its right end runs under the stem rather than clear of it.
    expect(x1).toBeGreaterThan(456)
    expect(x1).toBeCloseTo(537)
    expect(x0).toBeGreaterThanOrEqual(52 - 1e-6)
  })
})

describe('C081 ⿻乛亅', () => {
  it('leaves 亅’s top above the 乛 bar, as 才 sets it', () => {
    const bar = part('glyph 乛', [94, 483, 930, 775], [125, 474, 902, 743],
      [[94, 697, 869, 771], [737, 483, 930, 775]])
    const hook = part('glyph 亅', [252, -63, 548, 808], [272, -29, 547, 774], [[252, -63, 548, 808]])
    const out = componentFix('⿻乛亅', [bar, hook], { glyphRecord: () => null })
    expect(out[1]).toBe(hook)
    expect(targetBox(out[1], out[1].part.contours[0])[3]).toBeGreaterThan(743)
  })
})

describe('C071 ⿵𠆢丶', () => {
  it('draws the dot under 𠆢 as a 丶, not the host’s 捺', () => {
    const roof = part('glyph 𠆢', [37, 213, 967, 633], [41, 33, 953, 693], [[37, 213, 967, 633]])
    const cut = part('learned 𭕴', [656, 393, 791, 570], [351, 107, 651, 480], [[656, 393, 791, 570]])
    const out = COMPONENT_FIXES['⿵𠆢丶'].apply([roof, cut], dotComposer())
    expect(out[0]).toBe(roof)
    expect(out[1].origin).toBe('dot 丶')
    const placed = targetBox(out[1], out[1].part.contours[0])
    expect(placed[1]).toBeCloseTo(107, 6)
    expect(placed[3] - placed[1]).toBeLessThan(480 - 107)
  })
})

describe('C047 ⿱𠂊巾', () => {
  it('keeps the 巾 body at the size the pair is set with', () => {
    const cap = part('glyph 𠂊', [85, -46, 840, 790], [128, 336, 858, 841], [[85, -46, 840, 790]])
    const body = part('learned 帋', [153, -79, 856, 387], [153, -78, 856, 379], [[153, -79, 856, 387]])
    const out = COMPONENT_FIXES['⿱𠂊巾'].apply([cap, body])
    expect(out[0].target[3] - out[0].target[1]).toBeCloseTo(919 * 0.36, 6)
    expect(out[1].target[3] - out[1].target[1]).toBeCloseTo(919 * 0.65, 6)
    expect(out[1].target[3] - out[0].target[1]).toBeCloseTo(919 * 0.01, 6)
  })
})

describe('C013 ⿰臣⿱𠂉一', () => {
  it('sets the right stack apart and centres the description', () => {
    const court = part('host 監', [126, -78, 932, 782], [38, -82, 562, 840], [[126, -78, 932, 782]])
    const cap = part('host 監', [489, 492, 942, 836], [600, 361, 967, 840], [[489, 492, 942, 836]])
    const bar = part('host 監', [579, 377, 917, 441], [600, 88, 967, 155], [[579, 377, 917, 441]])
    const face = [38, 40, 967, 962]
    const out = COMPONENT_FIXES['⿰臣⿱𠂉一'].apply([court, cap, bar], { face })
    expect(out[0].target[2] - out[0].target[0]).toBeCloseTo(929 * 0.40, 6)
    expect(out[1].target[3] - out[1].target[1]).toBeCloseTo(922 * 0.40, 6)
    expect(out[1].target[2] - out[1].target[0]).toBeCloseTo(929 * 0.50, 6)
    // The 一 sits under the 𠂉, above the column's foot.
    expect(out[2].target[3]).toBeLessThan(out[1].target[1])
    expect(out[2].target[3]).toBeLessThan(out[0].target[3])
    // The whole description is centred in the face.
    const low = Math.max(out[0].target[3], out[1].target[3], out[2].target[3])
    const high = Math.min(out[0].target[1], out[1].target[1], out[2].target[1])
    expect((high + low) / 2).toBeCloseTo((face[1] + face[3]) / 2, 6)
  })
})


it('C013 splits a stretched host cut before extending the lower bar', () => {
  const court = part('host 監', [0, 0, 400, 500], [0, 0, 520, 920], [[0, 0, 400, 500]])
  const right = part('host 監', [0, 0, 450, 460], [560, 50, 930, 870],
    [[90, 0, 430, 65], [0, 116, 200, 460], [100, 248, 450, 313]])
  const out = COMPONENT_FIXES['⿰臣⿱𠂉一'].apply([court, right])
  expect(out).toHaveLength(3)
  expect(out[0].target[3] - out[0].target[1]).toBeLessThan(750)
  expect(out[2].target[2] - out[2].target[0]).toBeGreaterThan(450)
  expect(out[1].part.contours).toHaveLength(2)
})

it('C034 separates the 卝 terminals from the first 干 bar', () => {
  const cap = part('learned 𢾴', [0, 0, 1000, 300], [0, 600, 1000, 900], [[0, 0, 400, 300], [600, 0, 1000, 300]])
  const stem = part('learned 竿', [0, 0, 1000, 600], [0, 0, 1000, 620], [[0, 500, 1000, 600]])
  const [a, b] = COMPONENT_FIXES['⿱卝干'].apply([cap, stem])
  expect(a.target[1] - b.target[3]).toBeGreaterThan(60)
  expect(a.target[3]).toBe(900)
  expect(b.target[1]).toBe(0)
})

it('C052 preserves the left strokes while replacing both right strokes', () => {
  const whole = part('instance 鰥', [0, 0, 1000, 1000], [30, 20, 950, 940],
    Array.from({ length: 5 }, () => [0, 0, 1000, 1000]))
  const glyph = part('glyph 遝', [0, 0, 1000, 1000], [0, 0, 1000, 1000],
    Array.from({ length: 13 }, (_, i) => [i * 20, 20, i * 20 + 15, 800])).part
  const [out, ...dots] = COMPONENT_FIXES['⿲𰀪丨⿱丶丶'].apply([whole], { ...dotComposer(), glyph: ch => ch === '遝' ? glyph : dotComposer().glyph() })
  expect(dots).toHaveLength(2)
  expect(dots.every(p => p.origin === 'dot 丶')).toBe(true)
  expect(out.origin).toBe('body 遝')
  expect(out.target).toEqual(whole.target)
  expect(out.part.contours).toEqual([4, 11, 12].map(i => glyph.contours[i]))
  expect(out.fixed).toBe(true)
})

it('C085 keeps the mouth bottom clear of the earth foot', () => {
  const mouth = part('glyph 口', [0, 0, 750, 790], [100, 0, 850, 790], [[0, 0, 750, 790]])
  const earth = part('glyph 土', [0, 0, 900, 870], [50, 0, 950, 870], [[0, 0, 900, 70], [400, 0, 480, 870]])
  const [a, b] = COMPONENT_FIXES['⿻口土'].apply([mouth, earth], { face: [0, 0, 1000, 900] })
  expect(a.target[1] - b.target[1]).toBeGreaterThan(200)
  expect(b.target[3] - a.target[3]).toBeGreaterThan(100)
  expect(a.target[0]).toBeGreaterThan(b.target[0])
  expect(a.target[2]).toBeLessThan(b.target[2])
})

it('C060 gives 又 the broad shallow form and spacing of 𠷃', async () => {
  const records = (await import('./fixtures/noto-c060.json')).default
  const { partOf, mapped } = await import('../src/composer/geometry.js')
  const frame = [328, -71, 974, 845]
  for (const target of [[0, 0, 1000, 900], [400, -80, 950, 840]]) {
    const parts = ['穴', '𠆢', '又'].map(ch => {
      const g = partOf(records[ch].G)
      return placed(g, g.box, target, 0, `glyph ${ch}`)
    })
    const composer = { glyphRecord: ch => records[ch]?.G ?? null }
    const out = componentFix('⿳穴𠆢又', parts, composer)
    expect(out[2].origin).toBe('construct 𠷃 又')
    for (const inner of out.slice(1)) {
      expect(inner.target[0]).toBeGreaterThan(out[0].target[0])
      expect(inner.target[2]).toBeLessThan(out[0].target[2])
    }
    out[2].target.forEach((v, i) => expect(v).toBeCloseTo(mapped([385, -71, 917, 273], frame, target)[i], 0))
    expect(out[2].part.contours.map(box)).toEqual([box(partOf(records['𠷃'].G).contours[4])])
    out[1].target.forEach((v, i) => expect(v).toBeCloseTo(mapped([385, 267, 917, 544], frame, target)[i], 0))
    expect(componentFix('⿳穴𠆢又', parts, { glyphRecord: () => null })).toBe(parts)
    expect(componentFix('⿳穴𠆢又', [parts[0]], composer)).toEqual([parts[0]])
  }
})

it('C080 lowers the crossbar while retaining a long central head', () => {
  const bar = part('overlay 吏', [0, 0, 900, 70], [0, 700, 900, 770], [[0, 0, 900, 70]])
  const stop = part('glyph 止', [0, 0, 900, 900], [0, 0, 900, 900],
    [[500, 430, 850, 500], [0, 0, 900, 70], [450, 0, 520, 900], [150, 0, 220, 650]])
  const [a, b] = COMPONENT_FIXES['⿻一止'].apply([bar, stop], { face: [0, 0, 900, 900] })
  expect(a.target[3]).toBeLessThan(680)
  expect(targetBox(b, b.part.contours[2])[3] - a.target[3]).toBeGreaterThan(240)
  expect(targetBox(b, b.part.contours[0])[3]).toBeLessThan(520)
  expect(targetBox(b, b.part.contours[3])[1]).toBe(0)
})

it('C073 keeps approximately one stem width of white before the right stroke', () => {
  const stem = part('glyph 丅', [0, 0, 900, 900], [0, 0, 900, 900], [[0, 820, 900, 900], [400, 0, 480, 850]])
  const line = part('learned 介', [0, 0, 80, 500], [400, 0, 480, 500], [[0, 0, 80, 500]])
  const [, out] = COMPONENT_FIXES['⿸⿹丅丿丨'].apply([stem, line])
  expect(out.target[0] - 480).toBeCloseTo(78.75)
  expect(out.target[3]).toBeGreaterThan(600)
  expect(out.target[1]).toBeGreaterThan(100)
})

it('C046 keeps a small lifted dot left of centre in a nested face', () => {
  const composer = dotComposer()
  const cut = part('learned 遝', [0, 0, 500, 440], [435, -71, 911, 365], [[0, 0, 500, 440]])
  const [after] = COMPONENT_FIXES['⿱𠂉丶'].apply([cut], composer, [100, 200, 500, 700])
  expect(after.target[2]).toBeLessThanOrEqual(300)
  expect(after.target[0]).toBeGreaterThanOrEqual(200)
  expect(after.target[2] - after.target[0]).toBeLessThanOrEqual(100)
  expect(after.target[1]).toBeCloseTo(330)
})

it('C049 sets two equal bars and a stem that reaches the mouth', () => {
  const contour = (x0, y0, x1, y1) => {
    const light = Float64Array.from([x0, y0, x1, y0, x1, y1, x0, y1])
    return { ops: [], light, heavy: light.slice(), width: null }
  }
  const cap = placed(makePart([contour(60, 600, 940, 680), contour(60, 380, 940, 460), contour(450, 200, 550, 620)]),
    [60, 200, 940, 680], [60, 200, 940, 680], 0, 'learned 𤆖')
  const mouth = part('learned 吂', [0, 0, 800, 300], [100, -80, 900, 220], [[0, 0, 800, 300]])
  const [top, lower] = COMPONENT_FIXES['⿱𰀁口'].apply([cap, mouth], { face: [38, -81, 967, 840] })
  const boxes = top.part.contours.map(contour => targetBox(top, contour)).sort((l, r) => l[1] - r[1])
  // Two bars of one span, and a stem that stands on the mouth's top edge.
  const faceWidth = 967 - 38, faceHeight = 840 + 81
  expect(boxes.filter(box => box[2] - box[0] > 0.5 * faceWidth && box[3] - box[1] < 0.2 * faceHeight)).toHaveLength(2)
  // The stem's foot reaches into the mouth's top bar.
  expect(boxes[0][1]).toBeLessThanOrEqual(lower.target[3] + 1)
})

it('C079 joins a directly sourced ㇒ to the lower half of 丅', () => {
  const stem = part('glyph 丅', [0, 0, 900, 900], [0, 0, 900, 900], [[0, 820, 900, 900], [400, 0, 480, 850]])
  const slash = part('glyph ㇒', [0, 0, 500, 500], [600, 0, 900, 500], [[0, 0, 500, 500]])
  const [, out] = COMPONENT_FIXES['⿹丅丿'].apply([stem, slash], { glyph: () => slash.part, ink: () => 1000 })
  expect(out.target[2]).toBe(480)
  expect(out.target[3]).toBeLessThan(425)
  expect(out.target[3]).toBeGreaterThan(300)
  expect(out.target[0]).toBe(0)
})


it('C081 exposes the hook head by lowering the bar without raising the bounds', () => {
  const bar = part('glyph 乛', [0, 0, 800, 300], [100, 470, 900, 770], [[0, 0, 800, 300]])
  const hook = part('glyph 亅', [0, 0, 280, 800], [270, -30, 550, 866], [[0, 0, 280, 800]])
  const [a, b] = COMPONENT_FIXES['⿻乛亅'].apply([bar, hook])
  expect(b.target.slice(0, 3)).toEqual(hook.target.slice(0, 3))
  expect(b.target[3] - a.target[3]).toBeCloseTo(224, 0)
  expect(a.target[3] - a.target[1]).toBe(300)
  expect(a.target[0]).toBe(bar.target[0])
})
