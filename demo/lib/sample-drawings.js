// The font switch's sample drawings: the newest sequence replaces the one in flight, so a slow
// drawing never holds up the sequence being edited, and two switches asking for one sequence share
// its answer. A drawing is kept for a repeated sequence; a failure is not, so a retry can recover.
/**
 * @template T
 * @param {(sequence: string, options: { signal: AbortSignal }) => Promise<T | null>} draw
 * @returns {(sequence: string) => Promise<T | null>}
 */
export function createSampleDrawings(draw) {
  /** @type {Map<string, T>} */
  const drawings = new Map()
  /** @type {{ sequence: string, controller: AbortController, promise: Promise<T | null> } | null} */
  let inFlight = null

  return sequence => {
    if (!sequence) return Promise.resolve(null)
    const cached = drawings.get(sequence)
    if (cached) {
      // A drawing kept from before answers at once; whatever is in flight for another sequence is
      // no longer the one being shown.
      if (inFlight && inFlight.sequence !== sequence) inFlight.controller.abort()
      return Promise.resolve(cached)
    }
    if (inFlight?.sequence === sequence) return inFlight.promise
    inFlight?.controller.abort()
    const controller = new AbortController()
    const promise = Promise.resolve().then(() => draw(sequence, { signal: controller.signal })).then(drawing => {
      if (drawing) {
        if (drawings.size > 120) drawings.delete(drawings.keys().next().value)
        drawings.set(sequence, drawing)
      }
      return drawing
    }, () => null).finally(() => {
      if (inFlight?.controller === controller) inFlight = null
    })
    inFlight = { sequence, controller, promise }
    return promise
  }
}
