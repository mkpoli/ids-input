<script>
  // Five faces side by side for the same characters and descriptions: the sets are 千字文, four
  // classical poems, the workshop's examples, and the records unencoded-db holds.
  import PageHeader from './ui/PageHeader.svelte'
  import FontDrawing from './ui/FontDrawing.svelte'
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { composerPreview } from '@han-compose/composer'
  import { COMPOSER_BASES } from './lib/composer.js'
  import { EXAMPLES } from './lib/examples.js'
  import { createIconDrawings } from './lib/icons.js'
  import qianziwen from './lib/font-compare/qianziwen.json'
  import poems from './lib/font-compare/poems.json'
  import unencoded from './lib/font-compare/unencoded.json'

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

  const FACES = /** @type {const} */ ([
    { key: 'sans', label: 'app.font.sans' },
    { key: 'serif', label: 'app.font.serif' },
    { key: 'fangsong', label: 'app.font.fangsong' },
    { key: 'regular', label: 'app.font.regular' },
    { key: 'pen-writing', label: 'app.font.pen-writing' },
  ])
  /** @type {Map<string, ReturnType<typeof createIconDrawings>>} */
  const drawings = new Map()
  /** @param {string} style */
  const drawOf = style => {
    if (!drawings.has(style)) drawings.set(style, createIconDrawings(composerPreview({ base: COMPOSER_BASES[style], fontStyle: style })))
    return /** @type {ReturnType<typeof createIconDrawings>} */ (drawings.get(style))
  }

  /** @typedef {{ key: string, sequence: string, note: string }} Row */
  const SETS = [
    {
      id: 'qianziwen', label: 'fontCompare.set.qianziwen', rows: qianziwen.characters.map((char, index) => ({
        key: `qzw-${index}`, sequence: char, note: `${index + 1}`,
      })),
    },
    {
      id: 'poems', label: 'fontCompare.set.poems', rows: poems.flatMap(poem => poem.characters.map((char, index) => ({
        key: `poem-${poem.title}-${index}`, sequence: char, note: `${poem.title} · ${poem.author}`,
      }))),
    },
    {
      id: 'examples', label: 'fontCompare.set.examples', rows: EXAMPLES.map((example, index) => ({
        key: `example-${index}`, sequence: example.sequence, note: example.char ?? '',
      })),
    },
    {
      id: 'unencoded', label: 'fontCompare.set.unencoded', rows: unencoded.map(entry => ({
        key: `unencoded-${entry.id}`, sequence: entry.ids ?? '', note: `#${entry.id}${entry.status ? ` · ${entry.status}` : ''}`,
      })),
    },
  ].map(set => ({ ...set, rows: set.rows.filter(row => row.sequence) }))

  let setId = $state(SETS[0].id)
  let page = $state(1)
  const PAGE_SIZE = 20
  const set = $derived(SETS.find(entry => entry.id === setId) ?? SETS[0])
  const pages = $derived(Math.max(1, Math.ceil(set.rows.length / PAGE_SIZE)))
  const shown = $derived(set.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))

  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  /** @param {number} next */
  const go = next => {
    page = Math.min(pages, Math.max(1, next))
    toTop()
  }
</script>

<svelte:head>
  <title>{t('fontCompare.title')} — {t('app.title')}</title>
</svelte:head>

<div class="page">
  <PageHeader page="font-compare" title={t('fontCompare.title')} {t} bind:locale />

  <main>
    <p class="lead">{t('fontCompare.lead')}</p>

    <div class="controls">
      <label class="select">
        <span>{t('fontCompare.setLabel')}</span>
        <span class="ui-select-wrap">
          <select class="ui-select" bind:value={setId} onchange={() => { page = 1; toTop() }}>
            {#each SETS as entry (entry.id)}<option value={entry.id}>{t(entry.label)} · {entry.rows.length}</option>{/each}
          </select>
        </span>
      </label>
      <span class="count">{t('fontCompare.count', { shown: shown.length, total: set.rows.length })}</span>
      <div class="pager">
        <button type="button" class="ui-button" data-size="sm" disabled={page <= 1} onclick={() => go(page - 1)}>{t('appendix.prev')}</button>
        <span>{t('fontCompare.page', { page, pages })}</span>
        <button type="button" class="ui-button" data-size="sm" disabled={page >= pages} onclick={() => go(page + 1)}>{t('appendix.next')}</button>
      </div>
    </div>

    <div class="table" role="table" aria-label={t('fontCompare.title')}>
      <div class="head" role="row">
        <span class="label" role="columnheader">{t('fontCompare.row')}</span>
        {#each FACES as face (face.key)}<span role="columnheader">{t(face.label)}</span>{/each}
      </div>
      {#each shown as row (row.key)}
        <div class="row" role="row">
          <span class="label" role="rowheader">
            <b lang="zh">{row.sequence}</b>
            {#if row.note}<small>{row.note}</small>{/if}
          </span>
          {#each FACES as face (face.key)}
            <span class="cell" role="cell">
              <FontDrawing sequence={row.sequence} draw={drawOf(face.key)} label={`${row.sequence} — ${t(face.label)}`} />
            </span>
          {/each}
        </div>
      {/each}
    </div>

    <div class="pager bottom">
      <button type="button" class="ui-button" data-size="sm" disabled={page <= 1} onclick={() => go(page - 1)}>{t('appendix.prev')}</button>
      <span>{t('fontCompare.page', { page, pages })}</span>
      <button type="button" class="ui-button" data-size="sm" disabled={page >= pages} onclick={() => go(page + 1)}>{t('appendix.next')}</button>
    </div>

    <p class="source">
      {t('fontCompare.source')}
      <a href="https://zh.wikisource.org/wiki/千字文" target="_blank" rel="noreferrer">千字文</a>
      {#each poems as poem (poem.title)}· <a href={poem.url} target="_blank" rel="noreferrer">{poem.title}</a>{/each}
      · <a href="https://gaiji.glyphatlas.org" target="_blank" rel="noreferrer">unencoded-db</a>
    </p>
  </main>
</div>

<style>
  main{max-width:1200px;margin:0 auto;padding:24px max(18px,env(safe-area-inset-right)) 48px max(18px,env(safe-area-inset-left))}
  .lead{max-width:62ch;margin:0 0 20px;color:var(--ui-color-ink-muted)}
  .controls{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:14px}
  .select{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--ui-color-ink-muted)}
  .count{font-size:12px;color:var(--ui-color-ink-muted);margin-inline-start:auto}
  .pager{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ui-color-ink-muted)}
  .pager.bottom{margin-top:16px;justify-content:center}
  .table{border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);overflow:hidden;background:var(--ui-color-surface)}
  .head,.row{display:grid;grid-template-columns:minmax(110px,1.1fr) repeat(5,1fr);align-items:center}
  .head{padding:8px;border-bottom:1px solid var(--ui-color-border);font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--ui-color-ink-muted);text-align:center}
  .head .label{text-align:start;padding-inline-start:6px}
  .row{border-bottom:1px solid var(--ui-color-border-faint)}
  .row:last-child{border-bottom:0}
  .label{display:flex;flex-direction:column;gap:2px;padding:8px 6px 8px 10px;min-width:0}
  .label b{font-size:20px;font-weight:500}
  .label small{font-size:10px;color:var(--ui-color-ink-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cell{padding:4px;min-width:0;border-inline-start:1px solid var(--ui-color-border-faint)}
  .source{max-width:80ch;margin:18px 0 0;font-size:11px;line-height:1.6;color:var(--ui-color-ink-muted)}
  .source a{color:var(--ui-color-accent);text-decoration:none}
  @media (max-width:720px){
    .head,.row{grid-template-columns:minmax(72px,1fr) repeat(5,1fr)}
    .label b{font-size:16px}
  }
</style>
