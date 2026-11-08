// Build `data/kana-strokes.json.gz`: the stroke count and first stroke of every kana KanjiVG draws.
//
// KanjiVG draws one path per stroke, numbered `kvg:<code point>-s1`, `-s2` and so on, so the number
// of paths is the stroke count and their order is the writing order. It records no five-stroke
// class, and reading one off a path's shape does not work: kana strokes are curved, so a turn and a
// curve carry the same turning angle and the class came out wrong for ア, コ and ヨ. The table holds
// counts alone until a source that names stroke types arrives.
//
//   node scripts/build_kana_strokes.mjs [kvg directory]   # a checked-out KanjiVG skips the download
//
// KanjiVG (c) Ulrich Apel, CC BY-SA 3.0, <https://kanjivg.tagaini.net>.
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const REVISION = '610091ce618cf757ed1357a8954cd65283e015d6'
const SOURCE = `KanjiVG ${REVISION}, CC BY-SA 3.0, https://github.com/KanjiVG/kanjivg`
const TARGET = new URL('../data/kana-strokes.json.gz', import.meta.url)
// Hiragana U+3041–U+3096 and katakana U+30A1–U+30FA, the kana a reader meets.
const RANGES = [[0x3041, 0x3096], [0x30a1, 0x30fa]]

/**
 * KanjiVG's SVG for one kana, or null where the file does not exist. A failed request is retried,
 * and a failure that survives the retries throws: a kana dropped by a lost connection would ship as
 * a silent gap (マ was lost that way once).
 * @param {string | undefined} dir @param {string} name @returns {Promise<string | null>}
 */
async function readKana(dir, name) {
  if (dir) {
    try { return readFileSync(`${dir}/${name}.svg`, 'utf8') } catch { return null }
  }
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/${REVISION}/kanji/${name}.svg`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url)
      if (response.status === 404) return null
      if (!response.ok) throw Error(`${response.status}`)
      return await response.text()
    } catch (error) {
      if (attempt === 3) throw error
      await new Promise(resolve => setTimeout(resolve, 400 * attempt))
    }
  }
  return null
}

const dir = process.argv[2]
/** @type {string[]} */ const keys = []
/** @type {number[]} */ const strokes = []
/** @type {string[]} */ const absent = []
for (const [from, to] of RANGES) {
  for (let point = from; point <= to; point++) {
    const char = String.fromCodePoint(point)
    const name = point.toString(16).padStart(5, '0')
    const svg = await readKana(dir, name)
    if (svg === null) { absent.push(char); continue }
    // A path may carry attributes besides id and d (マ's `kvg:type="㇇"` sits between them), so the
    // tag is matched whole and `d` read from it rather than required next to the id.
    const paths = [...svg.matchAll(new RegExp(`<path id="kvg:${name}-s(\\d+)"([^>]*)>`, 'g'))]
      .map(match => [match[1], /\bd="([^"]*)"/.exec(match[2])?.[1] ?? ''])
      .filter(([, d]) => d)
    if (!paths.length) { absent.push(char); continue }
    paths.sort((a, b) => Number(a[1]) - Number(b[1]))
    keys.push(char)
    strokes.push(paths.length)
  }
}

if (!keys.length) throw Error('no kana drawn: check the source directory or the network')
const text = JSON.stringify({ revision: REVISION, source: SOURCE, keys, strokes })
const gz = gzipSync(text, { level: 9, mtime: 0 })
writeFileSync(TARGET, gz)
console.log(`${keys.length} kana, ${gz.length} bytes`)
if (absent.length) console.log(`not drawn by KanjiVG: ${absent.join('')}`)
