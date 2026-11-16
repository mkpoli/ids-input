// A bitmap drawing is read from a PNG image and traced into the polygons along its ink.
import { expect, it } from 'bun:test'
import { deflateSync } from 'node:zlib'
import { area, cells, counters, SQUARE, wound } from '../scripts/lib/outline.mjs'
import { inkOf, trace } from '../scripts/lib/trace.mjs'

/** A chunk of a PNG file; nothing here checks its sum. @param {string} type @param {Buffer} body */
const chunk = (type, body) => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(body.length, 0)
  head.write(type, 4, 'latin1')
  return Buffer.concat([head, body, Buffer.alloc(4)])
}
/** A one-bit palette image whose palette writes ink as `dark`. @param {string[]} rows @param {number} dark */
function png(rows, dark) {
  const width = rows[0].length, line = Math.ceil(width / 8)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(rows.length, 4)
  header.set([1, 3, 0, 0, 0], 8)
  const data = Buffer.alloc(rows.length * (line + 1))
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if ((cell === '#') === (dark === 1)) data[y * (line + 1) + 1 + (x >> 3)] |= 128 >> (x & 7)
  }))
  const palette = dark === 1 ? [255, 255, 255, 0, 0, 0] : [0, 0, 0, 255, 255, 255]
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('PLTE', Buffer.from(palette)), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))])
}
/** @param {string[]} rows */
const bitmap = rows => ({ width: rows[0].length, height: rows.length, ink: Uint8Array.from(rows.join(''), cell => cell === '#' ? 1 : 0) })

it('reads the ink of a palette image whichever entry is dark', () => {
  const rows = ['#..#.....#', '.#........', '..........']
  for (const dark of [0, 1]) {
    const read = inkOf(png(rows, dark))
    expect([read.width, read.height]).toEqual([10, 3])
    expect([...read.ink].join('')).toBe(rows.join('').replaceAll('#', '1').replaceAll('.', '0'))
  }
  expect(() => inkOf(Buffer.from('not an image'))).toThrow('not a PNG image')
})

it('keeps the corners of a box and winds its counter the other way', () => {
  const rows = Array.from({ length: 30 }, (_, y) => Array.from({ length: 30 }, (_, x) =>
    x >= 4 && x < 26 && y >= 4 && y < 26 && !(x >= 10 && x < 20 && y >= 10 && y < 20) ? '#' : '.').join(''))
  const polygons = trace(bitmap(rows))
  expect(polygons).toHaveLength(2)
  const [shape, counter] = polygons.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))
  expect(new Set(shape.map(point => point.join()))).toEqual(new Set(['4,4', '26,4', '26,26', '4,26']))
  expect(new Set(counter.map(point => point.join()))).toEqual(new Set(['10,10', '20,10', '20,20', '10,20']))
  expect(Math.sign(area(shape))).toBe(-Math.sign(area(counter)))
  expect(counters([shape, counter])).toEqual([false, true])
})

it('draws the steps of a slant as one line', () => {
  // A band 6 pixels tall that falls a pixel every 2 across.
  const rows = Array.from({ length: 40 }, (_, y) => Array.from({ length: 40 }, (_, x) => x >= 4 && x < 36 && y >= 4 + (x >> 1) && y < 10 + (x >> 1) ? '#' : '.').join(''))
  const polygons = trace(bitmap(rows))
  expect(polygons).toHaveLength(1)
  expect(polygons[0].length).toBeLessThanOrEqual(8)
})

it('keeps ink that meets at a corner as two shapes', () => {
  const rows = ['##....', '##....', '..##..', '..##..', '......']
  expect(trace(bitmap(rows), 0)).toHaveLength(2)
})

it('covers the cells of the bitmap it traces', () => {
  const rows = Array.from({ length: SQUARE }, (_, y) => Array.from({ length: SQUARE }, (_, x) =>
    Math.hypot(x - 100, y - 100) < 70 && Math.hypot(x - 100, y - 100) >= 40 || (y >= 20 && y < 24 && x >= 10 && x < 190) ? '#' : '.').join(''))
  const drawn = bitmap(rows)
  const traced = cells(wound(trace(drawn)))
  let differ = 0
  traced.forEach((cell, at) => { differ += cell !== drawn.ink[at] ? 1 : 0 })
  expect(differ / drawn.ink.reduce((sum, cell) => sum + cell, 0)).toBeLessThan(0.02)
})
