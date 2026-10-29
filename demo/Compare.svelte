<script>
  // A public gallery of the composer beside KAGE: the same IDS drawn by both, with the measured
  // agreement. Two sets: 44 unencoded KRM headwords and 20 common-use kanji.
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { applyTheme, storedTheme } from './lib/theme.js'
  import { load, save } from './lib/storage.js'
  import ThemeSwitch from './ui/ThemeSwitch.svelte'
  import data from './lib/comparison.json'

  const params = new URLSearchParams(location.search)
  const wanted = String(params.get('lang') ?? load('locale', null) ?? navigator.language ?? '')
  const traditional = /^zh-(?:Hant|TW|HK|MO)\b/i
  let locale = $state(
    LOCALES.find(([code]) => code === wanted)?.[0]
    ?? (traditional.test(wanted) ? 'zh-Hant' : undefined)
    ?? LOCALES.find(([code]) => wanted.startsWith(code.split('-')[0]))?.[0] ?? 'en')
  $effect(() => save('locale', locale))
  $effect(() => { document.documentElement.lang = locale })
  const messages = $derived(LOCALES.find(([code]) => code === locale)?.[2])
  const t = $derived(translator({ ...appMessages('en'), ...messages, ...appMessages(locale) }, locale))

  let theme = $state(storedTheme())
  /** @param {import('./lib/theme.js').Theme} next */
  const setTheme = next => { theme = next; applyTheme(next) }

  /** @typedef {'all' | 'side' | 'stacked' | 'enclosure'} Filter */
  /** @type {Filter} */
  let filter = $state('all')
  /** @typedef {'all' | 'krm' | 'joyo' | 'review'} SetFilter */
  /** @type {SetFilter} */
  let set = $state('krm')
  /** @type {'weakest' | 'best'} */
  let order = $state('weakest')
  let limit = $state(48)
  const SIDE = new Set(['⿰', '⿲'])
  const STACKED = new Set(['⿱', '⿳'])
  const ENCLOSURE = new Set('⿴⿵⿶⿷⿸⿹⿺⿼⿽')
  const shown = $derived(data.entries
    .filter(e => (set === 'all' || e.set === set) &&
      (filter === 'all' || (filter === 'side' ? SIDE.has(e.op) : filter === 'stacked' ? STACKED.has(e.op) : ENCLOSURE.has(e.op))))
    .slice()
    .sort((a, b) => order === 'weakest' ? a.f1 - b.f1 : b.f1 - a.f1))
  const visible = $derived(shown.slice(0, limit))
  $effect(() => { void set; void filter; void order; limit = 48 })
  const filters = $derived(/** @type {const} */ ([
    ['all', t('compare.filter.all')], ['side', t('compare.filter.side')],
    ['stacked', t('compare.filter.stacked')], ['enclosure', t('compare.filter.enclosure')],
  ]))
  /** @param {string} sequence */
  const openHref = sequence => `./#${encodeURIComponent(sequence)}`
  /** @param {string} sequence */
  const ziHref = sequence => `https://zi.tools/?secondary=ids&seq=${encodeURIComponent(sequence)}`
  /** @param {number} value */
  const two = value => value.toFixed(2)
</script>

<svelte:head>
  <title>{t('compare.title')} — {t('app.title')}</title>
</svelte:head>

<div class="page">
  <header class="bar">
    <a class="brand" href="./" aria-label={t('app.title')}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="var(--accent)" /><path d="M7 7h4v10H7zM13 7h4v4h-4zM13 13h4v4h-4z" fill="var(--on-accent)" /></svg>
      <span>{t('app.title')}</span>
    </a>
    <span class="slash" aria-hidden="true">/</span>
    <h1>{t('compare.title')}</h1>
    <div class="end">
      <label class="select">
        <span class="visually-hidden">{t('app.language')}</span>
        <select bind:value={locale} aria-label={t('app.language')}>
          {#each LOCALES as [code, name] (code)}<option value={code}>{name}</option>{/each}
        </select>
      </label>
      <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={{ system: t('app.theme.system'), light: t('app.theme.light'), dark: t('app.theme.dark') }} onchange={setTheme} />
      <a class="back" href="./">{t('compare.back')}</a>
    </div>
  </header>

  <main>
    <p class="lead">{t('compare.lead')}</p>
    <p class="dataset">{t('compare.dataset', { total: data.entries.length, krm: data.sets.krm.shown, joyo: data.sets.joyo.shown, review: data.sets.review.shown, date: data.generatedAt })}</p>
    <p class="hint">{t('compare.operators')}</p>

    <details class="method">
      <summary>{t('compare.method')}</summary>
      <p>{t('compare.method.body', { krm: data.sets.krm.shown, joyo: data.sets.joyo.shown, review: data.sets.review.shown })}</p>
      <p class="caveat">{t('compare.method.caveat')}</p>
    </details>

    <div class="controls">
      <label class="select">
        <span>{t('compare.set')}</span>
        <select bind:value={set}>
          <option value="all">{t('compare.set.all')}</option>
          <option value="krm">{t('compare.set.krm')}</option>
          <option value="joyo">{t('compare.set.joyo')}</option>
          <option value="review">{t('compare.set.review')}</option>
        </select>
      </label>
      <div class="filters" role="group" aria-label={t('compare.filter')}>
        {#each filters as [key, label] (key)}
          <button type="button" aria-pressed={filter === key} onclick={() => filter = key}>{label}</button>
        {/each}
      </div>
      <label class="order">
        <span>{t('compare.sort')}</span>
        <select bind:value={order}>
          <option value="weakest">{t('compare.sort.weakest')}</option>
          <option value="best">{t('compare.sort.best')}</option>
        </select>
      </label>
    </div>
    {#if set === 'joyo'}<p class="note">{t('compare.joyoNote')}</p>{/if}
    {#if set === 'review'}<p class="note">{t('compare.reviewNote')}</p>{/if}
    {#if shown.length !== data.entries.length}<p class="count">{t('compare.count', { shown: shown.length, total: data.entries.length })}</p>{/if}

    <div class="grid">
      {#each visible as entry (entry.sequence)}
        <article class="card">
          <div class="head">
            <h2 class="seq" lang="zh">{entry.sequence}</h2>
            <span class="badge">{t('compare.score.f1')} {two(entry.f1)}</span>
          </div>
          <div class="drawings">
            <figure>
              <figcaption>{t('compare.ours')}</figcaption>
              <svg viewBox="0 0 1000 1000" role="img" aria-label={`${entry.sequence} — ${t('compare.ours')}`}><path d={entry.ours} fill="currentColor"/></svg>
            </figure>
            <figure>
              <figcaption>{t('compare.kage')}</figcaption>
              <svg viewBox="0 0 200 200" role="img" aria-label={`${entry.sequence} — ${t('compare.kage')}`}>
                {#each entry.kage as d, i (i)}<path {d} fill="currentColor"/>{/each}
              </svg>
            </figure>
          </div>
          <p class="meta">
            <span class="set">{t(`compare.setTag.${entry.set}`)}</span>
            <span class="category">{t(`compare.category.${entry.category}`)}</span>
            <span>{entry.reused ? t('compare.wholeGlyph') : t('compare.parts', { count: entry.nparts })}</span>
            <span>{t('compare.score.iou')} {two(entry.iou)}</span>
            <span>{t('compare.score.layout')} {two(entry.layout)}</span>
          </p>
          <div class="links">
            <a href={openHref(entry.sequence)}>{t('compare.open')}</a>
            <a href={ziHref(entry.sequence)} target="_blank" rel="noreferrer">{t('compare.try')}</a>
          </div>
        </article>
      {/each}
    </div>
    {#if limit < shown.length}
      <button type="button" class="more" onclick={() => limit += 48}>{t('compare.showMore')}</button>
    {/if}

    <footer>
      <p>{t('compare.credit')}
        <a href="https://zi.tools/" target="_blank" rel="noreferrer">zi.tools</a> ·
        <a href="https://glyphwiki.org/" target="_blank" rel="noreferrer">GlyphWiki</a> ·
        <a href="https://github.com/kurgm/kage-engine" target="_blank" rel="noreferrer">KAGE</a>.
        {t('compare.license')}</p>
    </footer>
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  .bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px max(18px,env(safe-area-inset-right)) 10px max(18px,env(safe-area-inset-left));
    border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);position:sticky;top:0;z-index:10}
  .brand{display:flex;align-items:center;gap:8px;color:var(--ink);text-decoration:none;font-weight:650;font-size:15px;white-space:nowrap}
  .slash{color:var(--line-strong)}
  h1{margin:0;font-size:15px;font-weight:600;color:var(--muted);white-space:nowrap}
  .end{display:flex;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap}
  .back{font-size:13px;color:var(--accent);text-decoration:none;padding:5px 9px;border-radius:8px}
  .back:hover{background:var(--hover)}
  .select select,.order select{height:32px;padding:0 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:13px}
  .select select:focus-visible,.order select:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}

  main{width:100%;max-width:1240px;margin:0 auto;padding:26px max(18px,env(safe-area-inset-right)) 60px max(18px,env(safe-area-inset-left))}
  .lead{margin:0 0 6px;max-width:72ch;font-size:17px;line-height:1.55}
  .dataset{margin:0 0 4px;color:var(--muted);font-size:13px}
  .hint{margin:0 0 14px;color:var(--muted);font-size:12.5px}
  .method{max-width:78ch;margin:0 0 18px;font-size:13.5px;color:var(--muted)}
  .method summary{cursor:pointer;color:var(--ink);font-weight:600}
  .method p{margin:8px 0}
  .method .caveat{color:var(--muted)}

  .controls{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:18px 0 4px}
  .controls .select{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--muted)}
  .filters{display:flex;gap:2px;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}
  .filters button{height:28px;padding:0 11px;border:0;border-radius:7px;background:none;color:var(--muted);font:inherit;font-size:13px;cursor:pointer}
  .filters button:hover{color:var(--ink)}
  .filters button[aria-pressed="true"]{background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}
  .filters button:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .order{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--muted)}
  .count{margin:8px 0 16px;color:var(--muted);font-size:12.5px}
  .note{margin:8px 0 0;color:var(--muted);font-size:12.5px}

  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}
  .card{display:flex;flex-direction:column;gap:9px;padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:var(--shadow)}
  .head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
  .seq{margin:0;font-family:var(--cjk);font-size:24px;font-weight:400;line-height:1.2;overflow-wrap:anywhere}
  .badge{font:600 11.5px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--accent);background:var(--accent-soft);padding:4px 7px;border-radius:999px;white-space:nowrap}
  .drawings{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  figure{margin:0;display:flex;flex-direction:column;gap:3px}
  figcaption{font-size:11px;color:var(--muted)}
  .drawings svg{width:100%;height:auto;aspect-ratio:1;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;color:var(--ink)}
  .meta{display:flex;flex-wrap:wrap;gap:4px 10px;margin:0;font-size:11.5px;color:var(--muted)}
  .meta .category{color:var(--ink)}
  .meta .set{border:1px solid var(--line);border-radius:999px;padding:0 6px;color:var(--muted)}
  .links{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px}
  .links a{color:var(--accent);text-decoration:none}
  .links a:hover{text-decoration:underline}
  .more{display:block;margin:18px auto 0;padding:8px 18px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font:inherit;font-size:13px;cursor:pointer}
  .more:hover{background:var(--hover)}
  .more:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  footer{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}
  footer p{margin:0;max-width:90ch;line-height:1.6}
  footer a{color:var(--accent);text-decoration:none}
  footer a:hover{text-decoration:underline}
  @media (max-width:640px){
    /* The page keeps its heading in the accessibility tree; the brand already names the site. */
    h1{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    .slash{display:none}
    .bar{gap:8px}
    .lead{font-size:15.5px}
    .grid{grid-template-columns:1fr}
  }
</style>
