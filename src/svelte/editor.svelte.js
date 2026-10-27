// @ts-check
// The state of one IDS being edited, shared by the components that show and change it (the sequence
// field, the operator palette, the tree, the part tools, the pickers, the preview), so a host can lay
// them out as it likes; `IdsInput` puts them together as one editor.
//
// The sequence is held twice, kept in step: as text in the field, which also takes the ASCII operator
// names (LR or lr for ⿰), and as a tree, where an empty slot shows (and is written) as ⬚. One part of
// the tree is chosen at a time. Every change is a named step in the history ("Split ⬚ with ⿰",
// "Put 木"), so it can be undone and redone, a hundred steps each way; a run of typing in the field
// is one step.
import { insertAt } from './insertion.js'
import { tokens, rangeToken } from './tokens.js'
import { tick } from 'svelte'
import { applyOperator, clear, isDescription, isNode, nextEmpty, parse, partAt, paths, place as placed, samePath, unwrap,
  write } from '../core/ids.js'
import { namingOperator, unalias } from '../core/aliases.js'
import { commandFor } from '../core/keys.js'
import { createHistory } from '../core/history.js'
import { lookupChar } from '../core/decompose.js'
import { createLookup } from './lookup.svelte.js'
import { translator } from './i18n.js'

/**
 * @typedef {import('../adapter/types.js').IdsAdapter} IdsAdapter
 * @typedef {import('../core/ids.js').Part} Part
 * @typedef {import('../core/ids.js').Path} Path
 * @typedef {'hover' | 'on' | 'off'} TintMode
 * @typedef {{ tintMode?: TintMode, adapter: IdsAdapter, messages?: Record<string, string>, locale?: string, disabled?: boolean }} EditorOptions
 * @typedef {{ id: number, label: string, destructive: boolean, undone?: boolean }} Change
 */

/** The message key of each operator's name. */
export const OP_NAMES = /** @type {Record<string, string>} */ ({
  '⿰': 'leftRight', '⿱': 'aboveBelow', '⿲': 'leftMiddleRight', '⿳': 'aboveMiddleBelow', '⿴': 'surround',
  '⿵': 'fromAbove', '⿶': 'fromBelow', '⿷': 'fromLeft', '⿸': 'fromUpperLeft', '⿹': 'fromUpperRight',
  '⿺': 'fromLowerLeft', '⿻': 'overlaid', '⿼': 'fromRight', '⿽': 'fromLowerRight', '⿾': 'mirrored',
  '⿿': 'rotated', '㇯': 'subtracted', '〾': 'variant',
})

/**
 * An editor over `options()`, read again whenever it is used, so a host may change the adapter or the
 * messages while it runs.
 * @param {() => EditorOptions} options
 */
export function createEditor(options) {
  const t = $derived(translator(options().messages, options().locale ?? 'en'))
  const disabled = () => Boolean(options().disabled)
  /** @param {string} op */
  const name = op => t(`ids.op.${OP_NAMES[op]}`)
  /** @param {Part | undefined} part */
  const text = part => part === null || part === undefined ? '' : write(part)

  let tree = $state.raw(/** @type {Part} */ (null))
  let caret = $state(/** @type {number | null} */ (null))
  let selectionVersion = $state(0)
  let hovered = $state.raw(/** @type {Path | null} */ (null))
  let chosen = $state.raw(/** @type {Path | null} */ (null))
  let draft = $state(''), piece = $state(''), note = $state('')
  /** The last change, for a host to answer (an undo toast after one that throws something away). */
  let change = $state.raw(/** @type {Change | null} */ (null))
  /** @type {import('../core/history.js').History<{ tree: Part, chosen: Path | null }>} */
  const history = createHistory(100)
  let steps = $state.raw(/** @type {{ done: string[], undone: string[] }} */ ({ done: [], undone: [] }))
  let typing = false, run = false, changes = 0
  const lookup = createLookup(() => options().adapter)
  /** @type {((text: string, whole: boolean) => void)[]} */
  const listeners = []

  const typed = $derived(parse(draft, { open: true }))
  const whole = $derived(write(tree))
  const problem = $derived(note || (!draft || !typed.problem ? '' : namingOperator(draft) ? t('ids.problem.naming')
    : t(`ids.problem.${typed.problem}`)))
  // The first slot still empty, named by its place: a sequence is whole only once there is none.
  const gap = $derived(isNode(tree) ? nextEmpty(tree) : null)
  const pending = $derived.by(() => {
    if (!gap) return ''
    const parent = partAt(tree, gap.slice(0, -1))
    return isNode(parent) ? t('ids.problem.empty', { n: /** @type {number} */ (gap.at(-1)) + 1, name: name(parent.op) }) : ''
  })
  const usable = $derived(isNode(tree) && !gap && !typed.problem && isDescription(whole))
  const picked = $derived(chosen ? partAt(tree, chosen) : undefined)
  // The descriptions a chosen component can be split into, those the editor can read, and what can stand in its place.
  const splits = $derived.by(() => {
    if (typeof picked !== 'string') return []
    const entry = lookup.known[lookupChar(picked)]
    return entry?.status === 'ready' ? entry.sequences.map(s => s.text).filter(sequence => !parse(sequence, { open: true }).problem) : []
  })
  const swaps = $derived(typeof picked === 'string' ? lookup.swaps[lookupChar(picked)] ?? [] : [])

  function sync() {
    steps = history.steps()
    const done = draft
    const ok = isNode(tree) && !nextEmpty(tree) && !parse(done, { open: true }).problem && isDescription(write(tree))
    for (const listen of listeners) listen(done, ok)
  }
  /** Start again from `text` (a description, or nothing), forgetting the history. @param {string} start */
  function reset(start) {
    history.clear(); caret = null; hovered = null; note = ''; change = null; typing = false; run = false
    const read = parse(start, { open: true })
    // A pasted ＋ for an empty slot is written back as ⬚.
    tree = read.tree ?? null; chosen = null; piece = ''
    draft = read.problem || tree === null ? start : write(tree)
    sync()
  }
  /** @param {Part} next @param {Path | null} select */
  function commit(next, select) {
    caret = null
    hovered = null
    tree = next; chosen = select; selectionVersion++; note = ''
    // An empty tree is an empty field, not an empty slot (⬚); a slot is written inside a node.
    if (!typing) draft = next === null ? '' : write(next)
    const part = select ? partAt(next, select) : undefined
    piece = text(part)
    if (typeof part === 'string') lookup.read(lookupChar(part))
    sync()
  }
  /**
   * A change to the tree, named for the history; a run of typing in the field is one step.
   * @param {Part} next @param {Path | null} select @param {string} label @param {{ destructive?: boolean }} [how]
   */
  function apply(next, select, label, { destructive = false } = {}) {
    const valid = parse(write(next), { open: true })
    if (valid.problem) { note = t(`ids.problem.${valid.problem}`); return }
    history.record({ tree, chosen }, { merge: typing && run, label })
    run = typing
    change = { id: ++changes, label, destructive }
    commit(next, select)
  }
  function undo() {
    run = false
    const label = history.undoLabel(), last = history.undo({ tree, chosen })
    if (!last) return
    change = { id: ++changes, label: label ?? '', destructive: false, undone: true }
    commit(last.tree, last.chosen)
  }
  function redo() {
    run = false
    const label = history.redoLabel(), last = history.redo({ tree, chosen })
    if (!last) return
    change = { id: ++changes, label: label ?? '', destructive: false }
    commit(last.tree, last.chosen)
  }

  /**
   * The editor's state, to put back later with `restore`: the tree, the chosen part, the text in the
   * field, the part field and the history.
   * @returns {{ tree: Part, chosen: Path | null, draft: string, piece: string, history: import('../core/history.js').HistoryState<{ tree: Part, chosen: Path | null }> }}
   */
  function snapshot() {
    return { tree, chosen, draft, piece, history: history.snapshot() }
  }
  /** Put back a state from `snapshot`, as when a host switches between documents. @param {ReturnType<typeof snapshot>} state */
  function restore(state) {
    caret = null
    hovered = null
    history.restore(state.history)
    tree = state.tree ?? null; chosen = state.chosen ?? null; draft = state.draft; piece = state.piece
    note = ''; typing = false; run = false; change = null
    const part = chosen ? partAt(tree, chosen) : undefined
    if (typeof part === 'string') lookup.read(lookupChar(part))
    sync()
  }

  // Where a part goes when nothing is chosen: the first empty slot.
  const target = () => chosen ?? (tree === null ? [] : nextEmpty(tree))
  /** @param {Part} part @param {string} [op] */
  function insert(part, op) {
    if (disabled() || caret === null || typed.problem) return
    const next = insertAt(tree, draft, caret, part, op)
    const valid = parse(write(next.tree), {open:true})
    if (valid.problem) { note = t(`ids.problem.${valid.problem}`); return }
    const label = op ? t('ids.do.split', { part: '⬚', op }) : t('ids.do.put', { part: text(part) })
    apply(next.tree, next.operator ? next.path : null, label)
    if (!next.operator) {
      const token = tokens(draft).find(token => samePath(token.path, next.path))
      caret = token?.end ?? draft.length
    }
  }
  /** An operator on the chosen part, or around the whole tree when nothing is chosen. @param {string} op @param {Path | null} [at] */
  function operator(op, at) {
    if (at === undefined && caret !== null && !typed.problem) { insert(null, op); return }
    at = at === undefined ? tree === null ? [] : chosen : at
    if (disabled()) return
    const before = at ? partAt(tree, at) : tree
    const done = applyOperator(tree, at, op)
    if (done.problem) { note = t(`ids.problem.${done.problem}`, { name: name(op) }); return }
    const label = at === null && tree !== null ? t('ids.do.wrap', { op }) : isNode(before) ? t('ids.do.swap', { from: before.op, op }) : t('ids.do.split', { part: text(before) || '⬚', op })
    apply(done.tree, done.chosen, label)
  }
  /** `part` in the chosen slot (or the first empty one), or at `at`. @param {Part} part @param {Path | null} [at] */
  function put(part, at) {
    if (at === undefined && caret !== null && !typed.problem) { insert(part); return }
    at = at === undefined ? target() : at
    if (disabled()) return
    if (!at) { note = t('ids.chooseFirst'); return }
    const before = partAt(tree, at)
    const next = placed(tree, at, part)
    apply(next.tree, next.chosen, before === null || before === undefined ? t('ids.do.put', { part: text(part) })
      : t('ids.do.replace', { from: text(before), part: text(part) }), { destructive: isNode(before) })
  }
  /** A part or a node as written (a palette part, a part taken from a tree, a sequence), put in place. @param {string} written @param {Path | null} [at] */
  function take(written, at) {
    const found = parse(unalias(written), { open: true })
    if (found.problem) { note = t(`ids.problem.${found.problem}`); return false }
    if (found.tree === null) return false
    put(found.tree, at)
    return true
  }
  /** Empty the part at `path`. @param {Path | null} path */
  function empty(path) {
    if (disabled() || !path) return
    const part = partAt(tree, path)
    if (part === null || part === undefined) return
    apply(clear(tree, path), path, t('ids.do.clear', { part: text(part) }), { destructive: true })
  }
  /** Take one level away at `path`, keeping its first filled part. @param {Path | null} path */
  function remove(path) {
    if (disabled() || !path) return
    const part = partAt(tree, path)
    if (!isNode(part)) return
    apply(unwrap(tree, path), path, t('ids.do.unwrap', { op: part.op }), { destructive: true })
  }
  /** Start over from `sequence` as one step, which can be undone. @param {string} sequence */
  function open(sequence) {
    const found = parse(sequence, { open: true })
    if (found.problem) { note = t(`ids.problem.${found.problem}`); return }
    apply(found.tree, null, sequence ? t('ids.do.open', { sequence }) : t('ids.do.clearAll'), { destructive: tree !== null })
  }
  /** Choose the part at `path`, or none; choosing the chosen part again lets it go. @param {Path | null} path @param {{ toggle?: boolean }} [how] */
  function choose(path, { toggle = true } = {}) {
    caret = null
    selectionVersion++
    chosen = path && toggle && samePath(chosen, path) ? null : path
    note = ''
    const part = chosen ? partAt(tree, chosen) : undefined
    piece = text(part)
    if (typeof part === 'string') lookup.read(lookupChar(part))
  }

  /** The field, read as it is typed: ASCII operator names become operators where the caret is. @param {HTMLInputElement} field */
  function edit(field) {
    const typedText = field.value, caret = field.selectionStart ?? typedText.length
    const written = unalias(typedText)
    if (written !== typedText) {
      const at = [...unalias(typedText.slice(0, caret))].length
      field.value = written
      const offset = [...written].slice(0, at).join('').length
      field.setSelectionRange(offset, offset)
    }
    draft = written
    const found = parse(written, { open: true })
    if (found.problem) { sync(); return }
    typing = true
    apply(found.tree, null, t('ids.do.type', { text: written || '∅' }))
    typing = false
  }
  /** Leaving the field: what it holds is written back as the tree has it. */
  function settle() {
    run = false
    if (!typed.problem && tree !== null) { draft = write(tree); sync() }
  }
  /** The part field: what it holds goes in the chosen slot, and the choice moves on to the next empty one. */
  function enter() {
    const typedText = unalias(piece.trim())
    if (!typedText) return false
    return take(typedText)
  }

  /** @param {Path} path */
  const pathKey = path => path.join('.')
  /** Move the focus to the chosen part's button within `root`. @param {HTMLElement | null | undefined} root */
  async function focusChosen(root) {
    await tick()
    const at = chosen
    if (at) /** @type {HTMLElement | null | undefined} */ (root?.querySelector(`[data-path="${pathKey(at)}"]`))?.focus()
  }

  /**
   * Keys while the focus is outside a text field within `root` (see `commandFor`). A key the editor
   * takes is its own: it is marked taken, so the page's own shortcuts leave it alone. `slot` is the
   * part field a typed character goes to.
   * @param {KeyboardEvent} event @param {{ root?: HTMLElement | null, slot?: HTMLInputElement | null }} [where]
   */
  function keydown(event, { root = null, slot = null } = {}) {
    if (disabled()) return
    const el = /** @type {HTMLElement} */ (event.target)
    if (el.closest?.('input, textarea, select, [contenteditable="true"], dialog, [role="menu"]')) return
    const command = commandFor(event)
    if (!command) return
    const inPicker = Boolean(el.closest?.('.ids-pick-tabs, .ids-pick-panel'))
    if (command.command === 'undo' || command.command === 'redo') {
      event.preventDefault()
      if (command.command === 'undo') undo(); else redo()
      if (!inPicker) focusChosen(root)
      return
    }
    // Any other key a picker handles, or pressed inside one (its tabs, its grid, its tree), is the picker's own.
    if (event.defaultPrevented || inPicker) return
    if (command.command === 'operator') { event.preventDefault(); operator(command.op); focusChosen(root); return }
    if ((command.command === 'next' || command.command === 'previous') && el.closest('.ids-tree') && tree !== null) {
      const from = /** @type {HTMLElement | null} */ (el.closest('[data-path]'))?.dataset.path
      const all = paths(tree), at = all.findIndex(path => from !== undefined ? pathKey(path) === from : samePath(path, chosen))
      const next = at + (command.command === 'previous' ? -1 : 1)
      if (next < 0 || next >= all.length) return
      event.preventDefault()
      choose(all[next], { toggle: false })
      focusChosen(root)
      return
    }
    if (command.command === 'clear' && el.closest('.ids-tree, .ids-operators')) { event.preventDefault(); empty(target()); focusChosen(root); return }
    // Any other character typed on the tree goes to the part field.
    if (command.command === 'type' && slot && el.closest('.ids-tree')) {
      event.preventDefault(); slot.focus(); piece = event.key
      tick().then(() => slot.setSelectionRange(piece.length, piece.length))
    }
  }

  return {
    /** @param {Path | null} path */
    hover(path) { hovered = disabled() ? null : path },
    /** @param {Path} path */
    isTinted(path) {
      const mode = options().tintMode ?? 'hover'
      return mode === 'on' || (mode === 'hover' && hovered !== null && hovered.every((n, i) => path[i] === n))
    },
    /** @param {Path} path */
    isHovered(path) { return hovered !== null && hovered.every((n, i) => path[i] === n) },
    get selectionVersion() { return selectionVersion },
    get selectionRange() { return caret !== null ? { start: caret, end: caret } : chosen === null ? null : tokens(draft).find(token => samePath(token.path, chosen)) ?? null },
    /** @param {number} start @param {number} end */
    selectText(start, end) {
      caret = start === end ? start : null
      const token = rangeToken(tokens(draft), start, end)
      chosen = token?.path ?? null
      piece = text(chosen ? partAt(tree, chosen) : undefined)
      if (typeof picked === 'string') lookup.read(lookupChar(picked))
    },
    /** @param {Path} path */
    isSelected(path) { return chosen !== null && chosen.every((n, i) => path[i] === n) },
    get tree() { return tree },
    get chosen() { return chosen },
    get draft() { return draft },
    get piece() { return piece },
    set piece(value) { piece = value },
    get note() { return note },
    get problem() { return problem },
    get pending() { return pending },
    get whole() { return whole },
    get usable() { return usable },
    get picked() { return picked },
    get splits() { return splits },
    get swaps() { return swaps },
    get change() { return change },
    get steps() { return steps },
    get canUndo() { return steps.done.length > 0 },
    get canRedo() { return steps.undone.length > 0 },
    get disabled() { return disabled() },
    get adapter() { return options().adapter },
    get messages() { return options().messages },
    get locale() { return options().locale ?? 'en' },
    get t() { return t },
    lookup, name, text, pathKey,
    reset, operator, put, take, empty, remove, open, choose, edit, settle, enter, undo, redo, keydown, focusChosen, snapshot, restore,
    /** Jump `n` steps back (negative) or forward through the history. @param {number} n */
    travel(n) { for (let k = 0; k < Math.abs(n); k++) if (n < 0) undo(); else redo() },
    /** Hear every change: the text and whether it is a whole description. @param {(text: string, whole: boolean) => void} listen */
    listen(listen) { listeners.push(listen); return () => { const at = listeners.indexOf(listen); if (at >= 0) listeners.splice(at, 1) } },
    /** The part at `path` written out, `⬚` for an empty slot. @param {Path} path */
    sequenceAt: (/** @type {Path} */ path) => write(partAt(tree, path) ?? null),
  }
}

/** @typedef {ReturnType<typeof createEditor>} Editor */
