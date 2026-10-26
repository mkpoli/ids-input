<script>
  // The operator palette, grouped by how many parts each operator takes. A button puts its operator on
  // the chosen part (or the first empty slot) of `editor`; each shows its key in a corner unless
  // `keyHints` is off, and names itself with its key on hover.
  import { OPERATOR_GROUPS } from '../core/ids.js'
  import { KEY_OF } from '../core/keys.js'
  import OperatorIcon from './OperatorIcon.svelte'
  import { shortcut } from './shortcut.js'

  /** @type {{ editor: import('./editor.svelte.js').Editor, keyHints?: boolean, size?: number }} */
  let { editor, keyHints = true, size = 24 } = $props()
  const t = $derived(editor.t)
  const uid = $props.id()
  // The short groups side by side first, then the long one across.
  const groups = [1, 3, 2].map(n => /** @type {typeof OPERATOR_GROUPS[number]} */ (OPERATOR_GROUPS.find(group => group.arity === n)))
</script>

<div class="ids-operators" role="group" aria-label={t('ids.operators')}>
  {#each groups as group (group.arity)}
    <div class="ids-op-group" data-arity={group.arity} role="group" aria-labelledby={`${uid}-ops-${group.arity}`}>
      <span class="ids-op-label" id={`${uid}-ops-${group.arity}`}>{t(`ids.group.${group.arity}`)}</span>
      <div class="ids-op-keys">
        {#each group.ops as op (op)}
          <button type="button" class="ids-key" data-op={op} disabled={editor.disabled} aria-label={editor.name(op)} aria-keyshortcuts={KEY_OF[op]}
            title={t('ids.operatorTitle', { op, name: editor.name(op), key: shortcut(KEY_OF[op]) })} onclick={() => editor.operator(op)}>
            <OperatorIcon {op} {size} />{#if keyHints}<kbd class="ids-kbd" aria-hidden="true">{shortcut(KEY_OF[op])}</kbd>{/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .ids-operators{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));--_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));
    --_line-strong:var(--ids-line-strong,light-dark(#b0b0ba,#5c5c67));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_surface-selected:var(--ids-surface-selected,light-dark(#e8e8ee,#30303a));
    --_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));--_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));
    --_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Parts","IDS Tangut","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",sans-serif);
    display:flex;flex-wrap:wrap;gap:10px 16px;min-width:0;color:var(--_ink)}
  .ids-op-group{display:flex;flex-direction:column;gap:4px;min-width:0}
  .ids-op-group[data-arity="2"]{flex:1 1 100%}
  .ids-op-label{font-size:11px;font-weight:500;letter-spacing:.02em;color:var(--_muted)}
  .ids-op-keys{display:grid;grid-template-columns:repeat(auto-fill,minmax(40px,1fr));gap:4px}
  .ids-op-group:not([data-arity="2"]) .ids-op-keys{grid-template-columns:repeat(3,40px)}
  .ids-op-group[data-arity="3"] .ids-op-keys{grid-template-columns:repeat(2,40px)}
  .ids-key{position:relative;display:grid;place-items:center;height:40px;padding:0;font:inherit;color:inherit;cursor:pointer;
    border:1px solid var(--_line);border-radius:8px;background:var(--_surface);transition:border-color .12s,background-color .12s}
  .ids-key:not(:disabled):hover{border-color:var(--_accent);background:var(--_accent-light)}
  .ids-key:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-key:disabled{cursor:default;opacity:.55}
  .ids-kbd{position:absolute;right:3px;bottom:2px;font:500 9px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--_muted);pointer-events:none}
</style>
