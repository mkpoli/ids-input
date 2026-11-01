<script>
  // Where parts come from, in tabs: components and characters the adapter's search finds, by name or
  // by a drawing, the parts palette (IdsParts), the parts of any character or description typed
  // (IdsFrom) and structure templates (IdsTemplates), each only where the adapter can answer it. A
  // part picked goes in `editor`'s chosen slot, or the first empty one; parts can also be dragged
  // onto the tree. Arrow keys, Home and End move between the tabs.
  import { tick, untrack } from 'svelte'
  import { isMarks } from '../core/ids.js'
  import IdsFrom from './IdsFrom.svelte'
  import IdsParts from './IdsParts.svelte'
  import IdsSketch from './IdsSketch.svelte'
  import IdsTemplates from './IdsTemplates.svelte'
  import { loadStrokeRecords } from './strokes.js'
  import { strokeSummary } from './i18n.js'

  /** @typedef {'find' | 'parts' | 'from' | 'templates'} Tab */
  /** @type {{ editor: import('./editor.svelte.js').Editor, pickers?: Tab[], recentKey?: string | null, tab?: Tab | null, fromText?: string, title?: boolean }} */
  let { editor, pickers = ['find', 'parts', 'from', 'templates'], recentKey = 'ids-input.recentParts', tab = $bindable(null), fromText = $bindable(''), title = true } = $props()
  const t = $derived(editor.t)
  const adapter = $derived(editor.adapter)
  const uid = $props.id()
  const shown = $derived(pickers.filter(name => name === 'find' ? Boolean(adapter.search) : name === 'parts' ? Boolean(adapter.parts) : true))
  let opened = $state(new Set(/** @type {string[]} */ ([])))
  const current = $derived(tab && shown.includes(tab) ? tab : shown[0])
  $effect(() => { if (current && !opened.has(current)) untrack(() => { opened = new Set([...opened, current]) }) })
  // Asking for the From tab's text from outside opens it.
  $effect(() => { if (fromText) untrack(() => { if (shown.includes('from')) tab = 'from' }) })
  /** @type {HTMLButtonElement[]} */
  let buttons = $state([])
  /** @param {KeyboardEvent} event @param {number} index */
  function tabKey(event, index) {
    const last = shown.length - 1
    const to = /** @type {Record<string, number>} */ ({ ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last })[event.key]
    if (to === undefined) return
    event.preventDefault()
    tab = shown[to]
    buttons[to]?.focus()
  }

  // The find tab: components and characters the adapter's search answers for what is typed, once
  // the typing settles.
  let query = $state('')
  // The find tab also takes a drawing: the same palette, looked for by shape instead of by name.
  let drawing = $state(false)
  let field = $state(/** @type {HTMLInputElement | null} */ (null))
  /** Leave the pad and put the cursor back in the field. */
  function type() {
    drawing = false
    tick().then(() => field?.focus())
  }
  /** @type {{ status: 'idle' | 'loading' | 'ready' | 'failed', items: import('../adapter/types.js').Found[] }} */
  let found = $state({ status: 'idle', items: [] })
  // A stroke count narrows the found characters, and every hit's tooltip says how many strokes it
  // has and which stroke it starts with; the table loads on first use, once for both.
  let strokeLimit = $state('')
  let strokeRecords = $state.raw(/** @type {Map<string, import('./strokes.js').StrokeRecord> | null} */ (null))
  $effect(() => {
    if (strokeRecords) return
    loadStrokeRecords().then(records => { strokeRecords = records }).catch(() => { strokeRecords = new Map() })
  })
  const strokeCounts = $derived(strokeRecords && new Map([...strokeRecords].map(([char, record]) => [char, record.strokes])))
  const wantedStrokes = $derived(strokeLimit === '' ? null : Number(strokeLimit))
  const foundItems = $derived.by(() => {
    const counts = strokeCounts, wanted = wantedStrokes
    if (wanted === null || !counts) return found.items
    return found.items.filter(item => counts.get(item.char) === wanted)
  })
  /** What a found character's tooltip says: its label, then its stroke count and first stroke. */
  const hitTitle = (/** @type {import('../adapter/types.js').Found} */ item) => [
    item.label ? `${item.char} ${item.label}` : item.char,
    strokeSummary(t, strokeRecords?.get(item.char)),
  ].filter(Boolean).join(' · ')
  $effect(() => {
    const asked = query.trim(), search = adapter.search, stroke = strokeLimit
    if (!asked || !search) { found = { status: 'idle', items: [] }; return }
    const controller = new AbortController()
    found = { status: 'loading', items: [] }
    const timer = setTimeout(() => search(asked, { signal: controller.signal, limit: stroke === '' ? 24 : 120 }).then(
      items => { if (!controller.signal.aborted) found = { status: 'ready', items: items ?? [] } },
      () => { if (!controller.signal.aborted) found = { status: 'failed', items: [] } }), 150)
    return () => { clearTimeout(timer); controller.abort() }
  })
  const picked = $derived(editor.picked)
</script>

{#if shown.length}
  <div class="ids-search">
    {#if title}<span class="ids-title">{editor.chosen && picked !== null && picked !== undefined ? t('ids.replace', { part: editor.text(picked) }) : t('ids.insert')}</span>{/if}
    <div class="ids-pick-tabs" role="tablist" aria-label={t('ids.pick.label')}>
      {#each shown as name, index (name)}
        <button type="button" role="tab" id={`${uid}-pick-${name}`} aria-controls={opened.has(name) ? `${uid}-pick-${name}-panel` : undefined} bind:this={buttons[index]}
          class:active={current === name} aria-selected={current === name} tabindex={current === name ? 0 : -1}
          onclick={() => tab = name} onkeydown={event => tabKey(event, index)}>{t(`ids.pick.${name}`)}</button>
      {/each}
    </div>
    <!-- A picker once opened stays, hidden while another is shown, so what was typed in it is kept. -->
    {#each shown as name (name)}
      {#if opened.has(name)}
        <div class="ids-pick-panel" role="tabpanel" id={`${uid}-pick-${name}-panel`} aria-labelledby={`${uid}-pick-${name}`} hidden={current !== name}>
          {#if name === 'find'}
            <div class="ids-find">
              {#if drawing}
                <IdsSketch {adapter} disabled={editor.disabled} messages={editor.messages} locale={editor.locale}
                  onpick={part => editor.take(part, undefined, { loose: isMarks(part) })} onclose={type} />
              {:else}
                <div class="ids-find-row">
                  <input bind:this={field} type="search" bind:value={query} disabled={editor.disabled} lang="ja" spellcheck="false" autocomplete="off"
                    aria-label={t('ids.search.label')} placeholder={t('ids.find.placeholder')} />
                  <input class="ids-strokes" type="number" min="1" max="40" inputmode="numeric" autocomplete="off"
                    aria-label={t('ids.search.strokes')} placeholder={t('ids.search.strokesAny')} value={strokeLimit}
                    oninput={event => { strokeLimit = event.currentTarget.value }} />
                  {#if adapter.parts}
                    <button type="button" class="ids-draw-toggle" disabled={editor.disabled} title={t('ids.draw.open')} aria-label={t('ids.draw.open')}
                      onclick={() => { drawing = true; query = '' }}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1L19 8.2 15.8 5 5 15.8 4 20Z" /><path d="m13.8 7 3.2 3.2" /></svg>
                    </button>
                  {/if}
                </div>
                {#if found.status === 'loading'}<p class="ids-note">{t('ids.from.searching')}</p>
                {:else if found.status === 'failed'}<p class="ids-note fault">{t('ids.from.searchFailed')}</p>
                {:else if found.status === 'ready' && !foundItems.length}<p class="ids-note">{t('ids.search.none')}</p>
                {:else if foundItems.length}
                  <div class="ids-found">
                    {#each foundItems as item (item.char)}
                      <button type="button" class="ids-hit" data-character={item.char} disabled={editor.disabled} lang="ja" title={hitTitle(item)}
                        draggable="true" ondragstart={event => event.dataTransfer?.setData('text/plain', item.char)}
                        onclick={() => { query = ''; editor.take(item.char) }}><span class="ids-hit-char">{item.char}</span>{#if item.label}<span class="ids-hit-label">{item.label}</span>{/if}</button>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
          {:else if name === 'templates'}<IdsTemplates {editor} />
          {:else if name === 'parts'}<IdsParts {adapter} disabled={editor.disabled} messages={editor.messages} locale={editor.locale} {recentKey} onpick={part => editor.take(part, undefined, { loose: isMarks(part) })} />
          {:else}<IdsFrom {adapter} lookup={editor.lookup} disabled={editor.disabled} messages={editor.messages} locale={editor.locale} bind:text={fromText} ontake={part => editor.take(part)} />{/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .ids-search{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#686874,#9d9daa));--_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));
    --_control-border:var(--ids-control-border,light-dark(#8a8a96,#6f6f7e));
    --_line-strong:var(--ids-line-strong,light-dark(#c2c2cc,#4a4a55));--_surface:var(--ids-surface,light-dark(#fff,#1b1b20));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));--_surface-selected:var(--ids-surface-selected,light-dark(#eeeef3,#26262d));
    --_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));--_accent-light:var(--ids-accent-light,light-dark(#e9edfd,#232c4c));
    --_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback,"IDS Fallback"),sans-serif);
    display:flex;flex-direction:column;gap:6px;min-width:0;color:var(--_ink)}
  :where(.ids-search) :is(button,input){font:inherit;color:inherit;border:1px solid var(--_line);border-radius:8px;background:var(--_surface)}
  :where(.ids-search) input{border-color:var(--_control-border)}
  :where(.ids-search) button{cursor:pointer}
  :where(.ids-search) :is(button,input):focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-title{font-size:11px;color:var(--_muted)}
  .ids-pick-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:3px;border-radius:10px;background:var(--_surface-subtle);border:1px solid var(--_line)}
  .ids-pick-tabs button{flex:1 1 auto;border:0;background:transparent;font-size:12.5px;padding:6px 8px;white-space:nowrap;border-radius:7px;color:var(--_muted)}
  .ids-pick-tabs button.active{background:var(--_surface);color:var(--_ink);box-shadow:0 1px 2px rgb(0 0 0 / .12)}
  .ids-pick-panel{min-width:0}
  .ids-pick-panel[hidden]{display:none}
  .ids-find{display:flex;flex-direction:column;gap:6px}
  .ids-find-row{display:flex;gap:6px;align-items:stretch}
  .ids-find input{flex:1;min-width:0;font-size:14px;padding:7px 10px}
  .ids-find input.ids-strokes{flex:0 0 58px;text-align:center}
  .ids-draw-toggle{display:inline-flex;align-items:center;justify-content:center;flex:none;width:36px;padding:0;color:var(--_muted)}
  .ids-draw-toggle:hover{color:var(--_accent)}
  .ids-draw-toggle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  .ids-found{display:flex;flex-wrap:wrap;gap:4px}
  .ids-hit{display:flex;align-items:baseline;gap:6px;max-width:100%;min-width:0;padding:2px 8px;border-color:transparent;background:var(--_surface-subtle)}
  .ids-hit:not(:disabled):hover{border-color:var(--_accent)}
  .ids-hit-char{flex:none;font-size:22px;font-family:var(--_font)}
  .ids-hit-label{min-width:0;max-width:16ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--_muted);font-variant-numeric:tabular-nums}
  .ids-note{margin:0;font-size:11px;color:var(--_muted)}
  .ids-note.fault{color:var(--_fault)}
</style>
