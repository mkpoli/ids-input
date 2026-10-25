<script>
  // The sequence field of `editor`: the description as text, read as it is typed, ASCII operator
  // names (LR, ud) becoming operators. Enter calls `onenter`; a problem marks the field invalid.
  /** @type {{ editor: import('./editor.svelte.js').Editor, label?: boolean, placeholder?: string, onenter?: () => void }} */
  let { editor, label = true, placeholder = '⿰⿱匕失⿱コ疋', onenter } = $props()
  const t = $derived(editor.t)
  /** @type {HTMLInputElement | null} */ let field = $state(null)
  /** @param {Event} [event] */
  const edit = event => { if (!/** @type {InputEvent | undefined} */ (event)?.isComposing && field) editor.edit(field) }
</script>

<label class="ids-field">
  {#if label}<span class="ids-title">{t('ids.label')}</span>{/if}
  <input bind:this={field} value={editor.draft} disabled={editor.disabled} lang="ja" spellcheck="false" autocomplete="off"
    aria-label={label ? undefined : t('ids.label')} {placeholder} aria-invalid={Boolean(editor.problem)}
    oninput={edit} oncompositionend={() => edit()} onblur={() => editor.settle()}
    onkeydown={event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); onenter?.() } }} />
</label>

<style>
  .ids-field{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));--_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));
    --_line-strong:var(--ids-line-strong,light-dark(#b0b0ba,#5c5c67));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_surface-selected:var(--ids-surface-selected,light-dark(#e8e8ee,#30303a));
    --_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));--_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));
    --_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Parts","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",sans-serif);
    display:flex;flex-direction:column;gap:4px;min-width:0;color:var(--_ink)}
  .ids-title{font-size:11px;color:var(--_muted)}
  input{min-width:0;font:inherit;font-size:22px;padding:6px 10px;font-family:var(--_font);color:inherit;
    border:1px solid var(--_line);border-radius:8px;background:var(--_surface)}
  input::placeholder{color:color-mix(in srgb,var(--_muted) 70%,transparent)}
  input:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  input[aria-invalid="true"]{border-color:var(--_fault)}
</style>
