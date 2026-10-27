// @ts-check
// Drawing sequences in a worker (`worker.js`) one at a time, the newest only. Asking for another
// sequence while one is being drawn ends that worker and starts a new one, since a drawing in
// progress cannot be interrupted; the files it had loaded stay in the browser's cache, the export's
// files being immutable.

/**
 * @typedef {import('../adapter/types.js').Drawing} Drawing
 * @typedef {import('../adapter/types.js').SketchLeaf} SketchLeaf
 * @typedef {{ status: 'composed', drawn: Drawing } | { status: 'failed', error: string, unavailable?: boolean } | { status: 'cancelled' }} Answer
 * @typedef {{ postMessage(message: any): void, terminate(): void, onmessage: ((event: MessageEvent) => any) | null,
 *   onerror: ((event: ErrorEvent) => any) | null }} WorkerLike
 */

/**
 * A drawer over workers made by `makeWorker`, drawing from the export at `base`. `draw(sequence,
 * onSketch, { separate })` answers `{ status: 'composed', drawn }`, `{ status: 'failed', error,
 * unavailable }` (`unavailable` when the export itself could not be read), or `{ status:
 * 'cancelled' }` when it was replaced or `cancel` was called first; `onSketch` hears where the layout
 * puts each part before the drawing is done, and `separate` asks the composer to draw every operand
 * rather than a glyph that spells the whole description. `warm()` starts the worker on the export's
 * manifest and layout before the first drawing.
 * @param {() => WorkerLike} makeWorker
 * @param {string} base
 */
export function createDrawer(makeWorker, base) {
  /** @type {WorkerLike | null} */
  let worker = null
  /** @type {{ id: number, resolve: (answer: Answer) => void, onSketch: ((leaves: SketchLeaf[]) => void) | null } | null} */
  let pending = null
  let next = 0
  /** @param {Answer} answer */
  const settle = answer => { const p = pending; pending = null; p?.resolve(answer) }
  function end() {
    worker?.terminate()
    worker = null
  }
  /** The live worker, made once with its message handlers. */
  function connect() {
    if (worker) return worker
    const live = makeWorker()
    worker = live
    live.onmessage = ({ data }) => {
      if (data.id !== pending?.id) return
      if (data.sketch) { pending?.onSketch?.(data.sketch); return }
      settle(data.error === undefined ? { status: 'composed', drawn: data.drawn } : { status: 'failed', error: data.error, ...(data.unavailable ? { unavailable: true } : {}) })
    }
    live.onerror = event => { event?.preventDefault?.(); end(); settle({ status: 'failed', error: String(event?.message ?? 'worker failed') }) }
    return live
  }
  function cancel() {
    if (!pending) return
    end()
    settle({ status: 'cancelled' })
  }
  /** Load the export's manifest and layout now, so a later drawing starts with them. */
  function warm() { connect().postMessage({ id: ++next, warm: true, base }) }
  /**
   * @param {string} sequence
   * @param {((leaves: SketchLeaf[]) => void) | null} [onSketch]
   * @param {{ separate?: boolean, fontStyle?: 'sans' | 'serif' }} [options]
   * @returns {Promise<Answer>}
   */
  function draw(sequence, onSketch = null, { separate = false, fontStyle = 'sans' } = {}) {
    cancel()
    const live = connect()
    const id = ++next
    return new Promise(resolve => {
      pending = { id, resolve, onSketch }
      live.postMessage({ id, sequence, base, separate, fontStyle })
    })
  }
  return { draw, cancel, warm, dispose: () => { cancel(); end() } }
}
