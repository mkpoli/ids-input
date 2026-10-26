// @ts-nocheck: a port of han-compose's Python, kept line for line; its types are the arrays it reads.
// The composer in a Web Worker, so drawing a sequence never holds up the page: it receives
// `{ id, sequence, base, separate }` and answers, for the export at `base`, first `{ id, sketch }`
// (where the layout puts each part, `sketch` in `loader.js`) and then `{ id, drawn }`, or
// `{ id, error }`, with `unavailable` when the export's manifest or layout could not be read at all.
// A `{ id, warm, base }` message loads the manifest and layout and answers `{ id, warm }`, so the
// first drawing starts with them. The page ends a worker whose answer it no longer needs
// (`client.js`).
import { compose, fromUrl, sketch } from './loader.js'
import { hasTangut, onlyTangut, tangutSource } from './tangut.js'

const sources = new Map()
self.onmessage = async ({ data: { id, sequence, base, separate, warm } }) => {
  const local = !warm && onlyTangut(sequence), mixed = !warm && !local && hasTangut(sequence)
  const key = local ? 'tangut' : `${mixed ? 'mixed' : 'han'}:${base}`
  if (!sources.has(key)) {
    const fallback = local ? null : fromUrl(base)
    sources.set(key, local || mixed ? tangutSource({ fallback }) : fallback)
  }
  const source = sources.get(key)
  try { await source.ready() } catch (error) {
    self.postMessage(warm ? { id, warm: true, error: String(error?.message ?? error) } : { id, error: String(error?.message ?? error), unavailable: true })
    return
  }
  if (warm) { self.postMessage({ id, warm: true }); return }
  try {
    self.postMessage({ id, sketch: await sketch(source, sequence) })
    self.postMessage({ id, drawn: await compose(source, sequence, { separate }) })
  } catch (error) { self.postMessage({ id, error: String(error?.message ?? error) }) }
}
