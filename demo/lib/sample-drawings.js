// The font switch's sample drawings: the newest sequence replaces the one in flight, so a slow
// drawing never holds up the sequence being edited, and two switches asking for one sequence share
// its answer. A drawing is kept for a repeated sequence; a failure is not, so a retry can recover.
/**
 * @template T
 * @param {(sequence: string, options: { signal: AbortSignal }) => Promise<T | null>} draw
 * @returns {((sequence: string) => Promise<T | null>) & { cancel: () => void }}
 */
export function createSampleDrawings(draw) {
  /** @type {Map<string, T>} */
  const drawings = new Map()
  /** @type {{ sequence: string, controller: AbortController, promise: Promise<T | null> } | null} */
  let inFlight = null

  /** @type {((sequence: string) => Promise<T | null>) & { cancel: () => void }} */
  const samples = sequence => {
    if (!sequence) return Promise.resolve(null)
    const cached = drawings.get(sequence)
    if (cached) return Promise.resolve(cached)
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
  // No sample is wanted: stop the drawing in flight rather than let it finish unseen.
  samples.cancel = () => {
    if (!inFlight) return
    inFlight.controller.abort()
    inFlight = null
  }
  return samples
}
