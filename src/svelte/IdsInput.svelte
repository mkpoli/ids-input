<script>
  // An ideographic description sequence typed or built as a tree, in one block: the sequence field and
  // its preview, the operator palette, the tree, the chosen part's tools and the part pickers, all over
  // one editor (`createEditor`). It starts from `value`, or else from the first description of `char`,
  // and hands the sequence to `onuse` once it is whole. A host wanting its own layout uses the parts
  // (IdsSequence, IdsOperators, IdsTree, IdsPartTools, IdsPicker, IdsPreview) over its own editor.
  import { untrack } from 'svelte'
  import { isSequence, parse } from '../core/ids.js'
  import { replacementQuery } from '../core/replacement.js'
  import { createEditor } from './editor.svelte.js'
  import IdsOperators from './IdsOperators.svelte'
  import IdsPartTools from './IdsPartTools.svelte'
  import IdsPicker from './IdsPicker.svelte'
  import IdsPreview from './IdsPreview.svelte'
  import IdsSequence from './IdsSequence.svelte'
  import IdsTree from './IdsTree.svelte'
  import { shortcut } from './shortcut.js'

  /** @type {{ adapter: import('../adapter/types.js').IdsAdapter, value?: string, char?: string, disabled?: boolean, messages?: Record<string, string>, locale?: string,
   *   pickers?: ('find' | 'characters' | 'parts' | 'from')[], recentKey?: string | null, keyHints?: boolean, tintMode?: import('./editor.svelte.js').TintMode, onuse?: (sequence: string) => void,
   *   onchange?: (text: string, whole: boolean) => void, preview?: import('svelte').Snippet<[string, boolean]> }} */
  let { adapter, value = $bindable(''), char = '', disabled = false, messages, locale = 'en', pickers = ['find', 'characters', 'parts', 'from'],
    recentKey = 'ids-input.recentParts', keyHints = true, tintMode = 'hover', onuse, onchange, preview } = $props()

  const editor = createEditor(() => ({ adapter, messages, locale, disabled, tintMode }))
  const t = $derived(editor.t)
  /** @type {HTMLElement | null} */ let root = $state(null)
  /** @type {HTMLInputElement | null} */ let slot = $state(null)

  // The text the editor last handed out, so a `value` set from outside is told from its own.
  let seen = ''
  $effect(() => editor.listen((text, whole) => { seen = text; value = text; onchange?.(text, whole) }))
  // Each `char` starts again: from `value` when it is a description, or else from the character's own first description.
  $effect(() => {
    const of = char
    untrack(() => {
      const typed = isSequence(value) || replacementQuery(value) ? value : ''
      editor.reset(typed)
      if (!typed && of) editor.lookup.read(of).then(found => {
        if (char !== of) return
        const first = found?.status === 'ready' ? found.sequences.find(s => !parse(s.text, { open: true }).problem) : undefined
        if (!editor.draft && first) editor.reset(first.text)
      })
    })
  })
  $effect(() => {
    const given = value
    untrack(() => { if (given !== seen && given !== editor.draft) editor.reset(isSequence(given) || replacementQuery(given) ? given : '') })
  })
  function use() { if (editor.usable && !disabled) onuse?.(editor.whole) }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ids-input" bind:this={root} onkeydown={event => editor.keydown(event, { root, slot })}>
  <div class="ids-top">
    <div class="ids-top-field"><IdsSequence {editor} onenter={use} /></div>
    {#if preview}
      <div class="ids-own-preview">{@render preview(editor.whole, editor.usable)}</div>
    {:else if adapter.preview || adapter.drawing}
      <IdsPreview {adapter} tree={editor.tree} chosen={editor.chosen} {messages} {locale} notes={false} />
    {/if}
  </div>
  <IdsOperators {editor} {keyHints} />
  <IdsTree {editor} {keyHints} />
  <IdsPartTools {editor} {keyHints} bind:slot />
  <IdsPicker {editor} {pickers} {recentKey} />
  <div class="ids-actions">
    <button type="button" class="ids-undo" disabled={disabled || !editor.canUndo} title={editor.steps.done.at(-1) ? t('ids.undo.named', { step: editor.steps.done.at(-1) ?? '' }) : t('ids.undo')}
      aria-keyshortcuts="Control+Z Meta+Z" onclick={() => editor.undo()}>{t('ids.undo')}{#if keyHints}<kbd aria-hidden="true">{shortcut('mod+z', undefined, { compact: true })}</kbd>{/if}</button>
    <button type="button" class="ids-redo" disabled={disabled || !editor.canRedo} title={editor.steps.undone[0] ? t('ids.redo.named', { step: editor.steps.undone[0] }) : t('ids.redo')}
      aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" onclick={() => editor.redo()}>{t('ids.redo')}{#if keyHints}<kbd aria-hidden="true">{shortcut('mod+shift+z', undefined, { compact: true })}</kbd>{/if}</button>
    {#if onuse}<button type="button" class="ids-use" disabled={disabled || !editor.usable} onclick={use}>{t('ids.use')}{#if keyHints}<kbd aria-hidden="true">{shortcut('enter', undefined, { compact: true })}</kbd>{/if}</button>{/if}
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
    --_font:var(--ids-font,"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",sans-serif);
    display:flex;flex-direction:column;gap:12px;min-width:0;color:var(--_ink)}
  .ids-top{display:flex;gap:12px;align-items:flex-start}
  .ids-top-field{flex:1;min-width:0}
  .ids-own-preview{flex:none}
  .ids-input :global(.ids-tree){border:1px solid var(--_line);border-radius:12px;background:var(--_surface-subtle);min-height:96px}
  .ids-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
  .ids-actions button{position:relative;display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:0 16px 0 12px;font:inherit;font-size:13px;color:inherit;cursor:pointer;
    border:1px solid var(--_line);border-radius:8px;background:var(--_surface)}
  .ids-actions button:disabled{cursor:default;opacity:.5}
  .ids-actions button:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-actions kbd{position:absolute;right:4px;bottom:2px;font:500 9px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--_muted);pointer-events:none}
  .ids-use:not(:disabled){margin-left:auto;border-color:var(--_accent);background:var(--_accent);color:var(--_surface)}
  .ids-use:not(:disabled) kbd{color:inherit;opacity:.8}
</style>
