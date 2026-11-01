#!/usr/bin/env bun
// Scan the serif export's own glyphs for contours whose heavy master does not end where it starts:
// the ones `partOf` (src/composer/geometry.js) repairs before drawing, and the ones it draws as
// stored because their light master never repeated its first point. A contour's gap is measured
// through the pen's own points, so it matches what the drawing code reads.
//
//   bun scripts/audit_serif_openings.mjs OUT_DIR [RANGE...]
//
// A range is `ascii`, `cjk`, `latin-ext`, `greek`, `cyrillic`, `all`, or `U+XXXX-U+YYYY`. The run
// ends with a self-check on `o` and `6`, whose records are pinned in tests/serif-outlines.test.js.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bytes, commands, partOf } from '../src/composer/geometry.js'
import { fromUrl } from '../src/composer/loader.js'
import { COMPOSER_BASES } from '../demo/lib/composer.js'

const RANGES = {
  ascii: [[0x0030, 0x007a]],
  'latin-ext': [[0x00c0, 0x024f]],
  greek: [[0x0370, 0x03ff], [0x1f00, 0x1fff]],
  cyrillic: [[0x0400, 0x04ff]],
  cjk: [[0x3400, 0x4dbf], [0x4e00, 0x9fff], [0x20000, 0x323af]],
}
/** The gap, in font units, that leaves a visible wedge: the 25-quarter-unit rounding error a TrueType
 *  outline cannot avoid is 6.25, and the 39 quarter units the joined records carry is 9.75. */
const OPENING = 4

// In quarter units, as the pinned records store them.
const CHECKS = { o: 39, 6: 39 }

const [dir, ...requested] = process.argv.slice(2)
if (!dir) throw Error('Usage: bun scripts/audit_serif_openings.mjs OUT_DIR [RANGE...]')
const named = requested.length ? requested : ['ascii']
const ranges = named.flatMap(name => {
  if (name === 'all') return Object.values(RANGES).flat()
  if (RANGES[name]) return RANGES[name]
  const match = /^U\+([0-9a-f]+)-U\+([0-9a-f]+)$/i.exec(name)
  if (!match) throw Error(`Unknown range: ${name}`)
  return [[parseInt(match[1], 16), parseInt(match[2], 16)]]
})

const source = fromUrl(COMPOSER_BASES.serif)
await source.ready()
const store = source.store()

/** The record's int16 points, quarter units, read the way `geometry.js` reads them.
 *  @param {string} text */
const int16 = text => {
  const raw = bytes(text)
  return new Int16Array(raw.buffer, raw.byteOffset, raw.length >> 1)
}

/** The pen's own points, read the way `partOf` reads them, with `segments`' implied close made
 *  explicit: the contour starts and ends on the midpoint between the last point and the first.
 *  @param {any[]} ops @param {Int16Array} light @param {Int16Array} delta @param {number} weight */
function outline(ops, light, delta, weight) {
  const coords = i => (light[i] + weight * delta[i]) / 4
  let at = 0, first = null, last = null, implied = false
  for (const [op, n, star] of commands(ops)) {
    if (op === 'Q' || op === 'C') implied = star
    if (op === 'M' || op === 'L') {
      if (first === null) first = [coords(2 * at), coords(2 * at + 1)]
      last = [coords(2 * at), coords(2 * at + 1)]
    } else last = [coords(2 * (at + n - 1)), coords(2 * (at + n - 1) + 1)]
    at += n
  }
  if (!first || !last) return null
  const end = implied ? [(last[0] + first[0]) / 2, (last[1] + first[1]) / 2] : last
  const start = implied ? end : first
  return Math.hypot(start[0] - end[0], start[1] - end[1])
}

/** A record's own contours as `partOf` reads them: the gap their heavy master leaves before the
 *  repair, and the gap the drawn part still has after it.
 *  @param {any} record */
function openings(record) {
  const found = { repaired: [], stored: [], near: [], faulty: [], contours: 0 }
  const part = partOf(record.G)
  record.G.p.forEach(([ops, light, delta], index) => {
    const lo = int16(light), d = int16(delta)
    if (d.length !== lo.length) { found.faulty.push('delta length'); return }
    found.contours++
    const gap = outline(ops, lo, d, 1)
    if (gap === null) return
    const drawn = part.contours[index]
    const n = drawn.heavy.length
    const left = Math.hypot(drawn.heavy[0] - drawn.heavy[n - 2], drawn.heavy[1] - drawn.heavy[n - 1])
    // What `partOf` repaired is the difference between the record's heavy gap and the drawn one.
    // What is left is a contour whose light master never closed, drawn as stored.
    if (left <= OPENING && gap > OPENING) found.repaired.push(+gap.toFixed(2))
    else if (left > OPENING) {
      if (lo.length >= 4 && lo[0] === lo[lo.length - 2] && lo[1] === lo[lo.length - 1]) found.near.push(+left.toFixed(2))
      else found.stored.push(+left.toFixed(2))
    }
  })
  return found
}

/** @param {any} record */
const hasOwn = record => Array.isArray(record?.G?.p)

const chars = []
for (const [lo, hi] of ranges) for (let cp = lo; cp <= hi; cp++) chars.push(String.fromCodePoint(cp))

const BATCH = 500
const hits = { repaired: [], stored: [], near: [] }
let asked = 0, withOutlines = 0, faulty = 0
for (let start = 0; start < chars.length; start += BATCH) {
  const batch = chars.slice(start, start + BATCH)
  await source.load(source.filesOf(batch))
  for (const char of batch) {
    const record = store.rec(char)
    asked++
    if (!hasOwn(record)) continue
    withOutlines++
    const found = openings(record)
    if (found.faulty.length) faulty++
    const code = `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
    for (const kind of ['repaired', 'stored', 'near']) if (found[kind].length) hits[kind].push({ char, code, gaps: found[kind] })
  }
  if (start % (BATCH * 20) === 0) console.log(`${asked}/${chars.length} asked`)
}

// The scan has to be able to report a gap before its silence means anything.
// The control is read from the export itself, whatever ranges were asked for.
await source.load(source.filesOf(Object.keys(CHECKS)))
const matched = Object.keys(CHECKS).every(key => {
  const record = store.rec(key)
  return hasOwn(record) && openings(record).repaired.some(gap => Math.abs(gap - CHECKS[key]) < 0.1)
})
const summary = {
  export: COMPOSER_BASES.serif, ranges: named, asked, withOutlines, faulty,
  control: matched,
  // The gaps found in each bucket, largest first, so the threshold has a distribution to answer to.
  gaps: Object.fromEntries(['repaired', 'stored', 'near'].map(kind => [kind,
    hits[kind].flatMap(hit => hit.gaps).sort((a, b) => b - a).slice(0, 12)])),
  counts: Object.fromEntries(['repaired', 'stored', 'near'].map(kind => [kind, hits[kind].length])),
  hits,
}
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'openings.json'), JSON.stringify(summary, null, 2))
console.log(`${asked} asked, ${withOutlines} with outlines: ${hits.repaired.length} repaired, ${hits.stored.length} drawn as stored with a gap, ${hits.near.length} closed and still open, ${faulty} faulty; control ${matched ? 'found o and 6' : 'MISSING'}`)
if (!matched) process.exit(1)
