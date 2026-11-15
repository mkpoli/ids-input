<script module>
  import { isNode } from '../core/ids.js'

  /** What can stand in place of the editor's chosen part, in groups by how it was found.
   * @param {import('./editor.svelte.js').Editor} editor */
  export function alternativeGroups(editor) {
    const picked = editor.picked, found = editor.alternatives.found
    const part = typeof picked === 'string' ? picked : ''
    const swaps = part ? editor.swaps : [], splits = part ? editor.splits : [], merges = isNode(picked) ? editor.merges : []
    const extra = found.filter(({ text }) => !splits.includes(text) && !merges.includes(text) && !swaps.some(swap => swap.char === text))
    return {
      swaps, splits, merges,
      merged: extra.filter(option => option.operation === 'merge'),
      split: extra.filter(option => option.operation === 'expand'),
      both: extra.filter(option => option.operation === 'both'),
    }
  }

  /** Whether the chosen part has alternatives to list, or a search that may still find some.
   * @param {import('./editor.svelte.js').Editor} editor @param {number} [unifiable] how many UCV entries offer a form */
  export function hasAlternatives(editor, unifiable = 0) {
    const groups = alternativeGroups(editor), search = editor.alternatives
    return (typeof editor.picked === 'string' && unifiable > 0) || groups.swaps.length + groups.splits.length + groups.merges.length + groups.merged.length + groups.split.length + groups.both.length > 0
      || search.truncated || search.failed
  }
</script>

<script>
  // The alternatives of the editor's chosen part: the components that can stand for it, the
  // descriptions it splits into, the characters it merges to, and the recursive combinations of
  // splitting and merging, and with `variations` the forms the IRG unifies with it (its UCV entries),
  // each under its own heading. `onchoose` hears an alternative being used; `onspent`, the search
  // asked for more having found everything. With nothing to offer it shows nothing.
  import { write } from '../core/ids.js'
  import { createUnifiable } from './unifiable.svelte.js'

  /** @type {{ editor: import('./editor.svelte.js').Editor, variations?: boolean, variationsHref?: ((entry: string) => string) | null, onchoose?: () => void, onspent?: () => void }} */
  let { editor, variations = false, variationsHref = null, onchoose, onspent } = $props()
  const t = $derived(editor.t)
  const uid = $props.id()
  const search = $derived(editor.alternatives)
  const groups = $derived(alternativeGroups(editor))
  const picked = $derived(editor.picked)
  const part = $derived(typeof picked === 'string' ? picked : '')
  const written = $derived(isNode(picked) ? write(picked) : '')
  const unifiable = createUnifiable(() => variations ? part : '')
  $effect(() => { search.load() })

  /** @param {() => unknown} use */
  function choose(use) { if (use() !== false) onchoose?.() }
  /** @type {HTMLButtonElement | null} */ let moreButton = $state(null)
  let reading = false
  // The button goes when the list is complete; the host keeps the reader's place.
  $effect(() => {
    if (search.loading || !reading) return
    reading = false
    if (!search.truncated) onspent?.()
  })
</script>

{#if hasAlternatives(editor, unifiable.entries.length)}
<div class="ids-options">
  {#if groups.swaps.length}
    <div class="ids-option-group" role="group" aria-labelledby={`${uid}-replace`}>
      <span class="ids-option-label" id={`${uid}-replace`}>{t('ids.alternatives.replace')}</span>
      <div class="ids-option-items">
        {#each groups.swaps as item (item.char)}
          <button type="button" class="ids-swap" disabled={editor.disabled} title={item.count ? `${part} → ${item.char} · ${item.count}` : `${part} → ${item.char}`}
            draggable="true" ondragstart={event => event.dataTransfer?.setData('text/plain', item.char)} onclick={() => choose(() => editor.take(item.char))}>{item.char}</button>
        {/each}
      </div>
    </div>
  {/if}
  {#if part && unifiable.entries.length}
    <div class="ids-option-group" role="group" aria-labelledby={`${uid}-unified`}>
      <span class="ids-option-label" id={`${uid}-unified`}>{t('ids.alternatives.unifiable')}</span>
      {#each unifiable.entries as entry (entry.id)}
        <div class="ids-option-items ids-unified" data-ucv={entry.id}>
          {#if variationsHref}<a class="ids-unified-entry" href={variationsHref(entry.id)} target="_blank" rel="noreferrer">UCV {entry.id}</a>
          {:else}<span class="ids-unified-entry">UCV {entry.id}</span>{/if}
          {#each entry.forms as form, place (place)}
            {@const outline = unifiable.outlines?.[form.glyph]}
            {#if form.text}
              {@const text = form.text}
              <button type="button" class="ids-swap ids-unified-form" data-form={form.glyph} disabled={editor.disabled} title={`${part} → ${text}`} aria-label={`${part} → ${text}`}
                draggable="true" ondragstart={event => event.dataTransfer?.setData('text/plain', text)} onclick={() => choose(() => editor.take(text))}>
                {#if outline}<svg viewBox="0 0 200 200" aria-hidden="true"><path d={outline} /></svg>{:else}{text}{/if}
              </button>
            {:else if outline}
              <span class="ids-unified-form" data-form={form.glyph} role="img" title={t('ids.ucv.form', { name: form.glyph })} aria-label={t('ids.ucv.form', { name: form.glyph })}>
                <svg viewBox="0 0 200 200" aria-hidden="true"><path d={outline} /></svg>
              </span>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  {/if}
  {#if groups.merges.length || groups.merged.length}
    <div class="ids-option-group" role="group" aria-labelledby={`${uid}-merge`}>
      <span class="ids-option-label" id={`${uid}-merge`}>{t('ids.alternatives.merge')}</span>
      <div class="ids-option-items">
        {#each groups.merges as char (char)}
          <button type="button" class="ids-swap ids-merge" disabled={editor.disabled} title={t('ids.merge', { part: written, char })}
            aria-label={t('ids.merge', { part: written, char })} onclick={() => choose(() => editor.merge(char))}>{char}</button>
        {/each}
        {#each groups.merged as option (option.text)}
          <button type="button" class="ids-swap ids-merge" disabled={editor.disabled} title={t('ids.use')} onclick={() => choose(() => editor.put(option.tree, editor.chosen))}>{option.text}</button>
        {/each}
      </div>
    </div>
  {/if}
  {#if groups.splits.length || groups.split.length}
    <div class="ids-option-group" role="group" aria-labelledby={`${uid}-split`}>
      <span class="ids-option-label" id={`${uid}-split`}>{t('ids.alternatives.split')}</span>
      <div class="ids-option-items">
        {#each groups.splits as sequence (sequence)}
          <button type="button" class="ids-swap ids-split" disabled={editor.disabled} title={t('ids.split', { part })}
            onclick={() => choose(() => editor.take(sequence))}>{sequence}</button>
        {/each}
        {#each groups.split as option (option.text)}
          <button type="button" class="ids-swap ids-split" disabled={editor.disabled} title={t('ids.use')} onclick={() => choose(() => editor.put(option.tree, editor.chosen))}>{option.text}</button>
        {/each}
      </div>
    </div>
  {/if}
  {#if groups.both.length}
    <div class="ids-option-group" role="group" aria-labelledby={`${uid}-both`}>
      <span class="ids-option-label" id={`${uid}-both`}>{t('ids.alternatives.both')}</span>
      <div class="ids-option-items">
        {#each groups.both as option (option.text)}
          <button type="button" class="ids-swap ids-split" disabled={editor.disabled} title={t('ids.use')} onclick={() => choose(() => editor.put(option.tree, editor.chosen))}>{option.text}</button>
        {/each}
      </div>
    </div>
  {/if}
  {#if search.truncated}
    <button type="button" class="ids-more" bind:this={moreButton} aria-disabled={search.loading}
      onclick={() => { reading = document.activeElement === moreButton; search.more() }}>{t('ids.alternatives.more')}</button>
  {/if}
  <span class="ids-status" role="status">{search.loading && search.level > 0 ? t('ids.from.searching') : search.failed ? t('ids.from.searchFailed') : ''}</span>
</div>
{/if}

<style>
  .ids-options{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_muted:var(--ids-muted,light-dark(#686874,#9d9daa));
    --_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));--_surface:var(--ids-surface,light-dark(#fff,#1b1b20));
    --_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));--_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));
    --_font:var(--ids-font,"IDS Numbered","IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Jurchen","IDS Operators","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif);
    display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--_ink)}
  :where(.ids-options) button{font:inherit;color:inherit;border:1px solid var(--_line);border-radius:8px;background:var(--_surface);cursor:pointer}
  :where(.ids-options) button:disabled{cursor:default;opacity:.5}
  :where(.ids-options) button:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-option-group{display:flex;flex-direction:column;gap:4px;min-width:0}
  .ids-option-label{font-size:11px;font-weight:500;letter-spacing:.02em;color:var(--_muted)}
  .ids-option-items{display:flex;flex-wrap:wrap;gap:6px}
  .ids-unified{align-items:center}
  .ids-unified-entry{flex:none;font-size:11px;line-height:1;padding:3px 6px;border:1px solid var(--_line);border-radius:5px;color:var(--_muted);white-space:nowrap;text-decoration:none;font-variant-numeric:tabular-nums}
  a.ids-unified-entry:hover{border-color:var(--_accent);color:var(--_accent)}
  .ids-unified-form{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:40px;height:36px}
  span.ids-unified-form{padding:3px}
  span.ids-unified-form{border:1px dashed var(--_line);border-radius:8px}
  .ids-unified-form svg{width:28px;height:28px;fill:currentColor}
  .ids-swap{min-width:40px;padding:2px 8px;font-size:22px;line-height:1.25;font-family:var(--_font)}
  .ids-split{max-width:100%;overflow-wrap:anywhere;text-align:left;font-size:16px;color:var(--_muted)}
  .ids-merge{font-weight:500}
  .ids-more{align-self:flex-start;padding:4px 8px;font-size:12px}
  .ids-status{font-size:11px;color:var(--_muted)}
  .ids-status:empty{display:none}
  .ids-swap:not(:disabled):hover{border-color:var(--_accent)}
  @media (pointer: coarse){
    .ids-swap{min-height:44px;padding:4px 10px}
    .ids-more{min-height:44px;padding:8px 12px;font-size:14px}
  }
</style>
