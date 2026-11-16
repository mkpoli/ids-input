<script>
  // Characters found by a description query (the adapter's `findByIds`), closest first, each with the
  // description it matched in and the matched part marked. `query` comes from the host (in the
  // workshop, the selected part or the whole tree).
  // The query is asked once the editing settles, and an answer for a query since replaced is
  // dropped. Hits are paged by `limit`, and a stroke count loads all hits so every match across
  // pages is counted and browsable. A hit opens its description (`onopen`), hands its character on
  // (`ontake`), or is dragged as its character.
  import { untrack } from 'svelte'
  import { loadStrokes } from './strokes.js'
  import { translator } from './i18n.js'
  import { watchFallback } from './fallback-font.js'

  /** @typedef {import('../adapter/types.js').IdsHit} IdsHit */
  /** @type {{ adapter: import('../adapter/types.js').IdsAdapter, query?: string, messages?: Record<string, string>, locale?: string, limit?: number, delay?: number, mode?: 'ids' | 'structure' | 'unknown' | 'similar',
   *   onopen?: (hit: IdsHit) => void, ontake?: (hit: IdsHit) => void }} */
  let { adapter, query = '', messages, locale = 'en', limit = 60, delay = 250, mode = 'ids', onopen, ontake } = $props()
  const ALL_LIMIT = Number.MAX_SAFE_INTEGER
  const t = $derived(translator(messages, locale))
  const uid = $props.id()
  const asked = $derived(query.trim())
  const pageSize = $derived(Math.max(1, limit))
  // A stroke count narrows the hits; the palette's character counts load on first use.
  let strokeLimit = $state('')
  /** @type {HTMLElement | null} */
  let panel = $state(null)
  /** @type {HTMLElement | null} */
  let topAnchor = $state(null)
  // The hits and the descriptions draw characters the reader's fonts may lack.
  $effect(() => { if (panel) return watchFallback(panel) })
  /** @type {Map<string, number | null> | null} */
  let strokeCounts = $state.raw(null)
  let strokeLoading = false
  $effect(() => {
    if (strokeLimit === '' || strokeCounts || strokeLoading) return
    strokeLoading = true
    loadStrokes().then(counts => { strokeCounts = counts }).catch(() => { strokeCounts = new Map() })
  })
  const wantedStrokes = $derived(strokeLimit === '' ? null : Number(strokeLimit))
  const queryKey = $derived(`${asked}\0${mode}`)
  let found = $state.raw(/** @type {{ key: string, find?: unknown, status: 'idle' | 'loading' | 'ready' | 'failed' | 'extra' | 'pattern', hits: IdsHit[], total: number, characters: string, askedLimit: number }} */ ({ key: '', status: 'idle', hits: [], total: 0, characters: '', askedLimit: 0 }))
  let asks = 0
  let page = $state(0)
  let copied = $state(false)
  let copying = $state(false)
  let copyFailed = $state(false)
  $effect(() => { void asked; void mode; void strokeLimit; void pageSize; page = 0; copied = false; copyFailed = false })
  const busy = $derived(found.status === 'loading' || (found.status === 'ready' && wantedStrokes !== null && strokeCounts === null && Boolean(asked)))
  const filteredHits = $derived.by(() => {
    if (found.key !== queryKey) return []
    const counts = strokeCounts, wanted = wantedStrokes
    if (wanted === null) return found.hits
    if (!counts) return []
    return found.hits.filter(hit => counts.get(hit.char) === wanted)
  })
  const totalCount = $derived.by(() => {
    if (found.key !== queryKey) return 0
    if (wantedStrokes !== null) return filteredHits.length
    if (found.status === 'ready' && found.askedLimit >= found.total && found.hits.length < found.total) return found.hits.length
    return found.total
  })
  let lastHits = $state.raw(/** @type {IdsHit[]} */ ([]))
  let lastCount = $state(0)
  const shownCount = $derived(!busy && found.key === queryKey ? totalCount : lastCount)
  const pages = $derived(Math.max(1, Math.ceil(shownCount / pageSize)))
  const currentPage = $derived(Math.min(page, pages - 1))
  const pageHits = $derived.by(() => {
    if (busy && found.key !== queryKey) return []
    if (wantedStrokes !== null && !strokeCounts) return []
    const start = currentPage * pageSize
    return filteredHits.slice(start, start + pageSize)
  })
  $effect(() => {
    if (!asked || found.status === 'failed' || found.status === 'pattern' || found.status === 'extra') {
      lastHits = []
      lastCount = 0
    } else if (!busy && found.key === queryKey) {
      lastHits = pageHits
      lastCount = totalCount
    }
  })
  const displayedHits = $derived(busy && !pageHits.length ? lastHits : pageHits)
  /** @param {number} target @param {boolean} [scroll] */
  function goToPage(target, scroll = false) {
    const next = Math.max(0, Math.min(pages - 1, target))
    page = next
    if (scroll) topAnchor?.scrollIntoView({ block: 'nearest' })
    return next
  }
  /** @param {HTMLInputElement} input @param {boolean} scroll */
  function commitPage(input, scroll) {
    const value = input.valueAsNumber
    const next = Number.isFinite(value) ? goToPage(Math.floor(value) - 1, scroll) : currentPage
    input.value = String(next + 1)
  }
  async function copyAll() {
    const id = asks
    const text = wantedStrokes === null ? found.characters : filteredHits.map(hit => hit.char).join('')
    copying = true
    try {
      await navigator.clipboard.writeText(text)
      if (id === asks) copied = true
    } catch { if (id === asks) copyFailed = true }
    finally { copying = false }
  }
  $effect(() => {
    const text = asked, key = queryKey
    const find = mode === 'structure' ? adapter.findByStructure
      : mode === 'unknown' ? adapter.findByUnknownStructure
      : mode === 'similar' ? adapter.findSimilar : adapter.findByIds
    const needAll = wantedStrokes !== null
    const targetLimit = needAll ? ALL_LIMIT : (page + 1) * pageSize
    if (!text || !find) {
      asks++
      found = { key, find, status: 'idle', hits: [], total: 0, characters: '', askedLimit: 0 }
      return
    }
    const current = untrack(() => found)
    const sameQuery = current.key === key && current.find === find
    const satisfied = sameQuery && (
      (current.status === 'ready' && (current.hits.length >= current.total || current.askedLimit >= targetLimit))
      || (!needAll && current.hits.length >= targetLimit && (current.status === 'ready' || current.status === 'loading'))
    )
    if (satisfied) {
      if (current.status === 'loading') untrack(() => { found = { ...found, status: 'ready' } })
      return
    }
    const id = ++asks
    const controller = new AbortController()
    untrack(() => { found = { ...found, status: 'loading' } })
    const wait = sameQuery && current.status === 'ready' && !needAll ? 0 : delay
    const timer = setTimeout(() => find(text, { limit: targetLimit, signal: controller.signal }).then(
      result => {
        if (id !== asks) return
        const problem = 'problem' in result ? result.problem : undefined
        found = {
          key,
          find,
          status: problem === 'extra' ? 'extra' : problem === 'pattern' ? 'pattern' : problem ? 'idle' : 'ready',
          hits: result.hits,
          total: result.total,
          characters: 'characters' in result && typeof result.characters === 'string' ? result.characters : '',
          askedLimit: targetLimit,
        }
      },
      () => { if (id === asks && !controller.signal.aborted) found = { key, find, status: 'failed', hits: [], total: 0, characters: '', askedLimit: 0 } }), wait)
    return () => { clearTimeout(timer); controller.abort() }
  })
  /** The description in pieces, each marked when a term matched it. @param {IdsHit} hit */
  function pieces(hit) {
    const chars = [...hit.sequence], marked = chars.map(() => false)
    for (const [a, b] of hit.spans) for (let i = a; i < b; i++) marked[i] = true
    /** @type {{ text: string, marked: boolean }[]} */
    const out = []
    chars.forEach((c, i) => { if (out.length && out[out.length - 1].marked === marked[i]) out[out.length - 1].text += c; else out.push({ text: c, marked: marked[i] }) })
    return out
  }
  /** @param {string} char */
  const cp = char => `U+${/** @type {number} */ (char.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`
</script>

{#snippet pager(/** @type {boolean} */ bottom)}
  <div class="pages" role="group" aria-label={t('ids.search.pages')}>
    <button type="button" disabled={currentPage === 0} onclick={() => goToPage(currentPage - 1, bottom)}>{t('ids.search.previous')}</button>
    <input type="number" min="1" max={pages} value={currentPage + 1} aria-label={t('ids.search.pages')}
      onchange={event => commitPage(event.currentTarget, bottom)}
      onkeydown={event => { if (event.key === 'Enter') { event.preventDefault(); commitPage(event.currentTarget, bottom) } }} />
    <span>{t('ids.search.page', { page: currentPage + 1, pages })}</span>
    <button type="button" disabled={currentPage + 1 >= pages} onclick={() => goToPage(currentPage + 1, bottom)}>{t('ids.search.next')}</button>
  </div>
{/snippet}

<section class="ids-search-results" aria-label={t('ids.search.title')} data-status={busy ? 'loading' : found.status} bind:this={panel}>
  <div class="stroke-limit">
    <label for={`${uid}-strokes`}>{t('ids.search.strokes')}</label>
    <input id={`${uid}-strokes`} type="number" min="1" max="40" inputmode="numeric" autocomplete="off"
      placeholder={t('ids.search.strokesAny')} value={strokeLimit}
      oninput={event => { strokeLimit = event.currentTarget.value }} />
  </div>
  <p class="count" aria-live="polite" bind:this={topAnchor}>
    {#if found.status === 'failed'}<span class="fault">{t('ids.search.failed')}</span>
    {:else if found.status === 'pattern'}<span class="fault">{t(mode === 'unknown' ? 'ids.structural.unknownInvalid' : 'ids.structural.invalid')}</span>
    {:else if found.status === 'extra'}<span class="fault">{t('ids.problem.extra')}</span>
    {:else if asked && ((found.status === 'ready' && !busy) || displayedHits.length)}{t('ids.search.count', { count: shownCount })}{/if}
  </p>
  {#if (mode === 'structure' || mode === 'unknown') && shownCount > 0 && found.status !== 'idle' && found.status !== 'failed' && found.status !== 'pattern' && found.status !== 'extra'}
    <div class="result-actions">
      <button type="button" disabled={copying || busy} onclick={copyAll}>{t(copied ? 'ids.structural.copied' : 'ids.structural.copy')}</button>
      {#if copyFailed}<span role="status">{t('ids.structural.copyFailed')}</span>{/if}
    </div>
  {/if}
  {#if displayedHits.length}
    {#if pages > 1}{@render pager(false)}{/if}
    <ol class="hits" class:stale={busy}>
      {#each displayedHits as hit (hit.char)}
        <li class="hit">
          <button type="button" class="open" data-character={hit.char} title={`${t('ids.search.open', { sequence: hit.sequence })} · ${cp(hit.char)}`} draggable="true"
            ondragstart={event => event.dataTransfer?.setData('text/plain', hit.char)} onclick={() => onopen?.(hit)}>
            <span class="char" lang="ja">{hit.char}</span>
            <span class="seq" lang="ja">{#each pieces(hit) as piece, i (i)}{#if piece.marked}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}</span>
            <span class="code">{cp(hit.char)}</span>
          </button>
          {#if ontake}<button type="button" class="take" title={t('ids.search.take', { char: hit.char })} aria-label={t('ids.search.take', { char: hit.char })} onclick={() => ontake?.(hit)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 4h7v7H4zM13 13h7v7h-7zM14 7h6M17 4v6M4 17h6" /></svg></button>{/if}
        </li>
      {/each}
    </ol>
    {#if pages > 1 && displayedHits.length > 12}{@render pager(true)}{/if}
  {:else if !busy}
    <!-- Nothing found, or nothing asked: a drawing of an empty search. -->
    <svg class="empty" viewBox="0 0 120 80" aria-hidden="true"><rect x="18" y="14" width="44" height="44" rx="8" /><path d="M40 26v20M30 36h20" /><circle cx="84" cy="44" r="16" /><path d="m96 56 12 12" /></svg>
  {/if}
</section>

<style>
  .ids-search-results{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_muted:var(--ids-muted,light-dark(#686874,#9d9daa));
    --_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));--_surface:var(--ids-surface,light-dark(#fff,#1b1b20));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));--_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));
    --_accent-light:var(--ids-accent-light,light-dark(#e9edfd,#232c4c));--_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));
    --_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Numbered","IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Jurchen","IDS Operators","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif);
    display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--_ink)}
  button:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .count{margin:0;min-height:18px;font-size:12px;color:var(--_muted)}
  .stroke-limit{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--_muted);justify-content:flex-end}
  .stroke-limit input{width:56px;padding:4px 6px;border:1px solid var(--_line);border-radius:6px;background:var(--_surface);color:var(--_ink);font:inherit;text-align:center}
  .stroke-limit input:focus-visible,.pages input:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .result-actions{display:flex;align-items:center;gap:8px;font-size:12px}
  .result-actions button,.pages button,.pages input{border:1px solid var(--_line);background:var(--_surface);color:var(--_ink);border-radius:6px;padding:4px 8px;font:inherit}
  .result-actions button{padding:5px 10px}
  .result-actions button,.pages button{cursor:pointer}
  .pages{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;font-size:12px;color:var(--_muted)}
  .pages button:disabled{cursor:default;opacity:.55}
  .pages button:not(:disabled):hover,.result-actions button:not(:disabled):hover{border-color:var(--_accent)}
  .pages input{width:4.5em;text-align:center;font-variant-numeric:tabular-nums}
  .pages span{font-variant-numeric:tabular-nums}
  .fault{color:var(--_fault)}
  .hits{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px;margin:0;padding:0;list-style:none;transition:opacity .15s}
  .hits.stale{opacity:.55}
  .hit{position:relative;aspect-ratio:1;min-width:0}
  .hit button{border:1px solid var(--_line);border-radius:10px;background:var(--_surface);color:inherit;font:inherit;cursor:pointer}
  .hit button:hover{border-color:var(--_accent);background:var(--_surface-subtle)}
  .open{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:6px 5px;text-align:center}
  .char{font-family:var(--_font);font-size:clamp(22px,2.2vw,34px);line-height:1.15}
  .seq{display:block;width:100%;font-family:var(--_font);font-size:10.5px;line-height:1.3;color:var(--_muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .code{display:none;font:10.5px/1.3 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--_muted)}
  .hit:hover .seq,.hit:focus-within .seq{display:none}
  .hit:hover .code,.hit:focus-within .code{display:block}
  @media (hover:none){.code{display:block}}
  mark{background:var(--_accent-light);color:var(--_ink);border-radius:3px;box-shadow:0 -2px 0 var(--_accent) inset}
  .take{position:absolute;top:2px;right:2px;display:grid;place-items:center;width:22px;height:22px;padding:0;border-color:transparent;background:var(--_surface);color:var(--_muted);opacity:0;transition:opacity .12s}
  .hit:hover .take,.hit:focus-within .take{opacity:1}
  .take:hover{color:var(--_accent);border-color:var(--_accent)}
  @media (hover:none){.take{opacity:1}}
  .take svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .empty{width:120px;align-self:center;margin:16px 0;fill:none;stroke:var(--_line);stroke-width:3;stroke-linecap:round;stroke-dasharray:0}
  .empty rect{stroke-dasharray:4 5}
</style>
