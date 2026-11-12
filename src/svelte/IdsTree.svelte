<script>
  import { untrack } from 'svelte'
  import { tint } from './tokens.js'
  import { watchFallback } from './fallback-font.js'
  import IdsInlineEdit from './IdsInlineEdit.svelte'
  import { PART_DRAG, siblings, swappable, neighbor } from './part-drag.js'
  // The tree of `editor`'s description as boxes laid out as the operators place their parts: a row, a
  // column, the second part inside a single host, or one over the other. Compound enclosure hosts
  // get separate panels so their descendants stay visible. A click chooses a part; a double click or
  // Enter on a focused box edits it in place; a part dragged from a palette, a tree or a search is
  // put where it is dropped, and a part of the tree
  // dropped beside a sibling moves there or on any other part switches places with it; the context
  // menu (right click, the Menu key or Shift+F10) splits or swaps with any operator, clears, removes a
  // level or copies that part's sequence. An empty slot shows as ⬚. A component the preview draws
  // variation sequences of has a button that lists them, each as the preview draws it; the menu
  // lists them too.
  import { OPERATOR_GROUPS, isNode, partAt, samePath, write } from '../core/ids.js'
  import { codePoints, variationBase, variationOf, withVariation } from '../core/variation.js'
  import IdsPartIcon from './IdsPartIcon.svelte'
  import OperatorIcon from './OperatorIcon.svelte'
  import { shortcut } from './shortcut.js'
  import { nodeLayout, treeSizes } from './tree-layout.js'

  /** @typedef {import('../core/ids.js').Part} Part @typedef {import('../core/ids.js').Path} Path */
  /** @type {{ editor: import('./editor.svelte.js').Editor, keyHints?: boolean }} */
  let { editor, keyHints = true } = $props()
  const t = $derived(editor.t)

  const sizes = $derived(treeSizes(editor.tree))

  // The variation sequences the preview draws, by character, read once for each adapter that lists them.
  const listSequences = $derived(editor.adapter.variationSequences)
  let sequences = $state.raw(/** @type {Map<string, string[]>} */ (new Map()))
  $effect(() => {
    const list = listSequences
    sequences = new Map()
    if (!list) return
    let current = true
    /** @type {ReturnType<typeof setTimeout> | undefined} */ let timer
    // A read that fails is tried again, twice, a little later each time.
    const read = (/** @type {number[]} */ waits) => list().then(found => { if (current) sequences = found },
      () => { if (current && waits.length) timer = setTimeout(() => read(waits.slice(1)), waits[0]) })
    read([2000, 8000])
    return () => { current = false; clearTimeout(timer) }
  })
  /** What a component can be written as: its character, then each of its variation sequences. None where it has no sequence. @param {Part | undefined} part */
  function formsOf(part) {
    const base = variationBase(part), found = base === null ? undefined : sequences.get(base)
    return base !== null && found?.length ? [base, ...found] : []
  }
  /** Whether the component is written with a variation selector. @param {Part} part */
  const varied = part => typeof part === 'string' && variationBase(part) !== null && variationOf(part) !== variationBase(part)
  /** @param {Path} path */
  const key = path => path.join('.')

  // Dropping a part on a box: beside a sibling it moves there, on any other part the two switch places.
  // Both stay plain values, so a dragover that lands on the same box costs no render.
  let overPath = $state(/** @type {string | null} */ (null))
  let overSwap = $state(false)
  /** @param {Path} path */
  const overKind = path => overPath !== key(path) ? null : overSwap ? 'swap' : 'move'
  /** @type {{ path: Path, tree: Part } | null} */ let dragging = $state.raw(null)
  /** @param {DragEvent} event @param {Path} path */
  function startDrag(event, path) {
    if (editor.disabled || !path.length || !event.dataTransfer) return
    dragging = { path, tree: editor.tree }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(PART_DRAG, '1')
    event.stopPropagation()
  }
  function endDrag() { dragging = null; overPath = null; overSwap = false }

  /** @param {DragEvent} event @param {Path} path */
  function dragover(event, path) {
    if (editor.disabled || !event.dataTransfer) return
    if (event.dataTransfer.types.includes(PART_DRAG)) {
      if (!dragging || dragging.tree !== editor.tree) return
      const swap = !siblings(dragging.path, path)
      if (swap && !swappable(dragging.path, path)) return
      event.preventDefault(); event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'
      overPath = key(path); overSwap = swap
      return
    }
    if (!event.dataTransfer.types.includes('text/plain')) return
    event.preventDefault(); event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    overPath = key(path); overSwap = false
  }
  /** @param {DragEvent} event @param {Path} path */
  function drop(event, path) {
    overPath = null; overSwap = false
    if (event.dataTransfer?.types.includes(PART_DRAG)) {
      if (!dragging || dragging.tree !== editor.tree) return
      const from = dragging.path, move = siblings(from, path), swap = !move && swappable(from, path)
      dragging = null
      if (!move && !swap) return
      event.preventDefault(); event.stopPropagation()
      if (move) editor.reorder(from, path); else editor.swap(from, path)
      return
    }
    const given = event.dataTransfer?.getData('text/plain')?.trim()
    if (!given) return
    event.preventDefault(); event.stopPropagation()
    editor.take(given, path)
  }

  // Lifting a box with the space bar: the keyboard way to switch a part with one in another branch.
  // Space lifts the focused box, Space again on another box places it, Escape lets it go.
  /** @type {{ path: Path, tree: Part } | null} */ let carry = $state.raw(null)
  $effect(() => {
    const tree = editor.tree
    untrack(() => { if (carry && carry.tree !== tree) carry = null })
  })
  // Escape lets a lifted box go. The character card takes the first Escape (keydown) to close
  // itself, so the release is read on keyup, where nothing has stopped the event.
  $effect(() => {
    /** @param {KeyboardEvent} event */
    const release = event => { if (event.key === 'Escape' && carry) carry = null }
    window.addEventListener('keyup', release)
    return () => window.removeEventListener('keyup', release)
  })
  /** @param {Path} to */
  function placeCarry(to) {
    const held = carry
    carry = null
    if (!held || held.tree !== editor.tree) return
    if (siblings(held.path, to)) editor.reorder(held.path, to)
    else if (swappable(held.path, to)) editor.swap(held.path, to)
  }

  // A finger drag: touch fires no dragstart, so the same move and switch are tracked by pointer.
  // The first movement past a few pixels starts it, so a tap still chooses the box.
  /** @type {{ path: Path, pointer: number, x: number, y: number, moved: boolean } | null} */ let touch = null
  /** @type {{ text: string, x: number, y: number } | null} */ let ghost = $state(null)
  // A drag that ends on a box can still be followed by a click; the next one is the drag's, not a choice.
  let swallowed = false

  /** @param {PointerEvent} event */
  function touchDown(event) {
    if (event.pointerType !== 'touch' || editor.disabled) return
    if (/** @type {HTMLElement} */ (event.target).closest('.ids-forms-toggle')) return
    const box = /** @type {HTMLElement} */ (event.target).closest('[data-hover-path]')
    if (!(box instanceof HTMLElement) || !rootEl?.contains(box) || box.closest('.inline-edit,input,textarea')) return
    const written = box.getAttribute('data-hover-path') ?? ''
    const path = written === '' ? [] : written.split('.').map(Number)
    if (!path.length) return
    touch = { path, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
  }

  /** @param {PointerEvent} event */
  function touchMove(event) {
    if (!touch || event.pointerId !== touch.pointer) return
    if (!touch.moved) {
      if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) < 8) return
      touch.moved = true
      swallowed = true
      dragging = { path: touch.path, tree: editor.tree }
      ghost = { text: editor.sequenceAt(touch.path), x: event.clientX, y: event.clientY }
    } else {
      if (ghost) ghost = { ...ghost, x: event.clientX, y: event.clientY }
    }
    overAt(event.clientX, event.clientY)
  }

  /** The box under a point, as a drop target. @param {number} x @param {number} y */
  function overAt(x, y) {
    const from = dragging?.path
    if (!from) return
    const under = document.elementFromPoint(x, y)?.closest('[data-hover-path]')
    const written = under instanceof HTMLElement ? under.getAttribute('data-hover-path') : null
    if (written == null) { overPath = null; overSwap = false; return }
    const path = written === '' ? [] : written.split('.').map(Number)
    const move = siblings(from, path), swap = !move && swappable(from, path)
    if (!move && !swap) { overPath = null; overSwap = false; return }
    overPath = key(path); overSwap = swap
  }

  /** @param {PointerEvent} event */
  function touchUp(event) {
    if (!touch || event.pointerId !== touch.pointer) return
    const from = touch.path, moved = touch.moved, landed = overPath
    touch = null
    if (!moved) return
    dragging = null; overPath = null; overSwap = false; ghost = null
    if (landed != null) {
      const to = landed === '' ? [] : landed.split('.').map(Number)
      if (siblings(from, to)) editor.reorder(from, to)
      else if (swappable(from, to)) editor.swap(from, to)
    }
    setTimeout(() => { swallowed = false }, 400)
  }

  function touchCancel() {
    if (!touch) return
    touch = null
    dragging = null; overPath = null; overSwap = false; ghost = null
    setTimeout(() => { swallowed = false }, 400)
  }

  // The context menu of a part: where it opened, and for which part.
  let menu = $state(/** @type {{ path: Path, x: number, y: number, forms?: boolean } | null} */ (null))
  /** @type {HTMLElement | null} */ let menuEl = $state(null)
  /** @type {HTMLElement | null} */ let rootEl = $state(null)
  $effect(() => { if (rootEl) return watchFallback(rootEl) })
  /** @type {{ path: Path } | null} */ let editing = $state(null)
  /** The first click's target, retained if selection changes the layout before the second click. @type {string | null} */ let clickPath = null
  /** @param {Path} path */
  function editPart(path) { if (!editor.disabled) { editor.choose(path, { toggle: false }); editing = { path } } }
  /** @param {Path} path @param {number} x @param {number} y */
  function openMenu(path, x, y) {
    if (editor.disabled) return
    // Placed where it opened, over everything (so no scrolled or clipped box moves or cuts it), kept inside the window.
    const W = 260, H = 280 + (formsOf(partAt(editor.tree, path)).length ? 30 + Math.ceil(formsOf(partAt(editor.tree, path)).length / 6) * 42 : 0)
    menu = { path, x: Math.max(8, Math.min(x, innerWidth - W - 8)), y: Math.max(8, Math.min(y, innerHeight - H - 8)) }
    editor.choose(path, { toggle: false })
    queueMicrotask(() => /** @type {HTMLElement | null | undefined} */ (menuEl?.querySelector('[role^="menuitem"]'))?.focus())
  }
  /** The variation sequences of the component at `path`, listed under its button. @param {Path} path @param {HTMLElement} anchor */
  function openForms(path, anchor) {
    if (editor.disabled) return
    const forms = formsOf(partAt(editor.tree, path)), r = anchor.getBoundingClientRect()
    const W = Math.min(forms.length, 6) * 42 + 14, H = Math.ceil(forms.length / 6) * 42 + 40
    menu = { path, forms: true, x: Math.max(8, Math.min(r.left, innerWidth - W - 8)), y: r.bottom + 4 + H > innerHeight - 8 ? Math.max(8, r.top - H - 4) : r.bottom + 4 }
    editor.choose(path, { toggle: false })
    queueMicrotask(() => /** @type {HTMLElement | null | undefined} */ (menuEl?.querySelector('[aria-checked="true"]') ?? menuEl?.querySelector('[role^="menuitem"]'))?.focus())
  }
  /** @param {MouseEvent} event @param {Path} path */
  function contextmenu(event, path) { event.preventDefault(); openMenu(path, event.clientX, event.clientY) }
  /** @param {KeyboardEvent} event @param {Path} path */
  function partKey(event, path) {
    if (event.key === ' ' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      if (!path.length || editor.disabled) return
      if (carry && samePath(carry.path, path)) { carry = null; return }
      if (carry) { placeCarry(path); return }
      carry = { path, tree: editor.tree }
      editor.choose(path)
      return
    }
    if (event.key === 'Escape' && carry) { event.preventDefault(); carry = null; return }
    if (event.key === 'Escape' && !event.isComposing && !editor.disabled && editor.chosen !== null) { event.preventDefault(); editor.choose(null); return }
    if (event.key === 'F2') { event.preventDefault(); editPart(path); return }
    if (event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.isComposing) { event.preventDefault(); editPart(path); return }
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing && ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
      const next = neighbor(editor.tree, path, ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1)
      if (path.length && !editor.disabled) { event.preventDefault(); if (next) { editor.reorder(path, next); editor.focusChosen(rootEl) } }
      return
    }
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      const r = /** @type {HTMLElement} */ (event.currentTarget).getBoundingClientRect()
      openMenu(path, r.left + 8, r.bottom)
    }
  }
  function closeMenu({ refocus = true } = {}) {
    // A list opened from a component's button gives the focus back to that button.
    const toggle = menu?.forms ? /** @type {HTMLElement | null | undefined} */ (rootEl?.querySelector(`.ids-forms-toggle[data-hover-path="${CSS.escape(key(menu.path))}"]`)) : null
    menu = null
    if (!refocus) return
    if (toggle) toggle.focus(); else editor.focusChosen(rootEl)
  }
  /** @param {() => void} act */
  function run(act) { act(); closeMenu() }
  /** @param {KeyboardEvent} event */
  function menuKey(event) {
    const items = /** @type {HTMLElement[]} */ ([...(menuEl?.querySelectorAll('[role^="menuitem"]:not([disabled])') ?? [])])
    const at = items.indexOf(/** @type {HTMLElement} */ (document.activeElement))
    const step = /** @type {Record<string, number>} */ ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 })[event.key]
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu() }
    else if (event.key === 'Tab') closeMenu({ refocus: false })
    else if (step) { event.preventDefault(); items[(at + step + items.length) % items.length]?.focus() }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); items[event.key === 'Home' ? 0 : items.length - 1]?.focus() }
  }
  const menuPart = $derived(menu ? partAt(editor.tree, menu.path) : undefined)
  const menuForms = $derived(formsOf(menuPart))
  /** A click on a node's frame, away from its parts and buttons, chooses it. @param {MouseEvent} event @param {Path} path */
  function frameClick(event, path) {
    if (editor.disabled) return
    const target = /** @type {HTMLElement} */ (event.target)
    const frame = /** @type {HTMLElement} */ (event.currentTarget)
    const parts = /** @type {HTMLElement | null} */ (frame.querySelector(':scope > .ids-parts'))
    if (target.closest('button,.inline-edit') || parts?.contains(target)) return
    editor.choose(path)
  }
</script>

<svelte:window onpointerdown={event => { if (menu && !menuEl?.contains(/** @type {Node} */ (event.target))) closeMenu({ refocus: false }) }} />

{#snippet box(/** @type {Part} */ part, /** @type {Path} */ path, /** @type {{ op: string, n: number } | null} */ parent)}
  {@const selected = samePath(editor.chosen, path)}
  {#if isNode(part)}
    {@const what = parent ? t('ids.part', { part: editor.name(part.op), n: parent.n, name: editor.name(parent.op) }) : editor.name(part.op)}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="ids-node {nodeLayout(part)}" style:--tint={tint(path, true)} draggable={!editor.disabled && path.length > 0 && !(editing && samePath(editing.path, path))}
      ondragstart={event => startDrag(event, path)} ondragend={endDrag}
      title={path.length ? `${editor.name(part.op)} · ${t('ids.dragSibling')}` : undefined}
      class:dragged={dragging !== null && samePath(dragging.path, path)} class:carried={carry !== null && samePath(carry.path, path)} class:chosen={selected} class:hovered={editor.isHovered(path)} class:tinted={editor.isTinted(path)} class:over={overKind(path) === 'move'} class:swap={overKind(path) === 'swap'} data-op={part.op} data-hover-path={key(path)} class:disabled={editor.disabled} onclick={event => frameClick(event, path)}
      ondragover={event => dragover(event, path)} ondragleave={() => { overPath = null; overSwap = false }} ondrop={event => drop(event, path)}>
      <div class="ids-head">
        <button type="button" class="ids-op" draggable={!editor.disabled && path.length > 0} ondragstart={event => startDrag(event, path)} ondragend={endDrag} data-path={key(path)} class:dragged={dragging !== null && samePath(dragging.path, path)} class:carried={carry !== null && samePath(carry.path, path)} aria-pressed={selected} aria-keyshortcuts="Space" disabled={editor.disabled}
          aria-label={t('ids.node', { name: editor.name(part.op), sequence: write(part) })} title={`${part.op} ${editor.name(part.op)}${path.length ? ` · ${t('ids.dragSibling')}` : ''}`}
          onclick={() => editor.choose(path)} oncontextmenu={event => contextmenu(event, path)} onkeydown={event => partKey(event, path)}
          ondragover={event => dragover(event, path)} ondragleave={() => { overPath = null; overSwap = false }} ondrop={event => drop(event, path)}><OperatorIcon op={part.op} size={16} /></button>
        {#if editing && samePath(editing.path, path)}
          {#key editing}<IdsInlineEdit {editor} {path} owner={rootEl} onclose={() => editing = null} />{/key}
        {:else}
          <span class="ids-subsequence" lang="ja" title={write(part)}>{write(part)}</span>
        {/if}
        <button type="button" class="ids-unwrap" tabindex="-1" disabled={editor.disabled} aria-label={t('ids.unwrapNode', { what })} title={t('ids.unwrapHint')}
          onclick={() => editor.remove(path)}>×</button>
      </div>
      <div class="ids-parts">
        {#each part.parts as inner, i (key([...path, i]))}
          <div class="ids-cell" data-index={i} style:flex-grow={sizes.get(inner)?.[nodeLayout(part) === 'row' ? 'width' : 'height'] ?? 1}>{@render box(inner, [...path, i], { op: part.op, n: i + 1 })}</div>
        {/each}
      </div>
    </div>
  {:else}
    {@const label = part === null ? t('ids.empty') : part}
    {#if editing && samePath(editing.path, path)}
      {#key editing}<IdsInlineEdit {editor} {path} owner={rootEl} variant="leaf" onclose={() => editing = null} />{/key}
    {:else}
    <button type="button" class="ids-part" data-character={part ?? undefined} draggable={!editor.disabled && path.length > 0} ondragstart={event => startDrag(event, path)} ondragend={endDrag} style:--tint={tint(path)} class:empty={part === null} class:dragged={dragging !== null && samePath(dragging.path, path)} class:carried={carry !== null && samePath(carry.path, path)} class:chosen={selected} class:hovered={editor.isHovered(path)} class:tinted={editor.isTinted(path)} class:over={overKind(path) === 'move'} class:swap={overKind(path) === 'swap'} aria-pressed={selected} aria-keyshortcuts="Space"
      data-path={key(path)} data-hover-path={key(path)} disabled={editor.disabled} title={`${part === null ? label : t('ids.choose', { part })}${path.length ? ` · ${t('ids.dragSibling')}` : ''}`}
      aria-label={parent ? t('ids.part', { part: label, n: parent.n, name: editor.name(parent.op) }) : label}
      onclick={() => editor.choose(path)} oncontextmenu={event => contextmenu(event, path)} onkeydown={event => partKey(event, path)}
      ondragover={event => dragover(event, path)} ondragleave={() => { overPath = null; overSwap = false }} ondrop={event => drop(event, path)}>{#if part !== null && varied(part) && editor.adapter.icon}<span class="ids-form"><IdsPartIcon sequence={variationOf(part)} adapter={editor.adapter} />{part.slice(variationOf(part).length)}</span>{:else}{part ?? '⬚'}{/if}</button>
    {#if formsOf(part).length}
      {@const open = menu?.forms === true && samePath(menu.path, path)}
      <button type="button" class="ids-forms-toggle" class:varied={varied(part)} disabled={editor.disabled} aria-haspopup="menu" aria-expanded={open}
        aria-label={t('ids.variants.label', { part: variationBase(part) ?? '' })} title={t('ids.variants.label', { part: variationBase(part) ?? '' })}
        data-hover-path={key(path)} ondragover={event => dragover(event, path)} ondragleave={() => { overPath = null; overSwap = false }} ondrop={event => drop(event, path)}
        onkeydown={event => { if (event.key === 'Backspace' || event.key === 'Delete') event.stopPropagation() }}
        onpointerdown={event => { if (open) event.stopPropagation() }} onclick={event => { if (open) closeMenu(); else openForms(path, event.currentTarget) }}>
        <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    {/if}
    {/if}
  {/if}
{/snippet}

<div class="ids-tree" role="group" aria-label={t('ids.structure')} bind:this={rootEl}
  onpointermove={event => {
    if (touch) { touchMove(event); return }
    const target = /** @type {HTMLElement} */ (event.target).closest('[data-hover-path]')
    const path = target?.getAttribute('data-hover-path')
    editor.hover(path == null ? null : path === '' ? [] : path.split('.').map(Number))
  }} onpointerleave={() => editor.hover(null)} onpointerup={touchUp} onpointercancel={touchCancel} onpointerdown={event => {
    touchDown(event)
    const target = /** @type {HTMLElement} */ (event.target)
    if (!editor.disabled && (target === event.currentTarget || target.classList.contains('ids-tree-root'))) {
      const active = document.activeElement
      if (editing && active instanceof HTMLElement && rootEl?.contains(active)) active.blur()
      editor.choose(null)
    }
  }} onclickcapture={event => {
    if (swallowed) { swallowed = false; event.stopImmediatePropagation(); event.preventDefault(); return }
    if (event.detail !== 1) return
    const target = /** @type {HTMLElement} */ (event.target)
    clickPath = target.closest('.ids-unwrap,.ids-menu,.inline-edit,.ids-forms-toggle') ? null : target.closest('[data-hover-path]')?.getAttribute('data-hover-path') ?? null
  }} ondblclick={event => {
    if (clickPath == null) return
    const path = clickPath
    const anchor = /** @type {HTMLElement | null | undefined} */ (rootEl?.querySelector(`[data-hover-path="${CSS.escape(path)}"]`))
    if (anchor) { event.preventDefault(); editPart(path === '' ? [] : path.split('.').map(Number)) }
  }}>
  <div class="ids-tree-root">{@render box(editor.tree, [], null)}</div>
  {#if ghost}
    <div class="ids-touch-ghost" aria-hidden="true" style:left="{ghost.x}px" style:top="{ghost.y}px">{ghost.text}</div>
  {/if}
  {#if menu}
    {@const filled = menuPart !== null && menuPart !== undefined}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="ids-menu" role="menu" tabindex="-1" aria-label={t('ids.menu.label', { part: editor.sequenceAt(menu.path) })} bind:this={menuEl}
      style:left="{menu.x}px" style:top="{menu.y}px" onkeydown={menuKey}>
      {#if menuForms.length && typeof menuPart === 'string'}
        <p class="ids-menu-title">{t('ids.variants.label', { part: menuForms[0] })}</p>
        <div class="ids-menu-forms">
          {#each menuForms as form (form)}
            <button type="button" role="menuitemradio" class="ids-menu-form" aria-checked={variationOf(menuPart) === form} title={codePoints(form)} aria-label={codePoints(form)}
              onclick={() => run(() => editor.vary(form, /** @type {Path} */ (menu?.path)))}><IdsPartIcon sequence={form} adapter={editor.adapter} /></button>
          {/each}
        </div>
      {/if}
      {#if !menu.forms}
      {#if menuForms.length}<div class="ids-menu-sep" role="separator"></div>{/if}
      <p class="ids-menu-title">{isNode(menuPart) ? t('ids.menu.swap') : t('ids.menu.split')}</p>
      <div class="ids-menu-ops">
        {#each OPERATOR_GROUPS.flatMap(group => group.ops) as op (op)}
          <button type="button" role="menuitem" class="ids-menu-op" title={editor.name(op)} aria-label={editor.name(op)}
            onclick={() => run(() => editor.operator(op, /** @type {Path} */ (menu?.path)))}><OperatorIcon {op} size={18} /></button>
        {/each}
      </div>
      <div class="ids-menu-sep" role="separator"></div>
      <button type="button" role="menuitem" class="ids-menu-item" disabled={!filled} onclick={() => run(() => editor.empty(menu?.path ?? null))}>
        <span>{t('ids.clear')}</span>{#if keyHints}<kbd>{shortcut('backspace')}</kbd>{/if}</button>
      <button type="button" role="menuitem" class="ids-menu-item" disabled={!isNode(menuPart)} onclick={() => run(() => editor.remove(menu?.path ?? null))}>
        <span>{t('ids.unwrap')}</span></button>
      <button type="button" role="menuitem" class="ids-menu-item" disabled={!filled}
        onclick={() => { const text = editor.sequenceAt(/** @type {Path} */ (menu?.path)); run(() => { navigator.clipboard?.writeText(text).catch(() => {}) }) }}>
        <span>{t('ids.menu.copy')}</span><span class="ids-menu-seq" lang="ja">{editor.sequenceAt(menu.path)}</span></button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ids-tree{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#686874,#9d9daa));--_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));
    --_line-strong:var(--ids-line-strong,light-dark(#c2c2cc,#4a4a55));--_surface:var(--ids-surface,light-dark(#fff,#1b1b20));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));--_surface-selected:var(--ids-surface-selected,light-dark(#eeeef3,#26262d));
    --_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));--_accent-light:var(--ids-accent-light,light-dark(#e9edfd,#232c4c));
    --_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Numbered","IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Jurchen","IDS Operators","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif);
    position:relative;display:grid;place-items:center;min-width:0;min-height:0;padding:16px;color:var(--_ink)}
  .ids-tree-root{position:relative;display:grid;width:min(100%,420px);aspect-ratio:1;min-height:0;container-type:size}
  .ids-tree-root > *{height:100%;min-height:0}
  :where(.ids-tree) button{font:inherit;color:inherit;border:1px solid var(--_line);border-radius:6px;background:var(--_surface);cursor:pointer}
  :where(.ids-tree) button:disabled{cursor:default;opacity:.55}
  :where(.ids-tree) button:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  /* Each node scales its frame and controls to its containing cell. One em is at most
     one pixel, shrinking together with the available width and height. */
  .ids-node{position:relative;display:flex;flex-direction:column;height:100%;min-width:0;min-height:0;box-sizing:border-box;font-size:min(1px,1cqw,.6cqh);padding:24em 6em 6em;border:1.5em dashed var(--_line-strong);border-radius:10em;cursor:pointer;
    transition:border-color .12s,background-color .12s}
  .ids-node.carried,.ids-part.carried{outline:2px dashed var(--_accent);outline-offset:2px}
  .ids-node[draggable="true"]{cursor:grab}
  .ids-node[draggable="true"]:active{cursor:grabbing}
  .ids-node.disabled{cursor:default}
  /* A finger on a box drags it rather than scrolling the tree; the gaps still scroll. */
  .ids-tree [data-hover-path]{touch-action:none}
  .ids-touch-ghost{position:fixed;z-index:60;max-width:12em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;
    padding:4px 10px;border:1px solid var(--_accent);border-radius:10px;background:var(--_surface);color:var(--_ink);
    font-family:var(--_font);font-size:20px;line-height:1.3;box-shadow:0 8px 20px rgb(0 0 0 / .2);transform:translate(-50%,-50%)}
  :is(.ids-op,.ids-part)[draggable="true"]{cursor:grab}
  :is(.ids-op,.ids-part)[draggable="true"]:active{cursor:grabbing}
  .ids-node.chosen{border-style:solid;border-color:var(--_accent);background:var(--_accent-light)}
  .ids-node.over{border-style:solid;border-color:var(--_accent)}
  .ids-node.swap{border-style:solid;border-color:var(--_accent);background:var(--_accent-light)}
  .ids-node.dragged,.ids-op.dragged,.ids-part.dragged{opacity:.45}
  .ids-head{position:absolute;top:3em;left:4em;right:4em;display:flex;justify-content:space-between;align-items:center;pointer-events:none}
  .ids-head button{pointer-events:auto;flex-shrink:0}
  .ids-subsequence{pointer-events:auto;flex:1;min-width:0;margin:0 .545em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11em/1.4 var(--_font);color:var(--_muted)}
  .ids-op{display:grid;place-items:center;padding:1em 3em;border-width:1em;border-radius:6em;border-color:transparent;background:none}
  .ids-op:hover,.ids-op[aria-pressed="true"]{border-color:var(--_accent)}
  .ids-unwrap{padding:0 .385em;font-size:13em;line-height:1.2;border-width:.077em;border-radius:.46em;color:var(--_muted);border-color:transparent;background:none}
  .ids-unwrap:not(:disabled):hover{color:var(--_fault);border-color:var(--_fault)}
  .ids-op :global(svg){width:16em;height:16em}
  .ids-op :global(svg *){vector-effect:none}
  .ids-parts{flex:1;display:flex;gap:6em;min-width:0;min-height:0}
  .ids-cell{position:relative;flex:1;display:grid;min-width:0;min-height:0;container-type:size}
  .ids-cell:has(:global(.inline-edit)){position:relative;z-index:2}
  .row > .ids-parts{flex-direction:row}
  .column > .ids-parts,.stack > .ids-parts{flex-direction:column}
  /* An enclosure: the first part fills the box, its glyph on the closed side, and the second sits
     inside it where the operator puts it, leaving a band of the first open around it. */
  .enclosure > .ids-parts{display:grid;gap:0;grid-template-columns:min(28em,12%) minmax(0,1fr) min(28em,12%);grid-template-rows:min(28em,12%) minmax(0,1fr) min(28em,12%)}
  .enclosure > .ids-parts > .ids-cell[data-index="0"]{grid-area:1/1/4/4}
  .enclosure > .ids-parts > .ids-cell[data-index="1"]{z-index:1;margin:min(4em,2cqw,2cqh)}
  .enclosure > .ids-parts > .ids-cell[data-index="1"] > .ids-part{background:var(--_surface)}
  .enclosure > .ids-parts > .ids-cell[data-index="0"] > .ids-part{font-size:min(22px,max(0px,calc(66cqh - 3px)),max(0px,calc(66cqw - 3px)));padding:min(2px,2cqh) min(3px,2cqw)}
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
  .ids-part{display:grid;place-items:center;width:100%;height:100%;min-width:0;min-height:0;box-sizing:border-box;padding:min(2px,2cqh) min(4px,2cqw);font-size:min(var(--ids-part-size,32px),max(0px,calc(66cqh - 3px)),max(0px,calc(66cqw - 3px)));line-height:1.4;overflow:hidden;
    font-family:var(--_font);color:var(--_ink);background:var(--_surface);border:min(1px,1cqw,1cqh) solid var(--_line);border-radius:min(8px,8cqw,8cqh)}
  .ids-part:not(:disabled):hover{border-color:var(--_line-strong)}
  .ids-part.empty{font-size:min(20px,max(0px,calc(66cqh - 3px)),max(0px,calc(66cqw - 3px)));color:var(--_muted);border-style:dashed;border-color:var(--_line-strong);background:transparent}
  .ids-tree-root > .ids-part{font-size:min(140px,max(0px,calc(66cqh - 3px)),max(0px,calc(66cqw - 3px)))}
  .ids-tree-root > .ids-part.empty{font-size:min(48px,max(0px,calc(66cqh - 3px)),max(0px,calc(66cqw - 3px)))}
  .ids-part.chosen{border:min(2px,2cqw,2cqh) solid var(--_accent);background:var(--_accent-light)}
  .ids-part.over{border:min(2px,2cqw,2cqh) solid var(--_accent);border-style:solid}
  .ids-part.swap{border:min(2px,2cqw,2cqh) solid var(--_accent);border-style:solid;background:var(--_accent-light)}

  .ids-form{display:inline-flex;align-items:center}
  /* The variation sequences of a component, opened from its corner. */
  .ids-forms-toggle{position:absolute;z-index:1;right:3px;bottom:3px;display:grid;place-items:center;width:18px;height:18px;padding:0;border-radius:5px;color:var(--_muted);background:var(--_surface)}
  .ids-forms-toggle svg{width:12px;height:12px}
  .ids-forms-toggle:not(:disabled):hover,.ids-forms-toggle[aria-expanded="true"],.ids-forms-toggle.varied{color:var(--_accent);border-color:var(--_accent)}
  /* An enclosing part keeps its button in the band its glyph stands in, clear of the part inside. */
  .enclosure > .ids-parts > .ids-cell[data-index="0"] > .ids-forms-toggle{right:1px;bottom:1px;width:14px;height:14px}
  .enclosure > .ids-parts > .ids-cell[data-index="0"] > .ids-forms-toggle svg{width:10px;height:10px}
  :is([data-op="⿸"],[data-op="⿵"]) > .ids-parts > .ids-cell[data-index="0"] > .ids-forms-toggle{bottom:auto;top:1px}
  [data-op="⿹"] > .ids-parts > .ids-cell[data-index="0"] > .ids-forms-toggle{right:auto;bottom:auto;left:1px;top:1px}
  :is([data-op="⿷"],[data-op="⿽"]) > .ids-parts > .ids-cell[data-index="0"] > .ids-forms-toggle{right:auto;left:1px}
  @container (max-height:40px) or (max-width:40px){
    .ids-forms-toggle{display:none}
  }

  /* Device-pixel minimum borders and controls cannot fit in the smallest cells.
     Clip the header visually while keeping its node button available to keyboard navigation. */
  @container (max-height:12px) or (max-width:12px){
    .ids-node{border-width:0;padding:0}
    .ids-head{inset:0;overflow:hidden;clip-path:inset(50%)}
    .ids-part,.ids-part.chosen,.ids-part.over,.ids-part.swap{border-width:0;padding:0}
  }

  .ids-menu{position:fixed;z-index:50;display:flex;flex-direction:column;gap:2px;width:max-content;max-width:270px;padding:6px;
    border:1px solid var(--_line);border-radius:10px;background:var(--_surface);box-shadow:0 10px 30px rgb(0 0 0 / .18)}
  .ids-menu-title{margin:2px 6px 4px;font-size:11px;color:var(--_muted)}
  .ids-menu-ops{display:grid;grid-template-columns:repeat(6,32px);gap:2px}
  .ids-menu-op{display:grid;place-items:center;height:30px;padding:0;border-color:transparent !important;background:none !important}
  .ids-menu-op:hover,.ids-menu-op:focus-visible{background:var(--_accent-light) !important}
  .ids-menu-forms{display:grid;grid-template-columns:repeat(6,40px);gap:2px}
  .ids-menu-form{display:grid;place-items:center;height:40px;padding:0;font-size:30px;border-color:transparent !important;background:none !important}
  .ids-menu-form:hover,.ids-menu-form:focus-visible{background:var(--_surface-selected) !important}
  .ids-menu-form[aria-checked="true"]{border-color:var(--_accent) !important;background:var(--_accent-light) !important}
  .ids-menu-sep{height:1px;margin:4px 2px;background:var(--_line)}
  .ids-menu-item{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:6px 8px;font-size:13px;text-align:left;
    border-color:transparent !important;background:none !important}
  .ids-menu-item:not(:disabled):hover,.ids-menu-item:focus-visible{background:var(--_surface-selected) !important}
  .ids-menu-item kbd,.ids-menu-seq{font:12px ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--_muted)}
  .ids-menu-seq{font-family:var(--_font);font-size:14px}
  .ids-node:where(.tinted),.ids-part:where(.tinted){background:color-mix(in oklab,var(--tint) 10%,var(--_surface));color:color-mix(in oklab,var(--_ink) 80%,var(--tint))}
  .ids-node.hovered,.ids-part.hovered{box-shadow:inset 0 0 0 2px var(--_accent)}
  .ids-node.hovered.tinted,.ids-part.hovered.tinted,.enclosure > .ids-parts > .ids-cell[data-index="1"] > .ids-part.hovered.tinted{background:color-mix(in oklab,var(--tint) 28%,var(--_surface))}
</style>
