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

const dir = process.argv[2]
/** @type {string[]} */ const keys = []
/** @type {number[]} */ const strokes = []
for (const [from, to] of RANGES) {
  for (let point = from; point <= to; point++) {
    const char = String.fromCodePoint(point)
    const name = point.toString(16).padStart(5, '0')
    let svg = ''
    try {
      svg = dir ? readFileSync(`${dir}/${name}.svg`, 'utf8')
        : await (await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/${REVISION}/kanji/${name}.svg`)).text()
    } catch { continue }
    if (!svg.includes(`kvg:${name}-s1`)) continue
    const paths = [...svg.matchAll(new RegExp(`<path id="kvg:${name}-s(\\d+)" d="([^"]*)"`, 'g'))]
    if (!paths.length) continue
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
