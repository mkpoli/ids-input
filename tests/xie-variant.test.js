import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { bundledSource } from '../src/composer/bundled.js'
import { componentDrawing, componentParts } from '../src/composer/component-forms.js'
import { compose, createSource, sketch } from '../src/composer/loader.js'
import { onlyBundled } from '../src/composer/local.js'
import { raster } from '../src/composer/geometry.js'
import { groupParts } from '../src/core/preview.js'
import { files } from './fixtures/composer-export.js'

const middle = '⿰丨⿴⿻冂一一', bottom = '⿹𠃌灬'
const full = `⿳宀${middle}${bottom}`, body = `⿱${middle}${bottom}`, binary = `⿱宀${body}`
const local = () => bundledSource({ load: async () => ({ records: {} }), matches: () => false })
const remote = () => createSource(async name => {
  const file = files[name]
  return file ? typeof file === 'string' ? new TextEncoder().encode(file).buffer : Uint8Array.from(file).buffer : null
})

function components(mask, size) {
  const remaining = mask.slice()
  let count = 0
  for (let start = 0; start < remaining.length; start++) {
    if (!remaining[start]) continue
    count++
    const queue = [start]
    remaining[start] = 0
    while (queue.length) {
      const i = queue.pop(), x = i % size
      for (const next of [x ? i - 1 : -1, x < size - 1 ? i + 1 : -1, i - size, i + size]) {
        if (next < 0 || next >= remaining.length || !remaining[next]) continue
        remaining[next] = 0
        queue.push(next)
      }
    }
  }
  return count
}

for (const fontStyle of ['sans', 'serif', 'kaisho']) {
  it(`draws JYN00003 and its connected body offline in ${fontStyle}`, async () => {
    for (const [text, leaves] of [[full, 7], [binary, 7], [body, 6]]) {
      expect(onlyBundled(text, false, false, fontStyle)).toBe(true)
      const drawn = await compose(local(), text, { fontStyle })
      expect(drawn.parts).toHaveLength(leaves)
      expect(drawn.origins.every(origin => origin.includes('JYN00003 editorial'))).toBe(true)
      expect(drawn.d).not.toMatch(/NaN|Infinity/)
      expect(drawn.d).toBe(componentDrawing(text, fontStyle).d)
      expect(drawn.cut).toBe('')
      const separated = await compose(local(), text, { fontStyle, separate: true })
      expect(separated.d).toBe(drawn.d)
      const boxes = await sketch(local(), text, { fontStyle })
      expect(groupParts(separated.parts, boxes)).toHaveLength(leaves)
    }
    expect(componentDrawing(full, fontStyle).d).toBe(componentDrawing(binary, fontStyle).d)
  })

  it(`connects the middle and hook while keeping four detached dots in ${fontStyle}`, () => {
    const parts = componentParts(body, undefined, fontStyle)
    expect(parts).toHaveLength(6)
    const dots = parts.at(-1)
    expect(dots.part.contours).toHaveLength(4)
    expect(components(raster([dots], 512), 512)).toBe(4)
    const frame = raster(parts.slice(0, -1), 512)
    expect(components(frame, 512)).toBe(1)
    // 冂 top, inner 一, closing 一 and 𠃌 crossbar are four distinct strokes.
    // Count ink runs through the counter centres, excluding dots and hook tip.
    for (const x of [580, 600, 620]) {
      let runs = 0, previous = 0
      for (let row = Math.floor((880 - 680) * .512); row < (880 - 180) * .512; row++) {
        const ink = frame[row * 512 + Math.floor(x * .512)]
        if (ink && !previous) runs++
        previous = ink
      }
      expect(runs).toBe(4)
    }
    expect(components(frame.map(pixel => pixel ? 0 : 1), 512)).toBe(4) // outside + three counters; both frame legs reach the hook
    expect(components(raster(parts, 512), 512)).toBe(5)
    // The hook turns left locally; it must never become a full-width bottom bar.
    const [stem, , baseline, middleBar, hook] = parts
    expect(baseline.source[3]).toBeLessThan(middleBar.source[1])
    expect(baseline.source[0]).toBeGreaterThan(stem.source[2]) // no bar across the left gap
    const lowerHookX = hook.part.contours.flatMap(contour => {
      const points = Array.from(contour.light), xs = []
      for (let i = 0; i < points.length; i += 2)
        if (points[i + 1] < (hook.source[1] + baseline.source[1]) / 2) xs.push(points[i])
      return xs
    })
    expect(lowerHookX.length).toBeGreaterThan(0)
    expect(Math.min(...lowerHookX)).toBeGreaterThan(stem.source[2])
    expect(hook.source[1]).toBeLessThan(baseline.source[1])
    expect(dots.source[3]).toBeLessThan(baseline.source[1])
  })

  it(`preserves contextual outlines under other components in ${fontStyle}`, async () => {
    for (const [text, part, leaves] of [[`⿰木${full}`, full, 7], [`⿱木${body}`, body, 6]]) {
      const drawn = await compose(remote(), text, { fontStyle })
      expect(drawn.origins.filter(origin => origin.includes(part))).toHaveLength(leaves)
      expect(drawn.d).not.toMatch(/NaN|Infinity/)
    }
  })
}

it('uses distinct font-derived faces and a current prepared example', async () => {
  expect(new Set(['sans','serif','kaisho'].map(style => componentDrawing(full, style).d)).size).toBe(3)
  const prepared = JSON.parse(readFileSync(new URL('../demo/lib/example-drawings.json', import.meta.url)))
  expect(prepared.drawings[full].drawn.d).toBe((await compose(local(), full)).d)
})
