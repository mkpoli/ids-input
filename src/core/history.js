// @ts-check
// Undo and redo over immutable states.

/**
 * @template T
 * @typedef {object} History
 * @property {(state: T, options?: { merge?: boolean }) => void} record Keeps `state`, the one before a change; with `merge`, a change continuing the last one (a run of typing) keeps nothing new.
 * @property {(current: T) => T | undefined} undo The state before, with `current` kept for redo; undefined with nothing to undo.
 * @property {(current: T) => T | undefined} redo The state undone last, with `current` kept for undo.
 * @property {() => boolean} canUndo
 * @property {() => boolean} canRedo
 * @property {() => void} clear
 */

/**
 * A history of at most `limit` steps each way.
 * @template T
 * @param {number} [limit]
 * @returns {History<T>}
 */
export function createHistory(limit = 100) {
  /** @type {T[]} */ let past = []
  /** @type {T[]} */ let future = []
  return {
    record(state, { merge = false } = {}) {
      if (!merge || !past.length) past = [...past.slice(1 - limit), state]
      future = []
    },
    undo(current) {
      const last = past.at(-1)
      if (!past.length) return undefined
      past = past.slice(0, -1)
      future = [...future, current].slice(-limit)
      return last
    },
    redo(current) {
      const last = future.at(-1)
      if (!future.length) return undefined
      future = future.slice(0, -1)
      past = [...past, current].slice(-limit)
      return last
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() { past = []; future = [] },
  }
}
