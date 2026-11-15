#!/usr/bin/env bun
// Rebuild demo/lib/example-drawings.json: every starter example composed once using bundled outlines or the export at
// COMPOSER_BASE, so the demo opens an example without waiting for the composer. Run it whenever
// COMPOSER_BASE changes; tests/example-drawings.test.js fails until the file matches the export.
//
//   bun run build:example-drawings
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { hasTangut, tangutSource } from '@han-compose/composer/tangut'
import { hasBopomofo, bopomofoSource } from '@han-compose/composer/bopomofo'
import { hasSmallSeal, smallSealSource } from '@han-compose/composer/small-seal'
import { hasShuishu, shuishuSource } from '@han-compose/composer/shuishu'
import { hasJurchen, jurchenSource } from '@han-compose/composer/jurchen'
import { onlyBundled } from '@han-compose/composer/local'
import { bundledSource } from '@han-compose/composer/bundled'
import { compose, fromUrl } from '@han-compose/composer/loader'
import { EXAMPLES, EXAMPLE_GROUPS } from '../lib/examples.js'
import { COMPOSER_BASE } from '../lib/composer.js'

// The outlines the engine carries, where its package keeps them.
const DATA = join(dirname(fileURLToPath(import.meta.resolve('@han-compose/composer/package.json'))), 'data')
const bundledOutlines = path => JSON.parse(gunzipSync(readFileSync(join(DATA, path))))
// A draft form names the character it stood for, so its example is drawn from the description.
const DRAFTED = new Map(EXAMPLE_GROUPS.filter(group => ['sign', 'erjian'].includes(group.key))
  .flatMap(group => group.examples.map(example => [example.sequence, group.key])))
const source = fromUrl(COMPOSER_BASE)
// Examples whose parts are all bundled draw from a local source. `onlyBundled` also says yes to a
// whole sequence that matches a component form, then skips its parts, so the export stays behind
// the source for the character's own glyph.
const bundled = bundledSource({ load: async () => ({ records: {} }), matches: () => false, fallback: source })
const loadTangut = async () => bundledOutlines('sources/tangut/outlines.json.gz')
const tangut = tangutSource({ load: loadTangut })
const mixed = tangutSource({ load: loadTangut, fallback: source })
const loadShuishu = async () => bundledOutlines('sources/shuishu/outlines.json.gz')
const loadJurchen = async () => bundledOutlines('sources/jurchen/outlines.json.gz')
const loadBopomofo = async () => bundledOutlines('sources/bopomofo/outlines.json.gz')
const bopomofoSources = new Map()
await source.ready()

// 黃金萬兩 as the photographed 揮春 writes it: 金's 八 hangs from the foot of 黄's 由, and 萬's
// band stands under 金. The composer gives each operand of a stack its own row, so the three parts
// are set here, in em units (y down), with 八 just overlapping 由 so the strokes join.
const HUANG_JIN_WAN = '⿱⿱龷由⿱⿱⿰丿㇏⿻王丷⿱田⿵冂山'
const HUANG_JIN_WAN_BOXES = [
  ['Noto Sans CJK: ⿱龷由', [185, 40, 815, 320]],
  ['Noto Sans CJK: ⿱⿰丿㇏⿻王丷', [60, 312, 940, 665]],
  ['Noto Sans CJK: ⿱田⿵冂山', [120, 688, 880, 958]],
]

/** Where a quadratic or cubic Bézier coordinate turns, as parameters in (0, 1). */
function turns(values) {
  if (values.length === 3) {
    const [a, b, c] = values, den = a - 2 * b + c
    return den ? [(a - b) / den] : []
  }
  const [a, b, c, d] = values
  const qa = -a + 3 * b - 3 * c + d, qb = 2 * (a - 2 * b + c), qc = b - a
  if (Math.abs(qa) < 1e-9) return qb ? [-qc / qb] : []
  const disc = qb * qb - 4 * qa * qc
  if (disc < 0) return []
  return [(-qb + Math.sqrt(disc)) / (2 * qa), (-qb - Math.sqrt(disc)) / (2 * qa)]
}

function bezier(values, t) {
  const u = 1 - t
  return values.length === 3
    ? u * u * values[0] + 2 * u * t * values[1] + t * t * values[2]
    : u * u * u * values[0] + 3 * u * u * t * values[1] + 3 * u * t * t * values[2] + t * t * t * values[3]
}

/** The ink box of an absolute M/L/Q/C/Z path, as [left, top, right, bottom]. */
function inkBox(d) {
  const box = [Infinity, Infinity, -Infinity, -Infinity]
  const add = (x, y) => { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y) }
  let at = [0, 0]
  for (const [, cmd, args] of String(d).matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    if (cmd === 'Z') continue
    const nums = (args.match(/-?\d+\.?\d*/g) || []).map(Number)
    const step = cmd === 'Q' ? 4 : cmd === 'C' ? 6 : 2
    for (let i = 0; i + step <= nums.length; i += step) {
      const points = [at]
      for (let k = 0; k < step; k += 2) points.push([nums[i + k], nums[i + k + 1]])
      const end = points[points.length - 1]
      add(...end)
      if (step > 2) for (const axis of [0, 1]) {
        const values = points.map(point => point[axis])
        for (const t of turns(values)) if (t > 0 && t < 1) {
          const v = bezier(values, t)
          add(axis ? bezier(points.map(point => point[0]), t) : v, axis ? v : bezier(points.map(point => point[1]), t))
        }
      }
      at = end
    }
  }
  return box
}

/** Maps every point of an absolute path; Z passes through. */
function transformPath(d, map) {
  let out = ''
  for (const [, cmd, args] of String(d).matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    if (cmd === 'Z') { out += 'Z'; continue }
    const nums = (args.match(/-?\d+\.?\d*/g) || []).map(Number)
    const pts = []
    for (let i = 0; i < nums.length; i += 2) {
      const [x, y] = map(nums[i], nums[i + 1])
      pts.push(`${x.toFixed(3)} ${y.toFixed(3)}`)
    }
    out += cmd + pts.join(' ')
  }
  return out
}

function stackHuangJinWan(drawn) {
  const groups = HUANG_JIN_WAN_BOXES.map(([origin, target]) => [drawn?.parts?.filter(p => String(p.origin).startsWith(origin)) ?? [], target])
  if (groups.some(([parts]) => parts.length === 0)) return drawn
  for (const [parts, [left, top, right, bottom]] of groups) {
    const boxes = parts.map(p => inkBox(p.d))
    const [x0, y0, x1, y1] = [0, 1, 2, 3].map(i => (i < 2 ? Math.min : Math.max)(...boxes.map(b => b[i])))
    const kx = (right - left) / (x1 - x0), ky = (bottom - top) / (y1 - y0)
    for (const part of parts) part.d = transformPath(part.d, (x, y) => [left + (x - x0) * kx, top + (y - y0) * ky])
  }
  drawn.d = drawn.parts.map(p => p.d).join('')
  return drawn
}

const drawings = {}
const failed = []
for (const example of EXAMPLES) {
  try {
    const local = onlyBundled(example.sequence)
    let selected = hasTangut(example.sequence) ? (local ? tangut : mixed) : (local ? bundled : source)
    if (hasBopomofo(example.sequence)) {
      if (!bopomofoSources.has(selected)) bopomofoSources.set(selected, bopomofoSource({ load: loadBopomofo, fallback: selected }))
      selected = bopomofoSources.get(selected)
    }
    if (hasSmallSeal(example.sequence)) selected = smallSealSource({load: async () => JSON.parse(gunzipSync(readFileSync(new URL('../../node_modules/@han-compose/composer/data/sources/small-seal/outlines.json.gz', import.meta.url)))), fallback: selected})
    if (hasShuishu(example.sequence)) selected = shuishuSource({ load: loadShuishu, fallback: selected })
    if (hasJurchen(example.sequence)) selected = jurchenSource({ load: loadJurchen, fallback: selected })
    // A draft form names the character it stood for, not the one its parts spell out: the examples of
    // the sign and the 二简字 group are drawn from the description, so the thumbnail matches the editor.
    const drafted = (DRAFTED.get(example.sequence) ?? null) !== null
    const drawn = await compose(selected, drafted ? example.sequence : example.char || example.sequence)
    if (example.sequence === HUANG_JIN_WAN) stackHuangJinWan(drawn)
    drawings[example.sequence] = { char: example.char, drawn }
    console.log(`drew ${example.char || example.sequence}`)
  } catch (error) {
    failed.push({ sequence: example.sequence, char: example.char, name: error?.name, message: String(error?.message ?? error) })
    console.log(`skipped ${example.char || example.sequence}: ${error?.name ?? 'Error'}: ${error?.message ?? error}`)
  }
}
const manifest = source.manifest
const data = {
  base: COMPOSER_BASE,
  composer: {
    commit: manifest?.composer?.commit ?? null,
    style: manifest?.composer?.style ?? null,
    layout_sha256: manifest?.composer?.layout_sha256 ?? null,
  },
  drawings,
  failed,
}
const out = new URL('../lib/example-drawings.json', import.meta.url)
writeFileSync(out, JSON.stringify(data, null, 1) + '\n')
console.log(`${Object.keys(drawings).length} drawings, ${failed.length} skipped, ${JSON.stringify(data).length} bytes -> demo/lib/example-drawings.json`)
