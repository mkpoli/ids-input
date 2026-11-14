<script>
  // Every component the merged corpus uses, most used first: its cid, how many descriptions name
  // it, and the characters those describe. The query lives in the address, so a search can be
  // linked to.
  import { onMount } from 'svelte'
  import PageHeader from './ui/PageHeader.svelte'
  import Menu from './ui/Menu.svelte'
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import dataUrl from '../data/component-atlas.json.gz?url'
  import outlinesUrl from '../data/custom-outlines.json.gz?url'

  const params = new URLSearchParams(location.search)
  const wanted = String(params.get('lang') ?? load('locale', null) ?? navigator.language ?? '')
  const traditional = /^zh-(?:Hant|TW|HK|MO)\b/i
  let locale = $state(LOCALES.find(([code]) => code === wanted)?.[0]
    ?? (traditional.test(wanted) ? 'zh-Hant' : undefined)
    ?? LOCALES.find(([code]) => wanted.startsWith(code.split('-')[0]))?.[0] ?? 'en')
  $effect(() => save('locale', locale))
  $effect(() => { document.documentElement.lang = locale })
  const messages = $derived(LOCALES.find(([code]) => code === locale)?.[2])
  const t = $derived(translator({ ...appMessages('en'), ...messages, ...appMessages(locale) }, locale))

  /** @typedef {{ cid: string, uses: number, char: string, encoded: boolean, subjects: string[], aliases: string[] }} Row */
  /** @typedef {{ built: string, counts: { descriptions: number }, licence: string, cap: number, components: Row[] }} Atlas */
  /** @type {Atlas | null} */
  let atlas = $state.raw(null)
  let failed = $state(false)
  /** GlyphWiki's glyph for a CHISE entity: the entity's GlyphWiki name, and each name's outline.
   * @type {{ names: Record<string, string>, outlines: Record<string, string> } | null} */
  let outlines = $state.raw(null)
  /** @type {HTMLInputElement | null} */
  let search = $state(null)
  /** A gzipped JSON file; the dev server may hand it over already decoded. @param {string} url */
  async function read(url) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(String(response.status))
    const bytes = new Uint8Array(await response.arrayBuffer())
    const text = bytes[0] === 0x1f && bytes[1] === 0x8b
      ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : new TextDecoder().decode(bytes)
    return JSON.parse(text)
  }
  onMount(() => {
    read(dataUrl).then(read => { atlas = read }, () => { failed = true })
    // An unencoded part has only a private-use character, which no font draws; GlyphWiki's glyph
    // stands in for it where there is one.
    read(outlinesUrl).then(read => { outlines = read }, () => {})
    if (!query && matchMedia('(pointer: fine)').matches) search?.focus({ preventScroll: true })
  })
  const rows = $derived(atlas?.components ?? [])
  /** GlyphWiki's glyph of an unencoded part. @param {Row} row */
  const outlineOf = row => {
    const from = outlines?.names[`&${row.cid.replace(/^chise:/, '')};`]
    const d = from === undefined ? undefined : outlines?.outlines[from]
    return from !== undefined && d ? { from, d } : null
  }

  const KINDS = /** @type {const} */ (['all', 'encoded', 'unencoded'])
  /** @template {string} T @param {readonly T[]} list @param {string | null} value @returns {T} */
  const oneOf = (list, value) => list.find(item => item === value) ?? list[0]
  let query = $state(params.get('q') ?? '')
  let kind = $state(oneOf(KINDS, params.get('kind')))
  let least = $state(Math.max(0, Math.floor(Number(params.get('min'))) || 0))
  let page = $state(Math.max(1, Math.floor(Number(params.get('page'))) || 1))
  const PAGE = 100
  $effect(() => {
    const next = new URLSearchParams(location.search)
    for (const [key, value, unset] of /** @type {[string, string, string][]} */ ([['q', query.trim(), ''], ['kind', kind, 'all'], ['min', String(least), '0'], ['page', String(page), '1']])) {
      if (value === unset) next.delete(key); else next.set(key, value)
    }
    const text = next.toString()
    history.replaceState(null, '', `${location.pathname}${text ? `?${text}` : ''}${location.hash}`)
  })
  const needle = $derived(query.trim())
  /** @param {Row} row @param {string} which */
  const matches = (row, which) => (!needle || row.char === needle || row.cid.includes(needle) || row.subjects.includes(needle))
    && (which === 'all' || row.encoded === (which === 'encoded')) && row.uses >= least
  const filtered = $derived(rows.filter(row => matches(row, kind)))
  const pages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE)))
  const visible = $derived(filtered.slice((page - 1) * PAGE, page * PAGE))
  $effect(() => { if (atlas && page > pages) page = pages })
  /** @param {() => void} change */
  const from = change => { change(); page = 1 }

  /** Hand the reader a file made here. @param {string} text @param {string} type @param {string} name */
  function offer(text, type, name) {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  // The table as files: the whole record as JSON, and one row per component as TSV.
  const downloads = [
    { label: 'JSON', note: 'component-atlas.json', run: () => atlas && offer(`${JSON.stringify(atlas, null, 1)}\n`, 'application/json', 'component-atlas.json') },
    { label: 'TSV', note: 'component-atlas.tsv', run: () => atlas && offer(
      [['cid', 'char', 'uses', 'encoded', 'aliases', 'appears_in'].join('\t'),
        ...atlas.components.map(row => [row.cid, row.char, row.uses, row.encoded, row.aliases.join(' '), row.subjects.join(' ')].join('\t'))].join('\n') + '\n',
      'text/tab-separated-values', 'component-atlas.tsv') },
  ]
  const CORPUS = 'https://github.com/mkpoli/ids-input/blob/main/data/ids-corpus.json.gz'
  const COPYING = 'https://github.com/mkpoli/ids-input/blob/main/data/COPYING-chise-ids.txt'
</script>

<svelte:head>
  <title>{t('app.atlas')} — {t('app.title')}</title>
</svelte:head>

<div class="page">
  <PageHeader page="component-atlas" title={t('app.atlas')} {t} bind:locale />

  <main>
    <details class="help">
      <summary>{t('atlas.about')}</summary>
      <dl>
        <dt>cid</dt><dd>{t('atlas.help.cid')}</dd>
        <dt>{t('atlas.usedIn')}</dt><dd>{t('atlas.help.usedIn')}</dd>
        <dt>{t('atlas.appearsIn')}</dt><dd>{t('atlas.help.appearsIn', { cap: atlas?.cap ?? 60 })}</dd>
        <dt>{t('atlas.kind.unencoded')}</dt><dd>{t('atlas.help.unencoded')}</dd>
      </dl>
      {#if atlas}
        <p>{t('atlas.help.built', { date: atlas.built, descriptions: atlas.counts.descriptions, licence: atlas.licence })}
          <a href={CORPUS} target="_blank" rel="noreferrer">ids-corpus.json.gz</a> · <a href={COPYING} target="_blank" rel="noreferrer">COPYING-chise-ids.txt</a></p>
      {/if}
      <p>{t('atlas.help.floor')}</p>
    </details>

    <div class="controls">
      <label class="search">
        <span class="ui-visually-hidden">{t('atlas.search')}</span>
        <input bind:this={search} class="ui-input" type="search" value={query} oninput={event => from(() => { query = event.currentTarget.value })} placeholder={t('atlas.search')} autocomplete="off" spellcheck="false" />
      </label>
      <div class="chips" role="group" aria-label={t('atlas.kind.label')}>
        {#each KINDS as one (one)}
          <button type="button" class="ui-chip" data-interactive aria-current={kind === one} aria-pressed={kind === one} onclick={() => from(() => { kind = one })}>{t(`atlas.kind.${one}`)} <span class="n">{rows.filter(row => matches(row, one)).length}</span></button>
        {/each}
      </div>
      <label class="least">
        <span>{t('atlas.minUses')}</span>
        <input class="ui-input" type="number" min="0" step="10" value={least} oninput={event => { const field = event.currentTarget; from(() => { least = Math.max(0, Math.floor(Number(field.value)) || 0) }); if (field.value !== '' && field.value !== String(least)) field.value = String(least) }} />
      </label>
      <span class="download"><Menu label={t('appendix.download')} icon="download" items={downloads} align="end" keyHints={false} compact /></span>
    </div>

    {#if failed}
      <p class="empty">{t('appendix.loadFailed')}</p>
    {:else if !atlas}
      <p class="empty">{t('appendix.loading')}</p>
    {:else}
      <p class="count" aria-live="polite">{t('atlas.count', { count: filtered.length })}</p>
      {#if filtered.length === 0}
        <p class="empty">{t('atlas.empty')}</p>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col" title={t('atlas.help.cid')}>{t('atlas.component')}</th>
                <th scope="col" class="num" title={t('atlas.help.usedIn')}>{t('atlas.usedIn')}</th>
                <th scope="col" title={t('atlas.help.appearsIn', { cap: atlas.cap })}>{t('atlas.appearsIn')}</th>
              </tr>
            </thead>
            <tbody>
              {#each visible as row (row.cid)}
                <tr>
                  <td>
                    <div class="component">
                      {#if row.encoded}<span class="form" lang="ja">{row.char}</span>
                      {:else}
                        {@const outline = outlineOf(row)}
                        {#if outline}<svg class="form" viewBox="0 0 200 200" role="img" aria-label={outline.from}><title>GlyphWiki · {outline.from}</title><path d={outline.d} fill="currentColor" /></svg>{:else}<span class="form dash">—</span>{/if}
                      {/if}
                      <span class="cid">{row.cid}</span>
                      {#if !row.encoded}<span class="tag" title={t('atlas.help.unencoded')}>{t('atlas.kind.unencoded')}</span>{/if}
                    </div>
                  </td>
                  <td class="num" data-label={t('atlas.usedIn')}>{row.uses.toLocaleString(locale)}</td>
                  <td class="inside" lang="ja">{row.subjects.join(' ')}{#if row.uses > row.subjects.length}<span class="more"> …</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if pages > 1}
          <div class="pager">
            <button type="button" class="ui-button" data-size="sm" disabled={page <= 1} onclick={() => { page -= 1 }}>{t('appendix.prev')}</button>
            <span>{t('appendix.page', { page, pages })}</span>
            <button type="button" class="ui-button" data-size="sm" disabled={page >= pages} onclick={() => { page += 1 }}>{t('appendix.next')}</button>
          </div>
        {/if}
      {/if}
    {/if}
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  main{width:100%;max-width:1180px;margin:0 auto;padding:22px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  .help{max-width:78ch;margin:0 0 14px;font-size:13px;line-height:1.55;color:var(--ui-color-ink-muted)}
  .help summary{cursor:pointer;width:max-content;color:var(--ui-color-ink-soft);font-weight:600}
  .help dl{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:6px 14px;margin:10px 0}
  .help dt{color:var(--ui-color-ink);font-weight:600}
  .help dd{margin:0}
  .help p{margin:6px 0 0}
  .help a{color:var(--ui-color-accent);text-decoration:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
  .help a:hover{text-decoration:underline}
  .controls{position:sticky;top:58px;z-index:5;display:flex;gap:10px 12px;flex-wrap:wrap;align-items:center;padding:12px;margin:0 0 8px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xl);background:color-mix(in srgb,var(--ui-color-canvas) 92%,transparent);backdrop-filter:blur(10px)}
  .search{flex:1 1 280px;max-width:420px}
  .search input{width:100%}
  .chips{display:flex;gap:6px;flex-wrap:wrap}
  .n{margin-inline-start:4px;font-variant-numeric:tabular-nums;color:var(--ui-color-ink-muted)}
  .least{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ui-color-ink-muted);white-space:nowrap}
  .least input{width:84px;font-variant-numeric:tabular-nums}
  .download{margin-inline-start:auto}
  .count{font-size:12px;color:var(--ui-color-ink-muted);margin:10px 0}
  .table-wrap{overflow-x:auto;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg)}
  table{border-collapse:collapse;width:100%;font-size:12.5px}
  th,td{padding:8px 10px;text-align:start;vertical-align:top;border-bottom:1px solid var(--ui-color-border)}
  th{font-size:11px;font-weight:600;color:var(--ui-color-ink-muted);white-space:nowrap;background:var(--ui-color-surface-sunken)}
  tbody tr:last-child td{border-bottom:0}
  .component{display:grid;justify-items:start;gap:3px;width:150px}
  .form{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:30px;line-height:1.1;color:var(--ui-color-ink)}
  svg.form{width:33px;height:33px}
  .dash{color:var(--ui-color-ink-muted)}
  .cid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--ui-color-ink-soft);overflow-wrap:anywhere}
  .tag{padding:0 5px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xs);font-size:10px;line-height:1.6;color:var(--ui-color-ink-muted);white-space:nowrap}
  .num{text-align:end;white-space:nowrap;color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  td.num{color:var(--ui-color-ink);font-size:13px}
  .inside{width:100%;font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:18px;line-height:1.6;letter-spacing:1px;overflow-wrap:anywhere;color:var(--ui-color-ink)}
  .more{color:var(--ui-color-ink-muted)}
  .pager{display:flex;align-items:center;gap:10px;justify-content:center;margin:12px 0;font-size:12px;color:var(--ui-color-ink-muted)}
  .empty{color:var(--ui-color-ink-muted);margin:18px 0}
  @media (max-width:720px) {
    thead{display:none}
    table,tbody{display:block}
    tbody tr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;padding:12px 10px;border-bottom:1px solid var(--ui-color-border)}
    tbody tr:last-child{border-bottom:0}
    tbody td{display:block;padding:0;border:0}
    .component{width:auto;grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:10px}
    .component .form{grid-row:1 / 3}
    td.num{align-self:start}
    td.num::before{content:attr(data-label);margin-inline-end:6px;font-size:10px;color:var(--ui-color-ink-muted)}
    .inside{width:auto;grid-column:1 / -1;font-size:17px}
    .search{flex-basis:100%;max-width:none}
    .controls{position:static}
    .download{margin-inline-start:0}
  }
</style>
