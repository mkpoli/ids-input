// bun scripts/build_ucv_spellings.mjs IVD_Sequences.txt StandardizedVariants.txt
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

const data = new URL('../data/', import.meta.url)
const catalogue = JSON.parse(readFileSync(new URL('ucv.json', data), 'utf8'))
const forms = new Set(catalogue.entries.flatMap(entry => entry.forms.filter(f => !f.text).map(f => f.glyph)))
const descriptions = gunzipSync(readFileSync(new URL('variant-descriptions.tsv.gz', data))).toString()
const ivd = readFileSync(process.argv[2])
if (!descriptions.includes('IVD_Sequences.txt sha256:' + createHash('sha256').update(ivd).digest('hex'))) {
  throw new Error('Use the IVD revision recorded in variant-descriptions.tsv.gz')
}
const sequences = new Map()
function record(glyph, sequence) {
  if (!forms.has(glyph)) return
  const known = sequences.get(glyph) ?? []
  known.push(sequence)
  sequences.set(glyph, known)
}
for (const line of ivd.toString().split('\n')) {
  const row = /^(\w+) (\w+); (Adobe-Japan1; CID\+|Moji_Joho; MJ)(\d+)$/.exec(line.trim())
  if (!row) continue
  const name = row[3].startsWith('Adobe') ? 'aj1-' + row[4].padStart(5, '0') : 'jmj-' + row[4]
  record(name, String.fromCodePoint(parseInt(row[1], 16), parseInt(row[2], 16)))
}
for (const line of descriptions.split('\n')) {
  const [sequence, , , glyph] = line.split('\t')
  record(glyph, sequence)
}
const result = {}
for (const glyph of [...sequences.keys()].sort()) {
  const options = sequences.get(glyph).sort()
  // A CID shared by different encoded characters cannot identify its intended base.
  if (new Set(options.map(s => [...s][0])).size === 1) result[glyph] = options[0]
}
writeFileSync(new URL('ucv-spellings.json', data), JSON.stringify(result, null, 2) + '\n')

const standardized = readFileSync(process.argv[3])
if (!descriptions.includes('StandardizedVariants.txt sha256:' + createHash('sha256').update(standardized).digest('hex'))) {
  throw new Error('Use the standardized variants revision recorded in variant-descriptions.tsv.gz')
}
const compatibility = {}
for (const [, base, selector, ideograph] of standardized.toString().matchAll(/^(\w+) (\w+); CJK COMPATIBILITY IDEOGRAPH-(\w+);/gm)) {
  compatibility[String.fromCodePoint(parseInt(ideograph, 16))] = String.fromCodePoint(parseInt(base, 16), parseInt(selector, 16))
}
writeFileSync(new URL('compatibility-sequences.json', data), JSON.stringify(compatibility, null, 1) + '\n')
