#!/usr/bin/env bun
// Rebuild the prepared example drawings: the Sans face's full drawings in
// demo/lib/example-drawings.json, and a card-sized art map for each other face in
// demo/lib/example-art-<face>.json. Run it whenever a composer export changes;
// tests/example-drawings.test.js fails until the files and the exports agree.
//
//   bun run build:example-drawings
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { hasTangut, tangutSource } from '@han-compose/composer/tangut'
import { hasBopomofo, bopomofoSource } from '@han-compose/composer/bopomofo'
import { hasSmallSeal, smallSealSource } from '@han-compose/composer/small-seal'
import { hasShuishu, shuishuSource } from '@han-compose/composer/shuishu'
import { hasJurchen, jurchenSource } from '@han-compose/composer/jurchen'
import { onlyBundled } from '@han-compose/composer/local'
import { bundledSource } from '@han-compose/composer/bundled'
import { compose, fromUrl } from '@han-compose/composer/loader'
import { EXAMPLES, EXAMPLE_GROUPS } from '../lib/examples.js'
import { COMPOSER_BASE, COMPOSER_BASES } from '../lib/composer.js'

/** The faces whose example cards need art of their own; Sans uses the full drawings. */
const ART_FACES = ['serif', 'regular', 'fangsong', 'pen-writing']

// The outlines the engine carries, where its package keeps them.
const DATA = join(dirname(fileURLToPath(import.meta.resolve('@han-compose/composer/package.json'))), 'data')
const bundledOutlines = path => JSON.parse(gunzipSync(readFileSync(join(DATA, path))))
// A draft form names the character it stood for, so its example is drawn from the description.
const DRAFTED = new Map(EXAMPLE_GROUPS.filter(group => ['sign', 'erjian'].includes(group.key))
  .flatMap(group => group.examples.map(example => [example.sequence, group.key])))
const loadTangut = async () => bundledOutlines('sources/tangut/outlines.json.gz')
const loadShuishu = async () => bundledOutlines('sources/shuishu/outlines.json.gz')
const loadJurchen = async () => bundledOutlines('sources/jurchen/outlines.json.gz')
const loadBopomofo = async () => bundledOutlines('sources/bopomofo/outlines.json.gz')
const loadSmallSeal = async () => bundledOutlines('sources/small-seal/outlines.json.gz')

/** The sources one face reads: its export, with the bundled outlines for the examples that carry them.
 * @param {string} base */
async function sourcesFor(base) {
  const source = fromUrl(base)
  await source.ready()
  // Examples whose parts are all bundled draw from a local source. `onlyBundled` also says yes to a
  // whole sequence that matches a component form, then skips its parts, so the export stays behind
  // the source for the character's own glyph.
  const bundled = bundledSource({ load: async () => ({ records: {} }), matches: () => false, fallback: source })
  const tangut = tangutSource({ load: loadTangut })
  const mixed = tangutSource({ load: loadTangut, fallback: source })
  const bopomofoSources = new Map()
  /** @param {typeof EXAMPLES[number]} example */
  const sourceOf = example => {
    const local = onlyBundled(example.sequence)
    let selected = hasTangut(example.sequence) ? (local ? tangut : mixed) : (local ? bundled : source)
    if (hasBopomofo(example.sequence)) {
      if (!bopomofoSources.has(selected)) bopomofoSources.set(selected, bopomofoSource({ load: loadBopomofo, fallback: selected }))
      selected = bopomofoSources.get(selected)
    }
    if (hasSmallSeal(example.sequence)) selected = smallSealSource({ load: loadSmallSeal, fallback: selected })
    if (hasShuishu(example.sequence)) selected = shuishuSource({ load: loadShuishu, fallback: selected })
    if (hasJurchen(example.sequence)) selected = jurchenSource({ load: loadJurchen, fallback: selected })
    return selected
  }
  const manifest = source.manifest
  return {
    composer: {
      commit: manifest?.composer?.commit ?? null,
      style: manifest?.composer?.style ?? null,
      layout_sha256: manifest?.composer?.layout_sha256 ?? null,
    },
    sourceOf,
  }
}

/** Compose every example in one face. A drafted form draws its description; the others name their
 *  character.
 * @param {string} style */
async function drawingsFor(style) {
  const { composer, sourceOf } = await sourcesFor(COMPOSER_BASES[style])
  /** @type {Record<string, { char: string, drawn: any }>} */
  const drawings = {}
  /** @type {{ sequence: string, char: string, name: string, message: string }[]} */
  const failed = []
  for (const example of EXAMPLES) {
    try {
      const drafted = DRAFTED.has(example.sequence)
      const drawn = await compose(sourceOf(example), drafted ? example.sequence : example.char || example.sequence)
      drawings[example.sequence] = { char: example.char, drawn }
      console.log(`${style}: drew ${example.char || example.sequence}`)
    } catch (error) {
      failed.push({ sequence: example.sequence, char: example.char, name: error?.name ?? 'Error', message: String(error?.message ?? error) })
      console.log(`${style}: skipped ${example.char || example.sequence}: ${error?.name ?? 'Error'}: ${error?.message ?? error}`)
    }
  }
  return { composer, drawings, failed }
}

/** A drawing a 36 px card can use. The card shows the path and any emoji; masks and parts are not drawn.
 * @param {any} drawn */
const cardArt = drawn => ({
  ...(drawn?.d ? { d: drawn.d } : {}),
  ...(drawn?.emoji?.length ? { emoji: drawn.emoji } : {}),
})

/** The art a face falls back to when its own export cannot draw an example. @param {string} style */
const fallbackFace = style => style === 'serif' ? 'sans' : 'serif'

const built = new Map()
// One export's compositions are mostly network and outline work; the five faces build together.
await Promise.all(['sans', ...ART_FACES].map(async style => { built.set(style, await drawingsFor(style)) }))

const sans = built.get('sans')
const drawings = sans.drawings
const data = {
  base: COMPOSER_BASE,
  composer: sans.composer,
  drawings,
  failed: sans.failed,
}
writeFileSync(new URL('../lib/example-drawings.json', import.meta.url), JSON.stringify(data, null, 1) + '\n')
console.log(`${Object.keys(drawings).length} drawings, ${sans.failed.length} skipped, ${JSON.stringify(data).length} bytes -> demo/lib/example-drawings.json`)

/** A face's art, with the fallback drawing where its export has none. @param {string} style */
function artFor(style) {
  const own = built.get(style)
  const fallback = built.get(fallbackFace(style))
  /** @type {Record<string, any>} */
  const art = {}
  for (const example of EXAMPLES) {
    const drawn = own.drawings[example.sequence]?.drawn
    const transplanted = drawn?.origins?.some(origin => origin.startsWith('transplant '))
    const borrowed = !drawn || (style !== 'serif' && (drawn.missing?.length || transplanted))
    const chosen = [borrowed ? null : drawn, fallback.drawings[example.sequence]?.drawn, sans.drawings[example.sequence]?.drawn]
      .find(candidate => candidate?.d || candidate?.emoji?.length)
    if (chosen) art[example.sequence] = cardArt(chosen)
  }
  return { base: COMPOSER_BASES[style], composer: own.composer, art, failed: own.failed }
}

for (const style of ART_FACES) {
  const path = `../lib/example-art-${style}.json`
  const face = artFor(style)
  writeFileSync(new URL(path, import.meta.url), JSON.stringify(face, null, 1) + '\n')
  console.log(`${style}: ${Object.keys(face.art).length} cards, ${face.failed.length} skipped, ${JSON.stringify(face).length} bytes -> demo/${path.replace('../', '')}`)
}
