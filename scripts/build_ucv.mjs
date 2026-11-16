// Compile the IRG's unifiable and non-unifiable component variations from the IWDS source file,
// with the outline of every component form the file names.
//
//   bun scripts/build_ucv.mjs [checkout] [--refresh]
//
// `checkout` is a local copy of the pinned revision; without it the files are fetched. An outline
// already in `data/ucv-forms.json.gz` is kept as it is, so a rebuild asks only for the forms that
// file lacks; `--refresh` reads every outline again. A form that has no vector drawing is traced
// from the snapshot's image of it. The forms no text writes are also drawn in
// Gothic from their stroke data (`data/ucv-strokes.json.gz`, see `build_ucv_strokes.mjs`).
import { Kage, Polygons } from '@kurgm/kage-engine'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { SQUARE, area, cells, counters, enclosed, filled, polygonsOf } from './lib/outline.mjs'
import { inkOf, trace } from './lib/trace.mjs'

const revision = '8302302d615ff1c1f60ae335b118b10060be0ed4'
const expected = '886b426ea3d1d329749e02b32cccd5082d31d6cf1b996ea37bdae5ac593ca491'
const raw = `https://raw.githubusercontent.com/yi-bai/iwds/${revision}`
const refresh = process.argv.includes('--refresh')
const checkout = process.argv.slice(2).find(arg => !arg.startsWith('--'))
const data = new URL('../data/', import.meta.url)

/** @param {string} path */
async function read(path) {
  if (checkout) return readFile(join(checkout, path)).catch(() => null)
  const response = await fetch(`${raw}/${path}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
/** @param {string} text */
const unescape = text => text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name) =>
  name[0] === '#' ? String.fromCodePoint(name[1] === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)))
    : ENTITIES[/** @type {keyof typeof ENTITIES} */ (name)] ?? whole)
/** @param {string} tag @returns {Record<string, string>} */
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)')/g)].map(match => [match[1], unescape(match[2] ?? match[3])]))

// The chart an example is shown from when it is not the current one.
const CHARTS = { '*': 'ucs2003', $: 'ucs2014', '#': 'supercjk' }
const IDC = /^[⿰-⿿㇯]$/u

/** The characters of an example list, its chart marks and whether it trails off.
 * @param {string} text */
function characters(text) {
  /** @type {string[]} */
  const list = []
  /** @type {Record<string, string>} */
  const charts = {}
  let more = false
  for (const char of text.trim()) {
    if (char === '…') more = true
    else if (char in CHARTS) charts[list[list.length - 1]] = CHARTS[/** @type {keyof typeof CHARTS} */ (char)]
    else if (!/\s/u.test(char)) list.push(char)
  }
  return { list, charts, more }
}

/** What a GlyphWiki glyph name says about the form it draws. @param {string} name */
function form(name) {
  const point = (/** @type {string} */ hex) => String.fromCodePoint(parseInt(hex, 16))
  const parts = name.split('-')
  const coded = parts.map(part => /^u[0-9a-f]{4,6}$/.test(part) ? point(part.slice(1)) : null)
  if (coded.every(Boolean)) {
    // A character, a description, or a character and its variation selector.
    const text = coded.join('')
    if (parts.length === 1 || IDC.test(/** @type {string} */ (coded[0]))) return { glyph: name, text }
    if (parts.length === 2 && /^ue01[0-9a-f]{2}$|^ufe0[0-9a-f]$/.test(parts[1])) return { glyph: name, text }
  }
  // A named form of a character: a source's, a position's or a numbered variant.
  if (coded[0] && !IDC.test(coded[0])) return { glyph: name, of: coded[0] }
  return { glyph: name }
}

/** An outline in a 200-unit square, as one path. @param {string} svg */
function outline(svg) {
  const paths = []
  for (const match of svg.matchAll(/<polygon points="([^"]+)"/g)) {
    const numbers = match[1].trim().split(/[\s,]+/).map(Number)
    let d = ''
    for (let i = 0; i + 1 < numbers.length; i += 2) d += `${i ? 'L' : 'M'}${+numbers[i].toFixed(1)} ${+numbers[i + 1].toFixed(1)}`
    paths.push(d + 'Z')
  }
  for (const match of svg.matchAll(/<path d="([^"]+)"/g)) {
    paths.push(match[1].trim().replace(/-?\d+(?:\.\d+)?/g, number => String(+Number(number).toFixed(1))).replace(/\s*([MLZ])\s*/g, '$1'))
  }
  return paths.join('')
}

const bytes = await read('iwds.xml')
if (!bytes) throw new Error('iwds.xml is missing')
if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('iwds.xml: unexpected source hash')
const xml = bytes.toString('utf8')

/** @type {{ id: string, en: string, subgroups: { id: string, en: string }[] }[]} */
const groups = []
/** @type {Record<string, any>[]} */
const entries = []
let group = '', subgroup = ''
for (const match of xml.matchAll(/<(group|subgroup)\s([^>]*)>|<\/(group|subgroup)>|<entry\s([^>]*)>([\s\S]*?)<\/entry>/g)) {
  if (match[1] === 'group') { const a = attributes(match[2]); group = a.id; subgroup = ''; groups.push({ id: a.id, en: a.en, subgroups: [] }) }
  else if (match[1] === 'subgroup') { const a = attributes(match[2]); subgroup = a.id; groups[groups.length - 1].subgroups.push({ id: a.id, en: a.en }) }
  else if (match[3] === 'subgroup') subgroup = ''
  else if (match[3] === 'group') group = ''
  else {
    const a = attributes(match[4])
    /** @type {Record<string, string[]>} */
    const fields = {}
    for (const field of match[5].matchAll(/<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g)) (fields[field[1]] ??= []).push(unescape(field[3]).trim())
    const one = (/** @type {string} */ name) => fields[name]?.[0] || undefined
    const charts = {}
    let more = false
    const list = (/** @type {string | undefined} */ text) => {
      if (!text) return undefined
      const read = characters(text)
      Object.assign(charts, read.charts); more ||= read.more
      return read.list
    }
    const groupsOf = (/** @type {string | undefined} */ text) => text?.split(',').map(part => list(part) ?? []).filter(part => part.length)
    const unified = list(one('unified'))
    const unifiedMore = more
    const entry = {
      id: a.id,
      kind: a.kind,
      level: a.level ? Number(a.level) : undefined,
      group: subgroup || group,
      forms: /** @type {string} */ (one('glyphs')).split(',').map(name => form(name.trim())),
      components: one('components'),
      jis: one('jis'),
      jisx0212: one('jisx0212'),
      hydcd: one('hydcd'),
      annexS: one('annexs'),
      unified,
      unifiedMore: unifiedMore || undefined,
      // A compatibility ideograph and the unified ideograph it is canonically equivalent to.
      compatibility: list(one('compatibles'))?.map(char => [char.normalize('NFC'), char]),
      disunified: groupsOf(one('disunified')),
      sourceSeparations: groupsOf(one('SourceCodeSeparation')),
      single: [...match[5].matchAll(/<single\s([^>]*)>([\s\S]*?)<\/single>/g)].map(single => {
        // The source ends some lists with a count in words (`About 10`, `More than 300`) in place of the characters.
        const body = unescape(single[2]).trim(), words = /\(?[A-Za-z][A-Za-z0-9 ]*\)?/
        const count = body.match(words)?.[0].replace(/[()]/g, '').trim()
        return { ...attributes(single[1]), examples: list(body.replace(words, '')) ?? [], count }
      }),
      references: one('references'),
      note: one('note'),
      review: fields.ReviewSystem,
      charts,
    }
    if (!entry.single.length) delete (/** @type {any} */ (entry)).single
    if (!Object.keys(charts).length) delete (/** @type {any} */ (entry)).charts
    entries.push(JSON.parse(JSON.stringify(entry)))
  }
}

// The outlines and the record of where each came from, as last compiled.
/** @type {Record<string, string>} */
const kept = refresh ? {} : await readFile(new URL('ucv-forms.json.gz', data)).then(bytes => JSON.parse(gunzipSync(bytes).toString('utf8')), () => ({}))
const before = refresh ? null : await readFile(new URL('ucv.json', data), 'utf8').then(text => JSON.parse(text).source?.glyphs, () => null)
/** @type {{ date: string, names: string[] }[]} */
const batches = [before?.fetched ?? []].flat()
/** @type {Record<string, string>} */
const outlines = {}
const missing = []
const names = [...new Set(entries.flatMap(entry => entry.forms.map((/** @type {{ glyph: string }} */ f) => f.glyph)))].sort()
for (const name of names) if (kept[name]) outlines[name] = kept[name]
const wanted = names.filter(name => !outlines[name])
for (let i = 0; i < wanted.length; i += 24) {
  await Promise.all(wanted.slice(i, i + 24).map(async name => {
    const svg = await read(`glyphs/${name}.svg`)
    const d = svg && outline(svg.toString('utf8'))
    if (d) outlines[name] = d
    else missing.push(name)
  }))
}
// Forms the snapshot has no drawing of come from GlyphWiki itself, one request at a time.
const fetched = []
for (const name of missing.sort()) {
  const response = await fetch(`https://glyphwiki.org/glyph/${name}.svg`, { headers: { 'user-agent': 'ucv-forms-build' } })
  if (!response.ok && response.status !== 404) throw new Error(`GlyphWiki ${name}: HTTP ${response.status}`)
  const d = response.ok ? outline(await response.text()) : ''
  if (d) { outlines[name] = d; fetched.push(name) }
  await new Promise(resolve => setTimeout(resolve, 150))
}
if (fetched.length) batches.push({ date: new Date().toISOString().slice(0, 10), names: fetched })
// A name GlyphWiki no longer draws has only the snapshot's image, a bitmap of the drawing square,
// which is traced.
/** @type {string[]} */
const traced = (before?.traced ?? []).filter((/** @type {string} */ name) => outlines[name])
for (const name of missing.filter(name => !outlines[name]).sort()) {
  const image = await read(`glyphs/${name}.png`)
  if (!image) continue
  const bitmap = inkOf(image)
  const scale = SQUARE / bitmap.width
  if (bitmap.width !== bitmap.height) throw new Error(`${name}: an image that is not square`)
  const d = trace(bitmap).map(polygon => 'M' + polygon.map(([x, y]) => `${+(x * scale).toFixed(1)} ${+(y * scale).toFixed(1)}`).join('L') + 'Z').join('')
  if (d) { outlines[name] = d; traced.push(name) }
}
traced.sort()
const absent = names.filter(name => !outlines[name])
if (absent.length) throw new Error(`no drawing of ${absent.join(' ')}`)

/**
 * An outline as a record of the drawing engine's exports, for a composer to place as a component:
 * the 200-unit square, y down, on a 1000-unit em whose top is 880. The strokes overlap and are
 * filled as one shape, so every polygon is wound the same way, and a counter the other way.
 * @param {string} key @param {[number, number][][]} polygons
 * @param {{ strokes?: boolean, heavy?: [number, number][][] }} [options] `strokes` says the polygons
 *   are all strokes, none a counter; `heavy` gives each polygon in the heavy master, point for point.
 */
function record(key, polygons, { strokes = false, heavy } = {}) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity, ink = 0
  const cut = strokes ? polygons.map(() => false) : counters(polygons)
  const p = polygons.map((polygon, at) => {
    /** @type {[number, number][]} */
    let points = polygon.map(([x, y]) => [x * 5, 880 - y * 5])
    /** @type {[number, number][]} */
    let bold = (heavy?.[at] ?? polygon).map(([x, y]) => [x * 5, 880 - y * 5])
    points.forEach(([x, y], i) => { const [nx, ny] = points[(i + 1) % points.length]; ink += Math.hypot(nx - x, ny - y) })
    if ((area(points) < 0) !== cut[at]) { points = points.reverse(); bold = bold.reverse() }
    const light = Buffer.alloc(points.length * 4), delta = Buffer.alloc(points.length * 4)
    points.forEach(([x, y], i) => {
      xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); yMin = Math.min(yMin, y); yMax = Math.max(yMax, y)
      const at = [Math.round(x * 4), Math.round(y * 4)]
      light.writeInt16LE(at[0], i * 4); light.writeInt16LE(at[1], i * 4 + 2)
      delta.writeInt16LE(Math.round(bold[i][0] * 4) - at[0], i * 4); delta.writeInt16LE(Math.round(bold[i][1] * 4) - at[1], i * 4 + 2)
    })
    return ['M' + 'L'.repeat(points.length - 1), light.toString('base64'), delta.toString('base64')]
  })
  const round = (/** @type {number} */ value) => +value.toFixed(4)
  return { k: key, G: { v: 0, b: [xMin, yMin, xMax, yMax].map(round), p }, ink: round(ink), o: p.length }
}
// The forms no text writes, each under the reference a description names it by (&GW-u58ec-t;).
/** @type {Record<string, object>} */
const records = {}
for (const entry of entries) for (const form of entry.forms) {
  if (form.text) continue
  const key = `&GW-${form.glyph};`
  if ([...key].length > 48 || !/^&[A-Za-z][A-Za-z0-9+_-]*;$/.test(key)) throw new Error(`${key}: not a reference a description can name`)
  records[key] = record(key, polygonsOf(outlines[form.glyph]))
}

// The same forms in Gothic, for a face of even strokes: each drawn from the stroke data that draws
// its recorded outline, at the stroke widths the Sans export's two masters give a character with
// as much stroke, so the composer weights it as it weights that export's parts. A form without
// such data keeps its Mincho outline.
/** @type {{ forms: Record<string, { version: number }>, glyphs: Record<string, string> } | null} */
const strokes = await readFile(new URL('ucv-strokes.json.gz', data)).then(bytes => JSON.parse(gunzipSync(bytes).toString('utf8')), () => null)
/**
 * The width of a Gothic stroke in each master, in units of the 200-unit square, for a glyph with
 * `length` units of stroke. A face thins its strokes as a character fills up: these lines are the
 * least squares of ink over stroke length for 62 characters of the Sans export (see data/README.md),
 * from 一 (17.0 and 34.6) to 鬱 (9.5 and 14.8).
 * @param {number} length
 */
const gothicWidths = length => {
  const light = Math.max(8, 19.028 - 5.6065e-3 * length)
  return { light, heavy: Math.max(light + 3, 37.629 - 1.4314e-2 * length) }
}
/** The side of the box a whole character fills, in units of the 200-unit square. */
const FULL = 170
/** A glyph name that ends in a place in a character, before any variant: `u752c-03`, `u5c3f-05-var-001`. */
const PLACED = /-(?:0[1-9]|1[0-5])(?:-(?:var|itaiji)-\d+)?$/
/** The least width of a Gothic stroke, in units of the 200-unit square. */
const GOTHIC_LEAST = 5
/** A counter is a blank of at least `least` cells at a hairline, and open while `open` of them are blank. */
const COUNTER = { least: 12, open: 6 }
const kage = new Kage()
kage.kShotai = kage.kGothic
for (const [name, glyph] of Object.entries(strokes?.glyphs ?? {})) kage.kBuhin.push(name, glyph)
/** A glyph's polygons, drawn in Gothic with strokes `width` wide. @param {string} name @param {number} width @returns {[number, number][][]} */
function strokesOf(name, width) {
  kage.kFont.kWidth = width / 2
  const polygons = new Polygons()
  kage.makeGlyph(polygons, name)
  return polygons.array.map(polygon => polygon.array.map(point => {
    if (point.off) throw new Error(`${name}: a drawing with curves`)
    return /** @type {[number, number]} */ ([+point.x.toFixed(2), +point.y.toFixed(2)])
  }))
}
/** @type {Record<string, object>} */
const even = {}
let gothic = 0
const unweighted = []
const clogged = []
if (strokes) {
  for (const [key, mincho] of Object.entries(records)) {
    const name = key.slice('&GW-'.length, -1)
    const kept = strokes.forms[name]
    if (!kept) { even[key] = mincho; continue }
    const glyph = `${name}@${kept.version}`
    const inked = (/** @type {number} */ width) => cells(strokesOf(glyph, width).filter(polygon => polygon.length > 2).map(polygon => area(polygon) < 0 ? polygon.reverse() : polygon))
    // How much stroke the form has: the ink of its strokes drawn two units wide, halved.
    const hairline = inked(2)
    // A form GlyphWiki names for a place in a character (`-03`, the top) fills part of the square:
    // it is weighed as the character it is part of, which has that much more stroke.
    let whole = 1
    if (PLACED.test(name)) {
      let left = SQUARE, top = SQUARE, right = -1, bottom = -1
      hairline.forEach((cell, at) => {
        if (!cell) return
        const row = Math.floor(at / SQUARE), col = at % SQUARE
        left = Math.min(left, col); right = Math.max(right, col); top = Math.min(top, row); bottom = Math.max(bottom, row)
      })
      whole = Math.min(3, Math.max(1, FULL * FULL / ((right - left + 1) * (bottom - top + 1))))
    }
    const widths = gothicWidths(whole * hairline.reduce((sum, cell) => sum + cell, 0) / 2)
    // The stroke data is spaced for Mincho's hairline bars: a width that fills a counter of the
    // form is narrowed, half a unit at a time, until every counter keeps some of its blank.
    const inside = enclosed(hairline, COUNTER.least)
    const fills = (/** @type {number} */ width) => filled(inked(width), inside, COUNTER.open) > 0
    const narrowed = (/** @type {number} */ width, /** @type {number} */ least) => {
      while (width - 0.5 >= least && fills(width)) width -= 0.5
      return width
    }
    widths.light = narrowed(widths.light, GOTHIC_LEAST)
    // The heavy master stays a pen wider than the light one, and near enough to it that the
    // lightest weight the engine draws (0.6 of their difference below the light) is still a stroke.
    widths.heavy = narrowed(Math.min(widths.heavy, 2.5 * widths.light), widths.light + 2)
    if (fills(widths.light) || fills(widths.heavy)) clogged.push(name)
    const thin = strokesOf(glyph, widths.light), thick = strokesOf(glyph, widths.heavy)
    // The masters are one drawing at two widths only where each polygon keeps its points.
    const paired = thin.length === thick.length && thin.every((polygon, at) => polygon.length === thick[at].length)
    if (!paired) unweighted.push(name)
    const drawn = thin.map((polygon, at) => ({ polygon, heavy: paired ? thick[at] : polygon })).filter(({ polygon }) => polygon.length > 2)
    // The engine's polygons are strokes: none is a counter, so all are wound one way.
    even[key] = record(key, drawn.map(({ polygon }) => polygon), { strokes: true, heavy: drawn.map(({ heavy }) => heavy) })
    gothic++
  }
}

const source = {
  name: 'IWDS data files (UCV and NUCV lists)',
  url: 'https://github.com/yi-bai/iwds',
  revision,
  file: 'iwds.xml',
  sha256: expected,
  document: 'IRG N2978, UCV & NUCV Lists, version 2026-10-20',
  documentUrl: 'https://www.unicode.org/irg/docs/n2978-Complete.pdf',
  glyphs: { name: 'GlyphWiki', url: 'https://glyphwiki.org/', snapshot: `glyphs/ at ${revision}`, fetched: batches, traced },
}
await writeFile(new URL('ucv.json', data), JSON.stringify({ format: 'ids-input/ucv', version: 1, source, groups, entries }, null, 1) + '\n')
await writeFile(new URL('ucv-forms.json.gz', data), gzipSync(JSON.stringify(Object.fromEntries(names.map(name => [name, outlines[name]])))))
await writeFile(new URL('ucv-outlines.json.gz', data), gzipSync(JSON.stringify({ source: 'GlyphWiki glyphs of the IRG UCV and NUCV forms; see data/README.md', records })))
if (strokes) {
  await writeFile(new URL('ucv-outlines-sans.json.gz', data), gzipSync(JSON.stringify({ source: 'GlyphWiki glyphs of the IRG UCV and NUCV forms, drawn in Gothic from their stroke data; see data/README.md', records: even })))
  console.log(`${gothic} forms drawn in Gothic, ${unweighted.length} of them at one width, ${Object.keys(even).length - gothic} kept in Mincho`)
  if (unweighted.length) console.log(unweighted.join(' '))
  if (clogged.length) console.log(`${clogged.length} with a counter filled at the least width of a master: ${clogged.join(' ')}`)
}
console.log(`${entries.filter(entry => entry.kind === 'unifiable').length} unifiable, ${entries.filter(entry => entry.kind !== 'unifiable').length} not unifiable; ${names.length} forms, ${wanted.length} asked for, ${fetched.length} fetched from GlyphWiki, ${traced.length} traced from an image; ${Object.keys(records).length} records`)
