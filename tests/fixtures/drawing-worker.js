// The composer's Worker, drawing in this process from an export given as files by name: what a
// browser's Worker does for a page, over the same messages, so a preview can be tested end to end
// without a browser.
import { compose, createSource, sketch } from '@han-compose/composer/loader'

/**
 * @param {Record<string, string | Uint8Array>} files
 */
export function drawingWorker(files) {
  const sources = new Map()
  const source = () => {
    if (!sources.has('s')) sources.set('s', createSource(async name => {
      const body = files[name]
      return body === undefined ? null : (typeof body === 'string' ? new TextEncoder().encode(body) : Uint8Array.from(body)).buffer
    }))
    return sources.get('s')
  }
  return {
    // A message left unanswered is one the worker never sent: a test lets it arrive late.
    hold: false,
    messages: [],
    onmessage: null,
    onerror: null,
    terminate() {},
    async postMessage({ id, sequence, warm, fontStyle = 'sans', separate = false }) {
      const store = source()
      const send = message => { if (this.hold) this.messages.push(message); else this.onmessage?.({ data: message }) }
      try { await store.ready() } catch (error) { send({ id, error: String(error?.message ?? error), unavailable: true }); return }
      if (warm) { send({ id, warm: true }); return }
      try {
        send({ id, sketch: await sketch(store, sequence, { fontStyle }) })
        send({ id, drawn: await compose(store, sequence, { separate, fontStyle }) })
      } catch (error) { send({ id, error: String(error?.message ?? error) }) }
    },
  }
}
