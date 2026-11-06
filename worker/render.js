// @ts-nocheck
// The image behind a share link: the sequence composed from the same export the editor draws from,
// laid out by `card.js`, rasterized, and kept in the cache. A sequence the composer cannot draw
// still gets a card, with the empty frame.
import { compose, dataUrls, sketch as composerSketch, unpack } from '@han-compose/composer'
import { documentView } from '@han-compose/composer/document-view'
import { boxCorners } from '../src/document/index.js'
import { sourceFor } from '@han-compose/composer/source'
import { cardSvg, SIZE, codePoint } from './card.js'
import { JURCHEN_VARIANT, OPERATORS } from '../src/core/ids.js'
import { facesFor } from './fonts.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
import { EXAMPLES } from '../demo/lib/examples.js'
import { CARD_VERSION } from './card-version.js'

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
  /** The deployment's name for a file the engine names. @param {string} path */
  const served = path => path.replace(SERVED, (_, script, shard) => script ? `${script}-outlines.json.gz` : `unicode-outlines/${shard}`)
  /** @type {Record<string, string>} */
  const loaders = {}
  for (const path of Object.keys(dataUrls)) {
    if (SERVED.test(path)) loaders[path] = new URL(`/og/data/${served(path)}`, 'https://assets/').href
  }
  return {
    loaders,
    // The files are the deployment's own: read from its assets by the path the engine names and
    // answered as the parsed file, which is what a bundled source reads (`records`, `unicode/...`).
    // A missing one is answered empty, as `outlines` on the page does; a dev server's page stands in
    // for a file it does not have, which the content type tells apart.
    read: async path => {
      const answer = await env.ASSETS.fetch(new URL(`/og/data/${served(path)}`, 'https://assets/'))
      if (!answer.ok || answer.headers.get('content-type')?.startsWith('text/html')) return {}
      return JSON.parse(await unpack(await answer.arrayBuffer()))
    },
  }
}

/** @type {Promise<Record<string, string>> | null} */
let index = null
const idsIndex = env => index ??= read(env, 'data/ids-index.json.gz')
  .then(bytes => bytes === null ? {} : unpack(bytes))
  .then(text => JSON.parse(text))
  .catch(() => ({}))

/** One character, a Jurchen variant sequence counting as one. @param {string} text */
const isOneCharacter = text => [...text].length === 1 || JURCHEN_VARIANT.test(text)

/**
 * The character a sequence is, or describes: the sequence itself when it is one character or a
 * Jurchen variant sequence, else a character whose IDS it exactly is.
 * @param {any} env @param {string} sequence
 */
export async function characterOf(env, sequence) {
  if (isOneCharacter(sequence) && !OPERATORS.some(([operator]) => operator === sequence)) return sequence
  return (await idsIndex(env))[sequence] ?? null
}

/**
 * The drawing of each unit, composed on its own, or null where one could not be. A single unit is
 * the sequence itself, whose drawing is given. @param {any} env @param {string[]} units @param {any} first
 */
async function drawUnits(env, units, first) {
  if (units.length === 1) return [first]
  return await Promise.all(units.map((unit) => draw(env, unit).catch(() => null)))
}

/** The sequence composed, or null where it could not be. @param {any} env @param {string} sequence */
async function draw(env, sequence) {
  const { loaders, read } = loadFor(env)
  const source = sourceFor(sequence, { base: COMPOSER_BASE, loaders, read })
  await source.ready()
  return await compose(source, sequence, { separate: false, fontStyle: 'sans' })
}

/**
 * The separated drawing of a document and its scoped view, or null where the composer cannot draw
 * it. A view can be incomplete while its drawing still shows the sequence.
 * @param {any} env @param {string} sequence @param {any} document
 */
async function drawDocument(env, sequence, document) {
  const { loaders, read } = loadFor(env)
  const source = sourceFor(sequence, { base: COMPOSER_BASE, separate: true, loaders, read })
  await source.ready()
  const drawing = await compose(source, sequence, { separate: true, fontStyle: 'sans' })
  const sketch = await composerSketch(source, sequence)
  return { view: documentView(document, drawing, sketch), drawing }
}

/** Rasterized card PNG. @param {any} env @param {string} sequence @param {any} drawing @param {string | null} char */
async function png(env, sequence, drawing, char, shown = null, document = null) {
  const Resvg = await ready()
  const units = shown?.units ?? [sequence]
  const { buffers, familyOf } = await facesFor(env, units.join('') + (char ?? '') + (shown?.codepoint ?? '') + (document?.title ?? ''))
  const render = await Resvg.async(cardSvg({ sequence, drawing, char, familyOf, units, drawings: shown?.drawings, codepoint: shown?.codepoint, document }), {
    font: { fontBuffers: buffers, defaultFontFamily: 'Noto Sans CJK JP', sansSerifFamily: 'Noto Sans CJK JP', loadSystemFonts: false },
    fitTo: { mode: 'original' },
  })
  try {
    const image = render.render()
    try { return image.asPng() } finally { image.free() }
  } finally { render.free() }
}

/**
 * The character an example names for a sequence: the one it writes, or for an abbreviation the
 * standard character it stands for. `composed` is the character the table says the sequence is, where
 * the example writes none.
 * @param {string} sequence @param {string | null} [composed]
 */
export function namedFor(sequence, composed = null) {
  const example = EXAMPLES.find(example => example.sequence === sequence)
  const named = example?.char || example?.abbreviates || composed
  return named && isOneCharacter(named) ? named : null
}

/** The character a card and its page both name: the example's, else the table's. @param {any} env @param {string} sequence */
export async function characterFor(env, sequence) {
  return namedFor(sequence, await characterOf(env, sequence))
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
  if (!named || !sequence.startsWith('⿰')) return [sequence]
  const pieces = [...sequence]
  // One operator, two plain characters: 3 pieces, with the operator first.
  if (pieces.length !== 3) return [sequence]
  const parts = pieces.slice(1)
  // The units are the character the sequence is read with, then the characters it writes; a written
  // character that is the named one already says which character, so the sequence stays whole.
  const written = parts.flatMap((part) => [...part].length === 1 ? [...part] : [])
  if (written.includes(named)) return [sequence]
  return [named, ...written]
}

/**
 * The card for `sequence` as a cacheable response. `ctx` carries the cache write past the answer.
 * `document` draws the sequence as the document carries it, and `token` keeps that card apart.
 * @param {any} env @param {any} ctx @param {string} sequence @param {any} [document]
 * @param {string} [token]
 */
export async function cardResponse(env, ctx, sequence, document = null, token = '') {
  const key = new URL(`https://card/${CARD_VERSION}/${encodeURIComponent(sequence)}`)
  if (document) key.searchParams.set('doc', token)
  const cache = globalThis.caches?.default
  const hit = await cache?.match(key)
  if (hit) return hit
  // The example names the character, else the table does. A sequence read with a character it does
  // not compose is shown as the characters it writes.
  const composed = await characterOf(env, sequence)
  const named = namedFor(sequence, composed)
  const char = named
  const units = await unitsFor(env, sequence, named && named !== composed ? named : null)
  // A document is one drawing, not the characters a sequence writes; when its layers cannot be
  // scoped, the card falls back to the separated drawing and still says it is a document. The
  // plain drawing is only made when no document drawing answered.
  const made = document ? await drawDocument(env, sequence, document).catch(() => null) : null
  const sequenceDrawing = made?.drawing ?? await draw(env, sequence).catch(() => null)
  const drawings = document ? [] : await drawUnits(env, units, sequenceDrawing)
  const shown = document ? null : units.length > 1 ? { units, drawings, codepoint: char ? codePoint(char) : undefined } : null
  const slots = made?.view ? [...made.view.frames.values()]
    .filter(frame => frame.node.kind === 'slot')
    .map(frame => boxCorners(frame.canvas, frame.box)) : []
  const drawn = document ? { scopes: made?.view.complete ? made.view.scopes : null, title: document.title ?? null, slots } : null
  const body = await png(env, sequence, sequenceDrawing, char, shown, drawn)
  const answer = new Response(body, { headers: {
    'content-type': 'image/png', 'content-length': String(body.length), 'cache-control': KEPT,
    'x-og-card': document ? drawn.scopes ? 'document' : 'document-fallback' : 'sequence',
  } })
  if (cache) ctx.waitUntil(cache.put(key, answer.clone()))
  return answer
}

export { SIZE }
