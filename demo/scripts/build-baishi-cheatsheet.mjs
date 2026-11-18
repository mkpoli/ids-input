#!/usr/bin/env bun
// Rebuild demo/lib/baishi-cheatsheet-outlines.json: what the cheatsheet draws, prepared from the
// export at COMPOSER_BASE so the page waits for no composer. It holds the outline of every
// character a card colours and of every component a card writes, contour by contour; the
// composer's drawing of each sequence no outline has, part by part; each written component's own
// row of the data for the variants a tooltip lists.
//
// Before drawing, every quotation of demo/lib/baishi-cheatsheet.js is looked up in Yi Bai's data at
// the commit it names: a quotation that is not in its row stops the build, and the ones found are
// stored beside the outlines. So does a card with nothing to draw: every quotation has an outline
// or a composed drawing, and a composed drawing has one part for each component, none of them
// approximated. Run it whenever COMPOSER_BASE or the cards change;
// tests/baishi-cheatsheet.test.js fails until the file matches.
//
// A card names contours by their number, so an outline that comes back different from the stored one
// stops the build too: look at the card's colouring again, then pass --redrawn.
//
//   bun run build:baishi-cheatsheet [folder] [--redrawn]   # a local copy of ids_lv0.txt and ids_lv1.txt skips the download
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compose, fromUrl } from '@han-compose/composer/loader'
import { COMPOSER_BASE } from '../lib/composer.js'
import { featureExamples } from '../lib/baishi-feature-examples.js'
import { SOURCE, STROKE_LETTERS, cardsOf, componentsWritten, composedDrawn, contoursOf, entriesOf, glyphsDrawn, quotations, tokenise } from '../lib/baishi-cheatsheet.js'

const redrawn = process.argv.includes('--redrawn')
const folder = process.argv.slice(2).find(argument => !argument.startsWith('--'))
/** @type {Record<string, string[]>} */
const files = {}
for (const [file, sha256] of Object.entries(SOURCE.sha256)) {
  let bytes
  if (folder) bytes = readFileSync(join(folder, file))
  else {
    const response = await fetch(`https://raw.githubusercontent.com/yi-bai/ids/${SOURCE.commit}/${file}`)
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
  }
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error(`${file} is not the file of ${SOURCE.commit}`)
  files[file] = bytes.toString('utf8').split('\n')
}

for (const [feature, examples] of Object.entries(featureExamples)) {
  for (const [char, line, text, mark, level] of examples) {
    const row = files[`ids_lv${level ?? 0}.txt`][line - 1]
    if (!row?.startsWith(char + '\t') || !text.includes(mark) ||
        (row.slice(char.length + 1) !== text && !entriesOf(row).includes(text))) {
      throw new Error(`${feature}: ${char} ${text} does not match its cited row or marked feature`)
    }
  }
}
for (const card of cardsOf()) {
  for (const quote of card.quotes) {
    const row = files[quote.file ?? 'ids_lv0.txt'][quote.row - 1] ?? ''
    const found = quote.text.includes('\t') ? row === quote.text : row.startsWith(`${quote.char}\t`) && entriesOf(row).includes(quote.text)
    if (!found) throw new Error(`${card.id}: ${quote.text} is not in ${quote.file ?? 'ids_lv0.txt'}:${quote.row} (${row})`)
    // Read here too, so a card the page cannot read stops the build.
    tokenise(quote.text, { strokes: quote.strokes })
    if (!quote.glyphs.some(Boolean)) throw new Error(`${card.id}: ${quote.text} has nothing drawn`)
  }
}
// A stroke letter is the chain its stroke's own row writes.
for (const [letters, stroke, line] of STROKE_LETTERS) {
  const row = files['ids_lv0.txt'][line - 1] ?? ''
  if (!row.startsWith(`${stroke}\t`) || !entriesOf(row).some(entry => entry.replace(/^\{[^}]*\}/u, '').replace(/(?<=\))\([^()]*\)$/u, '') === `#(${letters})`)) throw new Error(`${stroke} is not #(${letters}) in ids_lv0.txt:${line} (${row})`)
}

const out = new URL('../lib/baishi-cheatsheet-outlines.json', import.meta.url)
/** @type {Record<string, string[]>} */
const stored = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')).glyphs ?? {} : {}
const source = fromUrl(COMPOSER_BASE)
await source.ready()
/** A character's own outline, contour by contour, or null where the export has none. @param {string} char */
async function outline(char) {
  try {
    const drawn = await compose(source, char)
    return drawn.parts.length === 1 && drawn.parts[0].origin === `glyph ${char}` ? drawn.parts[0].d.split(/(?=M)/) : null
  } catch { return null }
}
/** @type {Record<string, string[]>} */
const glyphs = {}
const changed = []
for (const char of glyphsDrawn()) {
  const contours = await outline(char)
  if (!contours) throw new Error(`${char} cannot be drawn: the export has no glyph of its own for it`)
  glyphs[char] = contours
  if (stored[char] && stored[char].join('') !== contours.join('')) changed.push(char)
}
if (changed.length && !redrawn) throw new Error(`The outlines of ${changed.join(' ')} differ from the stored ones: check the contours their cards name, then run with --redrawn`)
// Every contour of a coloured glyph is named, and one that is not cut by a box is named once.
for (const card of cardsOf()) {
  for (const glyph of card.quotes.flatMap(quote => quote.glyphs)) {
    if (!glyph || glyph === 'composed' || !glyph.parts) continue
    const pieces = [...glyph.parts.flat(), ...(glyph.rest ?? [])]
    const whole = pieces.filter(piece => typeof piece === 'number')
    const named = contoursOf(pieces).sort((a, b) => a - b)
    if (named.join() !== (glyph.contours ?? glyphs[glyph.char]).map((_, index) => index).join() || new Set(whole).size !== whole.length) throw new Error(`${card.id}: ${glyph.char} has contours 0–${(glyph.contours ?? glyphs[glyph.char]).length - 1}, the card names ${pieces.map(piece => typeof piece === 'number' ? piece : piece[0]).join(' ')}`)
  }
}

// The composer's drawing of a sequence no outline has: one part for each component, in order.
/** @type {Record<string, string[]>} */
const composed = {}
for (const sequence of composedDrawn()) {
  const drawn = await compose(source, sequence, { separate: true })
  const leaves = [...sequence].filter(char => !/[⿰-⿿㇯]/u.test(char)).length
  if (drawn.approximate.length) throw new Error(`${sequence} cannot be drawn: the composer approximates ${drawn.approximate.join(' ')}`)
  if (drawn.parts.length !== leaves) throw new Error(`${sequence} cannot be drawn part by part: ${drawn.parts.length} parts for ${leaves} components`)
  composed[sequence] = drawn.parts.map(part => part.d)
}

// Each written component's own outline and row, where it has them, for the tooltips.
/** @type {Record<string, string>} */
const rows = {}
const headwords = new Map(files['ids_lv0.txt'].map(row => [row.slice(0, row.indexOf('\t')), row]))
/** @type {Record<string, string[]>} */
const components = {}
for (const char of componentsWritten()) {
  const row = headwords.get(char)
  if (row) rows[char] = row.slice(row.indexOf('\t') + 1)
  if (glyphs[char]) continue
  const contours = await outline(char)
  if (contours) components[char] = contours
}

const manifest = source.manifest
const data = {
  base: COMPOSER_BASE,
  composer: { commit: manifest?.composer?.commit ?? null, style: manifest?.composer?.style ?? null },
  data: { commit: SOURCE.commit, sha256: SOURCE.sha256 },
  // What was found in the data, so a card edited without this build is noticed.
  quotations: quotations(),
  glyphs,
  composed,
  components,
  rows,
}
writeFileSync(out, JSON.stringify(data, null, 1) + '\n')
console.log(`${data.quotations.length} quotations found, ${Object.keys(glyphs).length} outlines, ${Object.keys(composed).length} composed, ${Object.keys(components).length} component outlines, ${Object.keys(rows).length} rows, ${JSON.stringify(data).length} bytes -> demo/lib/baishi-cheatsheet-outlines.json`)
