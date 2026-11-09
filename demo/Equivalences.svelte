<script>
  // Appendix: the aligned pairs in the corpus, a BabelStone number beside the CHISE entity that names
  // the same component, with the characters that attest each pair. A reader can add their own pairs;
  // they stay in this browser and can be exported or imported as JSON.
  import { onMount } from 'svelte'
  import SiteSelect from './ui/SiteSelect.svelte'
  import ThemeSwitch from './ui/ThemeSwitch.svelte'
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { applyTheme, storedTheme } from './lib/theme.js'
  import { load, save } from './lib/storage.js'
  import dataUrl from '../data/ids-equivalences.json?url'
  import componentsUrl from '../data/ids-components.tsv?url'
  import { componentDrawing } from '../src/composer/component-forms.js'
  import { importPairs, parsePair, parseSide } from './lib/equivalences.js'

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

  /** @typedef {{ a: string, b: string, aChar: string | null, bChar: string | null, aDescription: string | null, bDescription: string | null, basis: string, status: string, prov: number[], note: string, yours?: boolean }} Row */
  /** @type {{ provenance: { source?: string }[], sources: { id: string, title: string, url: string, licence?: string }[], rows: any[][] } | null} */
  let doc = $state(null)
  let failed = $state(false)
  /** BabelStone's numbered components: the PUA glyph note 6 prints, the description and the fragment.
   * @type {Map<number, { glyph: string | null, description: string }>} */
  let numbered = $state(new Map())

  onMount(async () => {
    const [equivalencesResponse, componentsResponse] = await Promise.allSettled([fetch(dataUrl), fetch(componentsUrl)])
    try {
      if (equivalencesResponse.status !== 'fulfilled' || !equivalencesResponse.value.ok) throw new Error('equivalences')
      doc = await equivalencesResponse.value.json()
    } catch { failed = true }
    try {
      if (componentsResponse.status !== 'fulfilled' || !componentsResponse.value.ok) return
      const text = await componentsResponse.value.text()
      const map = new Map()
      for (const line of text.split(/\r?\n/)) {
        if (!line || line.startsWith('#')) continue
        const [name, description] = line.split('\t')
        const number = Number(name?.slice(1, -1))
        if (!Number.isInteger(number)) continue
        const pua = /\(([0-9A-F]{4,6})\)\s*$/.exec(description ?? '')
        map.set(number, { glyph: pua ? String.fromCodePoint(Number.parseInt(pua[1], 16)) : null, description: stripPua(description) })
      }
      numbered = map
    } catch { /* The table still lists the pairs without glyphs. */ }
  })

  /** Note 6 prints the PUA code point after the description; the Glyph column carries it instead.
   * @param {string | null} text */
  const stripPua = text => text ? text.replace(/\s*\([0-9A-F]{4,6}\)\s*$/, '') : text
  /** @param {any[]} raw @returns {Row} */
  const corpusRow = raw => ({
    a: raw[0], b: raw[1], aChar: raw[2], bChar: raw[3], aDescription: stripPua(raw[4]), bDescription: stripPua(raw[5]),
    basis: raw[6], status: raw[7], prov: raw[8] ?? [], note: raw[9] ?? '',
  })
  const corpusRows = $derived(doc ? doc.rows.map(corpusRow) : [])

  /** A reader's own pairs, as typed and parsed. @type {{ a: string, b: string, note: string }[]} */
  const stored = load('equivalences', [])
  let mine = $state(Array.isArray(stored)
    ? stored.filter(row => row && typeof row.a === 'string' && typeof row.b === 'string' && typeof row.note === 'string')
      .map(row => ({ a: row.a, b: row.b, note: row.note }))
    : [])
  $effect(() => save('equivalences', mine.length ? mine : undefined))
  const mineRows = $derived(mine.map(row => /** @type {Row} */ ({
    a: row.a, b: row.b, aChar: null, bChar: null, aDescription: null, bDescription: null,
    basis: 'reader', status: 'yours', prov: [], note: row.note, yours: true,
  })))
  const rows = $derived([...mineRows, ...corpusRows])

  let query = $state('')
  /** @type {'all' | 'verified' | 'candidate' | 'yours'} */
  let status = $state('all')
  const needle = $derived(query.trim().toLocaleLowerCase(locale))
  /** @param {Row} row */
  const haystack = row => [row.a, row.b, row.aChar ?? '', row.bChar ?? '', row.aDescription ?? '', row.bDescription ?? '', row.note, ...sourceLinks(row).map(source => source.title)]
    .join('\n').toLocaleLowerCase(locale)
  const visible = $derived(rows.filter(row => (status === 'all' || row.status === status) && (!needle || haystack(row).includes(needle))))
  const counts = $derived({
    all: rows.length,
    verified: rows.filter(row => row.status === 'verified').length,
    candidate: rows.filter(row => row.status === 'candidate').length,
    yours: mine.length,
  })

  /** The BabelStone glyph of the pair's numbered side, or the character itself when the pair names one.
   * @param {Row} row */
  function glyphOf(row) {
    for (const cid of [row.a, row.b]) {
      const numberedCid = /^bsp:(\d+)$/.exec(cid)
      if (numberedCid) return numbered.get(Number(numberedCid[1]))?.glyph ?? null
      const scalar = /^ucs:([0-9A-Fa-f]+)$/.exec(cid)
      if (scalar) return String.fromCodePoint(Number.parseInt(scalar[1], 16))
    }
    return null
  }
  /** The project's Sans cut of the pair's glyph, beside BabelStone Han PUA's drawing.
   * @param {Row} row */
  function ourGlyph(row) {
    const glyph = glyphOf(row)
    return glyph ? componentDrawing(glyph, 'sans') : null
  }
  /** @param {string} cid @param {string | null} description */
  const descriptionOf = (cid, description) => {
    if (description) return description
    const numberedCid = /^bsp:(\d+)$/.exec(cid)
    return numberedCid ? numbered.get(Number(numberedCid[1]))?.description ?? null : null
  }
  /** @param {Row} row */
  const basisOf = row => row.basis === 'alignment' ? t('appendix.basisValue.alignment') : row.basis === 'reader' ? t('appendix.basisValue.reader') : row.basis
  /** @param {Row} row */
  function sourceLinks(row) {
    if (!doc || row.yours) return []
    return [...new Set(row.prov.map(index => doc.provenance[index]?.source).filter(Boolean))]
      .map(id => doc.sources.find(source => source.id === id))
      .filter(Boolean)
  }
  /** @param {string} cid */
  const nameOf = cid => {
    const numbered = /^bsp:(\d+)$/.exec(cid)
    return numbered ? `{${numbered[1]}}` : cid.replace(/^chise:/, '')
  }
  /** @param {string} cid */
  const schemeOf = cid => cid.split(':')[0]
  let form = $state({ a: '', b: '', note: '' })
  let formError = $state('')
  /** @param {SubmitEvent} event */
  function add(event) {
    event.preventDefault()
    const pair = parsePair(form.a, form.b)
    if (!pair) { formError = parseSide(form.a) && parseSide(form.b) ? t('appendix.form.same') : t('appendix.form.invalid'); return }
    const [one, two] = pair
    if (corpusRows.some(row => row.a === one && row.b === two)) { formError = t('appendix.form.exists'); return }
    const note = form.note.trim()
    const existing = mine.find(row => row.a === one && row.b === two)
    if (existing) existing.note = note
    else mine = [...mine, { a: one, b: two, note }]
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
      const imported = importPairs(JSON.parse(await file.text()))
      const merged = new Map(mine.map(row => [`${row.a}\0${row.b}`, row]))
      for (const row of imported) merged.set(`${row.a}\0${row.b}`, row)
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
      <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={{ system: t('app.theme.system'), light: t('app.theme.light'), dark: t('app.theme.dark') }} onchange={setTheme} />
      <a class="back" href={`./?lang=${locale}`}>{t('sources.back')}</a>
    </div>
  </header>

  <main>
    <p class="lead">{t('appendix.lead')}</p>

    <div class="controls">
      <label class="search">
        <span class="ui-visually-hidden">{t('appendix.search')}</span>
        <input type="search" bind:value={query} placeholder={t('appendix.search')} autocomplete="off" />
      </label>
      <div class="chips" role="group" aria-label={t('appendix.status')}>
        <button type="button" class:active={status === 'all'} aria-pressed={status === 'all'} onclick={() => { status = 'all' }}>
          {t('appendix.all')} <span class="n">{counts.all}</span>
        </button>
        <button type="button" class:active={status === 'verified'} aria-pressed={status === 'verified'} onclick={() => { status = 'verified' }}>
          {t('appendix.verified')} <span class="n">{counts.verified}</span>
        </button>
        <button type="button" class:active={status === 'candidate'} aria-pressed={status === 'candidate'} onclick={() => { status = 'candidate' }}>
          {t('appendix.candidate')} <span class="n">{counts.candidate}</span>
        </button>
        <button type="button" class:active={status === 'yours'} aria-pressed={status === 'yours'} onclick={() => { status = 'yours' }}>
          {t('appendix.yours')} <span class="n">{counts.yours}</span>
        </button>
      </div>
    </div>

    {#if failed}
      <p class="empty">{t('appendix.loadFailed')}</p>
    {:else if !doc}
      <p class="empty">{t('appendix.loading')}</p>
    {/if}
      <p class="count" aria-live="polite">{t('appendix.count', { count: visible.length })}</p>
      {#if visible.length === 0}
        <p class="empty">{t('appendix.empty')}</p>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('appendix.glyph')}</th>
                <th scope="col">{t('appendix.one')}</th>
                <th scope="col">{t('appendix.other')}</th>
                <th scope="col">{t('appendix.basis')}</th>
                <th scope="col">{t('appendix.status')}</th>
                <th scope="col">{t('appendix.evidence')}</th>
                <th scope="col">{t('appendix.sources')}</th>
                <th scope="col"><span class="ui-visually-hidden">{t('appendix.form.add')}</span></th>
              </tr>
            </thead>
            <tbody>
              {#each visible as row (row.yours ? `mine:${row.a}:${row.b}` : `${row.a}:${row.b}`)}
                <tr class:yours={row.yours}>
                  <td class="glyph">
                    {#if glyphOf(row)}<span class="pua" title={t('appendix.glyphTitle.babel')}>{glyphOf(row)}</span>{/if}
                    {#if ourGlyph(row)}
                      <svg class="ours" viewBox="0 0 1000 1000" role="img" aria-label={t('appendix.glyphTitle.ours')}>
                        <path d={ourGlyph(row).d} fill="currentColor" />
                      </svg>
                    {/if}
                    {#if !glyphOf(row) && !ourGlyph(row)}—{/if}
                  </td>
                  <td>
                    <span class="identity">
                      <span class="name">{nameOf(row.a)}</span>
                      <span class="scheme">{schemeOf(row.a)}</span>
                      {#if descriptionOf(row.a, row.aDescription)}<span class="desc">{descriptionOf(row.a, row.aDescription)}</span>{/if}
                    </span>
                  </td>
                  <td>
                    <span class="identity">
                      <span class="name">{nameOf(row.b)}</span>
                      <span class="scheme">{schemeOf(row.b)}</span>
                      {#if descriptionOf(row.b, row.bDescription)}<span class="desc">{descriptionOf(row.b, row.bDescription)}</span>{/if}
                    </span>
                  </td>
                  <td class="basis">{basisOf(row)}</td>
                  <td><span class="mark {row.status}">{t(`appendix.state.${row.status}`)}</span></td>
                  <td class="note">{row.note || '—'}</td>
                  <td class="links">
                    {#if sourceLinks(row).length}
                      {#each sourceLinks(row) as source (source.id)}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title ?? source.file ?? source.id}</a>{/each}
                    {:else}—{/if}
                  </td>
                  <td>{#if row.yours}<button type="button" class="remove" onclick={() => remove(row.a, row.b)} aria-label={t('appendix.remove')} title={t('appendix.remove')}>×</button>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="glyph-note">{t('appendix.glyphNote')}</p>
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
  .table-wrap{overflow-x:auto;border:1px solid var(--ids-line);border-radius:8px}
  table{border-collapse:collapse;width:100%;font-size:12.5px}
  th,td{padding:8px 10px;text-align:start;vertical-align:top;border-bottom:1px solid var(--ids-line)}
  th{font-size:11px;font-weight:600;color:var(--ids-muted);white-space:nowrap;background:var(--ids-surface-subtle)}
  tbody tr:last-child td{border-bottom:0}
  tr.yours{background:color-mix(in srgb,var(--ids-accent-light) 45%,transparent)}
  .glyph{display:flex;align-items:center;gap:6px;color:var(--ids-ink);white-space:nowrap}
  .pua{font-family:'IDS Numbered','Noto Sans CJK JP',serif;font-size:22px;line-height:1.2}
  .glyph-note{font-size:11.5px;color:var(--ids-muted);margin:8px 0 0}
  .ours{width:26px;height:26px;flex:none}
  .identity{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
  .name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
  .scheme{font-size:10px;color:var(--ids-muted);text-transform:uppercase;letter-spacing:.02em}
  .desc{flex-basis:100%;color:var(--ids-muted);font-size:11.5px}
  .basis{color:var(--ids-muted)}
  .note{max-width:34ch;color:var(--ids-ink-soft)}
  .links{display:flex;flex-direction:column;gap:2px;white-space:nowrap}
  .links a{color:var(--ids-accent);text-decoration:none;font-size:11.5px}
  .links a:hover{text-decoration:underline}
  .mark{display:inline-block;padding:1px 6px;border-radius:999px;font-size:10.5px;border:1px solid var(--ids-line-strong);color:var(--ids-ink-soft);white-space:nowrap}
  .mark.verified{border-color:color-mix(in srgb,var(--ids-accent) 50%,transparent);color:var(--ids-accent)}
  .mark.candidate{color:var(--ids-muted)}
  .mark.yours{border-color:var(--ids-accent);color:var(--ids-accent)}
  .remove{padding:0 5px;border:0;background:none;color:var(--ids-muted);font-size:16px;line-height:1;cursor:pointer}
  .remove:hover{color:var(--ids-fault)}
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
    .note{max-width:none}
    form label, form input{width:100%;min-width:0}
    .primary{width:100%}
  }
</style>
