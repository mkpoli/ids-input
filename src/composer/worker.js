// @ts-nocheck: a port of han-compose's Python, kept line for line; its types are the arrays it reads.
// The composer in a Web Worker, so drawing a sequence never holds up the page: it receives
// `{ id, sequence, base }` and answers, for the export at `base`, first `{ id, sketch }` (where the
// layout puts each part, `sketch` in `loader.js`) and then `{ id, drawn }`, or `{ id, error }`, with
// `unavailable` when the export's manifest or layout could not be read at all. The page ends a worker
// whose answer it no longer needs (`client.js`).
import { compose, fromUrl, sketch } from './loader.js'

let source = null, at = null
self.onmessage = async ({ data: { id, sequence, base } }) => {
  if (at !== base) { source = fromUrl(base); at = base }
  try { await source.ready() } catch (error) { self.postMessage({ id, error: String(error?.message ?? error), unavailable: true }); return }
  try {
    self.postMessage({ id, sketch: await sketch(source, sequence) })
    self.postMessage({ id, drawn: await compose(source, sequence) })
  } catch (error) { self.postMessage({ id, error: String(error?.message ?? error) }) }
}
