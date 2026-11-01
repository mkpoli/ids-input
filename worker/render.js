// @ts-nocheck
// The image behind a share link: the sequence composed from the same export the editor draws from,
// laid out by `card.js`, rasterized, and kept in the cache. A sequence the composer cannot draw
// still gets a card, with the empty frame.
import { compose, dataUrls, unpack } from '@han-compose/composer'
import { sourceFor } from '@han-compose/composer/source'
import { cardSvg, SIZE } from './card.js'
import { OPERATORS } from '../src/core/ids.js'
import { facesFor } from './fonts.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'

// The card changes with this constant: old entries stay readable under their own key.
const VERSION = 'v10'
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

/**
 * How a source reads the outlines this deployment serves under `/og/data/`, where `og-assets.mjs`
 * copies the drawing engine's files: each by the name of the engine's `data/` path it answers for.
 * The loader leaves a file out unless it is copied to `data/`.
 * @param {any} env
 */
const loadFor = env => {
  const SERVED = /^sources\/([a-z-]+)\/outlines\.json\.gz$|^unicode\/outlines\/([0-9a-f]+\.json\.gz)$/
  /** @type {Record<string, string>} */
  const loaders = {}
  for (const path of Object.keys(dataUrls)) {
    if (!SERVED.test(path)) continue
    const name = path.replace(SERVED, (_, script, shard) => script ? `${script}-outlines.json.gz` : `unicode-outlines/${shard}`)
    loaders[path] = new URL(`/og/data/${name}`, 'https://assets/').href
  }
  return async input => {
    const answer = await env.ASSETS.fetch(input)
    // A missing file is answered with the app's page, so the type says whether the file is there.
    if (!answer.ok || answer.headers.get('content-type')?.startsWith('text/html')) return new Response(null, { status: 404 })
    return answer
  }
}

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

/** The sequence composed, or null where it could not be. @param {any} env @param {string} sequence */
async function draw(env, sequence) {
  const source = sourceFor(sequence, { base: COMPOSER_BASE, loaders: loadFor(env) })
  await source.ready()
  return await compose(source, sequence, { separate: false, fontStyle: 'sans' })
}

/** Rasterized card PNG. @param {any} env @param {string} sequence @param {any} drawing @param {string | null} char */
async function png(env, sequence, drawing, char) {
  const Resvg = await ready()
  const { buffers, familyOf } = await facesFor(env, sequence + (char ?? ''))
  const render = await Resvg.async(cardSvg({ sequence, drawing, char, familyOf }), {
    font: { fontBuffers: buffers, defaultFontFamily: 'Noto Sans CJK JP', sansSerifFamily: 'Noto Sans CJK JP', loadSystemFonts: false },
    fitTo: { mode: 'original' },
  })
  try {
    const image = render.render()
    try { return image.asPng() } finally { image.free() }
  } finally { render.free() }
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
