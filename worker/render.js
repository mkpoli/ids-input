// @ts-nocheck
// The image behind a share link: the sequence composed from the same export the editor draws from,
// laid out by `card.js`, rasterized, and kept in the cache. A sequence the composer cannot draw
// still gets a card, with the empty frame.
import { Resvg, initResvg, resvgWasmModule } from '@cf-wasm/resvg/workerd'
import { compose } from '../src/composer/loader.js'
import { unpack } from '../src/composer/loader.js'
import { sourceFor } from '../src/composer/source.js'
import { cardSvg, SIZE } from './card.js'
import { facesFor } from './fonts.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'

// The card changes with this constant: old entries stay readable under their own key.
const VERSION = 'v7'
const KEPT = 'public, max-age=86400, stale-while-revalidate=604800'

// The entry point starts the module's WebAssembly on import, so this only waits for it.
let started = null
const ready = () => started ??= initResvg.ensure()

/** A file of the built card assets, or null where the build left it out. @param {any} env @param {string} path */
const read = async (env, path) => {
  const answer = await env.ASSETS.fetch(new URL(`/og/${path}`, 'https://assets/'))
  return answer.ok ? answer.arrayBuffer() : null
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
  unicode: { load: async name => { const bytes = await read(env, `data/${name}.json.gz`); return bytes === null ? {} : JSON.parse(await unpack(bytes)) } },
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
  if ([...sequence].length === 1 && !/[\u2FF0-\u2FFB]/.test(sequence)) return sequence
  return (await idsIndex(env))[sequence] ?? null
}

/** The sequence composed, or null where it could not be. @param {any} env @param {string} sequence */
async function draw(env, sequence) {
  const source = sourceFor(sequence, { base: COMPOSER_BASE, loaders: loadersFor(env) })
  await source.ready()
  return await compose(source, sequence, { separate: false, fontStyle: 'sans' })
}

/** Rasterized card PNG. @param {any} env @param {string} sequence @param {any} drawing @param {string | null} char */
async function png(env, sequence, drawing, char) {
  await ready()
  const { buffers, familyOf } = await facesFor(env, sequence)
  const render = await Resvg.async(cardSvg({ sequence, drawing, char, familyOf }), {
    font: { fontBuffers: buffers, defaultFontFamily: 'Noto Sans CJK JP', sansSerifFamily: 'Noto Sans CJK JP', loadSystemFonts: false },
    fitTo: { mode: 'original' },
  })
  return render.render().asPng()
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
  const char = await characterOf(env, sequence)
  const drawing = await draw(env, sequence).catch(() => null)
  const body = await png(env, sequence, drawing, char)
  const answer = new Response(body, { headers: { 'content-type': 'image/png', 'content-length': String(body.length), 'cache-control': KEPT } })
  if (cache) ctx.waitUntil(cache.put(key, answer.clone()))
  return answer
}

export { SIZE }
