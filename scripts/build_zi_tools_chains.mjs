// Compile the zi.tools descriptions that name a character but hold a stroke chain this package
// cannot draw: pasting one resolves to the character it describes.
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { isDescription } from '../src/core/ids.js'

const revision = 'da1e9f8a09e2ec8faaf176bac99203f978282041'
const expected = '51f78d7d84f52fd73e5bc155c2239b737c58ce627d446894a809f1a36547ae18'
const response = await fetch(`https://raw.githubusercontent.com/yi-bai/ids/${revision}/ids_lv1.txt`)
if (!response.ok) throw new Error(`Yi Bai IDS: HTTP ${response.status}`)
const bytes = Buffer.from(await response.arrayBuffer())
if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Yi Bai IDS: unexpected source hash')

/** A description's glyph-variant definition, the note after it. */
const DEFINITION = /\([0-9A-Za-z.,]+\)\s*$/u

/** @type {Map<string, string>} */
const entries = new Map()
for (const row of bytes.toString('utf8').split('\n')) {
  const [char, ...columns] = row.split('\t')
  if (!char || !columns.length) continue
  for (const column of columns) for (const part of column.split(';')) {
    const text = part.trim()
    if (!text.includes('#(') || isDescription(text)) continue
    if (!entries.has(text)) entries.set(text, char)
    // The same description without its trailing variant note. A pure chain like `#(S)` is not a
    // description followed by a note, so only a shortened form that still holds a chain is kept.
    const plain = text.replace(DEFINITION, '').trim()
    if (plain !== text && plain.includes('#(') && !entries.has(plain)) entries.set(plain, char)
  }
}
const lines = [`# zi.tools descriptions carrying a stroke chain, ${revision}; MIT.`]
for (const [text, char] of entries) lines.push(`${text}\t${char}`)
await writeFile(new URL('../data/zi-tools-chains.tsv.gz', import.meta.url), gzipSync(lines.join('\n') + '\n'))
console.log(`Compiled ${entries.size} descriptions`)
