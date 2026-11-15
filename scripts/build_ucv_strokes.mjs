// Collect the stroke data (KAGE) of the component variation forms no text writes, with every part
// they refer to, from a GlyphWiki dump, so the forms can be drawn in another face than Mincho.
//
//   bun scripts/build_ucv_strokes.mjs <dump folder>
//
// The folder holds `dump_newest_only.txt` and `dump_all_versions.txt` of
// https://glyphwiki.org/dump.tar.gz. A glyph is redrawn over time, so the stroke data kept for a
// form is the version that, drawn in Mincho, is the outline `data/ucv-forms.json.gz` recorded for
// it; a form no version draws that way is left out. Writes `data/ucv-strokes.json.gz`, from which
// `build_ucv.mjs` draws.
import { Kage, Polygons } from '@kurgm/kage-engine'
import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { gunzipSync, gzipSync } from 'node:zlib'
import { alike, area, cells, polygonsOf, wound } from './lib/outline.mjs'

const folder = process.argv[2]
if (!folder) throw new Error('usage: bun scripts/build_ucv_strokes.mjs <dump folder>')
const data = new URL('../data/', import.meta.url)
const ucv = JSON.parse(await readFile(new URL('ucv.json', data), 'utf8'))
/** @type {Record<string, string>} */
const recorded = JSON.parse(gunzipSync(await readFile(new URL('ucv-forms.json.gz', data))).toString('utf8'))
/** @type {string[]} */
const forms = [...new Set(ucv.entries.flatMap((/** @type {any} */ entry) => entry.forms)
  .filter((/** @type {any} */ form) => !form.text && !form.undrawn).map((/** @type {any} */ form) => form.glyph))].sort()

/** The least share of each drawing's ink that must lie on or beside the other's for one form. */
const SAME_FORM = Number(process.env.SAME_FORM ?? 0.97)
/** How far apart, in units of the drawing square, two edges may be and still be the same edge. */
const NEAR = 2

/** The parts a glyph's data refers to, each as it is named: with its version where one is pinned. @param {string} strokes */
const parts = strokes => strokes.split('$').map(line => line.split(':')).filter(fields => fields[0] === '99' && fields[7]).map(fields => fields[7])

/**
 * The rows of a dump table that `wanted` accepts, by name. A row is `name | related | data`.
 * @param {string} file @param {(name: string) => boolean} wanted
 */
async function rows(file, wanted) {
  /** @type {Map<string, string>} */
  const found = new Map()
  for await (const line of createInterface({ input: createReadStream(join(folder, file), 'utf8'), crlfDelay: Infinity })) {
    const cut = line.indexOf('|')
    if (cut < 0) continue
    // The table of every version writes the version after an escaped mark: `u5927-04\@2`.
    const name = line.slice(0, cut).trim().replace('\\@', '@')
    if (!wanted(name)) continue
    found.set(name, line.slice(line.indexOf('|', cut + 1) + 1).trim())
  }
  return found
}

// Every version of each form, then the parts they name, then theirs, until a pass finds no new
// name. A part pinned to a version (`u58ec-01@2`) is read from the table of every version, any
// other from the newest.
const named = new Set(forms)
/** @type {Map<string, string>} */
const glyphs = await rows('dump_all_versions.txt', name => named.has(name.split('@')[0]))
const absent = new Set()
let wanted = new Set([...glyphs.values()].flatMap(parts).filter(part => !glyphs.has(part)))
while (wanted.size) {
  const pinned = new Set([...wanted].filter(name => name.includes('@')))
  const newest = new Set([...wanted].filter(name => !name.includes('@')))
  const found = new Map([
    ...(newest.size ? await rows('dump_newest_only.txt', name => newest.has(name)) : []),
    ...(pinned.size ? await rows('dump_all_versions.txt', name => pinned.has(name)) : []),
  ])
  const next = new Set()
  for (const name of wanted) {
    const strokes = found.get(name)
    if (strokes === undefined) { absent.add(name); continue }
    glyphs.set(name, strokes)
    for (const part of parts(strokes)) if (!glyphs.has(part) && !absent.has(part)) next.add(part)
  }
  wanted = next
}

const kage = new Kage()
kage.kShotai = kage.kMincho
for (const [name, strokes] of glyphs) kage.kBuhin.push(name, strokes)
/** A glyph's Mincho drawing, or null where a part of it is not in the dump. @param {string} name */
function drawn(name) {
  const seen = new Set()
  const whole = (/** @type {string} */ glyph) => {
    if (seen.has(glyph)) return true
    seen.add(glyph)
    const strokes = glyphs.get(glyph)
    return strokes !== undefined && parts(strokes).every(whole)
  }
  if (!whole(name)) return null
  const polygons = new Polygons()
  kage.makeGlyph(polygons, name)
  // The engine's polygons are strokes, wound either way and filled as one shape.
  return polygons.array.map(polygon => polygon.array.map(point => /** @type {[number, number]} */ ([point.x, point.y])))
    .filter(polygon => polygon.length > 2).map(polygon => area(polygon) < 0 ? polygon.reverse() : polygon)
}

// The version of each form that draws its recorded outline, the newest of those that tie.
/** @type {Record<string, { version: number, same: number }>} */
const chosen = {}
const left = []
for (const name of forms) {
  const outline = cells(wound(polygonsOf(recorded[name])))
  let best = { version: 0, same: 0 }
  const versions = [...glyphs.keys()].filter(key => key.split('@')[0] === name && key.includes('@')).map(key => Number(key.split('@')[1])).sort((a, b) => b - a)
  for (const version of versions) {
    const polygons = drawn(`${name}@${version}`)
    const score = polygons ? alike(outline, cells(polygons), NEAR) : 0
    if (score > best.same) best = { version, same: score }
  }
  if (best.same >= SAME_FORM) chosen[name] = { version: best.version, same: +best.same.toFixed(4) }
  else left.push(`${name} ${best.same.toFixed(2)}${versions.length ? '' : ' (not in the dump)'}`)
}

// What is kept: each chosen version under its versioned name, and the parts it is drawn from.
/** @type {Record<string, string>} */
const kept = {}
const keep = (/** @type {string} */ name) => {
  if (name in kept) return
  const strokes = /** @type {string} */ (glyphs.get(name))
  kept[name] = strokes
  parts(strokes).forEach(keep)
}
for (const [name, { version }] of Object.entries(chosen)) keep(`${name}@${version}`)

const modified = (await stat(join(folder, 'dump_newest_only.txt'))).mtime.toISOString().slice(0, 10)
const source = { name: 'GlyphWiki', url: 'https://glyphwiki.org/dump.tar.gz', files: ['dump_newest_only.txt', 'dump_all_versions.txt'], modified, same: SAME_FORM, near: NEAR }
const sorted = Object.fromEntries(Object.keys(kept).sort().map(name => [name, kept[name]]))
await writeFile(new URL('ucv-strokes.json.gz', data), gzipSync(JSON.stringify({ source, forms: chosen, glyphs: sorted })))
console.log(`${forms.length} forms: ${Object.keys(chosen).length} with stroke data that draws the recorded outline, ${left.length} without; ${Object.keys(kept).length} glyphs kept`)
if (left.length) console.log(left.join('; '))
if (process.env.SCORES) await writeFile(process.env.SCORES, JSON.stringify({ chosen, left }))
