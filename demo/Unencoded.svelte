<script>
  // Every form no code point names, one row each: its identifier, the names BabelStone, CHISE and
  // zi.tools give it, what it is in each notation, and the characters it stands in. A reader can add
  // pairs, which show beside the form they name.
  import { onMount } from 'svelte'
  import PageHeader from './ui/PageHeader.svelte'
  import Segmented from './ui/controls/Segmented.svelte'
  import TextField from './ui/controls/TextField.svelte'
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { importPairs, parsePair, parseSide } from './lib/equivalences.js'
  import dataUrl from '../data/custom-components.json.gz?url'
  import outlinesUrl from '../data/custom-outlines.json.gz?url'
  import formsJsonUrl from '../data/custom-forms.json?url'
  import formsTsvUrl from '../data/custom-forms.tsv?url'
  import formsCsvUrl from '../data/custom-forms.csv?url'
  import ledgerUrl from '../data/custom-ids.tsv?url'
  import Menu from './ui/Menu.svelte'
  import { componentDrawing } from '@han-compose/composer/component-forms'
  import { SvelteSet } from 'svelte/reactivity'
  import { chainPath } from '../src/core/chain-shape.js'
  import engineOutlines from 'ids-engine-outlines'
  import { composerPreview } from '@han-compose/composer'
  import IdsPartIcon from '../src/svelte/IdsPartIcon.svelte'
  import { createCustomComponents, customsOf, parse } from '../src/core/index.js'
  import { COMPOSER_BASE, readFrom } from './lib/composer.js'
  import { createIconDrawings } from './lib/icons.js'
  import { formRows, matches, querySummary, segments } from './lib/custom-forms.js'

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


  /** @typedef {import('./lib/custom-forms.js').FormRow} Row */
  /** @type {import('../src/core/custom-components.js').CustomComponentsData | null} */
  let doc = $state.raw(null)
  let failed = $state(false)
  /** GlyphWiki's glyph for a CHISE entity: the entity's GlyphWiki name, and each name's outline.
   * @type {{ names: Record<string, string>, outlines: Record<string, string> } | null} */
  let outlines = $state.raw(null)
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
    read(dataUrl).then(read => { doc = read }, () => { failed = true })
    // The table reads without the outlines; a form then shows what the composer draws, or nothing.
    read(outlinesUrl).then(read => { outlines = read }, () => {})
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
  /** Save a file the site serves, under its own name. @param {string} url @param {string} name */
  function download(url, name) {
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
  }
  // The table as files: one row per form in three formats, the ledger of identifiers, and the
  // whole record with the derived descriptions.
  const downloads = [
    { label: 'JSON', note: 'custom-forms.json', run: () => download(formsJsonUrl, 'custom-forms.json') },
    { label: 'TSV', note: 'custom-forms.tsv', run: () => download(formsTsvUrl, 'custom-forms.tsv') },
    { label: 'CSV', note: 'custom-forms.csv', run: () => download(formsCsvUrl, 'custom-forms.csv') },
    { separator: true },
    { label: 'custom-ids.tsv', run: () => download(ledgerUrl, 'custom-ids.tsv') },
    { label: 'custom-components.json.gz', run: () => download(dataUrl, 'custom-components.json.gz') },
  ]
  // The four ways a form is written here, each with where its notation is defined.
  const NOTATIONS = [
    { id: 'babelstone', sample: '{53}', where: 'BabelStone IDS.TXT, note 6', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT' },
    { id: 'chise', sample: '&CDP-8964;', where: 'CHISE IDS', url: 'https://gitlab.chise.org/CHISE/ids' },
    { id: 'zi-tools', sample: '#(-𠃌㇉)', where: '白式 IDS §5 · zi.tools', url: 'https://nightfurysl2001.github.io/bai-ids/' },
    { id: 'form', sample: '&X-00053;', where: 'custom-ids.tsv', url: 'https://github.com/mkpoli/ids-input/blob/main/data/custom-ids.tsv' },
  ]

  // The drawings: the composer is asked for what draws a form, as the workshop's palette does.
  // The composer's drawer ends a drawing when another is asked for, so the rows ask one at a time.
  const queued = createIconDrawings(composerPreview({ base: readFrom(COMPOSER_BASE), fontStyle: 'sans', loaders: engineOutlines }))
  /** What the composer could not draw, so the row shows the next thing it has. */
  const undrawn = new SvelteSet()
  /** @param {string} sequence */
  const icon = async sequence => {
    const drawn = await queued(sequence)
    if (!drawn) undrawn.add(sequence)
    return drawn
  }
  const adapter = $derived(/** @type {import('../src/adapter/types.js').IdsAdapter} */ (/** @type {unknown} */ ({
    icon, fontStyle: 'sans',
    drawable: async (/** @type {string} */ text) => custom?.drawableLeaves(text) ?? { text, leaves: [] },
  })))
  /**
   * What stands for a form in the table, the first that there is: this project's cut of a numbered
   * component, GlyphWiki's glyph of a CHISE entity, a chain's own line, what the composer draws of
   * its equivalent, or nothing.
   * @param {Row} row
   * @returns {{ kind: 'composed', sequence: string } | { kind: 'outline', d: string, from: string } | { kind: 'chain', d: string } | null}
   */
  function glyphOf(row) {
    const cut = row.names.find(name => name.source === 'babelstone' && componentDrawing(name.text, 'sans'))
    if (cut) return { kind: 'composed', sequence: cut.text }
    for (const name of row.names) {
      const from = outlines?.names[name.text], d = from === undefined ? undefined : outlines?.outlines[from]
      if (from !== undefined && d) return { kind: 'outline', d, from }
    }
    // A chain is shown as its own line: it is there at once, and says what the chain writes.
    for (const name of row.names) {
      const d = name.source === 'zi-tools' ? chainPath(name.text) : null
      if (d) return { kind: 'chain', d }
    }
    const text = custom ? custom.drawable(row.shown) : row.shown
    const read = parse(text, { open: true })
    return !read.problem && read.tree !== null && !customsOf(read.tree).length && !undrawn.has(text) ? { kind: 'composed', sequence: row.shown } : null
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

{#snippet written(/** @type {string} */ text, /** @type {string | undefined} */ own)}
  <span class="name" lang="ja">{#each segments(text, name => custom?.form(name)?.id) as run, at (at)}{#if !run.source}{run.text}{:else if run.id && run.id !== own}<a class="part" data-source={run.source} href={`?q=${run.id}`} title={run.id} onclick={event => { event.preventDefault(); show(/** @type {string} */ (run.id)) }}>{run.text}</a>{:else}<span class="part" data-source={run.source}>{run.text}</span>{/if}{/each}</span>
{/snippet}

{#snippet mark(/** @type {string} */ status, /** @type {boolean} */ worded)}
  <span class="status" data-status={status} title={worded ? undefined : t(`appendix.status.${status}`)}>
    {#if status === 'confirmed'}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" /></svg>{:else if status === 'candidate' && !worded}<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.2" /></svg>{/if}
    {#if worded}{t(`appendix.status.${status}`)}{:else}<span class="ui-visually-hidden">{t(`appendix.status.${status}`)}</span>{/if}
  </span>
{/snippet}

<div class="page">
  <PageHeader page="unencoded" title={t('appendix.title')} {t} bind:locale />

  <main>
    <section class="notations" aria-label={t('appendix.notations')}>
      {#each NOTATIONS as one (one.id)}
        <article>
          <code class="part" data-source={one.id} lang="ja">{one.sample}</code>
          <a href={one.url} target="_blank" rel="noreferrer">{one.where}</a>
          <p>{t(`appendix.notation.${one.id}`)}</p>
        </article>
      {/each}
    </section>

    <div class="controls">
      <label class="search">
        <span class="ui-visually-hidden">{t('appendix.search')}</span>
        <input class="ui-input" type="search" value={query} oninput={event => from(() => { query = event.currentTarget.value })} placeholder={t('appendix.search')} autocomplete="off" spellcheck="false" />
      </label>
      <div class="chips" role="group" aria-label={t('appendix.sourceLabel')}>
        {#each SOURCES as one (one)}
          <button type="button" class="ui-chip" data-interactive aria-current={source === one} aria-pressed={source === one} onclick={() => from(() => { source = one })}>{t(`appendix.source.${one}`)} <span class="n">{rows.filter(row => matches(row, terms, one, status)).length}</span></button>
        {/each}
      </div>
      <div class="chips" role="group" aria-label={t('appendix.statusLabel')}>
        {#each STATUSES as one (one)}
          <button type="button" class="ui-chip" data-interactive aria-current={status === one} aria-pressed={status === one} onclick={() => from(() => { status = one })}>{t(`appendix.status.${one}`)} <span class="n">{rows.filter(row => matches(row, terms, source, one)).length}</span></button>
        {/each}
      </div>
      <span class="download"><Menu label={t('appendix.download')} icon="download" items={downloads} align="end" keyHints={false} compact /></span>
      <Segmented label={t('appendix.sortLabel')} value={sort} options={[{ value: 'id', label: t('appendix.sort.id') }, { value: 'uses', label: t('appendix.sort.uses') }]} onchange={value => from(() => { sort = oneOf(/** @type {const} */ (['id', 'uses']), value) })} />
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
              {@const glyph = glyphOf(row)}
              <tr id={row.id} class:yours={row.yours.length > 0}>
                <td class="glyph">
                  {#if glyph?.kind === 'composed'}<span class="drawn"><IdsPartIcon sequence={glyph.sequence} {adapter} /></span>
                  {:else if glyph?.kind === 'outline'}<svg class="drawn" viewBox="0 0 200 200" role="img" aria-label={glyph.from}><title>GlyphWiki · {glyph.from}</title><path d={glyph.d} fill="currentColor" /></svg>
                  {:else if glyph?.kind === 'chain'}<svg class="drawn" viewBox="0 0 1000 1000" aria-hidden="true"><path d={glyph.d} fill="none" stroke="currentColor" stroke-width="64" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  {:else}<span class="dash">—</span>{/if}
                </td>
                <td class="id">
                  <a href={`?q=${row.id}`} onclick={event => { event.preventDefault(); show(row.id) }}>{row.id}</a>
                  {@render mark(row.status, true)}
                </td>
                <td>
                  <ul class="names">
                    {#each row.names as name (name.text)}
                      <li><span class="tag" data-source={name.source}>{t(`appendix.source.${name.source}`)}</span>{@render written(name.text, row.id)}{#if name.description}<span class="desc" lang="ja">{name.description}</span>{/if}</li>
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
                        {@render written(item.text, row.id)}
                        {@render mark(item.status, false)}
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
                    <button type="button" class="ui-chip more" data-interactive aria-expanded={opened === row.id} aria-label={`${t('appendix.derived')} ${row.derived.length}`} onclick={() => { opened = opened === row.id ? null : row.id }}>{row.derived.length}</button>
                  {:else}—{/if}
                </td>
              </tr>
              {#if opened === row.id}
                <tr class="detail">
                  <td colspan="6">
                    <ul class="derived">
                      {#each row.derived as one (one.char + one.in + one.text)}
                        <li><span class="char" lang="ja">{one.char}</span><span class="tag" data-source={one.in}>{t(`appendix.source.${one.in}`)}</span>{@render written(one.text, row.id)}{@render mark(one.status === 'verified' ? 'confirmed' : 'candidate', false)}<span class="by" lang="ja">{@render written(one.of, row.id)}</span></li>
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
          <button type="button" class="ui-button" data-size="sm" disabled={page <= 1} onclick={() => { page -= 1 }}>{t('appendix.prev')}</button>
          <span>{t('appendix.page', { page, pages })}</span>
          <button type="button" class="ui-button" data-size="sm" disabled={page >= pages} onclick={() => { page += 1 }}>{t('appendix.next')}</button>
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
        <TextField label={t('appendix.one')} bind:value={form.a} placeholder={'{7}'} autocomplete="off" spellcheck={false} mono />
        <TextField label={t('appendix.other')} bind:value={form.b} placeholder={'&CDP-8BD0;'} autocomplete="off" spellcheck={false} mono />
        <div class="note-input"><TextField label={t('appendix.form.note')} bind:value={form.note} autocomplete="off" /></div>
        <button type="submit" class="ui-button" data-variant="primary">{t('appendix.form.add')}</button>
      </form>
      {#if formError}<p class="error" role="alert">{formError}</p>{/if}
      <div class="actions">
        <button type="button" class="ui-button" onclick={exportMine} disabled={mine.length === 0}>{t('appendix.export')}</button>
        <label class="ui-button import">{t('appendix.import')}<input type="file" accept="application/json,.json" onchange={importMine} /></label>
        <span class="hint">{t('appendix.form.hint')}</span>
      </div>
    </section>
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  main{width:100%;max-width:1180px;margin:0 auto;padding:26px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  .lead{max-width:70ch;margin:0 0 18px;color:var(--ui-color-ink-soft)}
  .notations{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0 0 14px}
  .notations article{display:flex;flex-direction:column;gap:4px;padding:12px 14px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .notations code{font-family:var(--ids-font),var(--ui-font-mono);font-size:18px;line-height:1.3}
  .notations a{font-size:12px;color:var(--ui-color-accent);text-decoration:none}
  .notations a:hover{text-decoration:underline}
  .notations p{margin:2px 0 0;font-size:12.5px;line-height:1.5;color:var(--ui-color-ink-muted)}
  .controls{position:sticky;top:58px;z-index:5;display:flex;gap:10px 12px;flex-wrap:wrap;align-items:center;padding:12px;margin:0 0 8px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xl);background:color-mix(in srgb,var(--ui-color-canvas) 92%,transparent);backdrop-filter:blur(10px)}
  .search{flex:1 1 280px;max-width:420px}
  .download{order:9;margin-inline-start:auto}
  .search input{width:100%}
  .note-input{flex:1 1 240px}
  .import{position:relative;cursor:pointer}
  .chips{display:flex;gap:6px;flex-wrap:wrap}
  .n{margin-inline-start:4px;font-variant-numeric:tabular-nums;color:var(--ui-color-ink-muted)}
  .count{font-size:12px;color:var(--ui-color-ink-muted);margin:10px 0}
  .glyph-note{font-size:11.5px;color:var(--ui-color-ink-muted);margin:0 0 8px}
  .table-wrap{overflow-x:auto;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg)}
  table{border-collapse:collapse;width:100%;font-size:12.5px}
  th,td{padding:8px 10px;text-align:start;vertical-align:top;border-bottom:1px solid var(--ui-color-border)}
  th{font-size:11px;font-weight:600;color:var(--ui-color-ink-muted);white-space:nowrap;background:var(--ui-color-surface-sunken)}
  tbody tr:last-child td{border-bottom:0}
  tr.yours{background:color-mix(in srgb,var(--ui-color-accent-soft) 45%,transparent)}
  .glyph{color:var(--ui-color-ink)}
  .drawn{display:block;font-size:34px;line-height:1}
  svg.drawn{width:34px;height:34px}
  .dash{color:var(--ui-color-ink-muted)}
  .id{white-space:nowrap}
  .id a,.link,a.name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--ui-color-accent);text-decoration:none}
  .id a:hover,.link:hover,a.name:hover{text-decoration:underline}
  .id .status{display:flex;margin-top:4px}
  .names,.equals,.derived{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
  .names li,.equals li,.derived li{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
  .tag{flex:none;padding:0 5px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xs);font-size:10px;line-height:1.6;color:var(--ui-color-ink-muted);white-space:nowrap}
  .tag[data-source="babelstone"],.part[data-source="babelstone"]{color:light-dark(#8a4b00,#e0a458)}
  .tag[data-source="babelstone"]{border-color:currentColor}
  .tag[data-source="chise"],.part[data-source="chise"]{color:light-dark(#1f5fa8,#7fb2ee)}
  .tag[data-source="chise"]{border-color:currentColor}
  .tag[data-source="zi-tools"],.part[data-source="zi-tools"]{color:light-dark(#1d7044,#6fcf97)}
  .tag[data-source="zi-tools"]{border-color:currentColor}
  .part[data-source="form"]{color:var(--ui-color-accent)}
  a.part{text-decoration:underline dotted;text-underline-offset:4px}
  a.part:hover{text-decoration-style:solid}
  .by .name{font-size:inherit}
  .status{display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--ui-color-ink-muted);white-space:nowrap}
  .status svg{width:13px;height:13px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .status[data-status="candidate"] svg{stroke-width:1.4;stroke-dasharray:2 2}
  .status[data-status="confirmed"],.status[data-status="verified"]{color:light-dark(#1d7044,#6fcf97)}
  .status[data-status="none"]{opacity:.7}
  .by{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:11px;color:var(--ui-color-ink-muted);overflow-wrap:anywhere}
  .num{text-align:end;white-space:nowrap;color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  .detail td{background:var(--ui-color-surface-sunken)}
  .derived{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:6px 18px}
  .char{font-family:var(--ids-font);font-size:17px;line-height:1.2}
  .identity{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
  .name{font-family:var(--ids-font),ui-monospace,monospace;font-size:15px;line-height:1.3;overflow-wrap:anywhere}
  .scheme{font-size:10px;color:var(--ui-color-ink-muted);text-transform:uppercase;letter-spacing:.02em}
  .desc{flex-basis:100%;color:var(--ui-color-ink-muted);font-size:11.5px}
  .kind,.uses{color:var(--ui-color-ink-muted);white-space:nowrap}
  .remove{padding:0 5px;border:0;background:none;color:var(--ui-color-ink-muted);font-size:16px;line-height:1;cursor:pointer}
  .remove:hover{color:var(--ui-color-danger)}
  .pager{display:flex;align-items:center;gap:10px;justify-content:center;margin:12px 0;font-size:12px;color:var(--ui-color-ink-muted)}
  .mine{margin-top:22px;padding-top:14px;border-top:1px solid var(--ui-color-border)}
  .mine ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
  .mine li{display:flex;align-items:baseline;gap:8px;font-size:12.5px}
  .pair-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
  .pair-note{color:var(--ui-color-ink-muted);font-size:11.5px}
  .add{margin-top:26px;padding-top:18px;border-top:1px solid var(--ui-color-border)}
  h2{font-size:13px;margin:0 0 10px}
  form{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
  .actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:12px}
  .import input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .hint{color:var(--ui-color-ink-muted)}
  .error{color:var(--ui-color-danger);font-size:12px;margin:8px 0 0}
  .empty{color:var(--ui-color-ink-muted);margin:18px 0}
  @media (max-width:720px) {
    thead{display:none}
    table,tbody{display:block}
    tbody tr{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:6px 10px;padding:12px 10px;border-bottom:1px solid var(--ui-color-border)}
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
    .search{flex-basis:100%;max-width:none}
    .controls{position:static}
  }
</style>
