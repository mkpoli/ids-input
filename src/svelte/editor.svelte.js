// @ts-check
// The state of one IDS being edited, shared by the components that show and change it (the sequence
// field, the operator palette, the tree, the part tools, the pickers, the preview), so a host can lay
// them out as it likes; `IdsInput` puts them together as one editor.
//
// The sequence is held twice, kept in step: as text in the field, which also takes the ASCII operator
// names (LR or lr for ⿰), and as a tree. The field draws an empty slot as ⬚ and the operands a node
// still misses after the typed text, their scope lines in the warning colour. One part of the tree is
// chosen at a time. Every change is a named step in the history ("Split ⬚ with ⿰",
// "Put 木"), so it can be undone and redone, a hundred steps each way; a run of typing in the field
// is one step.
import { insertAt } from './insertion.js'
import { tokens, rangeToken } from './tokens.js'
import { tick } from 'svelte'
import { applyOperator, arity, clear, entryBody, unfinishedCustom, isDescription, isMarks, isNode, nextEmpty, normalizeMarks, parse, partAt, paths, place as placed, reorderSiblings,
  replaceAt, samePath, sameTree, swapParts, unwrap, withMarks, write, writeDraft } from '../core/ids.js'
import { namingOperator, unalias } from '../core/aliases.js'
import { commandFor } from '../core/keys.js'
import { createHistory } from '../core/history.js'
import { lookupChar } from '../core/decompose.js'
import { variationBase, withVariation } from '../core/variation.js'
import { replacementQuery, resolveReplacement } from '../core/replacement.js'
import { replacementExpression, replacementInput, resolveReplacementExpression, unaliasReplacementInput } from '../core/replacement-expression.js'
import { createLookup } from './lookup.svelte.js'
import { translator } from './i18n.js'

/**
 * @typedef {import('../adapter/types.js').IdsAdapter} IdsAdapter
 * @typedef {import('../core/ids.js').Part} Part
 * @typedef {import('../core/ids.js').Path} Path
 * @typedef {'hover' | 'on' | 'off'} TintMode
 * @typedef {{ tintMode?: TintMode, adapter: IdsAdapter, messages?: Record<string, string>, locale?: string, disabled?: boolean }} EditorOptions
 * @typedef {{ id: number, label: string, destructive: boolean, undone?: boolean, reorder?: { from: Path, to: Path }, swap?: { from: Path, to: Path } }} Change
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
  let revision = $state(0)
  let hovered = $state.raw(/** @type {Path | null} */ (null))
  let chosen = $state.raw(/** @type {Path | null} */ (null))
  /** The field's selection is the chosen node's operator alone, which an operator button replaces. */
  let lone = false
  let draft = $state(''), piece = $state(''), note = $state('')
  /** The last change, for a host to answer (an undo toast after one that throws something away). */
  let change = $state.raw(/** @type {Change | null} */ (null))
  /** @type {import('../core/history.js').History<{ tree: Part, chosen: Path | null, draft: string }>} */
  const history = createHistory(100)
  let steps = $state.raw(/** @type {{ done: string[], undone: string[] }} */ ({ done: [], undone: [] }))
  let typing = false, run = false, changes = 0
  /** @type {AbortController | null} */ let resolution = null
  const lookup = createLookup(() => options().adapter)
  /** @type {((text: string, whole: boolean) => void)[]} */
  const listeners = []

  const typed = $derived(parse(draft, { open: true }))
  const whole = $derived(write(tree))
  // A custom component still being written (&CDP-89, {5, #(一) is not yet a part: no fault is named.
  const problem = $derived(note || (!draft || !typed.problem || unfinishedCustom(draft) >= 0 ? '' : namingOperator(draft) ? t('ids.problem.naming')
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
  // The characters each description encodes, asked once, for the merge list of a chosen node.
  /** @type {Record<string, { status: 'loading', id: number } | { status: 'failed' } | { status: 'ready', chars: string[] }>} */
  let described = $state.raw({})
  /** The `encoded` answer the cache belongs to, null when the adapter has none. */
  let describer = /** @type {IdsAdapter['encoded'] | null} */ (null)
  let mergeRequests = 0
  /**
   * Whether the answer to request `id` still owns `sequence`. An answer a newer request replaced is
   * ignored; one the adapter moved on from is dropped, so another adapter can ask again.
   * @param {string} sequence @param {IdsAdapter['encoded']} ask @param {number} id
   */
  function ownsDescribed(sequence, ask, id) {
    const known = described[sequence]
    if (known?.status !== 'loading' || known.id !== id) return false
    if (options().adapter.encoded === ask) return true
    const next = { ...described }
    delete next[sequence]
    described = next
    return false
  }
  /** @param {Path | null} select */
  function readDescribed(select) {
    const ask = options().adapter.encoded ?? null
    if (describer !== ask) { describer = ask; described = {} }
    if (!select || !ask) return
    const part = partAt(tree, select)
    if (!isNode(part) || nextEmpty(part)) return
    const sequence = write(part), known = described[sequence]
    // A failure is tried again the next time the node is selected.
    if (known?.status === 'loading' || known?.status === 'ready') return
    const id = ++mergeRequests
    described = { ...described, [sequence]: { status: 'loading', id } }
    // An operator modifier narrows the description to one character; its modifier-free reading is
    // a different character (⿻[1:]丨日 is 甲 where ⿻丨日 is 申).
    ask(sequence, { exact: true }).then(chars => {
      if (!ownsDescribed(sequence, ask, id)) return
      described = { ...described, [sequence]: { status: 'ready', chars: [...new Set(chars)].filter(char => char !== sequence && [...char].length === 1) } }
    }, () => {
      if (!ownsDescribed(sequence, ask, id)) return
      described = { ...described, [sequence]: { status: 'failed' } }
    })
  }

  function sync() {
    steps = history.steps()
    const done = draft
    const ok = isNode(tree) && !nextEmpty(tree) && !parse(done, { open: true }).problem && isDescription(write(tree))
    for (const listen of listeners) listen(done, ok)
  }
  /** Resolve complete zi.tools replacement input without overwriting a later edit.
   * @param {string} input */
  function resolveInput(input) {
    const query = replacementQuery(input)
    const expression = query ? null : replacementExpression(input)
    if ((!query && !expression) || disabled()) return
    cancelResolution()
    const controller = new AbortController()
    resolution = controller
    const ticket = revision, adapter = options().adapter
    const structure = (/** @type {string} */ char) => adapter.structure(char, { signal: controller.signal })
    const request = query ? resolveReplacement(query, structure, { signal: controller.signal })
      : resolveReplacementExpression(/** @type {import('../core/replacement-expression.js').Expression} */ (expression), structure, { signal: controller.signal })
    request.then(result => {
      if (result === null || revision !== ticket || draft !== input || disabled() || options().adapter !== adapter) return
      apply(result, null, t('ids.do.type', { text: write(result) }))
    }).catch(() => { /* Leave the original input in place if the data cannot be read. */ })
      .finally(() => { if (resolution === controller) resolution = null })
  }
  /** Resolve a pasted zi.tools description that carries a stroke chain this package cannot draw,
   * when the host's adapter names the character it describes. The text stays if it names none.
   * @param {string} input */
  function resolveChain(input) {
    const adapter = options().adapter
    if (!adapter?.chainCharacter || disabled()) return
    cancelResolution()
    const controller = new AbortController()
    resolution = controller
    const ticket = revision
    adapter.chainCharacter(input, { signal: controller.signal }).then(char => {
      if (!char || controller.signal.aborted || revision !== ticket || draft !== input || disabled() || options().adapter !== adapter) return
      apply(char, null, t('ids.do.resolve', { char }))
    }).catch(() => { /* Leave the text in place if the table cannot be read. */ })
      .finally(() => { if (resolution === controller) resolution = null })
  }
  function cancelResolution() { resolution?.abort(); resolution = null }
  function invalidateResolution() { revision++; cancelResolution() }
  /** Start again from `text` (a description, or nothing), forgetting the history. @param {string} start */
  function reset(start) {
    invalidateResolution()
    history.clear(); caret = null; hovered = null; note = ''; change = null; typing = false; run = false
    const read = parse(start, { open: true })
    tree = read.tree ?? null; chosen = null; lone = false; piece = ''
    // The text stays as given, so the slots a reader wrote stay written; a pasted ＋ for an empty
    // slot is written back as ⬚.
    draft = start.replaceAll('＋', '⬚')
    sync()
  }
  /** @param {Part} next @param {Path | null} select @param {string} [written] */
  function commit(next, select, written) {
    invalidateResolution()
    caret = null
    hovered = null
    tree = next; chosen = select; lone = false; selectionVersion++; note = ''
    // An empty tree is an empty field, not an empty slot (⬚); a slot is written inside a node.
    // A draft the tree cannot read yet (it is not a description) is put back as it was typed.
    if (!typing) draft = written ?? (next === null ? '' : writeDraft(next))
    const part = select ? partAt(next, select) : undefined
    piece = text(part)
    if (typeof part === 'string') lookup.read(lookupChar(part))
    readDescribed(select)
    sync()
  }
  /**
   * A change to the tree, named for the history; a run of typing in the field is one step. `from` is
   * the state to put back: this one, or the text a caller is about to replace (see `edit`).
   * @param {Part} next @param {Path | null} select @param {string} label @param {{ destructive?: boolean, reorder?: { from: Path, to: Path }, swap?: { from: Path, to: Path } }} [how]
   * @param {{ tree: Part, chosen: Path | null, draft: string }} [from]
   */
  function apply(next, select, label, { destructive = false, reorder, swap } = {}, from = { tree, chosen, draft }) {
    // A description's text can only carry marks at its end; keep them there.
    next = normalizeMarks(next)
    const valid = parse(write(next), { open: true })
    if (valid.problem) { note = t(`ids.problem.${valid.problem}`); return false }
    if (!sameTree(valid.tree, next)) { note = t('ids.problem.unwritable'); return false }
    history.record(from, { merge: typing && run, label })
    run = typing
    change = { id: ++changes, label, destructive, ...(reorder ? { reorder } : {}), ...(swap ? { swap } : {}) }
    commit(next, select)
    return true
  }
  function undo() {
    run = false
    const label = history.undoLabel(), last = history.undo({ tree, chosen, draft })
    if (!last) return
    change = { id: ++changes, label: label ?? '', destructive: false, undone: true }
    commit(last.tree, last.chosen, last.draft)
  }
  function redo() {
    run = false
    const label = history.redoLabel(), last = history.redo({ tree, chosen, draft })
    if (!last) return
    change = { id: ++changes, label: label ?? '', destructive: false }
    commit(last.tree, last.chosen, last.draft)
  }

  /**
   * The editor's state, to put back later with `restore`: the tree, the chosen part, the text in the
   * field, the part field and the history.
   * @returns {{ tree: Part, chosen: Path | null, draft: string, piece: string, history: import('../core/history.js').HistoryState<{ tree: Part, chosen: Path | null, draft: string }> }}
   */
  function snapshot() {
    return { tree, chosen, draft, piece, history: history.snapshot() }
  }
  /** Put back a state from `snapshot`, as when a host switches between documents. @param {ReturnType<typeof snapshot>} state */
  function restore(state) {
    invalidateResolution()
    caret = null
    hovered = null
    history.restore(state.history)
    tree = state.tree ?? null; chosen = state.chosen ?? null; lone = false; draft = state.draft; piece = state.piece
    note = ''; typing = false; run = false; change = null
    const part = chosen ? partAt(tree, chosen) : undefined
    if (typeof part === 'string') lookup.read(lookupChar(part))
    else readDescribed(chosen)
    sync()
  }

  // Where a part goes when nothing is chosen: the first empty slot.
  const target = () => chosen ?? (tree === null ? [] : nextEmpty(tree))
  /** @param {Part} part @param {string} [op] @param {string} [label] */
  function insert(part, op, label) {
    if (disabled() || caret === null || typed.problem) return false
    const next = insertAt(tree, draft, caret, part, op)
    const valid = parse(write(next.tree), {open:true})
    if (valid.problem) { note = t(`ids.problem.${valid.problem}`); return false }
    const change = op ? t('ids.do.split', { part: '⬚', op }) : t('ids.do.put', { part: text(part) })
    const gap = !op && isNode(part) ? nextEmpty(part) : null
    const applied = apply(next.tree, next.operator ? next.path : gap ? [...next.path, ...gap] : null, label ?? change)
    if (applied && !next.operator && !gap) {
      const token = tokens(draft).find(token => samePath(token.path, next.path))
      caret = token?.end ?? draft.length
    }
    return applied
  }
  /** An operator on the chosen part, or around the whole tree when nothing is chosen. A draft the
   * tree cannot read yet holds the parts themselves, so the operator goes in front of them (口匕 with
   * ⿰ becomes ⿰口匕), in place of the empty slots the stale tree would have shown. Refuses when the
   * parts do not fill the operator, and leaves the draft as typed. With an operator alone selected in
   * the field, it replaces that operator even where parts have to go, and stays selected.
   * @param {string} op @param {Path | null} [at] */
  function operator(op, at) {
    if (at === undefined && caret !== null && !typed.problem) { insert(null, op); return }
    if (disabled()) return
    if (at === undefined && typed.problem) {
      const rescued = op + draft
      const found = parse(rescued, { open: true })
      if (found.problem) { note = t('ids.problem.draft'); return }
      const applied = apply(found.tree, null, t('ids.do.type', { text: rescued }))
      if (applied) caret = op.length
      return
    }
    const replace = at === undefined && lone
    at = at === undefined ? tree === null ? [] : chosen : at
    const before = at ? partAt(tree, at) : tree
    const done = applyOperator(tree, at, op, { drop: replace })
    if (done.problem) { note = t(`ids.problem.${done.problem}`, { name: name(op) }); return }
    const label = at === null && tree !== null ? t('ids.do.wrap', { op }) : isNode(before) ? t('ids.do.swap', { from: before.op, op }) : t('ids.do.split', { part: text(before) || '⬚', op })
    const dropped = isNode(before) && before.parts.slice(arity(op)).some(part => part !== null)
    if (apply(done.tree, done.chosen, label, { destructive: dropped }) && replace) lone = true
  }
  /** `part` in the chosen slot (or the first empty one), or at `at`; false when it could not go there.
   * @param {Part} part @param {Path | null} [at] @param {string} [label] */
  function put(part, at, label) {
    if (at === undefined && caret !== null && !typed.problem) return insert(part, undefined, label)
    // An implicit or root placement has no part to replace while the field holds text the tree
    // cannot read: keep that text, as `take` and the operator path do.
    if ((at === undefined || at === null || at.length === 0) && typed.problem && draft) { note = t('ids.problem.draft'); return false }
    at = at === undefined ? target() : at
    if (disabled()) return false
    if (!at) { note = t('ids.chooseFirst'); return false }
    const before = partAt(tree, at)
    const next = placed(tree, at, part)
    return apply(next.tree, next.chosen, label ?? (before === null || before === undefined ? t('ids.do.put', { part: text(part) })
      : t('ids.do.replace', { from: text(before), part: text(part) })), { destructive: isNode(before) })
  }
  /**
   * Replace the node at `at` (the chosen node by default) with `char`, one of the characters
   * `merges` lists for it. False where that part is not a node or the adapter has not named `char`
   * among the characters it encodes.
   * @param {string} char @param {Path | null} [at]
   */
  function merge(char, at) {
    if (disabled() || !char) return false
    const path = at === undefined ? chosen : at
    if (!path) return false
    const part = partAt(tree, path)
    if (!isNode(part)) return false
    const known = described[write(part)]
    if (describer !== (options().adapter.encoded ?? null) || known?.status !== 'ready' || !known.chars.includes(char)) return false
    return apply(replaceAt(tree, path, char), path, t('ids.do.merge', { part: write(part), char }), { destructive: true })
  }
  /**
   * Write the component at `at` (the chosen one by default) as `sequence`: its character, or one
   * of its variation sequences. Its marks stay, and it stays chosen. False where that part is not a
   * component of that character.
   * @param {string} sequence @param {Path | null} [at]
   */
  function vary(sequence, at) {
    if (disabled()) return false
    const path = at === undefined ? chosen : at
    if (!path) return false
    const part = partAt(tree, path)
    if (typeof part !== 'string' || variationBase(part) === null || variationBase(part) !== variationBase(sequence)) return false
    const next = withVariation(part, sequence)
    if (next === part) return false
    return apply(replaceAt(tree, path, next), path, t('ids.do.replace', { from: text(part), part: text(next) }))
  }
  /**
   * A part or a node as written (a palette part, a part taken from a tree, a sequence), put in place.
   * With `loose`, a run of marks annotates the whole description instead of filling a slot. False
   * when the part could not be put anywhere, so a picker can keep what the reader was holding.
   * @param {string} written @param {Path | null} [at] @param {{ loose?: boolean }} [how]
   */
  function take(written, at, { loose = false } = {}) {
    // With text in the field that names no tree yet, a part has no place to go: say so instead of
    // replacing that text with a tree built from the last draft the editor could read.
    if (at === undefined && typed.problem && draft) { note = t('ids.problem.draft'); return false }
    if (at === undefined) {
      const marks = unalias(written)
      if (loose && isMarks(marks)) {
        if (tree === null) {
          const read = parse(marks, { open: true })
          if (read.problem || read.tree === undefined) return false
          return apply(read.tree, [], t('ids.do.put', { part: marks }))
        }
        return apply(withMarks(tree, marks), chosen, t('ids.do.put', { part: marks }))
      }
    }
    const found = parse(unalias(written), { open: true })
    if (found.problem) { note = t(`ids.problem.${found.problem}`); return false }
    if (found.tree === null) return false
    return put(found.tree, at)
  }
  /** Move one sibling to another sibling's position. @param {Path} from @param {Path} to */
  function reorder(from, to) {
    if (disabled()) return
    const next = reorderSiblings(tree, from, to)
    if (next !== tree) apply(next, to, t('ids.do.reorder'), { reorder: { from, to } })
  }
  /** Exchange the part at `from` with the part at `to`. @param {Path} from @param {Path} to */
  function swap(from, to) {
    if (disabled()) return
    const next = swapParts(tree, from, to)
    if (next !== tree) apply(next, to, t('ids.do.exchange', { from: text(partAt(tree, from)) || t('ids.empty'), to: text(partAt(tree, to)) || t('ids.empty') }), { swap: { from, to } })
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
    lone = false
    note = ''
    const part = chosen ? partAt(tree, chosen) : undefined
    piece = text(part)
    if (typeof part === 'string') lookup.read(lookupChar(part))
    else readDescribed(chosen)
  }

  /** The field, read as it is typed: ASCII operator names become operators where the caret is. @param {HTMLInputElement} field */
  function edit(field) {
    const typedText = field.value, caret = field.selectionStart ?? typedText.length
    // RP's operands may themselves be Latin letters; do not turn an operand into an IDC alias.
    const aliased = replacementInput(typedText) ? unaliasReplacementInput(typedText) : unalias(typedText)
    if (aliased !== typedText) {
      const at = [...(replacementInput(typedText) ? unaliasReplacementInput(typedText.slice(0, caret)) : unalias(typedText.slice(0, caret)))].length
      field.value = aliased
      const offset = [...aliased].slice(0, at).join('').length
      field.setSelectionRange(offset, offset)
    }
    // A zi.tools entry's notes say which glyph its description is for; the field keeps the description,
    // so the tokens a caret names stay the ones the tree has.
    const entry = entryBody(aliased)
    const written = entry.text && entry.text !== aliased && !parse(entry.text, { open: true }).problem ? entry.text : aliased
    if (written !== aliased) {
      const map = (/** @type {number} */ at) => Math.max(0, Math.min(written.length, at - entry.start))
      const from = field.selectionStart ?? aliased.length
      field.value = written
      field.setSelectionRange(map(from), map(field.selectionEnd ?? from))
    }
    if (draft !== written) invalidateResolution()
    // The step keeps what the field held before this input, including text the tree cannot read
    // yet, so Undo gives the previous draft back rather than the last tree it managed to read.
    const from = { tree, chosen, draft }
    draft = written
    const found = parse(written, { open: true })
    if (found.problem) { sync(); return }
    typing = true
    apply(found.tree, null, t('ids.do.type', { text: written || '∅' }), {}, from)
    typing = false
  }
  /** Leaving the field: what it holds stays, apart from a pasted ＋ becoming ⬚. */
  function settle() {
    run = false
    if (draft.includes('＋')) { draft = draft.replaceAll('＋', '⬚'); sync() }
  }
  /** The part field: what it holds goes in the chosen slot, and the choice moves on to the next empty one. */
  function enter() {
    const typedText = unalias(piece.trim())
    if (!typedText) return false
    return take(typedText)
  }

  /** @param {Path} path */
  const pathKey = path => path.join('.')
  /** Move the focus to the chosen part's focusable control within `root`. @param {HTMLElement | null | undefined} root */
  async function focusChosen(root) {
    await tick()
    const at = chosen
    if (at) /** @type {HTMLElement | null | undefined} */ (root?.querySelector(`[data-path="${pathKey(at)}"]:is(button,[tabindex])`))?.focus()
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
    if (el.closest?.('input, textarea, select, [contenteditable="true"], dialog, [role="menu"], .inline-edit')) return
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
    if ((command.command === 'clear' || command.command === 'empty') && el.closest('.ids-tree, .ids-operators')) { event.preventDefault(); empty(target()); focusChosen(root); return }
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
    get revision() { return revision },
    get selectionVersion() { return selectionVersion },
    get selectionRange() {
      if (caret !== null) return { start: caret, end: caret }
      const token = chosen === null ? undefined : tokens(draft).find(token => samePath(token.path, chosen))
      return !token ? null : lone ? { start: token.start, end: token.tokenEnd } : token
    },
    /** @param {number} start @param {number} end */
    selectText(start, end) {
      caret = start === end ? start : null
      const token = rangeToken(tokens(draft), start, end)
      chosen = token?.path ?? null
      const node = chosen ? partAt(tree, chosen) : undefined
      lone = isNode(node) && token?.start === start && (end === token.tokenEnd || end === start + node.op.length)
      piece = text(chosen ? partAt(tree, chosen) : undefined)
      if (typeof picked === 'string') lookup.read(lookupChar(picked))
      else readDescribed(chosen)
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
    /** The characters the chosen node encodes, once the adapter has answered; none for a component. */
    get merges() {
      if (!isNode(picked)) return []
      const known = described[write(picked)]
      return describer === (options().adapter.encoded ?? null) && known?.status === 'ready' ? known.chars : []
    },
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
    reset, operator, put, merge, vary, take, reorder, swap, empty, remove, open, choose, edit, settle, enter, undo, redo, keydown, focusChosen, snapshot, restore,
    resolveChain,
    resolveInput, cancelResolution,
    /** Jump `n` steps back (negative) or forward through the history. @param {number} n */
    travel(n) { for (let k = 0; k < Math.abs(n); k++) if (n < 0) undo(); else redo() },
    /** Hear every change: the text and whether it is a whole description. @param {(text: string, whole: boolean) => void} listen */
    listen(listen) { listeners.push(listen); return () => { const at = listeners.indexOf(listen); if (at >= 0) listeners.splice(at, 1) } },
    /** The part at `path` written out, `⬚` for an empty slot. @param {Path} path */
    sequenceAt: (/** @type {Path} */ path) => write(partAt(tree, path) ?? null),
  }
}

/** @typedef {ReturnType<typeof createEditor>} Editor */
