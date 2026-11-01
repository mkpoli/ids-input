import { describe, expect, it } from 'bun:test'
import { partOf } from '../src/composer/geometry.js'

const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
// A contour a font writes with one vertex twice: once where it opens and once where it closes, with
// a corner written twice inside it as well. An export grown before han-compose#46 moved one copy
// apart at heavy and left the other, so two points that are one vertex part.
const light = [0, 0, 0, 0, 400, 0, 400, 400, 0, 400, 0, 0]
const record = heavyPoint => {
  const heavy = [...light]
  for (const [at, value] of Object.entries(heavyPoint)) heavy[at] = value
  return { b: [0, 0, 400, 400], p: [['MLLLLL', int16(light.map(v => v * 4)), int16(heavy.map((v, k) => (v - light[k]) * 4))]] }
}
const contour = heavyPoint => partOf(record(heavyPoint)).contours[0]

describe('a record whose repeated points grew apart at heavy', () => {
  it('closes a contour torn between its last point and its first', () => {
    const c = contour({ 10: -39 })
    expect([c.heavy.at(-2), c.heavy.at(-1)]).toEqual([c.heavy[0], c.heavy[1]])
  })

  it('closes a corner torn between its two copies', () => {
    const c = contour({ 2: 39, 3: 39 })
    expect([c.heavy[2], c.heavy[3]]).toEqual([c.heavy[0], c.heavy[1]])
  })

  it('leaves the points that are not repeated as stored', () => {
    const c = contour({ 10: -39 })
    expect([...c.heavy.slice(4, 8)]).toEqual([...c.light.slice(4, 8)])
  })
})
