<script>
  // The chosen part of `editor`: a field to type it (Enter puts what it holds and moves on to the next
  // empty slot), buttons to clear it or take its level away, and the components that can stand in its
  // place or the descriptions it can be split into. A problem or the next slot to fill shows beneath.
  import { isNode } from '../core/ids.js'
  import { shortcut } from './shortcut.js'

  /** @type {{ editor: import('./editor.svelte.js').Editor, keyHints?: boolean, slot?: HTMLInputElement | null, status?: boolean }} */
  let { editor, keyHints = true, slot = $bindable(null), status = true } = $props()
  const t = $derived(editor.t)
  const picked = $derived(editor.picked)
</script>

<div class="ids-part-tools">
  <div class="ids-tools">
    <input class="ids-slot" bind:this={slot} bind:value={editor.piece} disabled={editor.disabled} lang="ja" spellcheck="false" autocomplete="off"
      aria-label={t('ids.slot')} placeholder={t('ids.slotHint')}
      onkeydown={event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); if (editor.enter()) queueMicrotask(() => slot?.select()) } }} />
    <button type="button" class="ids-clear" disabled={editor.disabled || !editor.chosen || picked === null || picked === undefined}
      title={`${t('ids.clear')} (${shortcut('backspace')})`} onclick={() => editor.empty(editor.chosen)}>{t('ids.clear')}{#if keyHints}<kbd>{shortcut('backspace')}</kbd>{/if}</button>
    <button type="button" class="ids-remove" disabled={editor.disabled || !isNode(picked)} title={t('ids.unwrap')} onclick={() => editor.remove(editor.chosen)}>{t('ids.unwrap')}</button>
  </div>
  {#if status}
    {#if editor.problem}<p class="ids-problem" role="status">{editor.problem}</p>
    {:else if editor.pending}<p class="ids-pending" role="status">{editor.pending}</p>{/if}
  {/if}
  {#if typeof picked === 'string' && (editor.swaps.length || editor.splits.length)}
    <div class="ids-swaps" role="group" aria-label={t('ids.swaps', { part: picked })}>
      <span class="ids-title">{t('ids.swaps', { part: picked })}</span>
      <div class="ids-options">
        {#each editor.swaps as item (item.char)}
          <button type="button" class="ids-swap" disabled={editor.disabled} title={item.count ? `${picked} → ${item.char} · ${item.count}` : `${picked} → ${item.char}`}
            draggable="true" ondragstart={event => event.dataTransfer?.setData('text/plain', item.char)} onclick={() => editor.take(item.char)}>{item.char}</button>
        {/each}
        {#each editor.splits as sequence (sequence)}
          <button type="button" class="ids-swap ids-split" disabled={editor.disabled} title={t('ids.split', { part: picked })}
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
    --_font:var(--ids-font,"IDS Strokes","IDS Parts","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",sans-serif);
    display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--_ink)}
  :where(.ids-part-tools) :is(button,input){font:inherit;color:inherit;border:1px solid var(--_line);border-radius:8px;background:var(--_surface)}
  :where(.ids-part-tools) button{cursor:pointer}
  :where(.ids-part-tools) button:disabled{cursor:default;opacity:.5}
  :where(.ids-part-tools) :is(button,input):focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch}
  .ids-slot{flex:1 1 140px;min-width:0;min-height:36px;padding:4px 10px;font-size:14px}
  .ids-slot:not(:placeholder-shown){font-size:20px;font-family:var(--_font);padding:2px 10px}
  .ids-tools > button{display:inline-flex;align-items:center;gap:8px;padding:0 12px;min-height:36px;font-size:13px}
  .ids-tools > button:not(:disabled):hover{border-color:var(--_line-strong);background:var(--_surface-subtle)}
  kbd{font:500 10px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--_muted)}
  .ids-title{font-size:11px;color:var(--_muted)}
  .ids-swaps{display:flex;flex-direction:column;gap:4px}
  .ids-options{display:flex;flex-wrap:wrap;gap:6px}
  .ids-swap{min-width:40px;padding:2px 8px;font-size:22px;line-height:1.25;font-family:var(--_font)}
  .ids-split{font-size:16px;color:var(--_muted)}
  .ids-swap:not(:disabled):hover{border-color:var(--_accent)}
  .ids-problem,.ids-pending{margin:0;font-size:12px;line-height:1.45}
  .ids-problem{color:var(--_fault)}
  .ids-pending{color:var(--_muted)}
</style>
