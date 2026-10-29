// @ts-check
// The editor's keyboard: an operator on each key of the number row and the row under it, read by
// where the key sits (`KeyboardEvent.code`) so every layout puts the same operators in the same place.
import { OPERATORS } from './ids.js'

/** The key that puts each operator, by the character it types on a US layout: 1–9, 0, - and = for ⿰ to ⿻, then q w e r t y for ⿼ ⿽ ⿾ ⿿ ㇯ 〾. */
export const KEYS = Object.fromEntries([...'1234567890-=qwerty'].map((key, i) => [key, OPERATORS[i][0]]))

/** The same keys by where they sit. */
export const CODES = Object.fromEntries(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
  'Minus', 'Equal', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'].map((code, i) => [code, OPERATORS[i][0]]))

/** Each operator's key, for showing beside it. */
export const KEY_OF = Object.fromEntries(Object.entries(KEYS).map(([key, op]) => [op, key]))

/** The key that empties a part, as the operator palette shows it: ? (Shift+/ on a US layout). */
export const EMPTY_KEY = '?'

/**
 * @typedef {{ key: string, code?: string, shiftKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, isComposing?: boolean }} KeyLike
 * @typedef {{ command: 'undo' | 'redo' | 'clear' | 'empty' | 'next' | 'previous' | 'type' } | { command: 'operator', op: string }} Command
 */

/**
 * What a key does in the editor's tree: `operator` (with `op`), `undo`, `redo`, `clear` (Backspace
 * or Delete), `empty` (?, for the empty slot the operator palette offers), `next` and `previous`
 * (Tab and Shift+Tab), `type` (a printable character, which goes to the part field), or null for a
 * key the editor leaves alone. Keys during an input method's composition are left alone.
 * @param {KeyLike} event
 * @returns {Command | null}
 */
export function commandFor(event) {
  if (event.isComposing || event.key === 'Process') return null
  const command = event.ctrlKey || event.metaKey
  if (command && event.key.toLowerCase() === 'z') return { command: event.shiftKey ? 'redo' : 'undo' }
  if (command && event.key.toLowerCase() === 'y') return { command: 'redo' }
  if (command || event.altKey) return null
  const op = event.shiftKey ? undefined : (event.code && CODES[event.code]) ?? KEYS[event.key]
  if (op) return { command: 'operator', op }
  if (event.key === EMPTY_KEY) return { command: 'empty' }
  if (event.key === 'Tab') return { command: event.shiftKey ? 'previous' : 'next' }
  if (event.key === 'Backspace' || event.key === 'Delete') return { command: 'clear' }
  if ([...event.key].length === 1 && event.key !== ' ') return { command: 'type' }
  return null
}
