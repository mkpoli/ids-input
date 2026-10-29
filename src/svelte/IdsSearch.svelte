<script>
  // Characters found by a description query (the adapter's `findByIds`), closest first, each with the
  // description it matched in and the matched part marked. `query` comes from the host (in the
  // workshop, the selected part or the whole tree).
  // The query is asked once the editing settles, and an answer for a query since replaced is
  // dropped. A hit opens its description (`onopen`), hands its character on (`ontake`), or is
  // dragged as its character.
  import { untrack } from 'svelte'
  import { translator } from './i18n.js'

  /** @typedef {import('../adapter/types.js').IdsHit} IdsHit */
  /** @type {{ adapter: import('../adapter/types.js').IdsAdapter, query?: string, messages?: Record<string, string>, locale?: string, limit?: number, delay?: number, mode?: 'ids' | 'structure' | 'similar',
   *   onopen?: (hit: IdsHit) => void, ontake?: (hit: IdsHit) => void }} */
  let { adapter, query = '', messages, locale = 'en', limit = 60, delay = 250, mode = 'ids', onopen, ontake } = $props()
  const t = $derived(translator(messages, locale))
  const asked = $derived(query.trim())
  let found = $state.raw(/** @type {{ status: 'idle' | 'loading' | 'ready' | 'failed' | 'extra' | 'pattern', hits: IdsHit[], total: number, characters: string }} */ ({ status: 'idle', hits: [], total: 0, characters: '' }))
  let asks = 0
  let shown = $state(60)
  let copied = $state(false)
  let copying = $state(false)
  let copyFailed = $state(false)
  $effect(() => { asked; mode; shown = limit; copied = false; copyFailed = false })
  async function copyAll() {
    const id = asks
    copying = true
    try {
      await navigator.clipboard.writeText(found.characters)
      if (id === asks) copied = true
    } catch { if (id === asks) copyFailed = true }
    finally { copying = false }
  }
  $effect(() => {
    const text = asked, find = mode === 'structure' ? adapter.findByStructure : mode === 'similar' ? adapter.findSimilar : adapter.findByIds, most = shown
    const id = ++asks
    if (!text || !find) { found = { status: 'idle', hits: [], total: 0, characters: '' }; return }
    const controller = new AbortController()
    untrack(() => { found = { ...found, status: 'loading' } })
    const timer = setTimeout(() => find(text, { limit: most, signal: controller.signal }).then(
      result => {
        if (id !== asks) return
        const problem = 'problem' in result ? result.problem : undefined
        found = { status: problem === 'extra' ? 'extra' : problem === 'pattern' ? 'pattern' : problem ? 'idle' : 'ready', hits: result.hits, total: result.total, characters: 'characters' in result && typeof result.characters === 'string' ? result.characters : '' }
      },
      () => { if (id === asks && !controller.signal.aborted) found = { status: 'failed', hits: [], total: 0, characters: '' } }), delay)
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

<section class="ids-search-results" aria-label={t('ids.search.title')} data-status={found.status}>
  <p class="count" aria-live="polite">
    {#if found.status === 'failed'}<span class="fault">{t('ids.search.failed')}</span>
    {:else if found.status === 'pattern'}<span class="fault">{t('ids.structural.invalid')}</span>
    {:else if found.status === 'extra'}<span class="fault">{t('ids.problem.extra')}</span>
    {:else if asked && found.status !== 'idle' && found.status !== 'loading' || found.status === 'loading' && found.hits.length}{t('ids.search.count', { count: found.total })}{/if}
  </p>
  {#if mode === 'structure' && found.status === 'ready' && found.total > 0}
    <div class="result-actions">
      <button type="button" disabled={copying} onclick={copyAll}>{t(copied ? 'ids.structural.copied' : 'ids.structural.copy')}</button>
      {#if copyFailed}<span role="status">{t('ids.structural.copyFailed')}</span>{/if}
    </div>
  {/if}
  {#if found.hits.length}
    <ol class="hits" class:stale={found.status === 'loading'}>
      {#each found.hits as hit (hit.char)}
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
    {#if mode === 'structure' && found.hits.length < found.total}
      <button type="button" class="more" disabled={found.status === 'loading'} onclick={() => shown += limit}>{t('ids.structural.more')}</button>
    {/if}
  {:else if found.status !== 'loading'}
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
    --_font:var(--ids-font,"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback,"IDS Fallback"),sans-serif);
    display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--_ink)}
  button:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .count{margin:0;min-height:18px;font-size:12px;color:var(--_muted)}
  .result-actions{display:flex;align-items:center;gap:8px;font-size:12px}
  .result-actions button,.more{border:1px solid var(--_line);background:var(--_surface);color:var(--_ink);border-radius:6px;padding:5px 10px;font:inherit;cursor:pointer}
  .more{align-self:center}
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
