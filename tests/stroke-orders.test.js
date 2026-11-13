import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { STROKE_KEYS, findByStrokes, nextStrokes, strokesFrom } from '../src/core/stroke-order.js'
const data = JSON.parse(gunzipSync(readFileSync(new URL('../data/stroke-orders.json.gz', import.meta.url))))
const palette = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url), 'utf8'))
const orders = new Map(data.keys.map((key, index) => [key, data.orders[index].split(' ')]))

it('records the stroke order of the Han parts of the palette', () => {
  expect(data.orders).toHaveLength(data.keys.length)
  expect(new Set(data.keys).size).toBe(data.keys.length)
  expect(data.keys.length).toBeGreaterThan(10600)
  const listed = new Set(palette.parts.map(row => row[0]))
  expect(data.keys.every(key => listed.has(key))).toBe(true)
  expect(data.orders.every(order => /^[hspnz]+( [hspnz]+)*$/.test(order))).toBe(true)
  for (const [key, value] of [['王', ['hhsh']], ['口', ['szh']], ['彐', ['zhh']], ['小', ['zpn', 'spn']], ['乃', ['pz', 'zp']]]) expect([key, orders.get(key)]).toEqual([key, value])
})

it('reads a part of one stroke as the class the palette gives it', () => {
  const letter = { 横: 'h', 豎: 's', 撇: 'p', 點: 'n', 折: 'z' }
  for (const row of palette.parts) {
    if (row[2] === 1 && row[4] && ['c', 'd', 's'].includes(row[5])) expect([row[0], orders.get(row[0])]).toEqual([row[0], [letter[row[4]]]])
  }
  for (const [key, value] of [['㇐', 'h'], ['㇕', 'z'], ['𠃍', 'z'], ['𠃎', 'z'], ['乀', 'n']]) expect([key, orders.get(key)]).toEqual([key, [value]])
})

it('finds parts by the strokes they begin with, fewest strokes first', () => {
  const parts = ['王', '彐', '口', '小', '乃', '三', '一'].map(part => ({ part }))
  expect(STROKE_KEYS.map(key => key.letter).join('')).toBe('hspnz')
  expect(strokesFrom(orders.get('小'), 'sp')).toBe(3)
  expect(strokesFrom(orders.get('小'), 'zpn')).toBe(3)
  expect(strokesFrom(orders.get('小'), 'h')).toBe(null)
  expect(findByStrokes(parts, orders, 'hh').map(hit => [hit.part.part, hit.strokes])).toEqual([['三', 3], ['王', 4]])
  expect(findByStrokes(parts, orders, 'h').map(hit => hit.part.part)).toEqual(['一', '三', '王'])
  // Either order of 乃 finds it.
  expect(findByStrokes(parts, orders, 'zp').map(hit => hit.part.part)).toEqual(['乃', '小'])
  expect(findByStrokes(parts, orders, 'pz').map(hit => hit.part.part)).toEqual(['乃'])
  expect([...nextStrokes(parts, orders, 'z')].sort()).toEqual(['h', 'p'])
  expect([...nextStrokes(parts, orders, 'hhsh')]).toEqual([])
})
