// Build `data/han-parts.json.gz`: every Han-script character the composer can draw, with the stroke
// count Unihan records for each, or the count of the unified form a radical stands for, and the class
// of its first stroke. The export's records are sharded by hash, so those keys come from
// their stored entries; the bundled fallback outlines and the palette outlines add the characters the
// export lacks. Unicode alone would claim glyphs no source draws.
//
// The first stroke is the one Rime's five-stroke dictionary records, written as the class a reader
// knows it by (横, 豎, 撇, 點, 折); the dictionary is LGPL-3.0, and its Chinese stroke order can
// differ from Japanese order. A character the dictionary lacks has no first stroke recorded.
//
//   node scripts/build_han_parts.mjs [Unihan.zip] [stroke.dict.yaml]   # local copies skip the download
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync, inflateRawSync } from 'node:zlib'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
import { characterScript } from '../src/core/scripts.js'

const UNIHAN = {
  url: 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip',
  sha256: '4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e',
}
// The revision `scripts/build_ids_parts.py` pins, so a part's first stroke reads the same in both.
const RIME = {
  url: 'https://raw.githubusercontent.com/rime/rime-stroke/1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48/stroke.dict.yaml',
  sha256: 'b3e93dce89c185f45c3d6e189b86b3a8626913352cc85e1094c786579a665791',
}

/** One entry of a zip archive, inflated when stored deflated. */
function unzipEntry(archive, name) {
  const eocd = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw Error('Not a zip archive')
  const count = archive.readUInt16LE(eocd + 10), start = archive.readUInt32LE(eocd + 16)
  let at = start
  for (let index = 0; index < count; index++) {
    const method = archive.readUInt16LE(at + 10), size = archive.readUInt32LE(at + 20)
    const nameLength = archive.readUInt16LE(at + 28), extraLength = archive.readUInt16LE(at + 30), commentLength = archive.readUInt16LE(at + 32)
    const offset = archive.readUInt32LE(at + 42)
    if (archive.subarray(at + 46, at + 46 + nameLength).toString() === name) {
      const localName = archive.readUInt16LE(offset + 26), localExtra = archive.readUInt16LE(offset + 28)
      const data = archive.subarray(offset + 30 + localName + localExtra, offset + 30 + localName + localExtra + size)
      return method === 0 ? data : inflateRawSync(data)
    }
    at += 46 + nameLength + extraLength + commentLength
  }
  throw Error(`No ${name} in the archive`)
}

const root = COMPOSER_BASE, manifest = await (await fetch(root + 'manifest.json')).json()
if (manifest.format !== 5 || manifest.files.records.files !== 4096) throw Error('Unexpected composer export')
const keys = new Set(), errors = []; let next = 0, done = 0
async function worker() {
  while (next < 4096) {
    const shard = (next++).toString(16).padStart(3, '0')
    let rows
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${root}g/${shard}.json`)
        if (!response.ok) throw Error(`${response.status}`)
        rows = JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())))
        break
      } catch (error) { if (attempt === 2) errors.push(`${shard}: ${error}`) }
    }
    for (const record of Object.values(rows ?? {})) {
      const key = record.k
      if (typeof key !== 'string' || !record.G && !record.s && !record.e) continue
      if ([...key].length === 1 && characterScript(key) === 'han') keys.add(key)
    }
    if (++done % 512 === 0) console.log(`${done}/4096 shards`)
  }
}
await Promise.all(Array.from({ length: 10 }, worker))
if (errors.length) throw Error(errors.join('\n'))

const archive = process.argv[2] ? readFileSync(process.argv[2]) : Buffer.from(await (await fetch(UNIHAN.url)).arrayBuffer())
if (createHash('sha256').update(archive).digest('hex') !== UNIHAN.sha256) throw Error(`Unexpected Unihan: ${UNIHAN.url}`)
const total = new Map()
for (const line of unzipEntry(archive, 'Unihan_IRGSources.txt').toString().split('\n')) {
  if (!line.startsWith('U+')) continue
  const [point, field, value] = line.split('\t')
  if (field === 'kTotalStrokes' && value) total.set(String.fromCodePoint(parseInt(point.slice(2), 16)), Number(value.split(' ')[0]))
}

// The bundled fallback outlines, then the palette's own fallback outlines, cover characters the
// export does not record; both are sources the composer draws from.
const coverage = JSON.parse(readFileSync(new URL('../data/unicode-coverage.json', import.meta.url)))
for (const [first, last] of coverage) {
  for (let point = first; point <= last; point++) {
    const char = String.fromCodePoint(point)
    if (characterScript(char) === 'han') keys.add(char)
  }
}
const palette = JSON.parse(gunzipSync(readFileSync(new URL('../data/palette-outlines.json.gz', import.meta.url)))).records
for (const char of Object.keys(palette)) {
  if ([...char].length === 1 && characterScript(char) === 'han') keys.add(char)
}

const list = [...keys].sort((a, b) => Number(a.codePointAt(0)) - Number(b.codePointAt(0)))
// A radical form Unihan does not list takes the count of the unified character the component forms
// name; anything without an equivalent stays uncounted.
const forms = new Map()
for (const line of readFileSync(new URL('../data/component-forms.tsv', import.meta.url), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [form, char] = line.split('\t')
  if (form && char && [...form].length === 1) forms.set(form, char)
}
// Stroke counts for the marks and numerals Unihan does not cover, supplied by the project: ⺀ two,
// 々 three, 〇 and 〡 one, and so on, read from the shapes.
const MARK_COUNTS = new Map([
  ['⺀', 2], ['々', 3], ['〇', 1], ['〡', 1], ['〢', 2], ['〣', 3], ['〤', 2], ['〥', 1],
  ['〦', 2], ['〧', 3], ['〨', 4], ['〩', 3], ['〸', 2], ['〹', 3], ['〺', 4], ['〻', 2],
  ['𖿢', 1], ['𖿣', 2], ['𖿰', 3], ['𖿱', 1], ['𖿲', 2], ['𖿳', 7], ['𖿴', 3], ['𖿵', 4], ['𖿶', 2],
])
const strokes = list.map(key => total.get(key) ?? total.get(forms.get(key)) ?? MARK_COUNTS.get(key) ?? null)

// Rime's dictionary writes each stroke of a character as one letter: h 横, s 豎, p 撇, n or d 點,
// z 折. A character's first stroke is the first letter of its first complete code, except that codes
// starting with s and with z and nothing else both count as 豎 (a vertical hook), as
// `build_ids_parts.py` reads them.
const CLASS_OF = { h: '横', s: '豎', p: '撇', n: '點', d: '點', z: '折' }
const rimePath = process.argv[3]
const rime = rimePath ? readFileSync(rimePath) : Buffer.from(await (await fetch(RIME.url)).arrayBuffer())
if (createHash('sha256').update(rime).digest('hex') !== RIME.sha256) throw Error(`Unexpected rime-stroke: ${RIME.url}`)
/** @type {Map<string, string[]>} */
const rimeCodes = new Map()
for (const line of rime.toString().split('\n')) {
  const [char, code] = line.split('\t')
  if (!char || !code || [...char].length !== 1 || !/^[hspnz]+$/.test(code)) continue
  const codes = rimeCodes.get(char)
  if (codes) codes.push(code); else rimeCodes.set(char, [code])
}
/** @param {string} char */
function firstStroke(char) {
  const codes = rimeCodes.get(char)
  if (!codes) return null
  const starts = new Set(codes.map(code => code[0]))
  // A vertical stroke and a vertical hook as the only starts are one class, 豎; otherwise the first
  // complete code decides. Read as `first_strokes` in `build_ids_parts.py` reads it.
  return CLASS_OF[starts.size === 2 && starts.has('s') && starts.has('z') ? 's' : codes[0][0]]
}

// The class of each CJK stroke character, from the letters of its Unicode name (CJK STROKE <letters>)
// as `build_ids_parts.py` reads them: a horizontal stroke and a rising one are 横, a vertical one and
// its hook 豎, the two falls 撇, the dot and the rightward dot 點, a turning stroke 折.
const STROKE_CLASS_OF = new Map([
  ['㇀', '横'], ['㇁', '折'], ['㇂', '折'], ['㇃', '折'], ['㇄', '折'], ['㇅', '折'], ['㇆', '折'], ['㇇', '折'], ['㇈', '折'], ['㇉', '折'], ['㇊', '折'], ['㇋', '折'], ['㇌', '折'], ['㇍', '折'], ['㇎', '折'], ['㇏', '點'], ['㇐', '横'], ['㇑', '豎'], ['㇒', '撇'], ['㇓', '撇'], ['㇔', '點'], ['㇕', '折'], ['㇖', '折'], ['㇗', '折'], ['㇘', '折'], ['㇙', '折'], ['㇚', '豎'], ['㇛', '折'], ['㇜', '折'], ['㇝', '點'], ['㇞', '折'], ['㇟', '折'], ['㇠', '折'], ['㇡', '折'], ['㇢', '折'], ['㇤', '折'], ['㇥', '折'],
])
// A CJK stroke character and the character it is an equivalent of (㇕ and 𠃍, ㇏ and 乀) are one
// stroke, so that character takes the stroke's class. Rows are read in order and the last wins, as
// `first_strokes` in `build_ids_parts.py` reads them.
const EQUIVALENT = new Map()
for (const line of readFileSync(new URL('../data/component-forms.tsv', import.meta.url), 'utf8').split('\n')) {
  const [form, char, source, detail] = line.split('\t')
  if (!form || !char || source !== 'unicode-ucd' || detail !== 'EquivalentUnifiedIdeograph') continue
  const cls = STROKE_CLASS_OF.get(form)
  if (cls) EQUIVALENT.set(char, cls)
}
// The four-stroke grass radical begins with a horizontal; CJK RADICAL SECOND ONE (⺂) is a single
// horizontal-fold stroke, which the five classes call 折.
const OVERRIDES = new Map([['⻀', '横'], ['⺂', '折']])
const firsts = list.map(char => EQUIVALENT.get(char) ?? OVERRIDES.get(char) ?? firstStroke(char))

const json = JSON.stringify({ base: root, commit: manifest.composer.commit, keys: list, strokes, firsts })
writeFileSync(new URL('../data/han-parts.json.gz', import.meta.url), gzipSync(json, { level: 9, mtime: 0 }))
console.log(`${list.length} Han characters, ${strokes.filter(count => count !== null).length} with stroke counts, ${firsts.filter(cls => cls !== null).length} with first strokes`)
