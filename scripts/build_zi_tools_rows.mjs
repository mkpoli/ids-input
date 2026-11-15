// Pin Yi Bai's three IDS levels for the zi.tools IDS Extension parser: every level-0 row, and the
// level-1 and level-2 rows where they differ from the level before. The three source files can be
// rebuilt from the result byte for byte (tests/baishi-parser.test.js does so).
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const revision = '2597437b928e8d530b7ae09cf53fe5ec7868569c'
const expected = {
  0: 'af5a0de3aae85ee1a69001918a78d4060d9a334c508ad2c6ac5854786791d474',
  1: 'aa9ba7e394d8fd5cf797b6b9bd6ae5b4546f5222d10f15158c656f099b35c0cf',
  2: 'b728e92679a9cb18a8f67f55f654f03875791dc34f6bab41ed1d4b4116bea7d6',
}

/** @param {0 | 1 | 2} level */
async function level(level) {
  const response = await fetch(`https://raw.githubusercontent.com/yi-bai/ids/${revision}/ids_lv${level}.txt`)
  if (!response.ok) throw new Error(`ids_lv${level}.txt: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (createHash('sha256').update(bytes).digest('hex') !== expected[level]) throw new Error(`ids_lv${level}.txt: unexpected hash`)
  return bytes.toString('utf8').split('\n')
}

const [lv0, lv1, lv2] = await Promise.all([level(0), level(1), level(2)])
if (lv0.length !== lv1.length || lv1.length !== lv2.length) throw new Error('the levels differ in length')
const head = (/** @type {string} */ line) => line.split('\t')[0]
const lines = [`# yi-bai/ids ${revision}; MIT, Copyright (c) 2021 Yi Bai; ids_lv0.txt ${expected[0]}, ids_lv1.txt ${expected[1]}, ids_lv2.txt ${expected[2]}.`]
let changed1 = 0, changed2 = 0
for (let i = 0; i < lv0.length; i++) {
  if (head(lv0[i]) !== head(lv1[i]) || head(lv1[i]) !== head(lv2[i])) throw new Error(`line ${i + 1}: the levels name different characters`)
  lines.push(`0\t${lv0[i]}`)
  if (lv1[i] !== lv0[i]) { lines.push(`1\t${lv1[i]}`); changed1++ }
  if (lv2[i] !== lv1[i]) { lines.push(`2\t${lv2[i]}`); changed2++ }
}
await writeFile(new URL('../data/zi-tools-rows.tsv.gz', import.meta.url), gzipSync(lines.join('\n'), { level: 9 }))
console.log(`Pinned ${lv0.length} lines; level 1 differs on ${changed1}, level 2 on ${changed2}`)
