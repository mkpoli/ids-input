<script>
  // The parts palette: the parts of ideographic description sequences that are hard to type
  // (難輸入部件), as the adapter's `parts()` gives them (the shipped `data/ids-parts.json`). Common holds
  // the parts that are 常用漢字 or in the first level of the 通用规范汉字表, plus frequent components and compound IDS,
  // most used first; Tangut
  // the Tangut components in code point order; Stroke count holds all common and hard-to-type
  // parts, by stroke count and then by the class of the first stroke (横 豎 撇 點 折, where
  // recorded, unknown last); Strokes the CJK strokes; Recent the parts picked here before, kept in
  // this browser under `recentKey` (none kept when it is null). A filter of characters finds those
  // parts or matching compound IDS, a number the parts of that many strokes. Picking a part calls `onpick(part)`.
  import { onMount } from 'svelte'
  import IdsPartIcon from './IdsPartIcon.svelte'
  import { isSequence } from '../core/ids.js'
  import { translator } from './i18n.js'

  /**
   * @typedef {import('../adapter/types.js').IdsAdapter} IdsAdapter
   * @typedef {import('../adapter/types.js').PalettePart} PalettePart
   */
  /** @type {{ adapter: IdsAdapter, disabled?: boolean, messages?: Record<string, string>, locale?: string, recentKey?: string | null, onreviewSeal?: () => void, onpick?: (part: string) => void }} */
  let { adapter, disabled = false, messages, locale = 'en', recentKey = 'ids-input.recentParts', onpick, onreviewSeal } = $props()
  const t = $derived(translator(messages, locale))
  const uid = $props.id()

  const RECENT_MAX = 30
  /** @type {('横' | '豎' | '撇' | '點' | '折')[]} */
  const CLASSES = ['横', '豎', '撇', '點', '折']
  const CLASS_KEY = { 横: 'h', 豎: 's', 撇: 'p', 點: 'd', 折: 'z' }
  /** @type {('common' | 'tangut' | 'seal' | 'difficult' | 'strokes' | 'recent')[]} */
  const TABS = ['common', 'tangut', 'seal', 'difficult', 'strokes', 'recent']

  /** @param {string} key @returns {unknown} */
  const stored = key => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null } }
  /** @param {string} key @param {unknown} value */
  const remember = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Kept for this page only. */ } }

  let parts = $state.raw(/** @type {PalettePart[] | null} */ (null))
  let failed = $state(false)
  let tab = $state(/** @type {(typeof TABS)[number]} */ ('common')), filter = $state('')
  /** @type {number | null | undefined} */
  let count = $state(undefined)
  /** @type {string[]} */
  let recent = $state([])
  $effect(() => {
    const kept = recentKey ? stored(recentKey) : null
    recent = Array.isArray(kept) ? [...new Set(kept.filter(part => typeof part === 'string'))].slice(0, RECENT_MAX) : []
    const read = adapter.parts
    if (!read) { failed = true; return }
    read().then(found => { parts = found; failed = false }, () => { failed = true })
  })

  const byPart = $derived(new Map((parts ?? []).map(part => [part.part, part])))
  const strokeParts = $derived((parts ?? []).filter(part => part.kind === 'c' || part.kind === 'd'))
  // Stroke counts available in the Stroke count panel, in order, null (not recorded) last; `count` is the one
  // chosen, undefined until one is, so the first count shows.
  const counts = $derived([...new Set(strokeParts.map(part => part.strokes ?? null))].sort((a, b) => (a ?? Infinity) - (b ?? Infinity)))
  const shownCount = $derived(count !== undefined && counts.includes(count) ? count : counts[0])
  /** @param {PalettePart[]} list */
  const grouped = list => [...CLASSES, null]
    .map(cls => ({ cls, parts: list.filter(part => (part.first ?? null) === cls) }))
    .filter(group => group.parts.length)

  const SEAL_GROUPS = /** @type {const} */ (['basic', 'compound', 'other'])
  let sealGroup = $state(/** @type {(typeof SEAL_GROUPS)[number]} */ ('basic'))
  const sealParts = $derived((parts ?? []).filter(part => part.kind === 'seal'))
  const sealGroups = $derived(SEAL_GROUPS.map(name => ({ name, parts: sealParts.filter(part => (part.sealGroup ?? 'other') === name) })).filter(group => group.parts.length))
  const selectedSealGroup = $derived(sealGroups.find(group => group.name === sealGroup) ?? sealGroups[0])
  const query = $derived(filter.trim())
  const filtered = $derived.by(() => {
    if (!query || !parts) return null
    if (tab === 'seal') return sealParts.filter(part => [...query].includes(part.part) || part.modern?.some(char => [...query].includes(char)))
    if (/^\d+$/.test(query)) return parts.filter(part => part.strokes === Number(query))
    const chars = new Set([...query])
    return parts.filter(part => !isSequence(query) && chars.has(part.part) || isSequence(part.part) && part.part.includes(query) || part.aliases?.some(alias => alias.includes(query)))
  })

  /** @type {{ cls: string | null | undefined, parts: PalettePart[] }[]} */
  const shown = $derived.by(() => {
    if (!parts) return []
    if (tab === 'common') return [{ cls: undefined, parts: parts.filter(part => part.kind === 'c' || part.kind === 'd' && (part.uses ?? 0) >= 50) }]
    if (tab === 'seal') return [{ cls: undefined, parts: selectedSealGroup?.parts ?? [] }]
    if (tab === 'tangut') return [{ cls: undefined, parts: parts.filter(part => part.kind === 't') }]
    if (tab === 'difficult') return grouped(strokeParts.filter(part => (part.strokes ?? null) === shownCount))
    if (tab === 'strokes') return grouped(parts.filter(part => part.kind === 's'))
    return [{ cls: undefined, parts: recent.map(part => byPart.get(part) ?? { part, kind: 'd' }) }]
  })

  /** @param {string} part */
  function pick(part) {
    recent = [part, ...recent.filter(other => other !== part)].slice(0, RECENT_MAX)
    if (recentKey) remember(recentKey, recent)
    onpick?.(part)
  }
  // Give a double-click time to select text without inserting its first click.
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let pickTimer
  /** @type {string | undefined} */
  let pendingPart
  /** @type {EventTarget | null} */
  let pendingTarget = null
  let selectionAtDown = ''
  function flushPick() {
    clearTimeout(pickTimer)
    const part = pendingPart
    pendingPart = undefined
    pendingTarget = null
    if (part !== undefined) pick(part)
  }
  onMount(() => {
    /** @param {PointerEvent} event */
    const pointer = event => {
      if (pendingTarget && !event.composedPath().includes(pendingTarget) && !(event.target instanceof Element && event.target.closest('.part'))) flushPick()
    }
    /** @param {KeyboardEvent} event */
    const keyboard = event => {
      if (pendingPart === undefined) return
      if (['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) return
      if ((event.ctrlKey || event.metaKey) && ['a', 'c'].includes(event.key.toLowerCase()) && event.target === pendingTarget) {
        clearTimeout(pickTimer); pendingPart = undefined; pendingTarget = null
      } else flushPick()
    }
    window.addEventListener('pointerdown', pointer, true)
    window.addEventListener('keydown', keyboard, true)
    return () => {
      clearTimeout(pickTimer)
      window.removeEventListener('pointerdown', pointer, true)
      window.removeEventListener('keydown', keyboard, true)
    }
  })
  /** @param {MouseEvent} event @param {string} part */
  function clickPart(event, part) {
    if (pendingPart !== undefined && pendingPart !== part) flushPick()
    clearTimeout(pickTimer)
    pendingPart = undefined
    pendingTarget = null
    if (event.detail === 0) { pick(part); return }
    if (event.detail > 1) return
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) {
      if (selection.toString() !== selectionAtDown) return
      selection.removeAllRanges()
    }
    if ('pointerType' in event && event.pointerType === 'touch') { pick(part); return }
    pendingPart = part
    pendingTarget = event.currentTarget
    pickTimer = setTimeout(flushPick, 500)
  }
  /** @param {MouseEvent} event */
  function selectPart(event) {
    clearTimeout(pickTimer)
    pendingPart = undefined
    pendingTarget = null
    const text = /** @type {HTMLElement} */ (event.currentTarget).querySelector('.part-text')
    if (!text) return
    const range = document.createRange(), selection = window.getSelection()
    range.selectNodeContents(text)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  /** @param {KeyboardEvent} event */
  function selectionKey(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const button = /** @type {HTMLElement} */ (event.currentTarget)
    const key = event.key.toLowerCase()
    const target = key === 'a' ? button.closest('.parts-panel')
      : key === 'c' && window.getSelection()?.isCollapsed ? button.querySelector('.part-text') : null
    if (!target) return
    if (key === 'a') event.preventDefault()
    const range = document.createRange(), selection = window.getSelection()
    range.selectNodeContents(target)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  /** @param {PalettePart} part */
  const title = part => [
    part.part,
    ...(part.aliases ?? []),
    ...(part.modern ?? []),
    part.sealBasis === 'cjk-ids' ? t('parts.seal.inferred', { ids: part.modernIds?.join(' / ') ?? '' }) : null,
    part.strokes == null ? t('parts.unknownStrokes') : `${part.derived ? '≈ ' : ''}${t('parts.strokeCount', { count: part.strokes })}`,
    part.uses ? t('parts.uses', { count: part.uses }) : null,
  ].filter(Boolean).join(' · ')
  // Arrow keys, Home and End move between the tabs and choose the one reached.
  /** @type {HTMLButtonElement[]} */
  let tabButtons = $state([])
  /** @param {KeyboardEvent} event @param {number} index */
  function tabKey(event, index) {
    const last = TABS.length - 1
    const to = /** @type {Record<string, number>} */ ({ ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last })[event.key]
    if (to === undefined) return
    event.preventDefault()
    tab = TABS[to]
    tabButtons[to]?.focus()
  }
  // A stroke outside the five classes (㇣) is another kind of stroke; any other part lacks the record.
  /** @param {string | null | undefined} cls */
  const heading = cls => cls ? t(`parts.first.${CLASS_KEY[/** @type {keyof CLASS_KEY} */ (cls)]}`) : tab === 'strokes' && !query ? t('parts.first.other') : t('parts.first.unknown')
</script>

{#snippet grid(/** @type {PalettePart[]} */ list)}
  <div class="parts-grid">
    {#each list as part (part.part)}
      <button type="button" class="part" class:compound={isSequence(part.part)} {disabled} lang={part.kind === 't' ? 'txg' : 'ja'} title={title(part)} aria-label={title(part)}
        onpointerdown={event => { selectionAtDown = window.getSelection()?.toString() ?? ''; event.currentTarget.draggable = !disabled && !(/** @type {Element} */ (event.target).closest('.part-text')) }}
        ondragstart={event => { if (event.target === event.currentTarget) event.dataTransfer?.setData('text/plain', part.part) }}
        onclick={event => clickPart(event, part.part)} ondblclick={selectPart} onkeydown={selectionKey}>
        {#if isSequence(part.part)}
          <IdsPartIcon sequence={part.part} {adapter} />
          <span class="part-text compound-text">{part.part}</span>
        {:else}
          <span class="part-text">{part.part}</span>
          {#if part.sealBasis === 'cjk-ids'}<span class="seal-estimate" aria-hidden="true">≈</span>{/if}
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

<div class="ids-parts" role="group" aria-label={t('parts.label')}>
  <div class="parts-top">
    <div class="parts-tabs" role="tablist" aria-label={t('parts.label')}>
      {#each TABS as name, index (name)}
        <button type="button" role="tab" id={`${uid}-tab-${name}`} aria-controls={`${uid}-panel`} bind:this={tabButtons[index]}
          class:active={tab === name} aria-selected={tab === name} tabindex={tab === name ? 0 : -1}
          onclick={() => { tab = name; filter = '' }} onkeydown={event => tabKey(event, index)}>{t(`parts.tab.${name}`)}</button>
      {/each}
    </div>
    <input class="parts-filter" type="search" bind:value={filter} lang="ja" spellcheck="false" autocomplete="off"
      placeholder={t(tab === 'seal' ? 'parts.seal.filter' : 'parts.filter')} aria-label={t(tab === 'seal' ? 'parts.seal.filter' : 'parts.filter')} />
  </div>
  {#if tab === 'seal' && onreviewSeal}
    <button type="button" class="seal-review-link" onclick={onreviewSeal}>{t('parts.seal.review')}</button>
  {/if}
  {#if tab === 'seal' && !query && sealGroups.length}
    <div class="seal-groups" role="group" aria-label={t('parts.seal.groups')}>
      {#each sealGroups as group (group.name)}
        <button type="button" class:active={selectedSealGroup?.name === group.name} aria-pressed={selectedSealGroup?.name === group.name}
          onclick={() => sealGroup = group.name}>{t(`parts.seal.${group.name}`)} <span>{group.parts.length}</span></button>
      {/each}
    </div>
  {/if}
  {#if tab === 'seal' && (filtered ?? selectedSealGroup?.parts ?? []).some(part => part.sealBasis === 'cjk-ids')}
    <p class="parts-note">{t('parts.seal.estimate')}</p>
  {/if}
  <div class="parts-panel" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`}>
    {#if failed}
      <p class="parts-note" role="status">{t('parts.failed')}</p>
    {:else if !parts}
      <p class="parts-note" role="status">{t('parts.loading')}</p>
    {:else if filtered}
      {#if filtered.length}{@render grid(filtered)}{:else}<p class="parts-note">{t('parts.none')}</p>{/if}
    {:else}
      {#if tab === 'difficult'}
        <div class="parts-counts" role="group" aria-label={t('parts.byStrokes')}>
          {#each counts as value (value ?? 'unknown')}
            <button type="button" class:active={value === shownCount} aria-pressed={value === shownCount}
              title={value == null ? t('parts.unknownStrokes') : t('parts.strokeCount', { count: value })}
              onclick={() => count = value}>{value ?? '?'}</button>
          {/each}
        </div>
      {/if}
      {#if tab === 'recent' && !recent.length}
        <p class="parts-note">{t('parts.noRecent')}</p>
      {/if}
      {#each shown as group (group.cls ?? 'all')}
        {#if group.cls !== undefined}<h4 class="parts-class">{heading(group.cls)}</h4>{/if}
        {@render grid(group.parts)}
      {/each}
    {/if}
  </div>
</div>

<style>
  .ids-parts{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));
    --_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_surface-selected:var(--ids-surface-selected,light-dark(#e8e8ee,#30303a));
    --_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));--_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));
    --_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));
    display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--_ink)}
  :where(.ids-parts) :is(button,input){font:inherit;color:inherit;border:1px solid var(--_line);border-radius:6px;background:var(--_surface)}
  :where(.ids-parts) button{cursor:pointer}
  :where(.ids-parts) button:disabled{cursor:default;opacity:.55}
  :where(.ids-parts) :is(button,input):focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .parts-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
  .parts-tabs{display:flex;flex-wrap:wrap;gap:4px}
  .parts-tabs button,.parts-counts button{border:0;background:transparent;font-size:12px;padding:6px 10px;border-radius:5px;color:var(--_muted)}
  .parts-tabs button.active,.parts-counts button.active{background:var(--_surface-selected);color:var(--_ink)}
  .parts-filter{flex:1 1 100%;min-width:0;padding:6px 8px;font-size:13px}
  .parts-counts{display:flex;flex-wrap:wrap;gap:2px;user-select:none}
  .parts-counts button{min-width:30px;padding:4px 6px;font-variant-numeric:tabular-nums}
  .parts-panel{display:flex;flex-direction:column;gap:8px;min-width:0}
  /* The subset faces first: their ranges cover only the strokes and rare parts, so other text falls
     through to the page's own fonts. */
  .parts-class,.parts-filter{font-family:"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut",var(--ids-ui-font,system-ui,sans-serif)}
  .parts-class{margin:4px 0 0;font-size:11px;font-weight:500;color:var(--_muted);user-select:none}
  .parts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:3px;max-height:260px;overflow:auto}
  .part{display:flex;align-items:center;justify-content:center;aspect-ratio:1;padding:0;font-size:22px;line-height:1;user-select:text;
    border-color:transparent;background:var(--_surface-subtle);font-family:"IDS Seal","IDS Parts","IDS Tangut","IDS Strokes",var(--ids-font,sans-serif)}
  .part.compound{position:relative;padding:5px}
  .part :global(.part-icon){user-select:none}
  .compound-text{position:absolute;bottom:0;max-width:100%;overflow:hidden;white-space:nowrap;
    font:8px/1 var(--ids-font,sans-serif);color:var(--_ink);background:var(--_surface)}
  .part:not(:disabled):hover{border-color:var(--_accent);background:var(--_accent-light)}
  .seal-review-link{align-self:start;padding:5px 8px;font-size:12px}
  .seal-groups{display:flex;flex-wrap:wrap;gap:4px}
  .seal-groups button{padding:5px 8px;font-size:12px;background:transparent;border-color:transparent;color:var(--_muted)}
  .seal-groups button.active{background:var(--_surface-selected);color:var(--_ink)}
  .seal-groups span{font-size:10px;font-variant-numeric:tabular-nums;margin-inline-start:4px}
  .part{position:relative}
  .seal-estimate{position:absolute;right:3px;bottom:1px;font:11px system-ui;color:var(--_muted);user-select:none}
  .parts-note{margin:0;font-size:12px;color:var(--_muted)}
</style>
