import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
import { characterScript } from '../src/core/scripts.js'
const read = () => JSON.parse(gunzipSync(readFileSync(new URL('../data/han-parts.json.gz', import.meta.url))))

it('lists the Han characters the pinned composer export draws', () => {
  const data = read(), keys = data.keys
  expect(data.base).toBe(COMPOSER_BASE)
  expect(keys.length).toBeGreaterThan(95000)
  expect(new Set(keys).size).toBe(keys.length)
  expect(keys.every(key => [...key].length === 1 && characterScript(key) === 'han')).toBe(true)
  expect(keys.every((key, index) => !index || keys[index - 1].codePointAt(0) < key.codePointAt(0))).toBe(true)
  for (const key of ['一', '龘', '𠀁', '𪚵', '\ufa0e']) expect(keys).toContain(key)
  // Characters the export lacks but the bundled outlines draw.
  for (const key of ['㒫', '㐧', '𪚴']) expect(keys).toContain(key)
})

it('carries the stroke count Unihan records for each character', () => {
  const data = read(), keys = data.keys, strokes = data.strokes
  expect(strokes).toHaveLength(keys.length)
  expect(strokes.filter(count => count === null)).toEqual([])
  const count = key => strokes[keys.indexOf(key)]
  for (const [key, value] of [['一', 1], ['𠀁', 2], ['鬱', 29], ['麤', 33], ['龘', 48]]) expect([key, count(key)]).toEqual([key, value])
  // A radical form takes the count of the unified character it stands for.
  for (const [key, value] of [['⺊', 2], ['⺌', 3], ['⺗', 4], ['⺀', 2], ['〣', 3], ['𖿳', 7]]) expect([key, count(key)]).toEqual([key, value])
  expect(Math.max(...strokes.filter(count => count !== null))).toBe(84)
})

it('carries the first stroke Rime records for each character', () => {
  const data = read(), keys = data.keys, firsts = data.firsts
  expect(firsts).toHaveLength(keys.length)
  const first = key => firsts[keys.indexOf(key)]
  for (const [key, value] of [['一', '横'], ['丨', '豎'], ['丿', '撇'], ['丶', '點'], ['乙', '折'], ['女', '折'], ['力', '折'], ['木', '横'], ['水', '豎'], ['口', '豎']]) expect([key, first(key)]).toEqual([key, value])
  // A character given as the equivalent of a stroke character keeps the stroke's class, and the
  // grass radical begins with a horizontal.
  for (const [key, value] of [['𠃍', '折'], ['乀', '點'], ['⻀', '横'], ['⺂', '折']]) expect([key, first(key)]).toEqual([key, value])
  expect(new Set(firsts.filter(Boolean))).toEqual(new Set(['横', '豎', '撇', '點', '折']))
  // The parts palette reads the same dictionary, so the two agree wherever both record a class.
  const palette = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url)))
  const rows = palette.parts.map(row => Object.fromEntries(palette.columns.map((name, index) => [name, row[index]])))
  const held = new Map(keys.map((key, index) => [key, firsts[index]]))
  const shared = rows.filter(row => row.first && held.has(row.part))
  expect(shared.length).toBeGreaterThan(5000)
  expect(shared.filter(row => held.get(row.part) !== row.first).map(row => row.part)).toEqual([])
})
