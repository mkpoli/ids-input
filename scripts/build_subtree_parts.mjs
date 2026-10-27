// Count the exact trees in the bundled corpus; no recursive expansion or glyph normalization.
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync, gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { arity, isSelector, parse } from '../src/core/ids.js'
import { parseIdsTable } from '../src/adapter/babelstone.js'

export function subtrees(text) {
  const tokens = text.match(/\{\d+\}|./gu) ?? []
  let at = 0
  const nodes = []
  function read() {
    const start = at, token = tokens[at++]
    if (!token) throw new Error(`Incomplete IDS: ${text}`)
    const children = Array.from({ length: arity(token) }, read)
    if (!children.length && isSelector(tokens[at])) at++
    const node = { text: tokens.slice(start, at).join(''), op: children.length ? token : null, children }
    nodes.push(node)
    return node
  }
  read()
  if (at !== tokens.length) throw new Error(`Trailing IDS: ${text}`)
  return nodes
}

export function frequencies(table, rejected = []) {
  const entries = new Map()
  for (const [char, sequences] of table) {
    const seen = new Set(), nested = new Set()
    // Identical regional alternatives count once for occurrences too.
    for (const text of new Set(sequences.map(sequence => sequence.text))) {
      let nodes
      try { nodes = subtrees(text) } catch { rejected.push({ char, text }); continue }
      for (const [index, node] of nodes.entries()) {
        const entry = entries.get(node.text) ?? { ...node, uses: 0, occurrences: 0, nestedUses: 0 }
        entry.occurrences++
        entries.set(node.text, entry)
        seen.add(node.text)
        if (index < nodes.length - 1) nested.add(node.text)
      }
    }
    for (const text of seen) entries.get(text).uses++
    for (const text of nested) entries.get(text).nestedUses++
  }
  return [...entries.values()].sort((a, b) => b.uses - a.uses || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))
}

export function strokeCounter(table, rows) {
  const known = new Map(rows.filter(row => row[2] != null && !arity([...row[0]][0])).map(row => [row[0], row[2]]))
  // The JP dotted 者 is nine strokes; a regional nine-stroke base plus 丶 double-counts its dot.
  known.set('⿻者丶', 9)
  // Reviewed subtractions: native host stroke count minus the removed component.
  for (const [text, strokes] of Object.entries({ '㇯鹿比': 7, '㇯馬灬': 6, '㇯鳥灬': 7 })) known.set(text, strokes)
  function count(node, seen = new Set()) {
    if (known.has(node.text)) return known.get(node.text)
    // Subtraction needs stroke geometry. Other operators use an additive estimate.
    if (node.op === '㇯') return null
    if (node.op) {
      const counts = node.children.map(child => count(child, seen))
      return counts.every(value => value != null) ? counts.reduce((a, b) => a + b, 0) : null
    }
    if (seen.has(node.text)) return null
    const next = new Set([...seen, node.text])
    for (const sequence of table.get(node.text) ?? []) {
      let root
      try { root = subtrees(sequence.text).at(-1) } catch { continue }
      if (!root.op) continue
      const result = count(root, next)
      if (result != null) return result
    }
    return null
  }
  return count
}

// Requested literal IDS remain selectable even below the frequency cutoff.
export const MANUAL_PARTS = ['⿰冫⿱丿丶', '⿳亠㐅厂', '⿳亠丷厂', '⿻𢆶戈', '⿸尸彳', '㇯鹿比', '㇯馬灬', '㇯鳥灬', '⿳亠口冖', '⿸尸氺', '⿳𰀉冖木', '⿳卝罒冖', '⿱丿乚']
// IDS.TXT's component table: {11}, bottom of 軣, ⿰⿱丶㇀⿱㇒丶.
// Exact root descriptions in the bundled corpus. Preserve regional spellings as aliases.
export const ENCODED_PARTS = {
  '⿱宀儿': '宂', '⿻三丨': '丰', '⿻㇒𰀁': '丰',
  '⿱艹罒': '𦭝', '⿱卝罒': '𦭝', '⿺友丶': '犮', '⿰𫠤攵': '敖',
  '⿱卝隻': '蒦', '⿸辰寸': '辱', '⿹勹巳': '包',
  '⿱⿱㇒⿻日丿十': '卑', '⿻九丶': '丸',
}
export const SOURCE_ALIASES = {
  '⿰冫⿱丿丶': ['{11}'], '⿳亠㐅厂': ['⿱文厂'], '⿳亠丷厂': ['产'],
  '⿻𢆶戈': ['{29}'],
  '㇯鹿比': ['{55}', '⿸广⿻[:-1]〢コ'],
  '㇯馬灬': ['{51}', '⿷#(-一丨b𠃌)𰀁'],
  '㇯鳥灬': ['{47}', '⿱丿⿷⿴#(一-𠃍丨b𠃌)一一'],
  '⿳亠口冖': ['{87}'], '⿳𰀉冖木': ['⿱{38}木'], '⿱丿乚': ['⿱㇒乚'],
}

export function manualUses(table, text, aliases = SOURCE_ALIASES[text] ?? []) {
  const spellings = new Set([text, ...aliases])
  let uses = 0
  for (const sequences of table.values()) {
    if (sequences.some(({ text }) => {
      try { return subtrees(text).some(node => spellings.has(node.text)) } catch { return false }
    })) uses++
  }
  return uses
}

export function build(root = new URL('../', import.meta.url)) {
  const data = name => new URL(`data/${name}`, root)
  const table = parseIdsTable(gunzipSync(readFileSync(data('babelstone-ids.tsv.gz'))).toString())
  const palette = JSON.parse(readFileSync(data('ids-parts.json'), 'utf8'))
  // Remove previously generated compounds so running the builder again is deterministic.
  const rows = palette.parts.filter(row => !arity([...row[0]][0]))
  const count = strokeCounter(table, rows)
  const rejected = []
  const entries = frequencies(table, rejected)
  const usage = new Map(entries.map(entry => [entry.text, entry.uses]))
  for (const row of rows) row[1] = usage.get(row[0]) ?? 0
  const threshold = 30
  const selected = entries.filter(entry => entry.op && entry.nestedUses >= threshold && !parse(entry.text).problem).map(entry => ({ ...entry }))
  for (const text of MANUAL_PARTS) {
    const existing = selected.find(entry => entry.text === text)
    const uses = manualUses(table, text)
    if (existing) existing.uses = uses
    else selected.push({ ...subtrees(text).at(-1), uses })
  }
  for (const entry of selected) {
    const encoded = ENCODED_PARTS[entry.text]
    if (!encoded) { rows.push([entry.text, entry.uses, count(entry), 1, null, 'c']); continue }
    let row = rows.find(row => row[0] === encoded)
    if (!row) {
      const first = subtrees(entry.text).filter(node => !node.op)
        .map(node => rows.find(row => row[0] === node.text)?.[4]).find(Boolean) ?? null
      row = [encoded, 0, count(entry), 1, first, 'c']; rows.push(row)
    }
  }
  // Several regional IDS can normalize to the same character. Count their union once,
  // instead of letting the last alias overwrite an earlier alias's usage count.
  for (const encoded of new Set(selected.map(entry => ENCODED_PARTS[entry.text]).filter(Boolean))) {
    const aliases = selected.filter(entry => ENCODED_PARTS[entry.text] === encoded).map(entry => entry.text)
    rows.find(row => row[0] === encoded)[1] = manualUses(table, encoded, aliases)
  }
  rows.sort((a, b) => (a[5] === 't') - (b[5] === 't') || (a[5] === 't' ? a[0].codePointAt(0) - b[0].codePointAt(0) : b[1] - a[1] || a[0].codePointAt(0) - b[0].codePointAt(0) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)))
  palette.parts = rows
  palette.subtrees = { threshold, manual: MANUAL_PARTS, sourceAliases: SOURCE_ALIASES, encoded: ENCODED_PARTS, measure: 'distinct characters containing the exact proper subtree', builder: 'scripts/build_subtree_parts.mjs' }
  writeFileSync(data('ids-parts.json'), JSON.stringify(palette) + '\n')
  const report = {
    columns: ['part', 'uses', 'occurrences', 'nestedUses', 'strokes'],
    characters: table.size,
    rejected,
    parts: entries.map(entry => [entry.text, entry.uses, entry.occurrences, entry.nestedUses, count(entry)]),
  }
  writeFileSync(data('ids-subtrees.json.gz'), gzipSync(JSON.stringify(report) + '\n', { level: 9 }))
  console.log(JSON.stringify({ characters: table.size, subtrees: entries.length, added: selected.length,
    unknownStrokes: selected.filter(entry => count(entry) == null).length,
    example: report.parts.find(row => row[0] === '⿰冫⿱丿丶'), top: selected.slice(0, 10).map(entry => [entry.text, entry.uses, count(entry)]) }, null, 2))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build()
