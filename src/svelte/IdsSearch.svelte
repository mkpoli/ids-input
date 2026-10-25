<script>
  // Characters found by a description query (the adapter's `findByIds`), closest first, each with the
  // description it matched in and the matched part marked. `query` comes from the host (in the
  // workshop, the tree being edited); what is typed in the field is added to it as further terms.
  // The query is asked once the editing settles, and an answer for a query since replaced is
  // dropped. A hit opens its description (`onopen`), hands its character on (`ontake`), or is
  // dragged as its character.
  import { untrack } from 'svelte'
  import { translator } from './i18n.js'

  /** @typedef {import('../adapter/types.js').IdsHit} IdsHit */
  /** @type {{ adapter: import('../adapter/types.js').IdsAdapter, query?: string, messages?: Record<string, string>, locale?: string, limit?: number, delay?: number,
   *   onopen?: (hit: IdsHit) => void, ontake?: (hit: IdsHit) => void }} */
  let { adapter, query = '', messages, locale = 'en', limit = 60, delay = 250, onopen, ontake } = $props()
  const t = $derived(translator(messages, locale))
  let extra = $state('')
  const asked = $derived([query, extra].map(q => q.trim()).filter(Boolean).join(' '))
  let found = $state.raw(/** @type {{ status: 'idle' | 'loading' | 'ready' | 'failed' | 'extra', hits: IdsHit[], total: number }} */ ({ status: 'idle', hits: [], total: 0 }))
  let asks = 0
  $effect(() => {
    const text = asked, find = adapter.findByIds, most = limit
    if (!text || !find) { found = { status: 'idle', hits: [], total: 0 }; return }
    const id = ++asks, controller = new AbortController()
    untrack(() => { found = { ...found, status: 'loading' } })
    const timer = setTimeout(() => find(text, { limit: most, signal: controller.signal }).then(
      result => { if (id === asks) found = { status: result.problem === 'extra' ? 'extra' : result.problem ? 'idle' : 'ready', hits: result.hits, total: result.total } },
      () => { if (id === asks && !controller.signal.aborted) found = { status: 'failed', hits: [], total: 0 } }), delay)
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
</script>

<section class="ids-search-results" aria-label={t('ids.search.title')} data-status={found.status}>
  <input type="search" bind:value={extra} lang="ja" spellcheck="false" autocomplete="off" aria-label={t('ids.search.more')} placeholder="⿰？口　木木" title={t('ids.search.hint')} />
  <p class="count" aria-live="polite">
    {#if found.status === 'failed'}<span class="fault">{t('ids.search.failed')}</span>
    {:else if found.status === 'extra'}<span class="fault">{t('ids.problem.extra')}</span>
    {:else if asked && found.status !== 'idle' && found.status !== 'loading' || found.status === 'loading' && found.hits.length}<span lang="ja" class="asked">{asked}</span>{t('ids.search.count', { count: found.total })}{/if}
  </p>
  {#if found.hits.length}
    <ol class="hits" class:stale={found.status === 'loading'}>
      {#each found.hits as hit (hit.char)}
        <li class="hit">
          <button type="button" class="open" title={t('ids.search.open', { sequence: hit.sequence })} draggable="true"
            ondragstart={event => event.dataTransfer?.setData('text/plain', hit.char)} onclick={() => onopen?.(hit)}>
            <span class="char" lang="ja">{hit.char}</span>
            <span class="seq" lang="ja">{#each pieces(hit) as piece, i (i)}{#if piece.marked}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}</span>
          </button>
          {#if ontake}<button type="button" class="take" title={t('ids.search.take', { char: hit.char })} aria-label={t('ids.search.take', { char: hit.char })} onclick={() => ontake?.(hit)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 4h7v7H4zM13 13h7v7h-7zM14 7h6M17 4v6M4 17h6" /></svg></button>{/if}
        </li>
      {/each}
    </ol>
  {:else if found.status !== 'loading'}
    <!-- Nothing found, or nothing asked: a drawing of an empty search. -->
    <svg class="empty" viewBox="0 0 120 80" aria-hidden="true"><rect x="18" y="14" width="44" height="44" rx="8" /><path d="M40 26v20M30 36h20" /><circle cx="84" cy="44" r="16" /><path d="m96 56 12 12" /></svg>
  {/if}
</section>

<style>
  .ids-search-results{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));
    --_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));
    --_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));--_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));
    --_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Parts","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",sans-serif);
    display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--_ink)}
  input{min-width:0;height:36px;padding:0 10px;font:inherit;font-size:15px;font-family:var(--_font);color:inherit;border:1px solid var(--_line);border-radius:8px;background:var(--_surface)}
  input::placeholder{color:color-mix(in srgb,var(--_muted) 70%,transparent)}
  :is(input,button):focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .count{margin:0;min-height:18px;font-size:12px;color:var(--_muted)}
  .asked{margin-right:6px;font-family:var(--_font);color:var(--_ink)}
  .fault{color:var(--_fault)}
  .hits{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px;margin:0;padding:0;list-style:none;transition:opacity .15s}
  .hits.stale{opacity:.55}
  .hit{position:relative;aspect-ratio:1;min-width:0}
  .hit button{border:1px solid var(--_line);border-radius:10px;background:var(--_surface);color:inherit;font:inherit;cursor:pointer}
  .hit button:hover{border-color:var(--_accent);background:var(--_surface-subtle)}
  .open{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:6px 5px;text-align:center}
  .char{font-family:var(--_font);font-size:clamp(22px,2.2vw,34px);line-height:1.15}
  .seq{display:block;width:100%;font-family:var(--_font);font-size:10.5px;line-height:1.3;color:var(--_muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  mark{background:var(--_accent-light);color:var(--_ink);border-radius:3px;box-shadow:0 -2px 0 var(--_accent) inset}
  .take{position:absolute;top:2px;right:2px;display:grid;place-items:center;width:22px;height:22px;padding:0;border-color:transparent;background:var(--_surface);color:var(--_muted);opacity:0;transition:opacity .12s}
  .hit:hover .take,.hit:focus-within .take{opacity:1}
  .take:hover{color:var(--_accent);border-color:var(--_accent)}
  @media (hover:none){.take{opacity:1}}
  .take svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .empty{width:120px;align-self:center;margin:16px 0;fill:none;stroke:var(--_line);stroke-width:3;stroke-linecap:round;stroke-dasharray:0}
  .empty rect{stroke-dasharray:4 5}
</style>
