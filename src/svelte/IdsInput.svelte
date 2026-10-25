<script>
  // An ideographic description sequence typed or built as a tree. It starts from `value`, or else
  // from the first description of `char`, and hands the sequence to `onuse` once it is whole.
  //
  // The sequence is held twice, kept in step: as text in the field, which also takes the ASCII
  // operator names (LR or lr for ⿰), and as a tree of boxes laid out as the operators place their
  // parts, where an empty slot shows (and is written) as ＋. A sequence with an empty slot is not
  // whole; ？ typed into a slot is the part no character names. One part of the tree is chosen at a
  // time. An operator put on a slot splits it, the slot's part first (⿰ on 失 gives ⿰失＋); put on an
  // operator, it takes that operator's place and keeps its parts. × takes one level away, keeping its
  // first filled part. A component found, typed into the part field or offered as a swap replaces the
  // chosen part, and a component with a description of its own can be split into it (𠤕 into ⿱匕矢).
  // The part picker under the tree has up to three tabs: components found by the adapter's search,
  // the parts palette (IdsParts), and the parts of any character or description typed (IdsFrom).
  // Every change can be undone, a hundred steps back.
  import { tick, untrack } from 'svelte'
  import IdsFrom from './IdsFrom.svelte'
  import IdsParts from './IdsParts.svelte'
  import { OPERATORS, applyOperator, arity, clear, isDescription, isNode, isSequence, nextEmpty, parse, partAt, paths,
    place as placed, samePath, unwrap, write } from '../core/ids.js'
  import { namingOperator, unalias } from '../core/aliases.js'
  import { KEY_OF, commandFor } from '../core/keys.js'
  import { createHistory } from '../core/history.js'
  import { lookupChar } from '../core/decompose.js'
  import { createLookup } from './lookup.svelte.js'
  import { translator } from './i18n.js'
  import OperatorIcon from './OperatorIcon.svelte'

  /**
   * @typedef {import('../adapter/types.js').IdsAdapter} IdsAdapter
   * @typedef {import('../core/ids.js').Part} Part
   * @typedef {import('../core/ids.js').Path} Path
   */

  /** @type {{ adapter: IdsAdapter, value?: string, char?: string, disabled?: boolean, messages?: Record<string, string>, locale?: string,
   *   pickers?: ('find' | 'parts' | 'from')[], recentKey?: string | null, onuse?: (sequence: string) => void,
   *   onchange?: (text: string, whole: boolean) => void, preview?: import('svelte').Snippet<[string, boolean]> }} */
  let { adapter, value = $bindable(''), char = '', disabled = false, messages, locale = 'en', pickers = ['find', 'parts', 'from'],
    recentKey = 'ids-input.recentParts', onuse, onchange, preview } = $props()

  const t = $derived(translator(messages, locale))
  const NAMES = {
    '⿰': 'leftRight', '⿱': 'aboveBelow', '⿲': 'leftMiddleRight', '⿳': 'aboveMiddleBelow', '⿴': 'surround',
    '⿵': 'fromAbove', '⿶': 'fromBelow', '⿷': 'fromLeft', '⿸': 'fromUpperLeft', '⿹': 'fromUpperRight',
    '⿺': 'fromLowerLeft', '⿻': 'overlaid', '⿼': 'fromRight', '⿽': 'fromLowerRight', '⿾': 'mirrored',
    '⿿': 'rotated', '㇯': 'subtracted', '〾': 'variant',
  }
  /** @param {string} op */
  const name = op => t(`ids.op.${NAMES[/** @type {keyof NAMES} */ (op)]}`)
  // How the box tree lays a node's parts out: in a row, in a column, the second inside the first, or
  // one over the other.
  /** @type {Record<string, string>} */
  const LAYOUT = { '⿰': 'row', '⿲': 'row', '⿱': 'column', '⿳': 'column', '⿻': 'stack', '㇯': 'stack', '⿾': 'stack', '⿿': 'stack', '〾': 'stack' }
  /** @param {string} op */
  const layout = op => LAYOUT[op] ?? 'enclosure'

  /** @type {Part} */
  let tree = $state.raw(null)
  /** @type {Path | null} */
  let chosen = $state.raw(null)
  let draft = $state(''), piece = $state(''), note = $state('')
  /** @type {HTMLInputElement | null} */ let field = $state(null)
  /** @type {HTMLInputElement | null} */ let slot = $state(null)
  /** @type {HTMLElement | null} */ let root = $state(null)
  /** @type {import('../core/history.js').History<{ tree: Part, chosen: Path | null }>} */
  const history = createHistory(100)
  let canUndo = $state(false), canRedo = $state(false)
  let typing = false, run = false
  const lookup = createLookup(() => adapter)

  // Each `char` starts again: from `value` when it is a description, or else from the character's
  // own first description. A `value` set from outside starts again from it.
  let seenValue = ''
  $effect(() => {
    const of = char
    untrack(() => {
      const typed = isSequence(value) ? value : ''
      history.clear(); note = ''
      reset(typed)
      if (!typed && of) lookup.read(of).then(found => {
        const first = found?.status === 'ready' ? found.sequences.find(s => !parse(s.text, { open: true }).problem) : undefined
        if (!draft && first) reset(first.text)
      })
    })
  })
  $effect(() => {
    const given = value
    untrack(() => { if (given !== seenValue && given !== draft) { history.clear(); reset(isSequence(given) ? given : '') } })
  })
  /** @param {string} text */
  function reset(text) {
    draft = text; chosen = null; piece = ''
    tree = parse(text, { open: true }).tree ?? null
    sync()
  }
  function sync() {
    canUndo = history.canUndo(); canRedo = history.canRedo()
    const text = draft
    seenValue = text
    value = text
    onchange?.(text, usableNow())
  }

  const whole = $derived(write(tree))
  // What is wrong with the text as typed, once there is some; a name half typed (the L of LR) is
  // asked to be finished.
  const typed = $derived(parse(draft, { open: true }))
  const problem = $derived(note || (!draft || !typed.problem ? '' : namingOperator(draft) ? t('ids.problem.naming')
    : t(`ids.problem.${typed.problem}`)))
  // The first slot still empty, named by its place: a sequence is whole only once there is none.
  const gap = $derived(isNode(tree) ? nextEmpty(tree) : null)
  const pending = $derived.by(() => {
    if (!gap) return ''
    const parent = partAt(tree, gap.slice(0, -1))
    return isNode(parent) ? t('ids.problem.empty', { n: /** @type {number} */ (gap.at(-1)) + 1, name: name(parent.op) }) : ''
  })
  const usableNow = () => isNode(tree) && !nextEmpty(tree) && !parse(draft, { open: true }).problem && isDescription(write(tree))
  const usable = $derived(isNode(tree) && !gap && !typed.problem && isDescription(whole))
  const picked = $derived(chosen ? partAt(tree, chosen) : undefined)
  /** @param {Part | undefined} part */
  const text = part => part === null || part === undefined ? '' : write(part)

  // A change to the tree, kept for undoing, a run of typing in the field as one; the field shows it
  // unless the reader is typing there.
  /** @param {Part} next @param {Path | null} select */
  function change(next, select) {
    history.record({ tree, chosen }, { merge: typing && run })
    run = typing
    commit(next, select)
  }
  /** @param {Part} next @param {Path | null} select */
  function commit(next, select) {
    tree = next; chosen = select; note = ''
    if (!typing) draft = write(next)
    const part = select ? partAt(next, select) : undefined
    piece = text(part)
    if (typeof part === 'string') lookup.read(lookupChar(part))
    sync()
  }
  function undo() { run = false; const last = history.undo({ tree, chosen }); if (last) commit(last.tree, last.chosen) }
  function redo() { run = false; const last = history.redo({ tree, chosen }); if (last) commit(last.tree, last.chosen) }

  // The field, read as it is typed: ASCII operator names become operators where the caret is.
  /** @param {Event} [event] */
  function edit(event) {
    if (/** @type {InputEvent | undefined} */ (event)?.isComposing || !field) return
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
    change(found.tree, null)
    typing = false
  }

  // Where an operator or a part goes when nothing is chosen: the first empty slot.
  const target = () => chosen ?? (tree === null ? [] : nextEmpty(tree))
  /** @param {string} op */
  function operator(op) {
    if (disabled) return
    const done = applyOperator(tree, target(), op)
    if (done.problem) note = t(`ids.problem.${done.problem}`, { name: name(op) })
    else change(done.tree, done.chosen)
  }
  /** @param {Part} part */
  function place(part) {
    const at = target()
    if (!at) { note = t('ids.chooseFirst'); return }
    const next = placed(tree, at, part)
    change(next.tree, next.chosen)
  }
  /** @param {string} char */
  function component(char) { if (!disabled) place(char) }
  /** @param {string} char */
  function swap(char) { place(parse(char).tree ?? char) }
  /** @param {string} sequence */
  function split(sequence) { const found = parse(sequence, { open: true }); if (!found.problem) place(found.tree) }
  // A part or a node taken from the parts palette or the "Take parts from" tree, as written.
  /** @param {string} written */
  function take(written) { const found = parse(written, { open: true }); if (!disabled && !found.problem && found.tree !== null) place(found.tree) }
  // The descriptions a component can be split into, those the editor can read.
  const splits = $derived.by(() => {
    if (typeof picked !== 'string') return []
    const entry = lookup.known[lookupChar(picked)]
    return entry?.status === 'ready' ? entry.sequences.map(s => s.text).filter(sequence => !parse(sequence, { open: true }).problem) : []
  })
  const swapsHere = $derived(typeof picked === 'string' ? lookup.swaps[lookupChar(picked)] ?? [] : [])
  /** @param {Path} path */
  function choose(path) {
    chosen = samePath(chosen, path) ? null : path
    note = ''
    const part = chosen ? partAt(tree, chosen) : undefined
    piece = text(part)
    if (typeof part === 'string') lookup.read(lookupChar(part))
  }
  /** @param {Path | null} path */
  function remove(path) { if (!disabled && path && isNode(partAt(tree, path))) change(unwrap(tree, path), path) }
  /** @param {Path | null} path */
  function empty(path) { if (!disabled && path && partAt(tree, path) !== null && partAt(tree, path) !== undefined) change(clear(tree, path), path) }

  // The part field: Enter puts what it holds in the chosen slot and moves on to the next empty one.
  function enter() {
    const typedText = unalias(piece.trim())
    if (!typedText) return
    const found = parse(typedText, { open: true })
    if (found.problem) { note = t(`ids.problem.${found.problem}`); return }
    place(found.tree)
    queueMicrotask(() => slot?.select())
  }

  /** @param {Path} path */
  const pathKey = path => path.join('.')
  async function focusChosen() {
    await tick()
    const at = chosen
    if (at) /** @type {HTMLElement | null | undefined} */ (root?.querySelector(`[data-path="${pathKey(at)}"]`))?.focus()
  }
  // Keys while the editor has the focus outside a text field (see `commandFor`). A key the editor
  // takes is its own: it is marked taken, so the page's own shortcuts leave it alone.
  /** @param {KeyboardEvent} event */
  function keydown(event) {
    if (disabled) return
    const el = /** @type {HTMLElement} */ (event.target)
    if (el.closest?.('input, textarea, select, [contenteditable="true"]')) return
    const command = commandFor(event)
    if (!command) return
    // Undo and redo work from anywhere in the editor; the focus stays in a picker that has it.
    const inPicker = Boolean(el.closest?.('.ids-pick-tabs, .ids-pick-panel'))
    if (command.command === 'undo' || command.command === 'redo') {
      event.preventDefault()
      if (command.command === 'undo') undo(); else redo()
      if (!inPicker) focusChosen()
      return
    }
    // Any other key a picker handles, or pressed inside one (its tabs, its grid, its tree), is the picker's own.
    if (event.defaultPrevented || inPicker) return
    if (command.command === 'operator') { event.preventDefault(); operator(command.op); focusChosen(); return }
    if ((command.command === 'next' || command.command === 'previous') && el.closest('.ids-tree') && tree !== null) {
      // From the part that has the focus, else the chosen one.
      const from = /** @type {HTMLElement | null} */ (el.closest('[data-path]'))?.dataset.path
      const all = paths(tree), at = all.findIndex(path => from !== undefined ? pathKey(path) === from : samePath(path, chosen))
      const next = at + (command.command === 'previous' ? -1 : 1)
      if (next < 0 || next >= all.length) return
      event.preventDefault()
      choose(all[next])
      focusChosen()
      return
    }
    if (command.command === 'clear') { event.preventDefault(); empty(target()); focusChosen(); return }
    // Any other character typed goes to the part field.
    if (command.command === 'type') { event.preventDefault(); slot?.focus(); piece = event.key; tick().then(() => slot?.setSelectionRange(piece.length, piece.length)) }
  }
  function use() { if (usable && !disabled) onuse?.(whole) }

  // The preview of a whole sequence, from the adapter's drawing or SVG, asked once the sequence is whole.
  /** @type {{ sequence: string, svg?: string | null, url?: string | null } | null} */
  let drawn = $state(null)
  $effect(() => {
    const sequence = usable ? whole : ''
    if (!sequence || preview || !(adapter.preview || adapter.drawing)) { drawn = null; return }
    const controller = new AbortController(), signal = controller.signal
    const asked = adapter.preview
      ? adapter.preview(sequence, { signal }).then(svg => ({ sequence, svg }))
      : /** @type {NonNullable<IdsAdapter['drawing']>} */ (adapter.drawing)(sequence, { signal }).then(url => ({ sequence, url }))
    asked.then(found => { if (!signal.aborted) drawn = found }, () => { if (!signal.aborted) drawn = null })
    return () => controller.abort()
  })

  // The part picker's tabs, those the adapter can answer. Arrow keys, Home and End move between them.
  const uid = $props.id()
  const shown = $derived(pickers.filter(tab => tab === 'find' ? Boolean(adapter.search) : tab === 'parts' ? Boolean(adapter.parts) : true))
  let picker = $state(/** @type {'find' | 'parts' | 'from' | null} */ (null))
  let opened = $state(new Set(/** @type {string[]} */ ([])))
  const current = $derived(picker && shown.includes(picker) ? picker : shown[0])
  $effect(() => { if (current && !opened.has(current)) untrack(() => { opened = new Set([...opened, current]) }) })
  /** @type {HTMLButtonElement[]} */
  let pickButtons = $state([])
  /** @param {'find' | 'parts' | 'from'} tab */
  function open(tab) { picker = tab }
  /** @param {KeyboardEvent} event @param {number} index */
  function pickKey(event, index) {
    const last = shown.length - 1
    const to = /** @type {Record<string, number>} */ ({ ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last })[event.key]
    if (to === undefined) return
    event.preventDefault()
    open(shown[to])
    pickButtons[to]?.focus()
  }

  // The find tab: components the adapter's search answers for what is typed, once the typing settles.
  let query = $state('')
  /** @type {{ status: 'idle' | 'loading' | 'ready' | 'failed', items: import('../adapter/types.js').Found[] }} */
  let found = $state({ status: 'idle', items: [] })
  $effect(() => {
    const asked = query.trim(), search = adapter.search
    if (!asked || !search) { found = { status: 'idle', items: [] }; return }
    const controller = new AbortController()
    found = { status: 'loading', items: [] }
    const timer = setTimeout(() => search(asked, { signal: controller.signal, limit: 24 }).then(
      items => { if (!controller.signal.aborted) found = { status: 'ready', items: items ?? [] } },
      () => { if (!controller.signal.aborted) found = { status: 'failed', items: [] } }), 150)
    return () => { clearTimeout(timer); controller.abort() }
  })
</script>

{#snippet box(/** @type {Part} */ part, /** @type {Path} */ path, /** @type {{ op: string, n: number } | null} */ parent)}
  {@const selected = samePath(chosen, path)}
  {#if isNode(part)}
    {@const what = parent ? t('ids.part', { part: name(part.op), n: parent.n, name: name(parent.op) }) : name(part.op)}
    <div class="ids-node {layout(part.op)}" class:chosen={selected} data-op={part.op}>
      <div class="ids-head">
        <button type="button" class="ids-op" data-path={pathKey(path)} aria-pressed={selected} {disabled}
          aria-label={t('ids.node', { name: name(part.op), sequence: write(part) })} title={`${part.op} ${name(part.op)}`}
          onclick={() => choose(path)}><OperatorIcon op={part.op} size={14} /></button>
        <button type="button" class="ids-unwrap" tabindex="-1" {disabled} aria-label={t('ids.unwrapNode', { what })} title={t('ids.unwrap')}
          onclick={() => remove(path)}>×</button>
      </div>
      <div class="ids-parts">
        {#each part.parts as inner, i (pathKey([...path, i]))}
          <div class="ids-cell" data-index={i}>{@render box(inner, [...path, i], { op: part.op, n: i + 1 })}</div>
        {/each}
      </div>
    </div>
  {:else}
    {@const label = part === null ? t('ids.empty') : part}
    <button type="button" class="ids-part" class:empty={part === null} class:chosen={selected} aria-pressed={selected}
      data-path={pathKey(path)} {disabled} title={part === null ? label : t('ids.choose', { part })}
      aria-label={parent ? t('ids.part', { part: label, n: parent.n, name: name(parent.op) }) : label}
      onclick={() => choose(path)}>{part ?? '＋'}</button>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ids-input" bind:this={root} onkeydown={keydown}>
  <div class="ids-top">
    <label class="ids-field">
      <span class="ids-title">{t('ids.label')}</span>
      <input bind:this={field} value={draft} {disabled} lang="ja" spellcheck="false" autocomplete="off"
        placeholder="⿰⿱匕失⿱コ疋" aria-invalid={Boolean(problem)} oninput={edit} oncompositionend={() => edit()}
        onblur={() => { run = false; if (!typed.problem && tree !== null) { draft = write(tree); sync() } }}
        onkeydown={event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); use() } }} />
    </label>
    {#if preview}
      <div class="ids-preview">{@render preview(whole, usable)}</div>
    {:else if drawn && drawn.sequence === whole && (drawn.svg || drawn.url)}
      <div class="ids-preview" role="img" aria-label={whole}>
        {#if drawn.svg}{@html drawn.svg}{:else}<img src={drawn.url} alt="" />{/if}
      </div>
    {/if}
  </div>
  <div class="ids-operators" role="group" aria-label={t('ids.operators')}>
    {#each OPERATORS as [op] (op)}
      <button type="button" class="ids-key" data-op={op} {disabled} aria-label={name(op)}
        title={t('ids.operatorTitle', { op, name: name(op), key: KEY_OF[op] })} onclick={() => operator(op)}><OperatorIcon {op} size={22} /></button>
    {/each}
  </div>
  <div class="ids-tree" role="group" aria-label={t('ids.structure')}>
    {@render box(tree, [], null)}
  </div>
  <div class="ids-tools">
    <label class="ids-slot">
      <span class="ids-title">{t('ids.slot')}</span>
      <input bind:this={slot} bind:value={piece} {disabled} lang="ja" spellcheck="false" autocomplete="off"
        placeholder={t('ids.slotHint')} onkeydown={event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); enter() } }} />
    </label>
    <button type="button" class="ids-clear" disabled={disabled || !chosen || picked === null} onclick={() => empty(chosen)}>{t('ids.clear')}</button>
    <button type="button" class="ids-remove" disabled={disabled || !isNode(picked)} onclick={() => remove(chosen)}>{t('ids.unwrap')}</button>
    <button type="button" class="ids-undo" disabled={disabled || !canUndo} title={t('ids.undo.title')} onclick={undo}>{t('ids.undo')}</button>
    <button type="button" class="ids-redo" disabled={disabled || !canRedo} title={t('ids.redo.title')} onclick={redo}>{t('ids.redo')}</button>
  </div>
  {#if problem}<p class="ids-problem" role="status">{problem}</p>
  {:else if pending}<p class="ids-pending" role="status">{pending}</p>{/if}
  {#if typeof picked === 'string' && (swapsHere.length || splits.length)}
    <div class="ids-swaps" role="group" aria-label={t('ids.swaps', { part: picked })}>
      <span class="ids-title">{t('ids.swaps', { part: picked })}</span>
      <div class="ids-options">
        {#each swapsHere as item (item.char)}
          <button type="button" class="ids-swap" {disabled} title={item.count ? `${picked} → ${item.char} · ${item.count}` : `${picked} → ${item.char}`} onclick={() => swap(item.char)}>{item.char}</button>
        {/each}
        {#each splits as sequence (sequence)}
          <button type="button" class="ids-swap ids-split" {disabled} title={t('ids.split', { part: picked })} onclick={() => split(sequence)}>{sequence}</button>
        {/each}
      </div>
    </div>
  {/if}
  {#if shown.length}
    <div class="ids-search">
      <span class="ids-title">{chosen && picked !== null ? t('ids.replace', { part: text(picked) }) : t('ids.insert')}</span>
      <div class="ids-pick-tabs" role="tablist" aria-label={t('ids.pick.label')}>
        {#each shown as tab, index (tab)}
          <button type="button" role="tab" id={`${uid}-pick-${tab}`} aria-controls={opened.has(tab) ? `${uid}-pick-${tab}-panel` : undefined} bind:this={pickButtons[index]}
            class:active={current === tab} aria-selected={current === tab} tabindex={current === tab ? 0 : -1}
            onclick={() => open(tab)} onkeydown={event => pickKey(event, index)}>{t(`ids.pick.${tab}`)}</button>
        {/each}
      </div>
      <!-- A picker once opened stays, hidden while another is shown, so what was typed in it is kept. -->
      {#each shown as tab (tab)}
        {#if opened.has(tab)}
          <div class="ids-pick-panel" role="tabpanel" id={`${uid}-pick-${tab}-panel`} aria-labelledby={`${uid}-pick-${tab}`} hidden={current !== tab}>
            {#if tab === 'find'}
              <div class="ids-find">
                <input type="search" bind:value={query} {disabled} lang="ja" spellcheck="false" autocomplete="off"
                  aria-label={t('ids.search')} placeholder={t('ids.find.placeholder')} />
                {#if found.status === 'loading'}<p class="ids-note">{t('ids.from.searching')}</p>
                {:else if found.status === 'failed'}<p class="ids-note fault">{t('ids.from.searchFailed')}</p>
                {:else if found.status === 'ready' && !found.items.length}<p class="ids-note">{t('parts.none')}</p>
                {:else if found.items.length}
                  <div class="ids-found">
                    {#each found.items as item (item.char)}
                      <button type="button" class="ids-hit" {disabled} lang="ja" title={item.label ? `${item.char} ${item.label}` : item.char}
                        onclick={() => { query = ''; component(item.char) }}><span class="ids-hit-char">{item.char}</span>{#if item.label}<span class="ids-hit-label">{item.label}</span>{/if}</button>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if tab === 'parts'}<IdsParts {adapter} {disabled} {messages} {locale} {recentKey} onpick={take} />
            {:else}<IdsFrom {adapter} {lookup} {disabled} {messages} {locale} ontake={take} />{/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
  <div class="ids-actions">
    <p class="ids-keys">{t('ids.keys')}</p>
    {#if onuse}<button type="button" class="ids-use" disabled={disabled || !usable} onclick={use}>{t('ids.use')}</button>{/if}
  </div>
</div>

<style>
  .ids-input{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));--_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));
    --_line-strong:var(--ids-line-strong,light-dark(#b0b0ba,#5c5c67));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_surface-selected:var(--ids-surface-selected,light-dark(#e8e8ee,#30303a));
    --_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));--_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));
    --_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Parts","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",sans-serif);
    display:flex;flex-direction:column;gap:10px;min-width:0;color:var(--_ink)}
  :where(.ids-input) :is(button,input){font:inherit;color:inherit;border:1px solid var(--_line);border-radius:6px;background:var(--_surface)}
  :where(.ids-input) button{cursor:pointer}
  :where(.ids-input) button:disabled{cursor:default;opacity:.55}
  :where(.ids-input) input{padding:6px 8px;min-width:0}
  :where(.ids-input) :is(button,input):focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-top{display:flex;gap:10px;align-items:flex-end}
  .ids-field,.ids-slot{display:flex;flex-direction:column;gap:4px}
  .ids-field{flex:1;min-width:0}
  .ids-title{font-size:11px;color:var(--_muted)}
  .ids-field input{font-size:20px;padding:6px 8px;font-family:var(--_font)}
  .ids-field input[aria-invalid="true"]{border-color:var(--_fault)}
  .ids-preview{flex:none;display:grid;place-items:center;width:52px;height:52px;border:1px solid var(--_line);border-radius:8px;background:var(--_surface);overflow:hidden}
  .ids-preview :global(svg),.ids-preview img{width:44px;height:44px}
  .ids-operators{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px}
  @media (max-width:520px){.ids-operators{grid-template-columns:repeat(6,minmax(0,1fr))}}
  .ids-key{display:grid;place-items:center;padding:5px 0;min-width:0}
  .ids-key:not(:disabled):hover{border-color:var(--_accent)}

  .ids-tree{display:grid;justify-items:center;padding:12px;border:1px solid var(--_line);border-radius:10px;background:var(--_surface-subtle);min-height:72px}
  .ids-node{position:relative;display:flex;flex-direction:column;min-width:0;padding:22px 6px 6px;
    border:1.5px dashed var(--_line-strong);border-radius:8px}
  .ids-tree > .ids-node,.ids-tree > .ids-part{width:min(100%,360px)}
  .ids-node.chosen{border-style:solid;border-color:var(--_accent);background:var(--_accent-light)}
  .ids-head{position:absolute;top:2px;left:4px;right:4px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}
  .ids-head button{pointer-events:auto}
  .ids-op{display:grid;place-items:center;padding:1px 3px;border-color:transparent;background:none}
  .ids-op:hover,.ids-op[aria-pressed="true"]{border-color:var(--_accent)}
  .ids-unwrap{padding:0 5px;font-size:13px;line-height:1.2;color:var(--_muted);border-color:transparent;background:none}
  .ids-unwrap:not(:disabled):hover{color:var(--_fault);border-color:var(--_fault)}
  .ids-parts{flex:1;display:flex;gap:6px;min-width:0}
  .ids-cell{flex:1;display:grid;min-width:0}
  .row > .ids-parts{flex-direction:row}
  .column > .ids-parts,.stack > .ids-parts{flex-direction:column}
  /* An enclosure: the first part fills the box, its glyph on the closed side, and the second sits
     inside it where the operator puts it, leaving a band of the first open around it. */
  .enclosure > .ids-parts{display:grid;gap:0;grid-template-columns:42px minmax(min-content,1fr) 42px;grid-template-rows:42px minmax(min-content,1fr) 42px}
  .enclosure > .ids-parts > .ids-cell[data-index="0"]{grid-area:1/1/4/4}
  .enclosure > .ids-parts > .ids-cell[data-index="1"]{z-index:1;margin:4px}
  .enclosure > .ids-parts > .ids-cell[data-index="1"] > .ids-part{background:var(--_surface)}
  .enclosure > .ids-parts > .ids-cell[data-index="0"] > .ids-part{font-size:24px;padding:2px 8px}
  [data-op="⿴"] > .ids-parts > [data-index="1"]{grid-area:2/2/3/3}
  [data-op="⿵"] > .ids-parts > [data-index="1"]{grid-area:2/2/4/3}
  [data-op="⿶"] > .ids-parts > [data-index="1"]{grid-area:1/2/3/3}
  [data-op="⿷"] > .ids-parts > [data-index="1"]{grid-area:2/2/3/4}
  [data-op="⿸"] > .ids-parts > [data-index="1"]{grid-area:2/2/4/4}
  [data-op="⿹"] > .ids-parts > [data-index="1"]{grid-area:2/1/4/3}
  [data-op="⿺"] > .ids-parts > [data-index="1"]{grid-area:1/2/3/4}
  [data-op="⿼"] > .ids-parts > [data-index="1"]{grid-area:2/1/3/3}
  [data-op="⿽"] > .ids-parts > [data-index="1"]{grid-area:1/1/3/3}
  [data-op="⿴"] > .ids-parts > [data-index="0"] > .ids-part,
  [data-op="⿸"] > .ids-parts > [data-index="0"] > .ids-part{place-items:start start}
  [data-op="⿵"] > .ids-parts > [data-index="0"] > .ids-part{place-items:start center}
  [data-op="⿶"] > .ids-parts > [data-index="0"] > .ids-part{place-items:end center}
  [data-op="⿷"] > .ids-parts > [data-index="0"] > .ids-part{place-items:center start}
  [data-op="⿼"] > .ids-parts > [data-index="0"] > .ids-part{place-items:center end}
  [data-op="⿹"] > .ids-parts > [data-index="0"] > .ids-part{place-items:start end}
  [data-op="⿺"] > .ids-parts > [data-index="0"] > .ids-part{place-items:end start}
  [data-op="⿽"] > .ids-parts > [data-index="0"] > .ids-part{place-items:end end}

  .ids-part{display:grid;place-items:center;min-width:44px;min-height:48px;padding:2px 6px;font-size:28px;line-height:1.1;
    font-family:var(--_font);color:var(--_ink);background:var(--_surface);border:1px solid var(--_line);border-radius:6px}
  .ids-part:not(:disabled):hover{border-color:var(--_line-strong)}
  .ids-part.empty{font-size:18px;color:var(--_muted);border-style:dashed;border-color:var(--_line-strong);background:transparent}
  .ids-part.chosen{border:2px solid var(--_accent);padding:1px 5px;background:var(--_accent-light)}

  .ids-tools{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px}
  .ids-slot{flex:1 1 180px;min-width:0}
  .ids-slot input{font-size:14px;padding:7px 8px;min-height:38px}
  .ids-slot input:not(:placeholder-shown){font-size:18px;padding:5px 8px;font-family:var(--_font)}
  .ids-tools > button{padding:5px 10px;font-size:13px}
  .ids-swaps{display:flex;flex-direction:column;gap:4px}
  .ids-options{display:flex;flex-wrap:wrap;gap:6px}
  .ids-swap{min-width:40px;padding:3px 8px;font-size:20px;line-height:1.2;font-family:var(--_font)}
  .ids-split{font-size:16px;color:var(--_muted)}
  .ids-swap:not(:disabled):hover{border-color:var(--_accent)}
  .ids-problem{margin:0;font-size:12px;color:var(--_fault)}
  .ids-pending{margin:0;font-size:12px;color:var(--_muted)}
  .ids-search{display:flex;flex-direction:column;gap:4px}
  .ids-pick-tabs{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--_line);padding-bottom:4px}
  .ids-pick-tabs button{border:0;background:transparent;font-size:12px;padding:6px 10px;border-radius:5px;color:var(--_muted)}
  .ids-pick-tabs button.active{background:var(--_surface-selected);color:var(--_ink)}
  .ids-pick-panel{min-width:0}
  .ids-pick-panel[hidden]{display:none}
  .ids-find{display:flex;flex-direction:column;gap:6px}
  .ids-find input{font-size:14px;padding:7px 8px}
  .ids-found{display:flex;flex-wrap:wrap;gap:4px}
  .ids-hit{display:flex;align-items:baseline;gap:6px;padding:2px 8px;border-color:transparent;background:var(--_surface-subtle)}
  .ids-hit:not(:disabled):hover{border-color:var(--_accent)}
  .ids-hit-char{font-size:22px;font-family:var(--_font)}
  .ids-hit-label{font-size:11px;color:var(--_muted);font-variant-numeric:tabular-nums}
  .ids-note{margin:0;font-size:11px;color:var(--_muted)}
  .ids-note.fault{color:var(--_fault)}
  .ids-actions{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .ids-keys{margin:0;font-size:11px;line-height:1.5;color:var(--_muted)}
  .ids-use{flex:none;padding:5px 14px}
  .ids-use:not(:disabled){border-color:var(--_accent);background:var(--_accent);color:var(--_surface)}
</style>
