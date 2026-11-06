import { expect, it } from 'bun:test'
import data from '../src/composer/component-forms.json'
import { componentDrawing, componentParts, componentRecord, containsComponentForm, isComponentForm, isGroupedForm } from '../src/composer/component-forms.js'
import { onlyBundled } from '../src/composer/local.js'
import { compose } from '../src/composer/loader.js'
import { constants } from './fixtures/composer-export.js'

it('does not use Noto-only forms for Kaisho capabilities or outlines', () => {
  for (const text of ['⿱丿乚', '⿸⿳亠㐅厂生', '㇯馬灬']) {
    expect(isComponentForm(text, 'sans')).toBe(true)
    expect(isComponentForm(text, 'serif')).toBe(true)
    expect(isComponentForm(text, 'kaisho')).toBe(false)
    expect(isGroupedForm(text, 'kaisho')).toBe(false)
    expect(containsComponentForm(`⿰木${text}`, 'kaisho')).toBe(false)
    expect(componentRecord(text, 'kaisho')).toBeNull()
    expect(componentParts(text, undefined, 'kaisho')).toBeNull()
    expect(componentDrawing(text, 'kaisho')).toBeNull()
    expect(onlyBundled(text, false, false, 'kaisho')).toBe(false)
  }
})

it('loads the internal operands of a Noto-only form for Kaisho', async () => {
  const requests = []
  const stop = new Error('stop after initial file selection')
  const source = {
    ready: async () => {}, manifest: { constants },
    filesOf: keys => { requests.push(...keys); return [] },
    load: async () => { throw stop },
  }
  await expect(compose(source, '⿱木⿱丿乚', { fontStyle: 'kaisho' })).rejects.toThrow(stop.message)
  expect(requests).toContain('丿')
  expect(requests).toContain('乚')
  requests.length = 0
  await expect(compose(source, '⿱木⿱丿乚', { fontStyle: 'sans' })).rejects.toThrow(stop.message)
  expect(requests).not.toContain('丿')
  expect(requests).not.toContain('乚')
})

it('recognizes only explicit Kaisho forms and credits their native font', () => {
  for (const [text, groups] of Object.entries(data.forms.kaisho ?? {})) {
    expect(isComponentForm(text, 'kaisho')).toBe(true)
    expect(isGroupedForm(text, 'kaisho')).toBe(groups.length > 1)
    expect(containsComponentForm(`⿰木${text}`, 'kaisho')).toBe(true)
    expect(onlyBundled(text, false, false, 'kaisho')).toBe(true)
    const parts = componentParts(text, undefined, 'kaisho')
    expect(parts).toHaveLength(groups.length)
    expect(parts.every(part => part.origin.includes('Kureedo') && part.origin.endsWith(`: ${text}`))).toBe(true)
    expect(componentDrawing(text, 'kaisho').d).not.toMatch(/NaN|Infinity/)
  }
})

// 萬 carries its outer edge, 田's box, the legs and the 禸 pencil in one contour, and the
// prepared form splices the pencil out of it. The band it leaves is checked point by point,
// which is also what tells 田's counters apart from the band: a counter that winds with the
// band rather than against it fills in.
const WAN_SHAN = '⿳艹田⿵冂山'
const inked = (contours, x, y) => {
  let winding = 0
  for (const [, points] of contours) {
    const n = points.length / 2
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const [x1, y1, x2, y2] = [points[2 * i], points[2 * i + 1], points[2 * j], points[2 * j + 1]]
      if (y1 <= y ? y2 > y : y2 <= y) {
        if (x1 + (y - y1) / (y2 - y1) * (x2 - x1) > x) winding += y2 > y1 ? 1 : -1
      }
    }
  }
  return winding !== 0
}
// The band as 萬 draws it: the legs' outer edges, the floor they stand on, their inner edges, the
// flat inner top the splice closes the opening with and that bar's own top, 田's counter gap, and
// the leftmost point of the hook's blade. 山 does not share the legs' floor: the blade's upper
// edge is the floor of the compartment the legs enclose, and the spliced-out 禸 bottoms out just
// above it. On the right the blade, not the leg, is what limits 山's width.
const BAND = {
  sans: { floor: -80, legs: [110, 899], inner: [182, 826], ceiling: [208, 273], spine: [462, 534], blade: [713, -16] },
  serif: { floor: -78, legs: [127, 920], inner: [190, 814], ceiling: [240, 269], spine: [472, 535], blade: [664, -8] },
}
// Both arms carry a foot below the bar, the stem runs up into the ceiling bar as 萬's spine
// continued, and a channel stays open over the arms. The points left clear are the three whites
// that make it read as 山 — the channel, the two counters beside the stem, the floor between the
// feet — plus two places the native 禸 inked and this form must not.
const SAMPLES = {
  sans: {
    ink: { 'the left leg': [146, 50], 'the right leg': [862, 50], 'the band over the opening': [500, 240],
      "田's left stem": [200, 480], "田's middle bar": [500, 480], "艹's bar": [300, 735],
      "山's stem": [498, 150], "山's bar": [498, 70], "山's left arm": [319, 140],
      "山's right arm": [677, 140], "山's left foot": [319, 20], "山's right foot": [677, 20] },
    clear: { "田's upper-left counter": [350, 420], "田's lower-right counter": [650, 550],
      "the channel over 山's arms": [319, 193], "the counter left of 山's stem": [410, 140],
      "the counter right of 山's stem": [590, 140], "the floor between 山's feet": [498, 15],
      "the 禸 bar's left end": [250, 60], "the 禸 sweep's tail": [750, 0],
      'the opening left of 山': [230, 50], 'the opening right of 山': [770, 50] },
  },
  serif: {
    ink: { 'the left leg': [155, 50], 'the right leg': [850, 50], 'the band over the opening': [500, 300],
      "田's left stem": [230, 480], "田's middle bar": [500, 480], "艹's bar": [300, 735],
      "山's stem": [503, 170], "山's bar": [503, 95], "山's left arm": [320, 150],
      "山's right arm": [687, 150], "山's left foot": [320, 50], "山's right foot": [687, 50] },
    clear: { "田's upper-left counter": [350, 420], "田's lower-right counter": [650, 550],
      "the channel over 山's arms": [320, 220], "the counter left of 山's stem": [410, 150],
      "the counter right of 山's stem": [595, 150], "the floor between 山's feet": [503, 50],
      "the strip over the hook's blade": [640, 10],
      'the opening left of 山': [250, 100], 'the opening right of 山': [740, 100] },
  },
}

it('draws 萬 with 山 where its 禸 sits, in the sans face', () => {
  // The serif face has no prepared form for this description: its 山 cannot be placed in the
  // compartment without losing its horizontal weight, so it composes from parts instead.
  expect(isComponentForm(WAN_SHAN, 'serif')).toBe(false)
  for (const style of ['sans']) {
    expect(isComponentForm(WAN_SHAN, style)).toBe(true)
    expect(isGroupedForm(WAN_SHAN, style)).toBe(true)
    expect(componentDrawing(WAN_SHAN, style).d).not.toMatch(/NaN|Infinity/)
    const parts = componentParts(WAN_SHAN, undefined, style)
    expect(parts).toHaveLength(2)
    const [wan, shan] = data.forms[style][WAN_SHAN]
    // 萬's spliced outline, its 艹 and 田's four counters; 山 is the second group.
    expect(wan).toHaveLength(6)
    expect(shan).toHaveLength(1)
    expect([...wan, ...shan].flatMap(([, points]) => points).every(Number.isFinite)).toBe(true)
    const { floor, legs, inner, ceiling, spine, blade } = BAND[style]
    const box = points => [Math.min(...points.filter((_, i) => !(i % 2))), Math.min(...points.filter((_, i) => i % 2)),
      Math.max(...points.filter((_, i) => !(i % 2))), Math.max(...points.filter((_, i) => i % 2))]
    // The spliced outline comes first: its legs still stand on the band floor at 萬's own width.
    const outline = box(wan[0][1])
    expect([outline[0], outline[1], outline[2]]).toEqual([legs[0], floor, legs[1]])
    const [x0, y0, x1, y1] = box(shan[0][1])
    // 山 stands on the compartment's floor, above the hook's blade and well clear of the legs' own feet.
    expect(y0).toBeGreaterThan(blade[1])
    expect(y0 - floor).toBeGreaterThan((ceiling[0] - blade[1]) / 4)
    expect(x0).toBeGreaterThan(inner[0])
    expect(x1).toBeLessThan(inner[1])
    // It is set about 萬's spine and takes the share of the compartment 岡 gives its own 山,
    // so the two margins come out level however far in the hook reaches.
    expect(x0 + x1).toBe(spine[0] + spine[1])
    expect((x1 - x0) / (inner[1] - inner[0])).toBeCloseTo(0.69, 1)
    expect(Math.abs((x0 - inner[0]) - (inner[1] - x1))).toBeLessThan(20)
    // The stem continues 萬's spine: it keeps the spine's column and runs up into the ceiling bar.
    const xs = shan[0][1].filter((_, i) => !(i % 2))
    expect(xs).toContain(spine[0])
    expect(xs).toContain(spine[1])
    expect(y1).toBeGreaterThan(ceiling[0])
    expect(y1).toBeLessThan(ceiling[1])
    // Both faces draw 山 from the band, so every corner has its mirror image about the spine.
    const corners = new Set(shan[0][1].flatMap((_, i) => (i % 2 ? [] : [`${shan[0][1][i]},${shan[0][1][i + 1]}`])))
    for (const corner of corners) {
      const [x, y] = corner.split(',').map(Number)
      expect(corners).toContain(`${spine[0] + spine[1] - x},${y}`)
    }
    const contours = [...wan, ...shan]
    for (const [where, [x, y]] of Object.entries(SAMPLES[style].ink)) {
      expect(`${where}: ${inked(contours, x, y) ? 'ink' : 'clear'}`).toBe(`${where}: ink`)
    }
    for (const [where, [x, y]] of Object.entries(SAMPLES[style].clear)) {
      expect(`${where}: ${inked(contours, x, y) ? 'ink' : 'clear'}`).toBe(`${where}: clear`)
    }
  }
})
