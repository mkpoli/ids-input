// How much of Yi Bai's published level-1 IDS table this parser reads, by notation.
//
//   bun scripts/audit_zi_ids.mjs          a table by notation
//   bun scripts/audit_zi_ids.mjs --json   the same numbers as JSON
//
// The table is fetched from the revision `build_yi_bai_ids.mjs` compiles and checked against its
// hash, so the numbers are comparable between runs. A row is readable when `parse` answers a tree
// for it; a row may carry several notations, counted once under each.
import { createHash } from 'node:crypto'
import { parse } from '../src/core/ids.js'
import { notation, sequences } from './lib/ids-notation.mjs'

const revision = 'da1e9f8a09e2ec8faaf176bac99203f978282041'
const expected = '51f78d7d84f52fd73e5bc155c2239b737c58ce627d446894a809f1a36547ae18'
const response = await fetch(`https://raw.githubusercontent.com/yi-bai/ids/${revision}/ids_lv1.txt`)
if (!response.ok) throw new Error(`Yi Bai IDS: HTTP ${response.status}`)
const bytes = Buffer.from(await response.arrayBuffer())
if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Yi Bai IDS: unexpected source hash')

const all = sequences(bytes.toString('utf8'))
/** @type {Map<string, { total: number, read: number, unread: string[] }>} */
const byNotation = new Map()
let read = 0
for (const text of all) {
  const key = notation(text)
  const entry = byNotation.get(key) ?? { total: 0, read: 0, unread: [] }
  entry.total++
  if (parse(text).problem) { if (entry.unread.length < 5) entry.unread.push(text) }
  else { entry.read++; read++ }
  byNotation.set(key, entry)
}

const order = ['plain', 'note', 'modifier', 'chain', 'note+modifier', 'note+chain', 'modifier+chain', 'note+modifier+chain']
const rows = order.filter(key => byNotation.has(key)).map(key => ({ notation: key, ...byNotation.get(key) }))
const summary = { revision, total: all.length, read, unread: all.length - read, byNotation: rows }

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(`Yi Bai IDS level 1, ${revision}`)
  console.log(`read ${read} of ${all.length} sequences, ${all.length - read} unread`)
  for (const row of rows) {
    console.log(`  ${row.notation.padEnd(22)} ${String(row.read).padStart(7)} / ${String(row.total).padStart(7)}${row.read < row.total && row.unread.length ? `   e.g. ${row.unread[0]}` : ''}`)
  }
}
