<script>
  // Every form no code point names, one row each: its identifier, the names BabelStone, CHISE and
  // zi.tools give it, what it is in each notation, and the characters it stands in. A reader can add
  // pairs, which show beside the form they name.
  import { onMount } from 'svelte'
  import SiteSelect from './ui/SiteSelect.svelte'
  import ThemeSwitch from './ui/ThemeSwitch.svelte'
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { applyTheme, storedTheme } from './lib/theme.js'
  import { load, save } from './lib/storage.js'
  import { importPairs, parsePair, parseSide } from './lib/equivalences.js'
  import dataUrl from '../data/custom-components.json.gz?url'
  import engineOutlines from 'ids-engine-outlines'
  import { composerPreview } from '@han-compose/composer'
  import IdsPartIcon from '../src/svelte/IdsPartIcon.svelte'
  import { createCustomComponents, customsOf, parse } from '../src/core/index.js'
  import { COMPOSER_BASE, readFrom } from './lib/composer.js'
  import { createIconDrawings } from './lib/icons.js'
  import { formRows, matches, querySummary } from './lib/custom-forms.js'

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

  let theme = $state(storedTheme())
  /** @param {import('./lib/theme.js').Theme} next */
  const setTheme = next => { theme = next; applyTheme(next) }

  /** @typedef {import('./lib/custom-forms.js').FormRow} Row */
  /** @type {import('../src/core/custom-components.js').CustomComponentsData | null} */
  let doc = $state.raw(null)
  let failed = $state(false)
  onMount(async () => {
    try {
      const response = await fetch(dataUrl)
      if (!response.ok) throw new Error(String(response.status))
      // The published file is gzipped; the dev server may hand it over already decoded.
      const bytes = new Uint8Array(await response.arrayBuffer())
      const text = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(bytes)
      doc = JSON.parse(text)
    } catch { failed = true }
  })
  const custom = $derived(doc ? createCustomComponents(doc) : null)

  /** Reader-added pairs, shown beside the form either side names. @type {{ a: string, b: string, note: string }[]} */
  const stored = load('equivalences', [])
  let mine = $state(Array.isArray(stored)
    ? stored.filter(row => row && typeof row.a === 'string' && typeof row.b === 'string' && typeof row.note === 'string')
      .map(row => ({ a: row.a, b: row.b, note: row.note }))
    : [])
  $effect(() => save('equivalences', mine.length ? mine : undefined))
  const rows = $derived(doc ? formRows(doc, mine) : [])

  // The query lives in the address, so a search can be linked to.
  const SOURCES = /** @type {const} */ (['all', 'babelstone', 'chise', 'zi-tools', 'unnamed', 'yours'])
  const STATUSES = /** @type {const} */ (['any', 'confirmed', 'candidate', 'none'])
  /** @template {string} T @param {readonly T[]} list @param {string | null} value @returns {T} */
  const oneOf = (list, value) => list.find(item => item === value) ?? list[0]
  let hashed = ''
  try { hashed = decodeURIComponent(location.hash.slice(1)) } catch { hashed = '' }
  let query = $state(params.get('q') ?? (/^X-\d+$/.test(hashed) ? hashed : ''))
  let source = $state(oneOf(SOURCES, params.get('source')))
  let status = $state(oneOf(STATUSES, params.get('status')))
  let sort = $state(oneOf(/** @type {const} */ (['id', 'uses']), params.get('sort')))
  let page = $state(Math.max(1, Math.floor(Number(params.get('page'))) || 1))
  const PAGE = 50
  $effect(() => {
    const next = new URLSearchParams(location.search)
    for (const [key, value, unset] of /** @type {[string, string, string][]} */ ([['q', query.trim(), ''], ['source', source, 'all'], ['status', status, 'any'], ['sort', sort, 'id'], ['page', String(page), '1']])) {
      if (value === unset) next.delete(key); else next.set(key, value)
    }
    const text = next.toString()
    history.replaceState(null, '', `${location.pathname}${text ? `?${text}` : ''}`)
  })
  const terms = $derived(querySummary(query))
  const filtered = $derived.by(() => {
    const found = rows.filter(row => matches(row, terms, source, status))
    return sort === 'uses' ? [...found].sort((a, b) => b.uses - a.uses || a.number - b.number) : found
  })
  const pages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE)))
  const visible = $derived(filtered.slice((page - 1) * PAGE, page * PAGE))
  $effect(() => { if (doc && page > pages) page = pages })
  /** @param {() => void} change */
  const from = change => { change(); page = 1 }
  /** @param {string} id */
  const show = id => from(() => { query = id; source = 'all'; status = 'any' })
  let opened = $state(/** @type {string | null} */ (null))

  // The drawings: the composer is asked for what draws a form, as the workshop's palette does.
  // The composer's drawer ends a drawing when another is asked for, so the rows ask one at a time.
  const icon = createIconDrawings(composerPreview({ base: readFrom(COMPOSER_BASE), fontStyle: 'sans', loaders: engineOutlines }))
  const adapter = $derived(/** @type {import('../src/adapter/types.js').IdsAdapter} */ (/** @type {unknown} */ ({
    icon, fontStyle: 'sans',
    drawable: async (/** @type {string} */ text) => custom?.drawableLeaves(text) ?? { text, leaves: [] },
  })))
  /** Whether everything a form is written with draws. @param {Row} row */
  const draws = row => {
    const read = custom ? parse(custom.drawable(row.shown), { open: true }) : null
    return Boolean(read && !read.problem && read.tree !== null && !customsOf(read.tree).length)
  }
  /** @param {string} cid */
  const shortName = cid => cid.replace(/^(?:chise|bsp|ucs):/, '')

  let form = $state({ a: '', b: '', note: '' })
  let formError = $state('')
  /** @param {SubmitEvent} event */
  function add(event) {
    event.preventDefault()
    const pair = parsePair(form.a, form.b)
    if (!pair) { formError = parseSide(form.a) && parseSide(form.b) ? t('appendix.form.same') : t('appendix.form.invalid'); return }
    const [one, two] = pair
    if (mine.some(row => row.a === one && row.b === two)) { formError = t('appendix.form.exists'); return }
    mine = [...mine, { a: one, b: two, note: form.note.trim() }]
    form = { a: '', b: '', note: '' }
    formError = ''
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
      <a class="back" href={`./ucv.html?lang=${locale}`}>UCV</a>
      <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={{ system: t('app.theme.system'), light: t('app.theme.light'), dark: t('app.theme.dark') }} onchange={setTheme} />
      <a class="back" href={`./?lang=${locale}`}>{t('sources.back')}</a>
    </div>
  </header>

  <main>
    <div class="controls">
      <label class="search">
        <span class="ui-visually-hidden">{t('appendix.search')}</span>
        <input type="search" value={query} oninput={event => from(() => { query = event.currentTarget.value })} placeholder={t('appendix.search')} autocomplete="off" spellcheck="false" />
      </label>
      <div class="chips" role="group" aria-label={t('appendix.sourceLabel')}>
        {#each SOURCES as one (one)}
          <button type="button" class:active={source === one} aria-pressed={source === one} onclick={() => from(() => { source = one })}>{t(`appendix.source.${one}`)} <span class="n">{rows.filter(row => matches(row, terms, one, status)).length}</span></button>
        {/each}
      </div>
      <div class="chips" role="group" aria-label={t('appendix.statusLabel')}>
        {#each STATUSES as one (one)}
          <button type="button" class:active={status === one} aria-pressed={status === one} onclick={() => from(() => { status = one })}>{t(`appendix.status.${one}`)} <span class="n">{rows.filter(row => matches(row, terms, source, one)).length}</span></button>
        {/each}
      </div>
      <label class="sort">
        <span class="ui-visually-hidden">{t('appendix.sortLabel')}</span>
        <select value={sort} onchange={event => from(() => { sort = oneOf(/** @type {const} */ (['id', 'uses']), event.currentTarget.value) })}>
          <option value="id">{t('appendix.sort.id')}</option>
          <option value="uses">{t('appendix.sort.uses')}</option>
        </select>
      </label>
    </div>

    {#if failed}
      <p class="empty">{t('appendix.loadFailed')}</p>
    {:else if !doc}
      <p class="empty">{t('appendix.loading')}</p>
    {:else}
      <p class="count" aria-live="polite">{t('appendix.count', { count: filtered.length })}</p>
    {/if}

    {#if doc && filtered.length === 0}
      <p class="empty">{t('appendix.empty')}</p>
    {:else if doc}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('appendix.glyph')}</th>
              <th scope="col">{t('appendix.id')}</th>
              <th scope="col">{t('appendix.names')}</th>
              <th scope="col">{t('appendix.equivalent')}</th>
              <th scope="col" class="num">{t('appendix.uses')}</th>
              <th scope="col" class="num">{t('appendix.derived')}</th>
            </tr>
          </thead>
          <tbody>
            {#each visible as row (row.id)}
              <tr id={row.id} class:yours={row.yours.length > 0}>
                <td class="glyph">
                  {#if draws(row)}<span class="drawn"><IdsPartIcon sequence={row.shown} {adapter} /></span>{:else}<span class="dash">—</span>{/if}
                </td>
                <td class="id">
                  <a href={`?q=${row.id}`} onclick={event => { event.preventDefault(); show(row.id) }}>{row.id}</a>
                  <span class="status" data-status={row.status}>{t(`appendix.status.${row.status}`)}</span>
                </td>
                <td>
                  <ul class="names">
                    {#each row.names as name (name.text)}
                      <li><span class="tag" data-source={name.source}>{t(`appendix.source.${name.source}`)}</span><span class="name" lang="ja">{name.text}</span>{#if name.description}<span class="desc" lang="ja">{name.description}</span>{/if}</li>
                    {/each}
                    {#each row.of as other (other.id + other.relation)}
                      <li><span class="tag">{t(`appendix.relation.${other.relation}`)}</span><a class="name" href={`?q=${other.id}`} onclick={event => { event.preventDefault(); show(other.id) }}>{other.id}</a></li>
                    {/each}
                  </ul>
                </td>
                <td>
                  <ul class="equals">
                    {#each row.equivalents as item (item.in + item.text)}
                      <li>
                        <span class="tag" data-source={item.in}>{t(`appendix.source.${item.in}`)}</span>
                        <span class="name" lang="ja">{item.text}</span>
                        <span class="status" data-status={item.status}>{t(`appendix.status.${item.status}`)}</span>
                        {#if item.count}<span class="by" lang="ja">{item.count} · {item.characters.join('')}</span>{/if}
                        {#if item.id && item.id !== row.id}<a class="link" href={`?q=${item.id}`} onclick={event => { event.preventDefault(); show(/** @type {string} */ (item.id)) }}>{item.id}</a>{/if}
                      </li>
                    {/each}
                    {#each row.yours as pair (pair.other)}<!-- one line per other side: formRows joins the notes -->
                      <li><span class="tag">{t('appendix.yours')}</span><span class="name" lang="ja">{pair.other}</span>{#if pair.note}<span class="by">{pair.note}</span>{/if}</li>
                    {/each}
                  </ul>
                </td>
                <td class="num" data-label={t('appendix.uses')} title={row.usedIn}>{row.uses || '—'}</td>
                <td class="num" data-label={t('appendix.derived')}>
                  {#if row.derived.length}
                    <button type="button" class="more" aria-expanded={opened === row.id} aria-label={`${t('appendix.derived')} ${row.derived.length}`} onclick={() => { opened = opened === row.id ? null : row.id }}>{row.derived.length}</button>
                  {:else}—{/if}
                </td>
              </tr>
              {#if opened === row.id}
                <tr class="detail">
                  <td colspan="6">
                    <ul class="derived">
                      {#each row.derived as one (one.char + one.in + one.text)}
                        <li><span class="char" lang="ja">{one.char}</span><span class="tag" data-source={one.in}>{t(`appendix.source.${one.in}`)}</span><span class="name" lang="ja">{one.text}</span><span class="status" data-status={one.status === 'verified' ? 'confirmed' : 'candidate'}>{t(`appendix.status.${one.status === 'verified' ? 'confirmed' : 'candidate'}`)}</span><span class="by" lang="ja">{one.of}</span></li>
                      {/each}
                    </ul>
                  </td>
                </tr>
              {/if}
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
  .glyph{color:var(--ids-ink)}
  .drawn{display:block;font-size:34px;line-height:1}
  .dash{color:var(--ids-muted)}
  .id{white-space:nowrap}
  .id a,.link,a.name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--ids-accent);text-decoration:none}
  .id a:hover,.link:hover,a.name:hover{text-decoration:underline}
  .id .status{display:block;margin-top:4px}
  .names,.equals,.derived{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
  .names li,.equals li,.derived li{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
  .tag{flex:none;padding:0 5px;border:1px solid var(--ids-line);border-radius:4px;font-size:10px;line-height:1.6;color:var(--ids-muted);white-space:nowrap}
  .tag[data-source="babelstone"]{color:light-dark(#8a4b00,#e0a458);border-color:currentColor}
  .tag[data-source="chise"]{color:light-dark(#1f5fa8,#7fb2ee);border-color:currentColor}
  .tag[data-source="zi-tools"]{color:light-dark(#1d7044,#6fcf97);border-color:currentColor}
  .status{font-size:10px;color:var(--ids-muted);white-space:nowrap}
  .status[data-status="confirmed"],.status[data-status="verified"]{color:light-dark(#1d7044,#6fcf97)}
  .status[data-status="none"]{opacity:.7}
  .by{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:11px;color:var(--ids-muted);overflow-wrap:anywhere}
  .num{text-align:end;white-space:nowrap;color:var(--ids-muted);font-variant-numeric:tabular-nums}
  .more{padding:1px 7px;border:1px solid var(--ids-control-border);border-radius:999px;background:var(--ids-surface);color:var(--ids-accent);font:inherit;font-size:11.5px;cursor:pointer}
  .more[aria-expanded="true"]{background:var(--ids-accent-light);border-color:var(--ids-accent)}
  .detail td{background:var(--ids-surface-subtle)}
  .derived{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:6px 18px}
  .sort select{padding:5px 8px;border:1px solid var(--ids-control-border);border-radius:7px;background:var(--ids-surface);color:inherit;font:inherit;font-size:12px}
  .char{font-family:var(--ids-font);font-size:17px;line-height:1.2}
  .identity{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
  .name{font-family:var(--ids-font),ui-monospace,monospace;font-size:15px;line-height:1.3;overflow-wrap:anywhere}
  .scheme{font-size:10px;color:var(--ids-muted);text-transform:uppercase;letter-spacing:.02em}
  .desc{flex-basis:100%;color:var(--ids-muted);font-size:11.5px}
  .kind,.uses{color:var(--ids-muted);white-space:nowrap}
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
    thead{display:none}
    table,tbody{display:block}
    tbody tr{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:6px 10px;padding:12px 10px;border-bottom:1px solid var(--ids-line)}
    tbody tr:last-child{border-bottom:0}
    tbody td{display:block;padding:0;border:0}
    td.glyph{grid-row:1 / 3}
    td.id{grid-column:2;grid-row:1 / 3}
    td:nth-child(3),td:nth-child(4){grid-column:1 / -1}
    td:nth-child(5){grid-column:3;grid-row:1}
    td:nth-child(6){grid-column:3;grid-row:2}
    td.num::before{content:attr(data-label);margin-inline-end:6px;font-size:10px}
    tr.detail{display:block}
    .derived{grid-template-columns:minmax(0,1fr)}
    .search,.search input{width:100%}
    form label, form input{width:100%;min-width:0}
    .primary{width:100%}
  }
</style>
