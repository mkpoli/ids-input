<script>
  // The chosen part of `editor`: a field to type it (Enter puts what it holds and moves on to the next
  // empty slot), buttons to clear it or take its level away, and the alternatives in its place
  // (IdsAlternatives). A problem or the next slot to fill shows beneath; the alternatives float over
  // the page, so choosing a part does not move what is around it. A part chosen by selecting its text
  // in the field shows its alternatives beside the field, and the list here waits to be asked for.
  import { isNode } from '../core/ids.js'
  import { shortcut } from './shortcut.js'
  import { watchFallback } from './fallback-font.js'
  import { createUnifiable } from './unifiable.svelte.js'
  import IdsAlternatives, { hasAlternatives } from './IdsAlternatives.svelte'

  /** @type {{ editor: import('./editor.svelte.js').Editor, keyHints?: boolean, slot?: HTMLInputElement | null, status?: boolean, variations?: boolean, variationsHref?: ((entry: string) => string) | null }} */
  let { editor, keyHints = true, slot = $bindable(null), status = true, variations = false, variationsHref = null } = $props()
  const t = $derived(editor.t)
  const picked = $derived(editor.picked)
  function apply() { if (editor.enter()) queueMicrotask(() => { slot?.focus(); slot?.select() }) }
  const part = $derived(typeof picked === 'string' ? picked : '')
  const written = $derived(isNode(picked) ? editor.sequenceAt(editor.chosen ?? []) : '')
  const at = $derived(editor.chosen ? editor.chosen.join('.') : '')
  const identity = $derived(`${at}\u0000${part}\u0000${written}`)
  const search = $derived(editor.alternatives)
  // The search runs while the list is closed, so the tools know whether to offer it again.
  $effect(() => { search.load() })
  const unifiable = createUnifiable(() => variations ? part : '')
  const replaceable = $derived(hasAlternatives(editor, unifiable.entries.length))
  const label = $derived(t('ids.swaps.label', { part: part || written }))

  /** @type {HTMLElement | null} */ let root = $state(null)
  $effect(() => { if (root) return watchFallback(root) })
  /** @type {HTMLElement | null} */ let panel = $state(null)
  /** @type {HTMLButtonElement | null} */ let reopenButton = $state(null)
  let open = $state(false)
  let placed = $state(false)
  let sheet = $state(false)
  let top = $state(0), left = $state(0), maxHeight = $state(420)
  /** The part whose list the reader closed, so it stays closed until another part is chosen. */
  let shut = $state(/** @type {string | null} */ (null))

  $effect(() => {
    const key = identity
    if (!replaceable) { open = false; shut = null; return }
    if (shut === key) return
    if (editor.chosenInField) { open = false; shut = key; return }
    shut = null
    open = true
  })

  // The list floats beside the tools, out of the page's flow: it sits under them, or above when the
  // window leaves no room below, and follows them while the page or a pane scrolls. It stays hidden
  // while the tools are scrolled out of sight, and shows again when they come back.
  /** Whether `el` is inside the window and every scrolling or clipping box around it. @param {HTMLElement} el */
  function inSight(el) {
    const rect = el.getBoundingClientRect()
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false
    let top = rect.top, bottom = rect.bottom, left = rect.left, right = rect.right
    // The window bounds above stand for the document scroller; a host's body or html clipping a
    // viewport-tall box would otherwise report a tool below the first screen as hidden.
    /** @type {Element | null} */
    let node = el.parentElement
    while (node && node !== document.body && node !== document.documentElement) {
      const style = getComputedStyle(node)
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
        const box = node.getBoundingClientRect()
        top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom)
        left = Math.max(left, box.left); right = Math.min(right, box.right)
        if (bottom - top < 2 || right - left < 2) return false
      }
      node = node.parentElement ?? (node.getRootNode() instanceof ShadowRoot ? /** @type {ShadowRoot} */ (node.getRootNode()).host : null)
    }
    return true
  }
  function place() {
    if (!root || !panel) return
    // Touch screens get a bottom sheet, in either orientation, even when the tools are off screen:
    // the sheet does not follow them.
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    if (innerWidth <= 640 || (coarse && innerWidth <= 1024)) {
      sheet = true
      maxHeight = Math.min(Math.round(innerHeight * 0.62), 560)
      placed = true
      return
    }
    if (!inSight(root)) { placed = false; return }
    sheet = false
    const anchor = root.getBoundingClientRect(), box = panel.getBoundingClientRect(), edge = 8, gap = 6
    const under = anchor.bottom + gap, room = innerHeight - edge - under
    // The list drops from the tools to the bottom edge of the window. Only a strip too short to
    // read sends it above the tools, where it has to cover the tree.
    if (room >= 160) {
      top = under
      maxHeight = Math.min(420, room)
    } else {
      maxHeight = Math.min(420, Math.max(120, anchor.top - gap - edge))
      top = Math.max(edge, anchor.top - gap - box.height)
    }
    left = Math.max(edge, Math.min(anchor.left, innerWidth - box.width - edge))
    placed = true
  }
  $effect(() => {
    if (!open) { placed = false; return }
    void part
    place()
    const watch = new ResizeObserver(place)
    if (panel) watch.observe(panel)
    if (root) watch.observe(root)
    // Clipping by a scrolling pane changes without a resize or a scroll event of its own.
    const sight = new IntersectionObserver(place)
    if (root) sight.observe(root)
    // A host may lay itself out again after the resize, so follow it once more on the next frame.
    const resize = () => { place(); requestAnimationFrame(place) }
    addEventListener('resize', resize)
    addEventListener('scroll', place, true)
    return () => {
      watch.disconnect()
      sight.disconnect()
      removeEventListener('resize', resize)
      removeEventListener('scroll', place, true)
    }
  })

  function hide() {
    shut = identity
    open = false
    // A close keeps the reader in the tools, on the control that brings the list back.
    if (root?.contains(document.activeElement)) setTimeout(() => reopenButton?.focus({ preventScroll: true }), 0)
  }
  /** Bring back the list the reader closed for this part. */
  function show() {
    shut = null
    open = true
    setTimeout(() => { /** @type {HTMLElement | null | undefined} */ (panel?.querySelector('.ids-swaps-close'))?.focus({ preventScroll: true }) }, 0)
  }
  /** Where an outside press began, so a tap closes the list and a scroll or drag does not. */
  let press = /** @type {{ x: number, y: number } | null} */ (null)
  /** @param {PointerEvent} event */
  function pressOutside(event) {
    press = null
    if (!open || !placed || event.button !== 0) return
    const target = /** @type {Node | null} */ (event.target)
    if (target && root?.contains(target)) return
    press = { x: event.clientX, y: event.clientY }
  }
  /** @param {PointerEvent} event */
  function releaseOutside(event) {
    const start = press
    press = null
    if (!start || !open || !placed) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return
    hide()
  }
  /** Escape inside the tools closes the list and nothing under it, such as a host's modal dialog. @param {KeyboardEvent} event */
  function escapeInside(event) {
    if (!open || !placed || event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return
    event.preventDefault()
    event.stopPropagation()
    hide()
  }
  /** Escape elsewhere closes the list and leaves the key's own effect, such as closing a dialog, to the page. @param {KeyboardEvent} event */
  function escape(event) {
    if (!open || !placed || event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return
    hide()
  }
</script>

<svelte:window onpointerdown={pressOutside} onpointerup={releaseOutside} onpointercancel={() => { press = null }} onkeydown={escape} />

<div class="ids-part-tools" bind:this={root} onkeydowncapture={escapeInside}>
  <div class="ids-tools">
    <input class="ids-slot" bind:this={slot} bind:value={editor.piece} disabled={editor.disabled} lang="ja" spellcheck="false" autocomplete="off"
      aria-label={t('ids.slot')} placeholder={t('ids.slotHint')}
      onkeydown={event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); apply() } }} />
    <button type="button" class="ids-apply" disabled={editor.disabled || !editor.piece.trim()} onclick={apply}>{t('ids.apply')}</button>
    <button type="button" class="ids-clear" disabled={editor.disabled || !editor.chosen || picked === null || picked === undefined}
      title={`${t('ids.clear')} (${shortcut('backspace')})`} onclick={() => editor.empty(editor.chosen)}><span class="ids-glyph" aria-hidden="true">⬚</span>{t('ids.clear')}{#if keyHints}<kbd aria-hidden="true">{shortcut('backspace', undefined, { compact: true })}</kbd>{/if}</button>
    <button type="button" class="ids-remove" disabled={editor.disabled || !isNode(picked)} title={t('ids.unwrapHint')} onclick={() => editor.remove(editor.chosen)}>{t('ids.unwrap')}</button>
    {#if shut === identity && replaceable}
      <button type="button" class="ids-reopen" bind:this={reopenButton} onclick={show}>{t('ids.alternatives.show')}</button>
    {/if}
  </div>
  {#if status}
    {#if editor.problem}<p class="ids-problem" role="status">{editor.problem}</p>
    {:else if editor.pending}<p class="ids-pending" role="status">{editor.pending}</p>{/if}
  {/if}
  {#if open && sheet && placed}
    <button type="button" class="ids-scrim" aria-hidden="true" tabindex="-1" onclick={hide}></button>
  {/if}
  {#if open && replaceable}
    <div class="ids-swaps" class:ids-sheet={sheet} class:ready={placed} bind:this={panel} role="group" aria-label={label} aria-busy={search.loading}
      style:top={sheet ? undefined : `${top}px`} style:left={sheet ? undefined : `${left}px`} style:max-height="{maxHeight}px">
      <div class="ids-swaps-head">
        <span class="ids-title" title={label}>{label}</span>
        <button type="button" class="ids-swaps-close" aria-label={t('ids.swaps.close')} title={t('ids.swaps.close')} onclick={hide}>×</button>
      </div>
      <IdsAlternatives {editor} {variations} {variationsHref} onspent={() => {
        /** @type {HTMLElement | null | undefined} */ (panel?.querySelector('.ids-swaps-close'))?.focus({ preventScroll: true })
      }} />
    </div>
  {/if}
</div>

<style>
  .ids-part-tools{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#686874,#9d9daa));--_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));
    --_control-border:var(--ids-control-border,light-dark(#8a8a96,#6f6f7e));
    --_line-strong:var(--ids-line-strong,light-dark(#c2c2cc,#4a4a55));--_surface:var(--ids-surface,light-dark(#fff,#1b1b20));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));--_surface-selected:var(--ids-surface-selected,light-dark(#eeeef3,#26262d));
    --_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));--_accent-light:var(--ids-accent-light,light-dark(#e9edfd,#232c4c));
    --_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Numbered","IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Jurchen","IDS Operators","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif);
    display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--_ink)}
  :where(.ids-part-tools) :is(button,input){font:inherit;color:inherit;border:1px solid var(--_line);border-radius:8px;background:var(--_surface)}
  :where(.ids-part-tools) input{border-color:var(--_control-border)}
  :where(.ids-part-tools) button{cursor:pointer}
  :where(.ids-part-tools) button:disabled{cursor:default;opacity:.5}
  :where(.ids-part-tools) :is(button,input):focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch}
  .ids-slot{flex:1 1 140px;min-width:0;min-height:36px;padding:4px 10px;font-size:14px}
  .ids-slot:not(:placeholder-shown){font-size:20px;font-family:var(--_font);padding:2px 10px}
  .ids-tools > button{position:relative;display:inline-flex;align-items:center;gap:8px;padding:0 14px 0 12px;min-height:36px;font-size:13px}
  .ids-glyph{font-family:var(--_font);font-size:18px;line-height:1}
  .ids-tools > button:not(:disabled):hover{border-color:var(--_line-strong);background:var(--_surface-subtle)}
  kbd{position:absolute;right:4px;bottom:2px;font:500 9px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--_muted);pointer-events:none}
  .ids-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:system-ui,var(--_font),sans-serif;font-size:11px;color:var(--_muted)}
  .ids-swaps{position:fixed;z-index:41;display:flex;flex-direction:column;gap:6px;width:max-content;min-width:min(200px,calc(100vw - 16px));
    max-width:min(420px,calc(100vw - 16px));max-height:min(52vh,420px);padding:10px;border:1px solid var(--_line);border-radius:12px;background:var(--_surface);
    box-shadow:0 12px 32px -8px rgb(16 16 24 / .28),0 2px 8px rgb(16 16 24 / .12);overflow:auto;overscroll-behavior:contain}
  .ids-swaps:not(.ready){visibility:hidden}
  /* A phone reads the list as a bottom sheet, above a scrim that closes it. */
  .ids-sheet{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom, 0px));top:auto;width:auto;max-width:none;border-radius:16px}
  .ids-scrim{position:fixed;inset:0;z-index:40;margin:0;padding:0;border:0;border-radius:0;background:rgb(16 16 24 / .32);cursor:default;touch-action:none}
  .ids-swaps-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .ids-swaps-close{flex:none;display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:none;color:var(--_muted);font-size:16px;line-height:1}
  .ids-swaps-close:hover{background:var(--_surface-subtle);color:var(--_ink)}
  .ids-problem,.ids-pending{margin:0;font-size:12px;line-height:1.45}
  .ids-problem{color:var(--_fault)}
  .ids-pending{color:var(--_muted)}
  @media (pointer: coarse){
    .ids-swaps-close{width:44px;height:44px;font-size:20px}
    .ids-tools > button{min-height:44px}
  }
</style>
