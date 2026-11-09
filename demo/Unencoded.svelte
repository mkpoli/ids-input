<script>
  // Every component the corpus names, encoded or not: BabelStone's numbered parts, CHISE entities and
  // the characters that fill the other operands, with an equivalent where the alignment found one.
  // The project draws a numbered part in its own Sans cut beside BabelStone Han PUA; a reader can add
  // pairs, which appear as custom components.
  import { onMount } from 'svelte'
  import SiteSelect from './ui/SiteSelect.svelte'
  import ThemeSwitch from './ui/ThemeSwitch.svelte'
  import { translator } from '../src/svelte/index.js'
  import { componentDrawing } from '@han-compose/composer/component-forms'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { applyTheme, storedTheme } from './lib/theme.js'
  import { load, save } from './lib/storage.js'
  import { importPairs, parsePair, parseSide } from './lib/equivalences.js'
  import { equivalences } from '../src/core/index.js'
  import indexUrl from '../data/ids-components-index.json.gz?url'

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
  const equivalents = equivalences()

  let theme = $state(storedTheme())
  /** @param {import('./lib/theme.js').Theme} next */
  const setTheme = next => { theme = next; applyTheme(next) }

  /** @typedef {{ cid: string, char: string | null, kind: 'number' | 'entity' | 'character' | 'custom', label: string, description: string | null, fragment: string | null, uses: number, equivalents: { cid: string, status: string, note: string }[], yours?: boolean }} Row */
  /** @type {{ counts: { all: number, number: number, entity: number, character: number }, rows: Row[] } | null} */
  let doc = $state(null)
  let failed = $state(false)
  onMount(() => {
    let id = ''
    try { id = decodeURIComponent(location.hash.slice(1)) } catch { return }
    if (id) requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' })))
  })
  onMount(async () => {
    try {
      const response = await fetch(indexUrl)
      if (!response.ok) throw new Error(String(response.status))
      // The published file is gzipped; the dev server may hand it over already decoded.
      const bytes = new Uint8Array(await response.arrayBuffer())
      const text = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(bytes)
      doc = JSON.parse(text)
    } catch { failed = true }
  })

  /** Reader-added pairs, shown as custom components where the corpus does not name them. @type {{ a: string, b: string, note: string }[]} */
  const stored = load('equivalences', [])
  let mine = $state(Array.isArray(stored)
    ? stored.filter(row => row && typeof row.a === 'string' && typeof row.b === 'string' && typeof row.note === 'string')
      .map(row => ({ a: row.a, b: row.b, note: row.note }))
    : [])
  $effect(() => save('equivalences', mine.length ? mine : undefined))
  const customRows = $derived.by(() => {
    const known = new Set((doc?.rows ?? []).map(row => row.cid))
    const rows = new Map()
    for (const pair of mine) {
      for (const cid of [pair.a, pair.b]) {
        if (known.has(cid) || rows.has(cid)) continue
        const other = cid === pair.a ? pair.b : pair.a
        rows.set(cid, {
          cid, char: null, kind: 'custom', label: cid.replace(/^(?:chise|bsp|ucs):/, ''), description: null, fragment: null, uses: 0,
          equivalents: [{ cid: other, status: 'yours', note: pair.note }], yours: true,
        })
      }
    }
    return [...rows.values()]
  })
  const rows = $derived([...customRows, ...(doc?.rows ?? [])])

  let query = $state('')
  /** @type {'all' | 'with' | 'number' | 'entity' | 'character' | 'yours'} */
  let filter = $state('all')
  let page = $state(1)
  const PAGE = 100
  const needle = $derived(query.trim().toLocaleLowerCase(locale))
  /** @param {Row} row */
  const haystack = row => [row.cid, row.label, row.char ?? '', row.description ?? '', row.kind, ...row.equivalents.flatMap(one => [one.cid, one.note])]
    .join('\n').toLocaleLowerCase(locale)
  const filtered = $derived(rows.filter(row =>
    (filter === 'all' ? true
      : filter === 'with' ? row.equivalents.length > 0
        : filter === 'yours' ? Boolean(row.yours)
          : row.kind === filter)
    && (!needle || haystack(row).includes(needle))))
  const pages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE)))
  const visible = $derived(filtered.slice((page - 1) * PAGE, page * PAGE))
  $effect(() => { if (page > pages) page = pages })
  /** @param {string} next */
  function setFilter(next) { filter = next; page = 1 }
  $effect(() => { void query; page = 1 })

  /** @param {string} cid */
  const shortName = cid => cid.replace(/^(?:chise|bsp|ucs):/, '')
  /** @param {Row} row */
  const kindLabel = row => t(`appendix.kindValue.${row.kind}`)
  /** @param {Row} row */
  const equivalentText = row => row.equivalents.length
    ? row.equivalents.map(one => one.cid.replace(/^(?:chise|bsp|ucs):/, '')).join(', ')
    : '—'
  /** The PUA glyph, only where the bundled face draws it; the Sans cut says the same set. @param {Row} row */
  function puaOf(row) { return row.kind === 'number' && row.char && componentDrawing(row.char, 'sans') ? row.char : null }
  /** @param {Row} row */
  function sansOf(row) {
    if (!row.char || row.kind === 'entity') return null
    return componentDrawing(row.char, 'sans')
  }

  let form = $state({ a: '', b: '', note: '' })
  let formError = $state('')
  /** @param {SubmitEvent} event */
  function add(event) {
    event.preventDefault()
    const pair = parsePair(form.a, form.b)
    if (!pair) { formError = parseSide(form.a) && parseSide(form.b) ? t('appendix.form.same') : t('appendix.form.invalid'); return }
    const [one, two] = pair
    if (mine.some(row => row.a === one && row.b === two) || (doc?.rows ?? []).some(row => row.cid === one && row.equivalents.some(other => other.cid === two))) {
      formError = t('appendix.form.exists'); return
    }
    mine = [...mine, { a: one, b: two, note: form.note.trim() }]
    form = { a: '', b: '', note: '' }
    formError = ''
    page = 1
  }
  /** @param {string} a @param {string} b */
  function remove(a, b) { mine = mine.filter(row => row.a !== a || row.b !== b) }

  function exportMine() {
    const data = JSON.stringify({ format: 'ids-input/equivalences-mine', version: 1, rows: mine }, null, 1)
    const url = URL.createObjectURL(new Blob([`${data}\n`], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'ids-equivalences-mine.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  /** @param {Event} event */
  async function importMine(event) {
    const input = /** @type {HTMLInputElement} */ (event.currentTarget)
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const merged = new Map(mine.map(row => [`${row.a}\0${row.b}`, row]))
      for (const row of importPairs(JSON.parse(await file.text()))) merged.set(`${row.a}\0${row.b}`, row)
      mine = [...merged.values()]
      formError = ''
      page = 1
    } catch { formError = t('appendix.importFailed') }
  }
</script>

<div class="page">
  <header class="bar">
    <SiteSelect title={t('app.title')} label={t('app.sitesLabel')} more={t('app.sitesMore')} {locale} href={`./?lang=${locale}`} />
    <span class="slash" aria-hidden="true">/</span>
    <h1>{t('appendix.title')}</h1>
    <div class="end">
      <label class="lang">
        <span class="ui-visually-hidden">{t('sources.language')}</span>
        <select bind:value={locale}>
          {#each LOCALES as [code, name] (code)}<option value={code}>{name}</option>{/each}
        </select>
      </label>
      <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={{ system: t('app.theme.system'), light: t('app.theme.light'), dark: t('app.theme.dark') }} onchange={setTheme} />
      <a class="back" href={`./?lang=${locale}`}>{t('sources.back')}</a>
    </div>
  </header>

  <main>
    <p class="lead">{t('appendix.lead')}</p>

    <section class="equivalents" id="equivalents" aria-labelledby="equivalents-title">
      <h2 id="equivalents-title">{t('appendix.equivalents')}</h2>
      <p class="glyph-note">{t('appendix.equivalentsLead')}</p>
      <p class="glyph-note">Sources: <a href="https://ashide.otodo.net/setumei/ziboziso.html" target="_blank" rel="noreferrer">葦手入力</a> · <a href="https://www.unicode.org/reports/tr38/#kStrange" target="_blank" rel="noreferrer">Unihan kStrange</a> · <a href="https://www.babelstone.co.uk/CJK/IDS.TXT" target="_blank" rel="noreferrer">BabelStone IDS</a></p>
      <h3>{t('info.script.kana')}</h3>
      <div class="equiv-grid">
        {#each equivalents.kana as row (row.shapes[0])}
          <div class="equiv" lang="ja">
            <span class="equiv-shapes">{row.shapes.join(' ')}</span>
            <span class="equiv-arrow" aria-hidden="true">→</span>
            <span class="equiv-parts">{row.components.join(' ')}</span>
          </div>
        {/each}
      </div>
      <h3>{t('parts.tab.hangul')}</h3>
      <div class="equiv-grid">
        {#each equivalents.hangul as row (row.shapes[0])}
          <div class="equiv" lang="ko">
            <span class="equiv-shapes">{row.shapes.join(' ')}</span>
            <span class="equiv-arrow" aria-hidden="true">→</span>
            <span class="equiv-parts">{row.components.join(' ')}</span>
          </div>
        {/each}
      </div>
    </section>

    <div class="controls">
      <label class="search">
        <span class="ui-visually-hidden">{t('appendix.search')}</span>
        <input type="search" bind:value={query} placeholder={t('appendix.search')} autocomplete="off" />
      </label>
      <div class="chips" role="group" aria-label={t('appendix.filter')}>
        <button type="button" class:active={filter === 'all'} aria-pressed={filter === 'all'} onclick={() => setFilter('all')}>{t('appendix.all')}</button>
        <button type="button" class:active={filter === 'with'} aria-pressed={filter === 'with'} onclick={() => setFilter('with')}>{t('appendix.withEquivalent')}</button>
        <button type="button" class:active={filter === 'number'} aria-pressed={filter === 'number'} onclick={() => setFilter('number')}>{t('appendix.numbers')}</button>
        <button type="button" class:active={filter === 'entity'} aria-pressed={filter === 'entity'} onclick={() => setFilter('entity')}>{t('appendix.entities')}</button>
        <button type="button" class:active={filter === 'character'} aria-pressed={filter === 'character'} onclick={() => setFilter('character')}>{t('appendix.characters')}</button>
        <button type="button" class:active={filter === 'yours'} aria-pressed={filter === 'yours'} onclick={() => setFilter('yours')}>{t('appendix.yours')} <span class="n">{customRows.length}</span></button>
      </div>
    </div>

    {#if failed}
      <p class="empty">{t('appendix.loadFailed')}</p>
    {:else if !doc}
      <p class="empty">{t('appendix.loading')}</p>
    {/if}
    <p class="count" aria-live="polite">{t('appendix.count', { count: filtered.length })}</p>
    <p class="glyph-note">{t('appendix.glyphNote')}</p>

    {#if filtered.length === 0}
      <p class="empty">{t('appendix.empty')}</p>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('appendix.glyph')}</th>
              <th scope="col">{t('appendix.component')}</th>
              <th scope="col">{t('appendix.kind')}</th>
              <th scope="col">{t('appendix.equivalent')}</th>
              <th scope="col">{t('appendix.uses')}</th>
              <th scope="col"><span class="ui-visually-hidden">{t('appendix.form.add')}</span></th>
            </tr>
          </thead>
          <tbody>
            {#each visible as row (`${row.kind}:${row.cid}`)}
              <tr class:yours={row.yours}>
                <td class="glyph">
                  {#if puaOf(row)}<span class="pua" title={t('appendix.glyphTitle.babel')}>{puaOf(row)}</span>{/if}
                  {#if sansOf(row)}
                    <svg class="ours" viewBox="0 0 1000 1000" role="img" aria-label={t('appendix.glyphTitle.ours')}><path d={sansOf(row).d} fill="currentColor" /></svg>
                  {:else if row.kind === 'character' && row.char}
                    <span class="char">{row.char}</span>
                  {/if}
                  {#if !puaOf(row) && !sansOf(row) && row.kind !== 'character'}
                    <span class="dash" title={row.fragment ?? undefined}>—</span>
                  {/if}
                </td>
                <td>
                  <span class="identity">
                    <span class="name">{row.label}</span>
                    <span class="scheme">{row.cid.split(':')[0]}</span>
                    {#if row.description}<span class="desc">{row.description}</span>{/if}
                  </span>
                </td>
                <td class="kind">{kindLabel(row)}</td>
                <td class="equivalent">{equivalentText(row)}</td>
                <td class="uses">{row.uses || '—'}</td>
                <td>{#if row.yours && mine.some(pair => pair.a === row.cid || pair.b === row.cid)}<button type="button" class="remove" onclick={() => { const pair = mine.find(p => p.a === row.cid || p.b === row.cid); if (pair) remove(pair.a, pair.b) }} aria-label={t('appendix.remove')} title={t('appendix.remove')}>×</button>{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if pages > 1}
        <div class="pager">
          <button type="button" disabled={page <= 1} onclick={() => { page -= 1 }}>{t('appendix.prev')}</button>
          <span>{t('appendix.page', { page, pages })}</span>
          <button type="button" disabled={page >= pages} onclick={() => { page += 1 }}>{t('appendix.next')}</button>
        </div>
      {/if}
    {/if}

    {#if mine.length}
      <section class="mine" aria-labelledby="mine-title">
        <h2 id="mine-title">{t('appendix.mine')}</h2>
        <ul>
          {#each mine as pair (`${pair.a}\0${pair.b}`)}
            <li>
              <span class="pair-name">{shortName(pair.a)} ↔ {shortName(pair.b)}</span>
              {#if pair.note}<span class="pair-note">{pair.note}</span>{/if}
              <button type="button" class="remove" onclick={() => remove(pair.a, pair.b)} aria-label={t('appendix.remove')} title={t('appendix.remove')}>×</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="add" aria-labelledby="add-title">
      <h2 id="add-title">{t('appendix.form.title')}</h2>
      <form onsubmit={add}>
        <label>{t('appendix.one')}<input bind:value={form.a} placeholder={'bsp:7 / {7}'} autocomplete="off" spellcheck="false" /></label>
        <label>{t('appendix.other')}<input bind:value={form.b} placeholder={'chise:CDP-8BD0 / &CDP-8BD0;'} autocomplete="off" spellcheck="false" /></label>
        <label class="note-input">{t('appendix.form.note')}<input bind:value={form.note} autocomplete="off" /></label>
        <button type="submit" class="primary">{t('appendix.form.add')}</button>
      </form>
      {#if formError}<p class="error" role="alert">{formError}</p>{/if}
      <div class="actions">
        <button type="button" onclick={exportMine} disabled={mine.length === 0}>{t('appendix.export')}</button>
        <label class="import">{t('appendix.import')}<input type="file" accept="application/json,.json" onchange={importMine} /></label>
        <span class="hint">{t('appendix.form.hint')}</span>
      </div>
    </section>
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  .bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px max(18px,env(safe-area-inset-right)) 10px max(18px,env(safe-area-inset-left));border-bottom:1px solid var(--ids-line)}
  h1{font-size:15px;font-weight:600;margin:0}
  .slash{color:var(--ids-muted)}
  .end{display:flex;align-items:center;gap:10px;margin-inline-start:auto}
  .back{font-size:12px;color:var(--ids-muted);text-decoration:none}
  .back:hover{color:var(--ids-ink)}
  main{width:100%;max-width:1180px;margin:0 auto;padding:26px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  .lead{max-width:70ch;margin:0 0 18px;color:var(--ids-ink-soft)}
  .equivalents{scroll-margin-top:80px;margin:0 0 22px;padding:14px 16px;border:1px solid var(--ids-line);border-radius:8px;background:var(--ids-surface)}
  .equivalents h2{font-size:14px;margin:0 0 6px}
  .equivalents h3{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ids-muted);margin:14px 0 8px}
  .equiv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
  .equiv{display:flex;align-items:baseline;gap:5px;min-width:0;padding:5px 8px;border:1px solid var(--ids-line);border-radius:6px;background:var(--ids-surface);font-family:var(--ids-font);font-size:13px}
  .equiv-shapes{font-weight:600;color:var(--ids-ink);white-space:nowrap}
  .equiv-arrow{color:var(--ids-muted)}
  .equiv-parts{color:var(--ids-ink-soft);overflow-wrap:anywhere}
  .equivalents a{color:var(--ids-accent);text-decoration:none}
  .equivalents a:hover{text-decoration:underline}
  .controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
  .search input{width:min(360px,70vw);padding:7px 10px;border:1px solid var(--ids-control-border);border-radius:7px;background:var(--ids-surface);color:inherit;font:inherit}
  .chips{display:flex;gap:6px;flex-wrap:wrap}
  .chips button{padding:4px 9px;border:1px solid var(--ids-control-border);border-radius:999px;background:var(--ids-surface);color:var(--ids-ink-soft);font:inherit;font-size:12px;cursor:pointer}
  .chips button.active{border-color:var(--ids-accent);color:var(--ids-accent);background:var(--ids-accent-light)}
  .n{margin-inline-start:4px;font-variant-numeric:tabular-nums;color:var(--ids-muted)}
  .count{font-size:12px;color:var(--ids-muted);margin:10px 0}
  .glyph-note{font-size:11.5px;color:var(--ids-muted);margin:0 0 8px}
  .table-wrap{overflow-x:auto;border:1px solid var(--ids-line);border-radius:8px}
  table{border-collapse:collapse;width:100%;font-size:12.5px}
  th,td{padding:8px 10px;text-align:start;vertical-align:top;border-bottom:1px solid var(--ids-line)}
  th{font-size:11px;font-weight:600;color:var(--ids-muted);white-space:nowrap;background:var(--ids-surface-subtle)}
  tbody tr:last-child td{border-bottom:0}
  tr.yours{background:color-mix(in srgb,var(--ids-accent-light) 45%,transparent)}
  .glyph{display:flex;align-items:center;gap:6px;color:var(--ids-ink);white-space:nowrap}
  .pua{font-family:'IDS Numbered','Noto Sans CJK JP',serif;font-size:22px;line-height:1.2}
  .ours{width:26px;height:26px;flex:none}
  .char{font-family:'Noto Sans CJK JP',serif;font-size:19px;line-height:1.2}
  .identity{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
  .name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
  .scheme{font-size:10px;color:var(--ids-muted);text-transform:uppercase;letter-spacing:.02em}
  .desc{flex-basis:100%;color:var(--ids-muted);font-size:11.5px}
  .kind,.uses{color:var(--ids-muted);white-space:nowrap}
  .equivalent{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--ids-ink-soft);max-width:36ch}
  .remove{padding:0 5px;border:0;background:none;color:var(--ids-muted);font-size:16px;line-height:1;cursor:pointer}
  .remove:hover{color:var(--ids-fault)}
  .pager{display:flex;align-items:center;gap:10px;justify-content:center;margin:12px 0;font-size:12px;color:var(--ids-muted)}
  .pager button{padding:5px 10px;border:1px solid var(--ids-control-border);border-radius:6px;background:var(--ids-surface);color:inherit;font:inherit;cursor:pointer}
  .pager button:disabled{opacity:.5;cursor:default}
  .mine{margin-top:22px;padding-top:14px;border-top:1px solid var(--ids-line)}
  .mine ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
  .mine li{display:flex;align-items:baseline;gap:8px;font-size:12.5px}
  .pair-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
  .pair-note{color:var(--ids-muted);font-size:11.5px}
  .add{margin-top:26px;padding-top:18px;border-top:1px solid var(--ids-line)}
  h2{font-size:13px;margin:0 0 10px}
  form{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
  form label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--ids-muted)}
  form input{padding:6px 8px;border:1px solid var(--ids-control-border);border-radius:6px;background:var(--ids-surface);color:inherit;font:inherit;font-size:12.5px;min-width:180px}
  .note-input input{min-width:240px}
  .primary{padding:6px 12px;border:1px solid var(--ids-accent);border-radius:6px;background:var(--ids-accent);color:#fff;font:inherit;font-size:12.5px;cursor:pointer}
  .actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:12px}
  .actions button{padding:5px 10px;border:1px solid var(--ids-control-border);border-radius:6px;background:var(--ids-surface);color:inherit;font:inherit;cursor:pointer}
  .actions button:disabled{opacity:.5;cursor:default}
  .import{display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--ids-accent)}
  .import input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .hint{color:var(--ids-muted)}
  .error{color:var(--ids-fault);font-size:12px;margin:8px 0 0}
  .empty{color:var(--ids-muted);margin:18px 0}
  @media (max-width:720px) {
    form label, form input{width:100%;min-width:0}
    .primary{width:100%}
  }
</style>
