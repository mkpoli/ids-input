<script>
  // The full source catalogue: every top-level source the project reads or cites, followed by the
  // records behind the starter examples. One page, filters by category and tag, and a note for each
  // source that has one. The README links here instead of keeping a second list.
  import SiteSelect from './ui/SiteSelect.svelte'
  import { onMount } from 'svelte'
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { applyTheme, storedTheme } from './lib/theme.js'
  import { load, save } from './lib/storage.js'
  import { CATALOGUE } from './lib/source-catalogue.js'
  import { CATEGORIES, FEATURES, TAGS } from './lib/sources.js'
  import { inline } from './lib/rich-text.js'
  import ThemeSwitch from './ui/ThemeSwitch.svelte'

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

  let query = $state('')
  /** @type {'all' | import('./lib/sources.js').SourceCategory} */
  let category = $state('all')
  let tag = $state('all')

  const categoryLabel = (/** @type {string} */ id) => t(`sources.category.${id}`)
  const tagLabel = (/** @type {string} */ id) => {
    const key = `sources.tag.${id}`, text = t(key)
    return text === key ? id : text
  }
  const featureLabel = (/** @type {string} */ id) => {
    const key = `sources.use.${id}`, text = t(key)
    return text === key ? id : text
  }
  /** @param {import('./lib/sources.js').Source} entry */
  const summaryOf = entry => {
    if (entry.summaryKey) {
      const text = t(entry.summaryKey)
      if (text !== entry.summaryKey) return text
    }
    return entry.summary?.[locale] ?? entry.summary?.en ?? ''
  }

  /** @param {import('./lib/sources.js').Source} entry */
  const searchable = entry => [
    entry.title, entry.people?.join(' ') ?? '', entry.note ?? '', summaryOf(entry),
    entry.licence ?? '', entry.date ?? '', entry.id, entry.status ?? '',
    entry.number ? `[${entry.number}] ${entry.number}` : '', ...entry.tags.map(tagLabel),
  ].join('\n').toLocaleLowerCase(locale)
  /** @param {string} url */
  const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }

  const needle = $derived(query.trim().toLocaleLowerCase(locale))
  const visible = $derived(CATALOGUE.filter(entry =>
    (category === 'all' || entry.category === category)
    && (!needle || searchable(entry).includes(needle))))
  const matches = $derived(visible.filter(entry => tag === 'all' || entry.tags.includes(tag)))
  const groups = $derived(CATEGORIES
    .map(([id]) => ({ id, entries: matches.filter(entry => entry.category === id) }))
    .filter(group => group.entries.length > 0))
  const tagCounts = $derived(new Map(TAGS.map(([id]) => [id, visible.filter(entry => entry.tags.includes(id)).length])))
  const active = $derived(Boolean(query.trim()) || category !== 'all' || tag !== 'all')

  function clear() {
    query = ''
    category = 'all'
    tag = 'all'
  }

  onMount(() => {
    let id = ''
    try { id = decodeURIComponent(location.hash.slice(1)) } catch { return }
    if (id) requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' })))
  })
</script>

<div class="page">
  <header class="bar">
    <SiteSelect title={t('app.title')} label={t('app.sitesLabel')} more={t('app.sitesMore')} {locale} href={`./?lang=${locale}`} />
    <span class="slash" aria-hidden="true">/</span>
    <h1>{t('sources.title')}</h1>
    <div class="end">
      <label class="lang">
        <span class="ui-visually-hidden">{t('sources.language')}</span>
        <select bind:value={locale}>
          {#each LOCALES as [code, name] (code)}<option value={code}>{name}</option>{/each}
        </select>
      </label>
      <a class="back" href={`./unencoded.html?lang=${locale}`}>{t('appendix.title')}</a>
      <a class="back" href={`./ucv.html?lang=${locale}`}>UCV</a>
      <a class="back" href="./open-data.html">Open data</a>
      <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={{ system: t('app.theme.system'), light: t('app.theme.light'), dark: t('app.theme.dark') }} onchange={setTheme} />
      <a class="back" href={`./?lang=${locale}`}>{t('sources.back')}</a>
    </div>
  </header>

  <main>
    <p class="lead">{t('sources.lead')}</p>

    <div class="controls">
      <label class="search">
        <span class="ui-visually-hidden">{t('sources.search')}</span>
        <input type="search" bind:value={query} placeholder={t('sources.search')} autocomplete="off" />
      </label>
      <div class="chips" role="group" aria-label={t('sources.categories')}>
        <button type="button" class:active={category === 'all'} aria-pressed={category === 'all'} onclick={() => { category = 'all' }}>
          {t('sources.all')} <span class="n">{CATALOGUE.length}</span>
        </button>
        {#each CATEGORIES as [id] (id)}
          <button type="button" class:active={category === id} aria-pressed={category === id} onclick={() => { category = id }}>
            {categoryLabel(id)} <span class="n">{CATALOGUE.filter(entry => entry.category === id).length}</span>
          </button>
        {/each}
      </div>
      <div class="chips tags" role="group" aria-label={t('sources.tags')}>
        {#each TAGS as [id] (id)}
          {#if (tagCounts.get(id) ?? 0) > 0}
            <button type="button" class="tag" class:active={tag === id} aria-pressed={tag === id} onclick={() => { tag = tag === id ? 'all' : id }}>
              {tagLabel(id)} <span class="n">{tagCounts.get(id)}</span>
            </button>
          {/if}
        {/each}
        {#if active}
          <button type="button" class="clear" onclick={clear}>{t('sources.clear')}</button>
        {/if}
      </div>
    </div>

    <p class="count" aria-live="polite">{t('sources.count', { count: matches.length })}</p>

    {#if groups.length === 0}
      <p class="empty">{t('sources.empty')}</p>
    {:else}
      {#each groups as group (group.id)}
        <section class="group" aria-labelledby={`group-${group.id}`}>
          <h2 id={`group-${group.id}`}>{categoryLabel(group.id)} <span class="n">{group.entries.length}</span></h2>
          {#if group.id === 'examples'}<p class="grouplead">{t('sources.examplesLead')}</p>{/if}
          <div class="list">
            {#each group.entries as entry (entry.id)}
              <article class="source" id={entry.id} data-category={entry.category}>
                {#if entry.number}<span class="num">[{entry.number}]</span>{/if}
                <div class="head">
                  {#if entry.url}
                    <a class="title" href={entry.url} target="_blank" rel="noreferrer">{entry.title}</a>
                  {:else}
                    <span class="title">{entry.title}</span>
                  {/if}
                  {#if entry.people?.length}<span class="people">{entry.people.join(' · ')}</span>{/if}
                </div>
                <div class="meta">
                  {#if entry.licence}<span class="licence">{entry.licence}</span>{/if}
                  {#if entry.date}<span>{entry.date}</span>{/if}
                  {#if entry.read}<span>{t('sources.read')} {entry.read}</span>{/if}
                  {#if entry.used?.length}<span class="used">{t('sources.files')} {#each entry.used as file, i (file)}<code>{file}</code>{#if i < entry.used.length - 1}<span class="sep">{' · '}</span>{/if}{/each}</span>{/if}
                  {#if entry.status}<span class="status">{t(`sources.status.${entry.status}`)}</span>{/if}
                </div>
                {#if entry.usedIn?.length}<p class="usedin">{t('sources.used')} {#each entry.usedIn as id, i (id)}<span class="feature">{featureLabel(id)}</span>{#if i < entry.usedIn.length - 1}<span class="sep">{' · '}</span>{/if}{/each}</p>{/if}
                {#if summaryOf(entry)}<p class="summary">{summaryOf(entry)}</p>{/if}
                {#if entry.citedBy?.length}<p class="citedby">{t('sources.citedBy')} {#each entry.citedBy.slice(0, 3) as example, i (example.sequence)}<a href={`./?ids=${encodeURIComponent(example.sequence)}`}>{example.char || example.sequence}</a>{#if i < Math.min(entry.citedBy.length, 3) - 1}<span class="sep">{' · '}</span>{/if}{/each}{#if entry.citedBy.length > 3}<span class="n"> +{entry.citedBy.length - 3}</span>{/if}</p>{/if}
                {#if entry.more?.length}<p class="more">{#each entry.more as url, i (url)}<a href={url} target="_blank" rel="noreferrer">{hostOf(url)}</a>{#if i < entry.more.length - 1}<span class="sep">{' · '}</span>{/if}{/each}</p>{/if}
                {#if entry.tags.length}
                  <div class="tags">
                    {#each entry.tags as id (id)}
                      <button type="button" class="tag small" class:active={tag === id} aria-pressed={tag === id} onclick={() => { tag = tag === id ? 'all' : id }}>{tagLabel(id)}</button>
                    {/each}
                  </div>
                {/if}
                {#if entry.note}
                  <details class="note">
                    <summary>{t('sources.note')}</summary>
                    <p>{@html inline(entry.note)}</p>
                  </details>
                {/if}
              </article>
            {/each}
          </div>
        </section>
      {/each}
    {/if}
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  .bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px max(18px,env(safe-area-inset-right)) 10px max(18px,env(safe-area-inset-left));
    border-bottom:1px solid var(--ui-color-border);background:color-mix(in srgb,var(--ui-color-canvas) 88%,transparent);backdrop-filter:blur(10px);position:sticky;top:0;z-index:10}
  .slash{color:var(--ui-color-border-strong)}
  h1{margin:0;font-size:15px;font-weight:600;color:var(--ui-color-ink-muted);white-space:nowrap}
  .end{display:flex;align-items:center;gap:10px;margin-left:auto;flex-wrap:wrap}
  .back{font-size:13px;color:var(--ui-color-accent);text-decoration:none;padding:5px 9px;border-radius:var(--ui-radius-md)}
  .back:hover{background:var(--ui-color-surface-hover)}
  .lang select{font:inherit;font-size:13px;color:var(--ui-color-ink);background:var(--ui-color-surface);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);padding:5px 8px}

  main{width:100%;max-width:1180px;margin:0 auto;padding:26px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  .lead{margin:0 0 20px;max-width:80ch;font-size:16px;line-height:1.6;color:var(--ui-color-ink)}
  .controls{position:sticky;top:58px;z-index:5;display:grid;gap:10px;padding:12px;margin:0 0 8px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xl);background:color-mix(in srgb,var(--ui-color-canvas) 92%,transparent);backdrop-filter:blur(10px)}
  .search input{width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:9px 12px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface);color:var(--ui-color-ink)}
  .search input:focus{outline:2px solid var(--ui-color-accent);outline-offset:1px;border-color:transparent}
  .chips{display:flex;flex-wrap:wrap;gap:6px}
  .chips button{font:inherit;font-size:12.5px;line-height:1.2;padding:5px 9px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-pill);background:var(--ui-color-surface);color:var(--ui-color-ink-muted);cursor:pointer}
  .chips button:hover{background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  .chips button.active{background:var(--ui-color-accent);border-color:var(--ui-color-accent);color:var(--ui-color-on-accent)}
  .chips .tag{font-size:12px}
  .chips .clear{color:var(--ui-color-accent);border-style:dashed}
  .n{font-variant-numeric:tabular-nums;opacity:.65;margin-left:2px}

  .count{margin:12px 0 0;font-size:12.5px;color:var(--ui-color-ink-muted)}
  .empty{margin:40px 0;font-size:15px;color:var(--ui-color-ink-muted)}
  .group{margin:30px 0 0}
  .group h2{display:flex;align-items:baseline;gap:8px;margin:0 0 12px;padding-top:10px;border-top:1px solid var(--ui-color-border);font-size:18px;scroll-margin-top:290px}
  .group h2 .n{font-size:13px;font-weight:400}
  .grouplead{margin:-4px 0 14px;max-width:80ch;font-size:13px;line-height:1.55;color:var(--ui-color-ink-muted)}
  .list{display:grid;gap:10px}

  .source{position:relative;padding:13px 15px 13px 16px;border:1px solid var(--ui-color-border);border-left:3px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface);scroll-margin-top:290px}
  .source:target{border-left-color:var(--ui-color-accent);background:var(--ui-color-surface-hover)}
  .source[data-category="examples"]{border-left-color:var(--ui-color-border)}
  .num{position:absolute;top:13px;right:14px;font-size:11.5px;color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  .head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;padding-right:42px}
  .title{font-family:var(--cjk-sans);font-size:15px;font-weight:650;color:var(--ui-color-ink);text-decoration:none;line-height:1.35}
  a.title:hover{color:var(--ui-color-accent);text-decoration:underline;text-underline-offset:2px}
  .people{font-size:12.5px;color:var(--ui-color-ink-muted)}
  .meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:5px;font-size:12px;color:var(--ui-color-ink-muted)}
  .licence{padding:1px 7px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-pill);font-size:11.5px}
  .used code{margin-left:4px;font-size:11.5px}
  .sep{white-space:pre;margin:0 2px}
  .status{font-size:11.5px;color:var(--ui-color-ink-muted)}
  .usedin{margin:8px 0 0;font-size:12.5px;color:var(--ui-color-ink-muted)}
  .feature{color:var(--ui-color-ink);background:var(--ui-color-surface-sunken);border-radius:var(--ui-radius-pill);padding:1px 7px;font-size:12px}
  .citedby{margin:7px 0 0;font-family:var(--cjk-sans);font-size:12.5px;color:var(--ui-color-ink-muted)}
  .citedby a{color:var(--ui-color-accent);text-decoration:none}
  .citedby a:hover{text-decoration:underline}
  .more{margin:7px 0 0;font-size:12px}
  .more a{color:var(--ui-color-accent);text-decoration:none}
  .more a:hover{text-decoration:underline}
  .summary{margin:8px 0 0;font-family:var(--cjk-sans);font-size:13.5px;line-height:1.55;color:var(--ui-color-ink)}
  .tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
  .tag.small{font-size:11.5px;padding:2px 7px;border-radius:var(--ui-radius-pill);border:1px solid var(--ui-color-border);background:transparent;color:var(--ui-color-ink-muted);cursor:pointer}
  .tag.small.active{background:var(--ui-color-accent);border-color:var(--ui-color-accent);color:var(--ui-color-on-accent)}
  .note{margin-top:9px;font-size:12.5px;color:var(--ui-color-ink-muted)}
  .note summary{cursor:pointer;color:var(--ui-color-accent)}
  .note p{margin:6px 0 0;font-family:var(--cjk-sans);line-height:1.6}
  .note :global(a){color:var(--ui-color-accent)}
  .note :global(code){font-size:11.5px}

  @media (max-width:640px){
    .slash{display:none}
    .lead{font-size:15px}
    .controls{position:static}
    .head{padding-right:0}
    .num{position:static;order:2}
    .source,.group h2{scroll-margin-top:120px}
  }
</style>
