// Drawings for the tabs' icons, one after another: the composer's drawer ends the drawing in
// progress when another is asked for, so the strip asks for one at a time and keeps each drawing.
// A failed drawing is not kept, so asking again retries it.

/**
 * `draw(sequence)` answers a drawing or rejects; a drawing is cached by sequence. A sequence asked
 * for again is answered from the cache, and a sequence already waiting is not asked for twice.
 * @param {(sequence: string) => Promise<any>} draw
 * @returns {(sequence: string) => Promise<any>}
 */
export function createIconDrawings(draw) {
  /** @type {Map<string, any>} */
  const drawn = new Map()
  /** @type {Map<string, Promise<any>>} */
  const asking = new Map()
  /** @type {{ sequence: string, resolve: (drawing: any) => void }[]} */
  const waiting = []
  let busy = false

  async function next() {
    if (busy) return
    busy = true
    try {
      while (waiting.length) {
        const { sequence, resolve } = waiting.shift() ?? { sequence: '', resolve: () => {} }
        let drawing = null
        try { drawing = await draw(sequence) } catch { drawing = null }
        if (drawing) {
          if (drawn.size > 120) drawn.delete(drawn.keys().next().value)
          drawn.set(sequence, drawing)
        }
        resolve(drawing)
      }
    } finally { busy = false }
  }

  return sequence => {
    if (!sequence) return Promise.resolve(null)
    if (drawn.has(sequence)) return Promise.resolve(drawn.get(sequence))
    const already = asking.get(sequence)
    if (already) return already
    const answer = new Promise(resolve => { waiting.push({ sequence, resolve }); next() })
    asking.set(sequence, answer)
    answer.then(() => asking.delete(sequence))
    return answer
  }
}
