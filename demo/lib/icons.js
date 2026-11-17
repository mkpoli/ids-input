// Drawings for the tabs' icons, one after another: the composer's drawer ends the drawing in
// progress when another is asked for, so the strip asks for one at a time and keeps each drawing.
// A failed drawing is not kept, so asking again retries it. A caller that leaves aborts its
// request, so a page turned away from does not hold up the page being read.

/**
 * `draw(sequence, { signal })` answers a drawing or rejects; a drawing is cached by sequence. A
 * sequence asked for again is answered from the cache, and a sequence already waiting is not asked
 * for twice. An aborted request is removed from the queue and answers null.
 * @param {(sequence: string, options?: { signal?: AbortSignal }) => Promise<any>} draw
 * @returns {(sequence: string, options?: { signal?: AbortSignal }) => Promise<any>}
 */
export function createIconDrawings(draw) {
  /** @type {Map<string, any>} */
  const drawn = new Map()
  /** @type {Map<string, Promise<any>>} */
  const asking = new Map()
  /** @type {{ sequence: string, signal?: AbortSignal, resolve: (drawing: any) => void }[]} */
  const waiting = []
  let busy = false

  async function next() {
    if (busy) return
    busy = true
    try {
      while (waiting.length) {
        const entry = waiting.shift()
        if (!entry) break
        const { sequence, signal, resolve } = entry
        if (signal?.aborted) { resolve(null); continue }
        let drawing = null
        try { drawing = await draw(sequence, { signal }) } catch { drawing = null }
        if (signal?.aborted) { resolve(null); continue }
        if (drawing) {
          if (drawn.size > 120) drawn.delete(drawn.keys().next().value)
          drawn.set(sequence, drawing)
        }
        resolve(drawing)
      }
    } finally { busy = false }
  }

  return (sequence, { signal } = {}) => {
    if (!sequence || signal?.aborted) return Promise.resolve(null)
    if (drawn.has(sequence)) return Promise.resolve(drawn.get(sequence))
    const already = asking.get(sequence)
    if (already) return already
    const answer = new Promise(resolve => {
      /** @param {any} drawing */
      const settle = drawing => { signal?.removeEventListener('abort', cancel); resolve(drawing) }
      const cancel = () => {
        const at = waiting.indexOf(entry)
        if (at >= 0) { waiting.splice(at, 1); settle(null) }
      }
      /** @type {{ sequence: string, signal?: AbortSignal, resolve: (drawing: any) => void }} */
      const entry = { sequence, signal, resolve: settle }
      signal?.addEventListener('abort', cancel, { once: true })
      waiting.push(entry)
      next()
    })
    asking.set(sequence, answer)
    answer.then(() => asking.delete(sequence))
    return answer
  }
}
