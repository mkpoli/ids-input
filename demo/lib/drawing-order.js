// The order drawings are made in. The description being edited is drawn first; a font sample or a
// tab icon asked for while it loads waits until it is done, so the files it needs are not fetched
// beside the three other faces' exports and the icons' parts.

/**
 * `hold(loading)` says whether the main drawing is loading. `after(draw)` is `draw` held back while
 * it is: a call made then starts when the loading ends, and one aborted in the meantime never starts.
 * @returns {{ hold: (loading: boolean) => void,
 *   after: <A extends [string, { signal?: AbortSignal }?], T>(draw: (...args: A) => Promise<T>) => (...args: A) => Promise<T> }}
 */
export function createDrawingOrder() {
  let held = false
  /** @type {(() => void)[]} */
  let waiting = []
  return {
    hold(loading) {
      held = loading
      if (held) return
      const ready = waiting
      waiting = []
      for (const start of ready) start()
    },
    after: draw => async (...args) => {
      while (held) await new Promise(resolve => waiting.push(() => resolve(undefined)))
      args[1]?.signal?.throwIfAborted()
      return draw(...args)
    },
  }
}
