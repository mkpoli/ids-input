// Compile the IDS descriptions in Yi Bai's level-1 data that this package reads and can rewrite
// without losing meaning: plain descriptions and those with an operator modifier. Variant notes
// and stroke chains are left out until they can be represented.
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { isDescription } from '../src/core/ids.js'
import { tokens } from '../src/core/decompose.js'

// A zi.tools modifier after an operator, which this package reads and writes back.
const MODIFIER = /[⿴⿵⿶⿷⿼⿻㇯]\[[0-9:,._xabcdlr|-]+\]/gu
// Notation this table leaves out: variant notes and stroke chains (their brackets and hashes), and
// ASCII letters and digits, which also write variant identifiers inside a description.
const UNREAD = /[A-Za-z0-9.#(){}]/u

/** Whether `text` is kept: a description whose only notation beyond operators is an operator
 * modifier. @param {string} text */
const kept = text => !UNREAD.test(text.replace(MODIFIER, ''))

const revision = 'da1e9f8a09e2ec8faaf176bac99203f978282041'
const expected = '51f78d7d84f52fd73e5bc155c2239b737c58ce627d446894a809f1a36547ae18'
const response = await fetch(`https://raw.githubusercontent.com/yi-bai/ids/${revision}/ids_lv1.txt`)
if (!response.ok) throw new Error(`Yi Bai IDS: HTTP ${response.status}`)
const bytes = Buffer.from(await response.arrayBuffer())
if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Yi Bai IDS: unexpected source hash')
const lines = [`# Yi Bai IDS level 1, ${revision}; MIT; standard IDS, operator modifiers included.`]
for (const row of bytes.toString('utf8').split('\n')) {
  const [char, ...columns] = row.split('\t')
  if (!columns.length || tokens(char).length !== 1) continue
  const descriptions = [...new Set(columns.flatMap(column => column.split(';'))
    .filter(text => kept(text) && isDescription(text)))]
  if (descriptions.length) lines.push(`${char}\t${descriptions.join(' ')}`)
}
await writeFile(new URL('../data/yi-bai-ids.tsv.gz', import.meta.url), gzipSync(lines.join('\n') + '\n'))
console.log(`Compiled ${lines.length - 1} entries`)
