<script>
  // The operator palette, grouped by how many parts each operator takes, with a key for an empty slot
  // after them. A button puts its operator on the chosen part of `editor`, or wraps the whole tree if
  // none is chosen; each shows its key unless `keyHints` is off, and names itself with its key on hover.
  import { OPERATOR_GROUPS } from '../core/ids.js'
  import { EMPTY_KEY, KEY_OF } from '../core/keys.js'
  import OperatorIcon from './OperatorIcon.svelte'
  import { shortcut } from './shortcut.js'

  /** @type {{ editor: import('./editor.svelte.js').Editor, keyHints?: boolean, size?: number }} */
  let { editor, keyHints = true, size = 24 } = $props()
  const t = $derived(editor.t)
  const uid = $props.id()
  const picked = $derived(editor.picked)
  // The short groups side by side first, the empty slot's key after them, then the long group across.
  const groups = [1, 3, 'empty', 2].map(n => n === 'empty' ? 'empty'
    : /** @type {typeof OPERATOR_GROUPS[number]} */ (OPERATOR_GROUPS.find(group => group.arity === n)))
</script>

<div class="ids-operators" role="group" aria-label={t('ids.operators')}>
  {#each groups as item (typeof item === 'string' ? item : item.arity)}
    {#if item === 'empty'}
      <div class="ids-op-group" data-arity="0" role="group" aria-labelledby={`${uid}-ops-empty`}>
        <span class="ids-op-label" id={`${uid}-ops-empty`}>{t('ids.empty')}</span>
        <div class="ids-op-keys">
          <button type="button" class="ids-key ids-key-empty" disabled={editor.disabled || !editor.chosen || picked === null || picked === undefined}
            aria-label={t('ids.empty')} aria-keyshortcuts={EMPTY_KEY} title={`${t('ids.empty')} (${shortcut(EMPTY_KEY)})`}
            onclick={() => editor.empty(editor.chosen)}>
            <span class="ids-empty-glyph" aria-hidden="true">⬚</span>{#if keyHints}<kbd class="ids-kbd" aria-hidden="true">{shortcut(EMPTY_KEY)}</kbd>{/if}
          </button>
        </div>
      </div>
    {:else}
      <div class="ids-op-group" data-arity={item.arity} role="group" aria-labelledby={`${uid}-ops-${item.arity}`}>
        <span class="ids-op-label" id={`${uid}-ops-${item.arity}`}>{t(`ids.group.${item.arity}`)}</span>
        <div class="ids-op-keys">
          {#each item.ops as op (op)}
            <button type="button" class="ids-key" data-op={op} disabled={editor.disabled} aria-label={editor.name(op)} aria-keyshortcuts={KEY_OF[op]}
              title={t('ids.operatorTitle', { op, name: editor.name(op), key: shortcut(KEY_OF[op]) })} onclick={() => editor.operator(op)}>
              <OperatorIcon {op} {size} />{#if keyHints}<kbd class="ids-kbd" aria-hidden="true">{shortcut(KEY_OF[op])}</kbd>{/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
</div>

<style>
  .ids-operators{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#686874,#9d9daa));--_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));
    --_line-strong:var(--ids-line-strong,light-dark(#c2c2cc,#4a4a55));--_surface:var(--ids-surface,light-dark(#fff,#1b1b20));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));--_surface-selected:var(--ids-surface-selected,light-dark(#eeeef3,#26262d));
    --_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));--_accent-light:var(--ids-accent-light,light-dark(#e9edfd,#232c4c));
    --_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback,"IDS Fallback"),sans-serif);
    display:flex;flex-wrap:wrap;gap:10px 16px;min-width:0;color:var(--_ink)}
  .ids-op-group{display:flex;flex-direction:column;gap:4px;min-width:0}
  .ids-op-group[data-arity="2"]{flex:1 1 100%}
  .ids-op-label{font-size:11px;font-weight:500;letter-spacing:.02em;color:var(--_muted)}
  .ids-op-keys{display:grid;grid-template-columns:repeat(auto-fill,minmax(40px,1fr));gap:4px}
  .ids-op-group:not([data-arity="2"]) .ids-op-keys{grid-template-columns:repeat(3,40px)}
  .ids-op-group[data-arity="3"] .ids-op-keys{grid-template-columns:repeat(2,40px)}
  .ids-op-group[data-arity="0"] .ids-op-keys{grid-template-columns:40px}
  .ids-empty-glyph{font-family:var(--_font);font-size:20px;line-height:1}
  .ids-key{position:relative;display:grid;place-items:center;height:40px;padding:0;font:inherit;color:inherit;cursor:pointer;
    border:1px solid var(--_line);border-radius:8px;background:var(--_surface);transition:border-color .12s,background-color .12s}
  .ids-key:not(:disabled):hover{border-color:var(--_accent);background:var(--_accent-light)}
  .ids-key:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-key:disabled{cursor:default;opacity:.55}
  .ids-kbd{position:absolute;right:3px;bottom:2px;font:500 9px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--_muted);pointer-events:none}
</style>
