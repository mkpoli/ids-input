// @ts-check
// Undo and redo over immutable states, each step named by what it did ("Split ⬚ with ⿰"), so a
// toolbar can say what Undo and Redo will take back or put again and list the steps.

/**
 * @template T
 * @typedef {object} History
 * @property {(state: T, options?: { merge?: boolean, label?: string }) => void} record Keeps `state`, the one before a change named `label`; with `merge`, a change continuing the last one (a run of typing) keeps nothing new and takes the newer name.
 * @property {(current: T) => T | undefined} undo The state before, with `current` kept for redo; undefined with nothing to undo.
 * @property {(current: T) => T | undefined} redo The state undone last, with `current` kept for undo.
 * @property {() => boolean} canUndo
 * @property {() => boolean} canRedo
 * @property {() => string | undefined} undoLabel The name of the step Undo takes back.
 * @property {() => string | undefined} redoLabel The name of the step Redo puts again.
 * @property {() => { done: string[], undone: string[] }} steps The names of the steps done, oldest first, and of those undone, the next to redo first.
 * @property {() => HistoryState<T>} snapshot The steps done and undone, to put back later.
 * @property {(state: HistoryState<T>) => void} restore Put back the steps of a `snapshot`.
 * @property {() => void} clear
 */

/**
 * The steps a history holds, as `snapshot` hands them out.
 * @template T
 * @typedef {{ past: { state: T, label: string }[], future: { state: T, label: string }[] }} HistoryState
 */

/**
 * A history of at most `limit` steps each way.
 * @template T
 * @param {number} [limit]
 * @returns {History<T>}
 */
export function createHistory(limit = 100) {
  /** @type {{ state: T, label: string }[]} */ let past = []
  /** @type {{ state: T, label: string }[]} */ let future = []
  return {
    record(state, { merge = false, label = '' } = {}) {
      if (merge && past.length) past = [...past.slice(0, -1), { state: /** @type {{ state: T }} */ (past.at(-1)).state, label }]
      else past = [...past, { state, label }].slice(-limit)
      future = []
    },
    undo(current) {
      const last = past.at(-1)
      if (!last) return undefined
      past = past.slice(0, -1)
      future = [...future, { state: current, label: last.label }].slice(-limit)
      return last.state
    },
    redo(current) {
      const last = future.at(-1)
      if (!last) return undefined
      future = future.slice(0, -1)
      past = [...past, { state: current, label: last.label }].slice(-limit)
      return last.state
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    undoLabel: () => past.at(-1)?.label,
    redoLabel: () => future.at(-1)?.label,
    steps: () => ({ done: past.map(step => step.label), undone: future.map(step => step.label).reverse() }),
    snapshot: () => ({ past: past.slice(), future: future.slice() }),
    restore(state) { past = state.past.slice(-limit); future = state.future.slice(-limit) },
    clear() { past = []; future = [] },
  }
}
