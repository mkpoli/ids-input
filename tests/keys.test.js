import { describe, expect, it } from 'bun:test'
import { ALIASES, CODES, KEYS, KEY_OF, OPERATORS, commandFor, createHistory, namingOperator, unalias } from '../src/core/index.js'

describe('ASCII operator names', () => {
  it('name each operator but 〾 once', () => {
    const named = Object.values(ALIASES)
    expect(new Set(named).size).toBe(named.length)
    expect(OPERATORS.map(([op]) => op).filter(op => !named.includes(op))).toEqual(['〾'])
  })
  it('are written as their operators, read from the left', () => {
    expect(unalias('LR亻UD匕失')).toBe('⿰亻⿱匕失')
    expect(unalias('LLR')).toBe('⿲R')
    expect(unalias('RDOCXXMIROSU')).toBe('⿸⿴⿻⿾⿿㇯')
  })
  it('are read in lower case when the whole run is names', () => {
    expect(unalias('lr亻ud匕失')).toBe('⿰亻⿱匕失')
    expect(unalias('Rd广')).toBe('⿸广')
    expect(unalias('lrx')).toBe('lrx')
    expect(unalias(null)).toBe('')
  })
  it('know a name still being typed', () => {
    expect(namingOperator('⿰木L')).toBe(true)
    expect(namingOperator('⿰木l')).toBe(true)
    expect(namingOperator('⿰木a')).toBe(false)
    expect(namingOperator('⿰木')).toBe(false)
  })
})

describe('operator keys', () => {
  it('run along the number row, then q to y', () => {
    expect(KEYS['1']).toBe('⿰')
    expect(KEYS['=']).toBe('⿻')
    expect(KEYS.t).toBe('㇯')
    expect(KEYS.y).toBe('〾')
    expect(Object.keys(KEYS)).toHaveLength(OPERATORS.length)
    expect(CODES.Digit1).toBe('⿰')
    expect(CODES.Equal).toBe('⿻')
    expect(CODES.KeyY).toBe('〾')
    expect(Object.values(CODES).sort()).toEqual(Object.values(KEYS).sort())
    expect(KEY_OF['⿱']).toBe('2')
  })
})

describe('what a key does', () => {
  it('puts an operator by where the key sits, whatever the layout types', () => {
    expect(commandFor({ key: '&', code: 'Digit1' })).toEqual({ command: 'operator', op: '⿰' })
    expect(commandFor({ key: 'z', code: 'KeyY' })).toEqual({ command: 'operator', op: '〾' })
    expect(commandFor({ key: '2' })).toEqual({ command: 'operator', op: '⿱' })
  })
  it('undoes and redoes with Ctrl or ⌘', () => {
    expect(commandFor({ key: 'z', ctrlKey: true })).toEqual({ command: 'undo' })
    expect(commandFor({ key: 'Z', metaKey: true, shiftKey: true })).toEqual({ command: 'redo' })
    expect(commandFor({ key: 'y', ctrlKey: true })).toEqual({ command: 'redo' })
  })
  it('steps with Tab, clears with Backspace, and sends other characters to the part field', () => {
    expect(commandFor({ key: 'Tab' })).toEqual({ command: 'next' })
    expect(commandFor({ key: 'Tab', shiftKey: true })).toEqual({ command: 'previous' })
    expect(commandFor({ key: 'Backspace' })).toEqual({ command: 'clear' })
    expect(commandFor({ key: 'Delete' })).toEqual({ command: 'clear' })
    expect(commandFor({ key: '木' })).toEqual({ command: 'type' })
    expect(commandFor({ key: '!', code: 'Digit1', shiftKey: true })).toEqual({ command: 'type' })
  })
  it('leaves alone composition, other shortcuts, space and named keys', () => {
    expect(commandFor({ key: '1', code: 'Digit1', isComposing: true })).toBeNull()
    expect(commandFor({ key: 'Process', code: 'Digit1' })).toBeNull()
    expect(commandFor({ key: 'c', ctrlKey: true })).toBeNull()
    expect(commandFor({ key: '1', code: 'Digit1', altKey: true })).toBeNull()
    expect(commandFor({ key: ' ' })).toBeNull()
    expect(commandFor({ key: 'ArrowDown' })).toBeNull()
  })
})

describe('undo and redo', () => {
  it('step back and forth, the state left kept on the other side', () => {
    const history = createHistory()
    history.record('a')
    history.record('b')
    expect(history.undo('c')).toBe('b')
    expect(history.undo('b')).toBe('a')
    expect(history.canUndo()).toBe(false)
    expect(history.undo('a')).toBeUndefined()
    expect(history.redo('a')).toBe('b')
    expect(history.redo('b')).toBe('c')
    expect(history.canRedo()).toBe(false)
  })
  it('a new change drops what was undone', () => {
    const history = createHistory()
    history.record('a')
    history.undo('b')
    history.record('a')
    expect(history.canRedo()).toBe(false)
  })
  it('keep a run of typing as one step', () => {
    const history = createHistory()
    history.record('')
    history.record('⿰', { merge: true })
    history.record('⿰亻', { merge: true })
    expect(history.undo('⿰亻木')).toBe('')
    expect(history.canUndo()).toBe(false)
  })
  it('keeps at most its limit of steps', () => {
    const one = createHistory(1)
    one.record('a'); one.record('b')
    expect(one.undo('c')).toBe('b')
    expect(one.canUndo()).toBe(false)
  })
  it('name each step, a run of typing by its last name', () => {
    const history = createHistory()
    history.record('', { label: 'Type ⿰' })
    history.record('⿰', { merge: true, label: 'Type ⿰亻' })
    history.record('⿰亻', { label: 'Put 木' })
    expect(history.steps()).toEqual({ done: ['Type ⿰亻', 'Put 木'], undone: [] })
    expect(history.undoLabel()).toBe('Put 木')
    history.undo('⿰亻木')
    expect(history.redoLabel()).toBe('Put 木')
    expect(history.undoLabel()).toBe('Type ⿰亻')
    history.undo('⿰亻')
    expect(history.steps()).toEqual({ done: [], undone: ['Type ⿰亻', 'Put 木'] })
    expect(history.redo('')).toBe('⿰亻')
    expect(history.redo('⿰亻')).toBe('⿰亻木')
  })
  it('keep at most the limit', () => {
    const history = createHistory(3)
    for (const state of 'abcde') history.record(state)
    expect([history.undo('f'), history.undo('e'), history.undo('d'), history.undo('c')]).toEqual(['e', 'd', 'c', undefined])
  })
})

describe('a shortcut', () => {
  it('is written with symbols on Apple systems and with names elsewhere', async () => {
    const { shortcut } = await import('../src/svelte/shortcut.js')
    expect(shortcut('mod+shift+z', true)).toBe('⌘⇧Z')
    expect(shortcut('mod+shift+z', false)).toBe('Ctrl+Shift+Z')
    expect(shortcut('backspace', false)).toBe('Backspace')
    expect(shortcut('q', true)).toBe('Q')
    expect(shortcut('mod+shift+z', false, { compact: true })).toBe('Ctrl⇧Z')
    expect(shortcut('backspace', false, { compact: true })).toBe('⌫')
    expect(shortcut('mod+z', true, { compact: true })).toBe('⌘Z')
  })
})
