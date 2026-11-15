// Build data/component-atlas.json.gz: every component the merged corpus uses, how many
// descriptions name it, and which characters those are. The atlas page at
// https://ids.mkpo.li/component-atlas reads it.
//
//   bun scripts/build_component_atlas.mjs [--limit N]
//
// It reads data/ids-corpus.json.gz and counts only what the corpus describes; a component named
// through a CHISE entity that is still unresolved is not counted, so each count is a floor.
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'

const args = process.argv.slice(2)
const option = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1] }
const OUT = new URL('../data/component-atlas.json.gz', import.meta.url)
const LIMIT = Number(option('--limit', '4000'))
/** How many of the characters a component appears in each row keeps. */
const CAP = 60

const corpus = JSON.parse(gunzipSync(await readFile(new URL('../data/ids-corpus.json.gz', import.meta.url))).toString('utf8'))
const columns = object => Object.fromEntries(object.columns.map((name, at) => [name, at]))
const D = columns(corpus.descriptions), C = columns(corpus.components), A = columns(corpus.aliases)

const OPERATORS = new Set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿〾㇯')
const MARK = /^[\u0300-\u036F\u3099\u309A\u309B\u309C\u302E\u302F]$/u

/** The component cids a description uses, from its resolved text where it has one. */
function leaves(value) {
  const found = new Set()
  for (const [, cid] of value.matchAll(/&([^;]+);/g)) found.add(cid)
  // BabelStone writes a numbered component as `{94}` and zi.tools as `#(1-2-3)`; the digits are
  // catalogue positions, not characters, and must not become components.
  const text = value.replace(/\{[^}]*\}/g, '').replace(/#\([^)]*\)/g, '').replace(/&[^;]+;/g, '')
  for (const char of text) {
    if (OPERATORS.has(char) || MARK.test(char)) continue
    if (char.codePointAt(0) <= 0x7f) continue
    found.add(`ucs:${char.codePointAt(0).toString(16).toUpperCase()}`)
  }
  return found
}

const uses = new Map()
const subjectsOf = new Map()
for (const row of corpus.descriptions.rows) {
  const subject = row[D.subject]
  const source = row[D.resolved] ?? row[D.text]
  for (const cid of leaves(source)) {
    if (cid === subject) continue
    uses.set(cid, (uses.get(cid) ?? 0) + 1)
    if (!subjectsOf.has(cid)) subjectsOf.set(cid, [])
    const list = subjectsOf.get(cid)
    if (list.length < 200) list.push(subject)
  }
}

const form = new Map()
for (const row of corpus.components.rows) form.set(row[C.cid], row[C.char])
const aliasesOf = new Map()
for (const row of corpus.aliases.rows) {
  if (!aliasesOf.has(row[A.cid])) aliasesOf.set(row[A.cid], [])
  aliasesOf.get(row[A.cid]).push(`${row[A.ns]}:${row[A.value]}`)
}

const read = cid => {
  const point = cid.startsWith('ucs:') ? Number.parseInt(cid.slice(4), 16)
    : Number.parseInt(String(form.get(cid) ?? '').slice(2), 16)
  return Number.isFinite(point) ? String.fromCodePoint(point) : ''
}

// Unencoded components are the point of the catalogue but are used far less, so they are kept
// regardless of the cap; without them the page shows only what every font already draws.
const ranked = [...uses.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
const rows = [...ranked.slice(0, LIMIT), ...ranked.slice(LIMIT).filter(([cid]) => !cid.startsWith('ucs:'))]
  .map(([cid, count]) => ({
    cid, uses: count, char: read(cid),
    encoded: cid.startsWith('ucs:'),
    subjects: (subjectsOf.get(cid) ?? []).slice(0, CAP).map(read),
    aliases: aliasesOf.get(cid) ?? [],
  }))

const data = {
  built: new Date().toISOString().slice(0, 10),
  counts: corpus.counts,
  licence: corpus.licence.spdx,
  cap: CAP,
  components: rows,
}

const bytes = gzipSync(JSON.stringify(data), { level: 9 })
await writeFile(OUT, bytes)
console.log(`data/component-atlas.json.gz: ${rows.length} components, ${(bytes.length / 1024).toFixed(0)} KB`)
