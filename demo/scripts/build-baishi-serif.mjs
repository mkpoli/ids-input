// Prepare the Serif drawings from the workshop's pinned export. Pass a local
// copy as the first argument to build offline.
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { compose, fromUrl, LookupError } from '@han-compose/composer/loader'
import { COMPOSER_BASES } from '../lib/composer.js'
import { componentsWritten, composedDrawn, glyphsDrawn } from '../lib/baishi-cheatsheet.js'

const folder = process.argv.slice(2).find(argument => !argument.startsWith('--'))
const output = new URL('../lib/baishi-serif-outlines.json', import.meta.url)
const previous = existsSync(output) ? JSON.parse(await readFile(output, 'utf8')).glyphs : {}
const required = new Set(glyphsDrawn())
const base = COMPOSER_BASES.serif
const source = fromUrl(base, folder ? { fetch: async url => {
  try { return new Response(await readFile(join(folder, url.slice(base.length)))) }
  catch (error) { if (error.code === 'ENOENT') return new Response(null, { status: 404 }); throw error }
} } : {})
await source.ready()
const { commit, style } = source.manifest.composer
if (style !== 'serif' || !COMPOSER_BASES.serif.includes('/' + commit + '-')) throw new Error('Wrong Serif export')

const glyphs = {}
for (const char of new Set([...required, ...componentsWritten()])) {
  let drawn
  try { drawn = await compose(source, char, { fontStyle: 'serif' }) }
  catch (error) { if (!required.has(char) && error instanceof LookupError) continue; throw error }
  if (drawn.parts.length !== 1 || drawn.parts[0].origin !== 'glyph ' + char) {
    if (required.has(char)) throw new Error('Missing Serif glyph ' + char)
    continue
  }
  const contours = drawn.parts[0].d.split(/(?=M)/)
  if (required.has(char) && previous[char] && previous[char].join('') !== drawn.parts[0].d && !process.argv.includes('--redrawn')) {
    throw new Error('Review the Serif layer map for ' + char + ' before rebuilding with --redrawn')
  }
  glyphs[char] = contours
}
const composed = {}
for (const sequence of composedDrawn()) {
  const drawn = await compose(source, sequence, { separate: true, fontStyle: 'serif' })
  if (drawn.approximate.length || drawn.parts.length !== [...sequence].filter(char => !/[⿰-⿿㇯]/u.test(char)).length) throw new Error(sequence)
  composed[sequence] = drawn.parts.map(part => part.d)
}
await writeFile(output, JSON.stringify({ base: COMPOSER_BASES.serif, glyphs, composed }, null, 1) + '\n')
