<script>
  // The chosen part of `editor`: a field to type it (Enter puts what it holds and moves on to the next
  // empty slot), buttons to clear it or take its level away, and the components that can stand in its
  // place or the descriptions it can be split into. A problem or the next slot to fill shows beneath;
  // the components float over the page, so choosing a part does not move what is around it.
  import { isNode } from '../core/ids.js'
  import { shortcut } from './shortcut.js'

  /** @type {{ editor: import('./editor.svelte.js').Editor, keyHints?: boolean, slot?: HTMLInputElement | null, status?: boolean }} */
  let { editor, keyHints = true, slot = $bindable(null), status = true } = $props()
  const t = $derived(editor.t)
  const picked = $derived(editor.picked)
  function apply() { if (editor.enter()) queueMicrotask(() => { slot?.focus(); slot?.select() }) }
  const part = $derived(typeof picked === 'string' ? picked : '')
  const at = $derived(editor.chosen ? editor.chosen.join('.') : '')
  const identity = $derived(`${at}\u0000${part}`)
  const replaceable = $derived(Boolean(part) && (editor.swaps.length > 0 || editor.splits.length > 0))
  /** @type {HTMLElement | null} */ let root = $state(null)
  /** @type {HTMLElement | null} */ let panel = $state(null)
  let open = $state(false)
  let placed = $state(false)
  let top = $state(0), left = $state(0)
  /** The part whose list the reader closed, so it stays closed until another part is chosen. */
  let shut = $state(/** @type {string | null} */ (null))

  $effect(() => {
    const key = identity
    if (!replaceable) { open = false; shut = null; return }
    if (shut === key) return
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
    if (!inSight(root)) { placed = false; return }
    const anchor = root.getBoundingClientRect(), box = panel.getBoundingClientRect(), edge = 8, gap = 6
    const under = anchor.bottom + gap
    const y = under + box.height > innerHeight - edge ? anchor.top - box.height - gap : under
    top = Math.max(edge, Math.min(y, innerHeight - box.height - edge))
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
    if (slot && root?.querySelector('.ids-swaps')?.contains(document.activeElement)) slot.focus()
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
  </div>
  {#if status}
    {#if editor.problem}<p class="ids-problem" role="status">{editor.problem}</p>
    {:else if editor.pending}<p class="ids-pending" role="status">{editor.pending}</p>{/if}
  {/if}
  {#if open && replaceable}
    <div class="ids-swaps" class:ready={placed} bind:this={panel} role="group" aria-label={t('ids.swaps', { part })} style:top="{top}px" style:left="{left}px">
      <div class="ids-swaps-head">
        <span class="ids-title">{t('ids.swaps', { part })}</span>
        <button type="button" class="ids-swaps-close" aria-label={t('ids.swaps.close')} title={t('ids.swaps.close')} onclick={hide}>×</button>
      </div>
      <div class="ids-options">
        {#each editor.swaps as item (item.char)}
          <button type="button" class="ids-swap" disabled={editor.disabled} title={item.count ? `${picked} → ${item.char} · ${item.count}` : `${picked} → ${item.char}`}
            draggable="true" ondragstart={event => event.dataTransfer?.setData('text/plain', item.char)} onclick={() => editor.take(item.char)}>{item.char}</button>
        {/each}
        {#each editor.splits as sequence (sequence)}
          <button type="button" class="ids-swap ids-split" disabled={editor.disabled} title={t('ids.split', { part })}
            onclick={() => editor.take(sequence)}>{sequence}</button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .ids-part-tools{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));--_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));
    --_line-strong:var(--ids-line-strong,light-dark(#b0b0ba,#5c5c67));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_surface-selected:var(--ids-surface-selected,light-dark(#e8e8ee,#30303a));
    --_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));--_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));
    --_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback,"IDS Fallback"),sans-serif);
    display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--_ink)}
  :where(.ids-part-tools) :is(button,input){font:inherit;color:inherit;border:1px solid var(--_line);border-radius:8px;background:var(--_surface)}
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
  .ids-title{font-size:11px;color:var(--_muted)}
  .ids-swaps{position:fixed;z-index:20;display:flex;flex-direction:column;gap:6px;width:max-content;min-width:min(200px,calc(100vw - 16px));
    max-width:min(420px,calc(100vw - 16px));max-height:min(42vh,300px);padding:10px;border:1px solid var(--_line);border-radius:12px;background:var(--_surface);
    box-shadow:0 12px 32px -8px rgb(16 16 24 / .28),0 2px 8px rgb(16 16 24 / .12);overflow:auto}
  .ids-swaps:not(.ready){visibility:hidden}
  .ids-swaps-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .ids-swaps-close{display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:none;color:var(--_muted);font-size:16px;line-height:1}
  .ids-swaps-close:hover{background:var(--_surface-subtle);color:var(--_ink)}
  .ids-options{display:flex;flex-wrap:wrap;gap:6px}
  .ids-swap{min-width:40px;padding:2px 8px;font-size:22px;line-height:1.25;font-family:var(--_font)}
  .ids-split{font-size:16px;color:var(--_muted)}
  .ids-swap:not(:disabled):hover{border-color:var(--_accent)}
  .ids-problem,.ids-pending{margin:0;font-size:12px;line-height:1.45}
  .ids-problem{color:var(--_fault)}
  .ids-pending{color:var(--_muted)}
</style>
