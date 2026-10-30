// @ts-nocheck: a port of han-compose's Python, kept line for line; its types are the arrays it reads.
// The composer in a Web Worker, so drawing a sequence never holds up the page: it receives
// `{ id, sequence, base, separate }` and answers, for the export at `base`, first `{ id, sketch }`
// (where the layout puts each part, `sketch` in `loader.js`) and then `{ id, drawn }`, or
// `{ id, error }`, with `unavailable` when the export's manifest or layout could not be read at all.
// A `{ id, warm, base }` message loads the manifest and layout and answers `{ id, warm }`, so the
// first drawing starts with them. The page ends a worker whose answer it no longer needs
// (`client.js`).
import { compose, sketch } from './loader.js'
import { onlyBundled } from './local.js'
import { sourceFor, traitKey, traitsOf } from './source.js'

const sources = new Map()
self.onmessage = async ({ data: { id, sequence, base, separate, fontStyle, warm } }) => {
  const traits = !warm ? traitsOf(sequence) : null
  const key = `${base}:${warm ? 'warm' : traitKey(traits)}:${separate}:${fontStyle}`
  if (!sources.has(key)) sources.set(key, sourceFor(sequence, { base, fontStyle, separate, traits, remote: warm }))
  let source = sources.get(key)
  try {
    await source.ready()
  } catch (error) {
    // The export could not be read: the bundled outlines alone still draw what they cover.
    if (!warm && onlyBundled(sequence, false, true, fontStyle)) {
      source = sourceFor(sequence, { base, fontStyle, separate, traits, bundled: true })
      sources.set(key, source)
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
