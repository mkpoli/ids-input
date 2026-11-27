<script>
  // The editor's description respelled where it writes a component in full in a place characters
  // write a positional form of it (竹 on top, written 𥫗). It is offered beside what was typed and
  // put in the editor only when chosen; `onchoose` hears that. With nothing to offer, or an adapter
  // without `positionalForms`, it shows nothing.
  import { write } from '../core/ids.js'
  import { positionalSuggestion } from '../core/positional.js'

  /** @type {{ editor: import('./editor.svelte.js').Editor, onchoose?: () => void }} */
  let { editor, onchoose } = $props()
  const t = $derived(editor.t)
  /** @type {Map<string, import('../core/positional.js').PositionalForm> | null} */
  let forms = $state(null)
  $effect(() => {
    const ask = editor.adapter?.positionalForms
    if (!ask) { forms = null; return }
    let current = true
    ask().then(found => { if (current) forms = found }, () => {})
    return () => { current = false }
  })
  const found = $derived(forms && editor.tree !== null && !editor.problem ? positionalSuggestion(editor.tree, forms) : null)
  const count = (/** @type {number} */ n) => n.toLocaleString(editor.locale)
  // Each respelled component with how many characters are described either way.
  const evidence = $derived(found ? found.changes.map(change => `${change.from} ${count(change.written)} · ${change.to} ${count(change.formed)}`).join('\n') : '')
</script>

{#if found}
  {@const respelled = found.tree}
  <p class="ids-suggestion">
    <span class="ids-suggestion-label">{t('ids.suggestion.label')}</span>
    <button type="button" class="ids-suggestion-take" disabled={editor.disabled} title={evidence}
      onclick={() => { if (editor.put(respelled, []) !== false) onchoose?.() }}>{write(respelled)}</button>
  </p>
{/if}

<style>
  .ids-suggestion{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_muted:var(--ids-muted,light-dark(#686874,#9d9daa));
    --_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));--_surface:var(--ids-surface,light-dark(#fff,#1b1b20));
    --_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));--_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));
    --_font:var(--ids-font,"IDS Numbered","IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Jurchen","IDS Operators","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif);
    display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;min-width:0;margin:0;color:var(--_ink)}
  .ids-suggestion-label{font-size:12px;color:var(--_muted)}
  .ids-suggestion-take{max-width:100%;padding:2px 8px;border:1px solid var(--_line);border-radius:8px;background:var(--_surface);color:var(--_accent);
    font:16px/1.4 var(--_font);overflow-wrap:anywhere;text-align:left;cursor:pointer}
  .ids-suggestion-take:not(:disabled):hover{border-color:var(--_accent)}
  .ids-suggestion-take:disabled{cursor:default;opacity:.5}
  .ids-suggestion-take:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  @media (pointer: coarse){ .ids-suggestion-take{min-height:44px;padding:8px 12px} }
</style>
