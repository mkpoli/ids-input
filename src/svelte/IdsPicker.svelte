<script>
  // Where parts come from, in tabs: components the adapter's search finds, the parts palette
  // (IdsParts) and the parts of any character or description typed (IdsFrom), each only where the
  // adapter can answer it. A part picked goes in `editor`'s chosen slot, or the first empty one; parts
  // can also be dragged onto the tree. Arrow keys, Home and End move between the tabs.
  import { untrack } from 'svelte'
  import IdsFrom from './IdsFrom.svelte'
  import IdsParts from './IdsParts.svelte'
  import IdsTemplates from './IdsTemplates.svelte'

  /** @typedef {'find' | 'characters' | 'parts' | 'from' | 'templates'} Tab */
  /** @type {{ editor: import('./editor.svelte.js').Editor, pickers?: Tab[], recentKey?: string | null, tab?: Tab | null, fromText?: string, title?: boolean }} */
  let { editor, pickers = ['find', 'characters', 'parts', 'from', 'templates'], recentKey = 'ids-input.recentParts', tab = $bindable(null), fromText = $bindable(''), title = true } = $props()
  const t = $derived(editor.t)
  const adapter = $derived(editor.adapter)
  const uid = $props.id()
  const shown = $derived(pickers.filter(name => name === 'find' ? Boolean(adapter.search)
    : name === 'characters' ? Boolean(adapter.searchCharacters)
    : name === 'parts' ? Boolean(adapter.parts) : true))
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

  // The find tab: components the adapter's search answers for what is typed, once the typing settles.
  let query = $state('')
  /** @type {{ status: 'idle' | 'loading' | 'ready' | 'failed', items: import('../adapter/types.js').Found[] }} */
  let found = $state({ status: 'idle', items: [] })
  $effect(() => {
    const asked = query.trim(), search = adapter.search
    if (!asked || !search) { found = { status: 'idle', items: [] }; return }
    const controller = new AbortController()
    found = { status: 'loading', items: [] }
    const timer = setTimeout(() => search(asked, { signal: controller.signal, limit: 24 }).then(
      items => { if (!controller.signal.aborted) found = { status: 'ready', items: items ?? [] } },
      () => { if (!controller.signal.aborted) found = { status: 'failed', items: [] } }), 150)
    return () => { clearTimeout(timer); controller.abort() }
  })
  // The characters tab: characters whose readings or meanings answer for what is typed.
  let characterQuery = $state('')
  /** @type {{ status: 'idle' | 'loading' | 'ready' | 'failed', items: import('../adapter/types.js').Found[] }} */
  let characters = $state({ status: 'idle', items: [] })
  $effect(() => {
    const asked = characterQuery.trim(), search = adapter.searchCharacters
    if (!asked || !search) { characters = { status: 'idle', items: [] }; return }
    const controller = new AbortController()
    characters = { status: 'loading', items: [] }
    const timer = setTimeout(() => search(asked, { signal: controller.signal, limit: 24 }).then(
      items => { if (!controller.signal.aborted) characters = { status: 'ready', items: items ?? [] } },
      () => { if (!controller.signal.aborted) characters = { status: 'failed', items: [] } }), 150)
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
              <input type="search" bind:value={query} disabled={editor.disabled} lang="ja" spellcheck="false" autocomplete="off"
                aria-label={t('ids.search')} placeholder={t('ids.find.placeholder')} />
              {#if found.status === 'loading'}<p class="ids-note">{t('ids.from.searching')}</p>
              {:else if found.status === 'failed'}<p class="ids-note fault">{t('ids.from.searchFailed')}</p>
              {:else if found.status === 'ready' && !found.items.length}<p class="ids-note">{t('parts.none')}</p>
              {:else if found.items.length}
                <div class="ids-found">
                  {#each found.items as item (item.char)}
                    <button type="button" class="ids-hit" data-character={item.char} disabled={editor.disabled} lang="ja" title={item.label ? `${item.char} ${item.label}` : item.char}
                      draggable="true" ondragstart={event => event.dataTransfer?.setData('text/plain', item.char)}
                      onclick={() => { query = ''; editor.take(item.char) }}><span class="ids-hit-char">{item.char}</span>{#if item.label}<span class="ids-hit-label">{item.label}</span>{/if}</button>
                  {/each}
                </div>
              {/if}
            </div>
          {:else if name === 'characters'}
            <div class="ids-find">
              <input type="search" bind:value={characterQuery} disabled={editor.disabled} lang="ja" spellcheck="false" autocomplete="off"
                aria-label={t('ids.pick.characters')} placeholder={t('ids.characters.placeholder')} />
              {#if characters.status === 'loading'}<p class="ids-note">{t('ids.from.searching')}</p>
              {:else if characters.status === 'failed'}<p class="ids-note fault">{t('ids.from.searchFailed')}</p>
              {:else if characters.status === 'ready' && !characters.items.length}<p class="ids-note">{t('ids.characters.none')}</p>
              {:else if characters.items.length}
                <div class="ids-found">
                  {#each characters.items as item (item.char)}
                    <button type="button" class="ids-hit" data-character={item.char} disabled={editor.disabled} lang="ja" title={item.label ? `${item.char} ${item.label}` : item.char}
                      draggable="true" ondragstart={event => event.dataTransfer?.setData('text/plain', item.char)}
                      onclick={() => { characterQuery = ''; editor.take(item.char) }}><span class="ids-hit-char">{item.char}</span>{#if item.label}<span class="ids-hit-label">{item.label}</span>{/if}</button>
                  {/each}
                </div>
              {/if}
            </div>
          {:else if name === 'templates'}<IdsTemplates {editor} />
          {:else if name === 'parts'}<IdsParts {adapter} disabled={editor.disabled} messages={editor.messages} locale={editor.locale} {recentKey} onpick={part => editor.take(part)} />
          {:else}<IdsFrom {adapter} lookup={editor.lookup} disabled={editor.disabled} messages={editor.messages} locale={editor.locale} bind:text={fromText} ontake={part => editor.take(part)} />{/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .ids-search{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));--_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));
    --_line-strong:var(--ids-line-strong,light-dark(#b0b0ba,#5c5c67));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_surface-selected:var(--ids-surface-selected,light-dark(#e8e8ee,#30303a));
    --_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));--_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));
    --_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",sans-serif);
    display:flex;flex-direction:column;gap:6px;min-width:0;color:var(--_ink)}
  :where(.ids-search) :is(button,input){font:inherit;color:inherit;border:1px solid var(--_line);border-radius:8px;background:var(--_surface)}
  :where(.ids-search) button{cursor:pointer}
  :where(.ids-search) :is(button,input):focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-title{font-size:11px;color:var(--_muted)}
  .ids-pick-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:3px;border-radius:10px;background:var(--_surface-subtle);border:1px solid var(--_line)}
  .ids-pick-tabs button{flex:1 1 auto;border:0;background:transparent;font-size:12.5px;padding:6px 8px;white-space:nowrap;border-radius:7px;color:var(--_muted)}
  .ids-pick-tabs button.active{background:var(--_surface);color:var(--_ink);box-shadow:0 1px 2px rgb(0 0 0 / .12)}
  .ids-pick-panel{min-width:0}
  .ids-pick-panel[hidden]{display:none}
  .ids-find{display:flex;flex-direction:column;gap:6px}
  .ids-find input{font-size:14px;padding:7px 10px}
  .ids-found{display:flex;flex-wrap:wrap;gap:4px}
  .ids-hit{display:flex;align-items:baseline;gap:6px;max-width:100%;min-width:0;padding:2px 8px;border-color:transparent;background:var(--_surface-subtle)}
  .ids-hit:not(:disabled):hover{border-color:var(--_accent)}
  .ids-hit-char{flex:none;font-size:22px;font-family:var(--_font)}
  .ids-hit-label{min-width:0;max-width:16ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--_muted);font-variant-numeric:tabular-nums}
  .ids-note{margin:0;font-size:11px;color:var(--_muted)}
  .ids-note.fault{color:var(--_fault)}
</style>
