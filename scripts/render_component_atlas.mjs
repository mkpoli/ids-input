// Render an atlas of the merged corpus: every component, how often a description uses it, and which
// characters those are.
//
//   bun scripts/render_component_atlas.mjs [--out docs/component-atlas.html] [--limit N]
//
// The page is self-contained: the data is inlined, so it opens from disk with no server. It reads
// data/ids-corpus.json.gz and counts only what the corpus describes; a component named through a
// CHISE entity that is still unresolved is not counted, which the page states rather than hides.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1] }
const ROOT = new URL('../', import.meta.url).pathname
const OUT = resolve(ROOT, option('--out', 'demo/public/component-atlas.html'))
const LIMIT = Number(option('--limit', '4000'))

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
const subjectRows = new Map()
for (const row of corpus.descriptions.rows) {
  const subject = row[D.subject]
  if (!subjectRows.has(subject)) subjectRows.set(subject, row)
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
    unencoded: !cid.startsWith('ucs:'),
    subjects: (subjectsOf.get(cid) ?? []).slice(0, 60).map(read),
    aliases: aliasesOf.get(cid) ?? [],
  }))

const data = {
  built: new Date().toISOString().slice(0, 10),
  counts: corpus.counts,
  licence: corpus.licence.spdx,
  shown: rows.length,
  components: rows,
}

const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Component atlas</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root { color-scheme: light dark; --edge: #d8d8d8; --ink: #111; --muted: #666; --soft: #f6f6f6 }
  @media (prefers-color-scheme: dark) { :root { --edge: #333; --ink: #f2f2f2; --muted: #9a9a9a; --soft: #191919 } }
  body { margin: 0; padding: 24px; font: 14px/1.45 system-ui, sans-serif; color: var(--ink); background: var(--soft) }
  h1 { font-size: 18px; margin: 0 0 4px }
  p.note { color: var(--muted); margin: 0 0 16px; max-width: 70ch }
  input { padding: 7px 10px; font: inherit; width: 260px; border: 1px solid var(--edge); border-radius: 7px; background: transparent; color: inherit }
  table { border-collapse: collapse; width: 100%; margin-top: 14px }
  .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 10px 0 2px }
  .controls label { display: inline-flex; gap: 6px; align-items: center; color: var(--muted) }
  .controls input[type=number] { width: 84px }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--edge); vertical-align: middle }
  th { font-size: 12px; color: var(--muted); font-weight: 600 }
  .form { font-size: 26px; line-height: 1 }
  .cid { font-family: ui-monospace, monospace; font-size: 11px; color: var(--muted) }
  .uses { font-variant-numeric: tabular-nums; text-align: right; width: 70px }
  .inside { font-size: 18px; letter-spacing: 1px; overflow-wrap: anywhere }
  .check { display:inline-flex; gap:6px; align-items:center; color:var(--muted) }
  .count { color:var(--muted); font-size:12px; margin:8px 0 10px }
  .about { max-width:78ch; color:var(--muted); margin:0 0 14px }
  .about p { margin:0 0 8px } .about b { color:var(--ink) }
  .tag { font-size: 10px; border: 1px solid var(--edge); border-radius: 9px; padding: 0 6px; color: var(--muted); margin-left: 6px }
</style>
<body>
<h1>Component atlas</h1>
<div class="about">
  <p><b>What a cid is.</b> A component's identity, not its character. <code>ucs:53E3</code> is the Unicode
  scalar U+53E3 in hexadecimal — 53E3 is 21475, the code point of 口. <code>chise:GT-K00059</code> is a part
  CHISE names that no code point covers; it carries a private-use scalar internally. An old description could
  name one part <code>bsp:22</code> (BabelStone's numbered component) and another <code>chise:GT-K00125</code>;
  both are aliases of one cid.</p>
  <p><b>Used in</b> counts descriptions naming this component, not characters: a character described two ways
  counts twice. <b>Appears in</b> lists the characters those descriptions describe, capped at 120.
  <b>Unencoded</b> marks a part with no code point, so no font draws it.</p>
</div>
<p class="note">
  Built ${data.built} from <code>data/ids-corpus.json.gz</code> (${data.counts.descriptions.toLocaleString()} descriptions,
  ${data.licence} because the CHISE rows are, the BabelStone ones public domain, see
  <code>data/COPYING-chise-ids.txt</code>). Every component a description uses, most used first. A count
  covers only what the corpus describes: a part named through a CHISE entity that is still unresolved is not
  yet counted, so treat these as a floor.
</p>
<input id="filter" type="search" placeholder="Character, cid, or a character it appears in" autofocus>
<label class="check"><input id="onlyUnencoded" type="checkbox"> unencoded only</label>
<label class="check"><input id="onlyEncoded" type="checkbox"> encoded only</label>
<label class="check">at least <input id="minUses" type="number" min="0" step="10" value="0"> uses</label>
<p class="count" id="count"></p>
<table><thead><tr><th>Component</th><th>Used in</th><th>Appears in</th></tr></thead><tbody id="rows"></tbody></table>
<script>
const data = ${JSON.stringify(data)}
const body = document.getElementById('rows')
const escape = value => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function render() {
  const needle = document.getElementById('filter').value.trim()
  const onlyU = document.getElementById('onlyUnencoded').checked
  const onlyE = document.getElementById('onlyEncoded').checked
  const min = Number(document.getElementById('minUses').value) || 0
  const rows = data.components.filter(row => (!needle
    || row.char === needle || row.cid.includes(needle) || row.subjects.includes(needle))
    && (!onlyU || !row.encoded) && (!onlyE || row.encoded) && row.uses >= min)
  document.getElementById('count').textContent = rows.length.toLocaleString() + ' components'
  body.innerHTML = rows.slice(0, 400).map(row => \`<tr>
    <td><span class="form">\${escape(row.char)}</span><div class="cid">\${escape(row.cid)}\${row.unencoded ? '<span class="tag">unencoded</span>' : ''}</div></td>
    <td class="uses">\${row.uses.toLocaleString()}</td>
    <td class="inside">\${row.subjects.map(escape).join(' ')}\${row.uses > row.subjects.length ? ' …' : ''}</td>
  </tr>\`).join('')
  if (!rows.length) body.innerHTML = '<tr><td colspan="3">No component matches that.</td></tr>'
}
for (const id of ['filter','onlyUnencoded','onlyEncoded','minUses']) document.getElementById(id).addEventListener('input', render)
render()
</script>
</body></html>
`

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, html)
console.log(`${OUT}: ${data.shown} components, ${(html.length / 1024).toFixed(0)} KB`)
