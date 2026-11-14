#!/usr/bin/env bun
// Rebuild demo/lib/baishi-cheatsheet-outlines.json: the outline of every character the cheatsheet
// draws, contour by contour, from the export at COMPOSER_BASE, so the page colours a part by
// choosing its contours and waits for no composer. Before drawing, every quotation of
// demo/lib/baishi-cheatsheet.js is looked up in Yi Bai's data at the commit it names: a quotation
// that is not in its row stops the build. Run it whenever COMPOSER_BASE or the cards change;
// tests/baishi-cheatsheet.test.js fails until the file matches.
//
//   bun run build:baishi-cheatsheet [folder]   # a local copy of ids_lv0.txt and ids_lv1.txt skips the download
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compose, fromUrl } from '@han-compose/composer/loader'
import { COMPOSER_BASE } from '../lib/composer.js'
import { SECTIONS, SOURCE, entriesOf, glyphsDrawn, tokenise } from '../lib/baishi-cheatsheet.js'

const folder = process.argv[2]
/** @type {Record<string, string[]>} */
const rows = {}
for (const [file, sha256] of Object.entries(SOURCE.sha256)) {
  const bytes = folder ? readFileSync(join(folder, file))
    : Buffer.from(await (await fetch(`https://raw.githubusercontent.com/yi-bai/ids/${SOURCE.commit}/${file}`)).arrayBuffer())
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error(`${file} is not the file of ${SOURCE.commit}`)
  rows[file] = bytes.toString('utf8').split('\n')
}

let quoted = 0
for (const card of SECTIONS.flatMap(section => section.cards)) {
  for (const quote of card.quotes) {
    const row = rows[quote.file ?? 'ids_lv0.txt'][quote.row - 1] ?? ''
    const found = quote.text.includes('\t') ? row === quote.text : row.startsWith(`${quote.char}\t`) && entriesOf(row).includes(quote.text)
    if (!found) throw new Error(`${card.id}: ${quote.text} is not in ${quote.file ?? 'ids_lv0.txt'}:${quote.row} (${row})`)
    // Read here too, so a card the page cannot read stops the build.
    tokenise(quote.text, { strokes: card.strokes })
    quoted++
  }
}

const source = fromUrl(COMPOSER_BASE)
await source.ready()
/** @type {Record<string, string[]>} */
const glyphs = {}
for (const char of glyphsDrawn()) {
  const drawn = await compose(source, char)
  if (drawn.parts.length !== 1 || drawn.parts[0].origin !== `glyph ${char}`) throw new Error(`${char} is drawn from ${drawn.origins.join(', ')}, not its own glyph`)
  glyphs[char] = drawn.parts[0].d.split(/(?=M)/)
}
// Every contour of a coloured glyph is named once, so no part is drawn twice or left out.
for (const card of SECTIONS.flatMap(section => section.cards)) {
  for (const glyph of card.quotes.flatMap(quote => quote.glyphs ?? [])) {
    if (!glyph?.parts) continue
    const named = [...glyph.parts.flat(), ...(glyph.rest ?? [])].sort((a, b) => a - b)
    if (named.join() !== glyphs[glyph.char].map((_, index) => index).join()) throw new Error(`${card.id}: ${glyph.char} has contours 0–${glyphs[glyph.char].length - 1}, the card names ${named.join(' ')}`)
  }
}

const manifest = source.manifest
const data = {
  base: COMPOSER_BASE,
  composer: { commit: manifest?.composer?.commit ?? null, style: manifest?.composer?.style ?? null },
  data: { commit: SOURCE.commit, sha256: SOURCE.sha256 },
  glyphs,
}
writeFileSync(new URL('../lib/baishi-cheatsheet-outlines.json', import.meta.url), JSON.stringify(data, null, 1) + '\n')
console.log(`${quoted} quotations found, ${Object.keys(glyphs).length} outlines, ${JSON.stringify(data).length} bytes -> demo/lib/baishi-cheatsheet-outlines.json`)
