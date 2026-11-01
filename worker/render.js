// @ts-nocheck
// The image behind a share link: the sequence composed from the same export the editor draws from,
// laid out by `card.js`, rasterized, and kept in the cache. A sequence the composer cannot draw
// still gets a card, with the empty frame.
import { compose } from '../src/composer/loader.js'
import { unpack } from '../src/composer/loader.js'
import { sourceFor } from '../src/composer/source.js'
import { cardSvg, SIZE, codePoint } from './card.js'
import { OPERATORS } from '../src/core/ids.js'
import { facesFor } from './fonts.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
import { EXAMPLES } from '../demo/lib/examples.js'

// The card changes with this constant: old entries stay readable under their own key.
const VERSION = 'v11'
const KEPT = 'public, max-age=86400, stale-while-revalidate=604800'

// Metadata requests do not need the rasterizer.
let started = null
const ready = () => started ??= import('@cf-wasm/resvg/workerd').then(async module => {
  await module.initResvg.ensure()
  return module.Resvg
})

/** A file of the built card assets, or null where the build left it out. @param {any} env @param {string} path */
const read = async (env, path) => {
  const answer = await env.ASSETS.fetch(new URL(`/og/${path}`, 'https://assets/'))
  // A missing file is answered with the app's page, so the type says whether the file is there.
  if (!answer.ok || answer.headers.get('content-type')?.startsWith('text/html')) return null
  return answer.arrayBuffer()
}

/** Outlines as `JSON.parse(await unpack(bytes))`, or an empty set where the file is missing. */
const outlines = (env, path) => async () => {
  const bytes = await read(env, path)
  return bytes === null ? { records: {} } : JSON.parse(await unpack(bytes))
}

/** The overlay loaders, reading this deployment's own copies of the outline files. @param {any} env */
const loadersFor = env => ({
  tangut: { load: outlines(env, 'data/tangut-outlines.json.gz') },
  bopomofo: { load: outlines(env, 'data/bopomofo-outlines.json.gz') },
  seal: { load: outlines(env, 'data/small-seal-outlines.json.gz') },
  newKorean: { load: outlines(env, 'data/new-korean-outlines.json.gz') },
  shuishu: { load: outlines(env, 'data/shuishu-outlines.json.gz') },
  palette: { load: outlines(env, 'data/palette-outlines.json.gz') },
  unicode: { load: async name => { const bytes = await read(env, `data/${name.replace('unicode/', 'unicode-outlines/')}.json.gz`); return bytes === null ? {} : JSON.parse(await unpack(bytes)) } },
})

/** @type {Promise<Record<string, string>> | null} */
let index = null
const idsIndex = env => index ??= read(env, 'data/ids-index.json.gz')
  .then(bytes => bytes === null ? {} : unpack(bytes))
  .then(text => JSON.parse(text))
  .catch(() => ({}))

/**
 * The character a sequence is, or describes: the sequence itself when it is one character, else a
 * character whose IDS it exactly is.
 * @param {any} env @param {string} sequence
 */
export async function characterOf(env, sequence) {
  if ([...sequence].length === 1 && !OPERATORS.some(([operator]) => operator === sequence)) return sequence
  return (await idsIndex(env))[sequence] ?? null
}

/** The drawing of each unit, composed on its own, or null where one could not be. @param {any} env @param {string[]} units */
async function drawUnits(env, units) {
  return await Promise.all(units.map(unit => draw(env, unit).catch(() => null)))
}

/** The sequence composed, or null where it could not be. @param {any} env @param {string} sequence */
async function draw(env, sequence) {
  const source = sourceFor(sequence, { base: COMPOSER_BASE, loaders: loadersFor(env) })
  await source.ready()
  return await compose(source, sequence, { separate: false, fontStyle: 'sans' })
}

/** Rasterized card PNG. @param {any} env @param {string} sequence @param {any} drawing @param {string | null} char */
async function png(env, sequence, drawing, char, shown = null) {
  const Resvg = await ready()
  const units = shown?.units ?? [sequence]
  const { buffers, familyOf } = await facesFor(env, units.join('') + (char ?? '') + (shown?.codepoint ?? ''))
  const render = await Resvg.async(cardSvg({ sequence, drawing, char, familyOf, units, drawings: shown?.drawings, codepoint: shown?.codepoint }), {
    font: { fontBuffers: buffers, defaultFontFamily: 'Noto Sans CJK JP', sansSerifFamily: 'Noto Sans CJK JP', loadSystemFonts: false },
    fitTo: { mode: 'original' },
  })
  try {
    const image = render.render()
    try { return image.asPng() } finally { image.free() }
  } finally { render.free() }
}

/**
 * The character an example names for a sequence: the one it writes, or the standard character an
 * abbreviation stands for. A description can be read with the code point of a character it does not
 * compose, such as the 講 the sign writes with a full 讠; the card names that character.
 * @param {string} sequence
 */
export function namedFor(sequence) {
  const example = EXAMPLES.find(example => example.sequence === sequence)
  const named = example?.abbreviates || example?.char
  return named && [...named].length === 1 ? named : null
}

/**
 * The units a card draws a named sequence in: the characters the sequence writes, each composed on
 * its own, when a component would otherwise stand in for one — 快 where the composer takes the 忄
 * from it, say. Each unit is the character it draws, so the card names it beside its code point. A
 * sequence that already writes its named character, or whose parts are not all plain characters,
 * stays one unit.
 * @param {any} env @param {string} sequence @param {string | null} named
 * @returns {Promise<string[]>}
 */
export async function unitsFor(env, sequence, named) {
  if (!named || !sequence.includes('⿰') || !sequence.startsWith('⿰')) return [sequence]
  const pieces = [...sequence]
  // One operator, two plain characters: 3 pieces, with the operator first.
  if (pieces.length !== 3) return [sequence]
  const parts = pieces.slice(1)
  if (parts.some((part) => part === named)) return [sequence]
  const index = await idsIndex(env)
  const characters = parts.map((part) => {
    const drawn = index[part] ?? part
    return [...drawn].length === 1 ? drawn : part
  })
  if (characters.includes(named)) return [sequence]
  return [named, ...characters]
}

/**
 * The card for `sequence` as a cacheable response. `ctx` carries the cache write past the answer.
 * @param {any} env @param {any} ctx @param {string} sequence
 */
export async function cardResponse(env, ctx, sequence) {
  const key = new URL(`https://card/${VERSION}/${encodeURIComponent(sequence)}`)
  const cache = globalThis.caches?.default
  const hit = await cache?.match(key)
  if (hit) return hit
  // An example names the character its sequence is read with; otherwise the table gives it. A
  // sequence read with a character it does not compose is shown as the characters it writes.
  const named = namedFor(sequence)
  const composed = await characterOf(env, sequence)
  const char = named ?? composed
  const units = await unitsFor(env, sequence, named && named !== composed ? named : null)
  const drawings = await drawUnits(env, units)
  const shown = units.length > 1 ? { units, drawings, codepoint: char ? codePoint(char) : undefined } : null
  const body = await png(env, sequence, drawings[0], char, shown)
  const answer = new Response(body, { headers: { 'content-type': 'image/png', 'content-length': String(body.length), 'cache-control': KEPT } })
  if (cache) ctx.waitUntil(cache.put(key, answer.clone()))
  return answer
}

export { SIZE }
