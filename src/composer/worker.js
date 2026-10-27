// @ts-nocheck: a port of han-compose's Python, kept line for line; its types are the arrays it reads.
// The composer in a Web Worker, so drawing a sequence never holds up the page: it receives
// `{ id, sequence, base, separate }` and answers, for the export at `base`, first `{ id, sketch }`
// (where the layout puts each part, `sketch` in `loader.js`) and then `{ id, drawn }`, or
// `{ id, error }`, with `unavailable` when the export's manifest or layout could not be read at all.
// A `{ id, warm, base }` message loads the manifest and layout and answers `{ id, warm }`, so the
// first drawing starts with them. The page ends a worker whose answer it no longer needs
// (`client.js`).
import { compose, fromUrl, sketch } from './loader.js'
import { hasTangut, tangutSource } from './tangut.js'

import { hasBopomofo, bopomofoSource } from './bopomofo.js'
import { hasSmallSeal, smallSealSource } from './small-seal.js'
import { bundledSource } from './bundled.js'
import { onlyBundled } from './local.js'
import { hasPaletteGlyph, paletteSource } from './palette.js'
import { unicodeSource } from './unicode.js'

const sources = new Map()
self.onmessage = async ({ data: { id, sequence, base, separate, fontStyle, warm } }) => {
  const local = !warm && onlyBundled(sequence, separate, false, fontStyle)
  const tangut = !warm && hasTangut(sequence), bopomofo = !warm && hasBopomofo(sequence)
  const seal = !warm && hasSmallSeal(sequence)
  const palette = !warm && [...sequence].some(hasPaletteGlyph)
  const key = `${local ? 'local' : base}:${tangut}:${bopomofo}:${seal}:${palette}`
  if (!sources.has(key)) {
    let source = local ? null : fromUrl(base)
    if (tangut) source = tangutSource({ fallback: source })
    if (bopomofo) source = bopomofoSource({ fallback: source })
    if (seal) source = smallSealSource({ fallback: source })
    if (palette) source = paletteSource({ fallback: source })
    source ??= bundledSource({ load: async () => ({ records: {} }), matches: () => false })
    sources.set(key, source)
  }
  let source = sources.get(key)
  try { await source.ready() } catch (error) {
    if (!warm && onlyBundled(sequence, false, true, fontStyle)) {
      source = unicodeSource()
      if (tangut) source = tangutSource({ fallback: source })
      if (bopomofo) source = bopomofoSource({ fallback: source })
      if (seal) source = smallSealSource({ fallback: source })
      if (palette) source = paletteSource({ fallback: source })
      await source.ready()
    } else {
    self.postMessage(warm ? { id, warm: true, error: String(error?.message ?? error) } : { id, error: String(error?.message ?? error), unavailable: true })
    return
    }
  }
  if (warm) { self.postMessage({ id, warm: true }); return }
  try {
    self.postMessage({ id, sketch: await sketch(source, sequence, { fontStyle }) })
    self.postMessage({ id, drawn: await compose(source, sequence, { separate, fontStyle }) })
  } catch (error) { self.postMessage({ id, error: String(error?.message ?? error) }) }
}
