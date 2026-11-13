// Build `data/stroke-orders.json.gz`: the stroke order of each Han part of the palette, as the
// letters of Rime's five-stroke dictionary (h 横, s 豎, p 撇, n 點, z 折), so the palette can find a
// part by the strokes it is written with.
//
// A character the dictionary writes more than one way keeps every way, in the dictionary's order.
// A part of one stroke is that stroke: its order is the class `data/ids-parts.json` already gives
// it, which is how a CJK stroke symbol and the ideograph Unicode calls its equivalent (㇕ and 𠃍)
// read alike. A part the dictionary does not name, such as a compound part or a radical form, has
// no order here.
//
// The dictionary is LGPL-3.0 (data/licences/), and its Chinese stroke order can differ from
// Japanese order.
//
//   node scripts/build_stroke_orders.mjs [stroke.dict.yaml]   # a local copy skips the download
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

// The revision `scripts/build_ids_parts.py` pins, so a part's first stroke reads the same in both.
const RIME = {
  revision: '1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48',
  url: 'https://raw.githubusercontent.com/rime/rime-stroke/1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48/stroke.dict.yaml',
  sha256: 'b3e93dce89c185f45c3d6e189b86b3a8626913352cc85e1094c786579a665791',
}
const LETTER_OF = { 横: 'h', 豎: 's', 撇: 'p', 點: 'n', 折: 'z' }

const path = process.argv[2]
const rime = path ? readFileSync(path) : Buffer.from(await (await fetch(RIME.url)).arrayBuffer())
if (createHash('sha256').update(rime).digest('hex') !== RIME.sha256) throw Error(`Unexpected rime-stroke: ${RIME.url}`)
/** @type {Map<string, string[]>} */
const codes = new Map()
for (const line of rime.toString().split('\n')) {
  const [char, code] = line.split('\t')
  if (!char || !code || [...char].length !== 1 || !/^[hspnz]+$/.test(code)) continue
  const known = codes.get(char)
  if (!known) codes.set(char, [code])
  else if (!known.includes(code)) known.push(code)
}

const palette = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url), 'utf8'))
const at = name => palette.columns.indexOf(name)
const PART = at('part'), STROKES = at('strokes'), FIRST = at('first'), KIND = at('kind')
const keys = [], orders = []
for (const row of palette.parts) {
  if (!['c', 'd', 's'].includes(row[KIND])) continue
  const single = row[STROKES] === 1 && LETTER_OF[row[FIRST]]
  const order = single ? [single] : codes.get(row[PART])
  if (!order) continue
  keys.push(row[PART])
  orders.push(order.join(' '))
}

const json = JSON.stringify({
  source: `Rime five-stroke dictionary, revision ${RIME.revision}, LGPL-3.0, https://github.com/rime/rime-stroke`,
  letters: { h: '横', s: '豎', p: '撇', n: '點', z: '折' },
  keys, orders,
})
writeFileSync(new URL('../data/stroke-orders.json.gz', import.meta.url), gzipSync(json, { level: 9, mtime: 0 }))
console.log(`${keys.length} parts with a stroke order, ${orders.filter(order => order.includes(' ')).length} written more than one way`)
