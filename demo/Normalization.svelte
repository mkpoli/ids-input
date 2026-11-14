<script>
  // What the workshop reads as the same thing written another way, each table from the code or the
  // data that applies it, grouped by whether the input is rewritten or kept as written: structures
  // (the Templates count), kana and Hangul shapes (the search), component forms and stroke families
  // (the palette and the search), stroke chains and operator names (the parser).
  import PageHeader from './ui/PageHeader.svelte'
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { ALIASES, equivalences, parse, structureSkeleton } from '../src/core/index.js'
  import { STROKE_CHAINS } from '@han-compose/composer/tree'
  import identity from '../src/core/component-identity.json'
  import formsText from '../data/component-forms.tsv?raw'

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

  /** A rule: what is written, and what it is read as. @typedef {{ from: string[], to: string[], note?: string }} Rule */
  /** @param {string} hex */
  const char = hex => String.fromCodePoint(parseInt(hex, 16))

  // Structures: descriptions grouped by the skeleton the code gives them.
  const STRUCTURES = [
    ['⿱⿱甲乙丙', '⿱甲⿱乙丙', '⿳甲乙丙'], ['⿰⿰甲乙丙', '⿰甲⿰乙丙', '⿲甲乙丙'],
    ['⿱⿳甲乙丙丁', '⿳甲乙⿱丙丁', '⿱⿱⿱甲乙丙丁'], ['⿰⿲甲乙丙丁', '⿲甲乙⿰丙丁', '⿰⿰⿰甲乙丙丁'],
    ['⿰⿱甲乙⿱丙丁', '⿱⿰甲丙⿰乙丁'],
  ]
  /** @param {string} text */
  const skeleton = text => { const read = parse(text, { open: true }); return read.problem || read.tree === null ? '' : structureSkeleton(read.tree) }
  /** @type {Rule[]} */
  const structures = STRUCTURES.filter(group => group.every(text => skeleton(text) === skeleton(group[0])))
    // Where one operator writes the whole arrangement, that spelling is what the others come to.
    .map(group => /^[⿲⿳]/u.test(group[group.length - 1]) ? { from: group.slice(0, -1), to: [group[group.length - 1]] } : { from: group, to: [skeleton(group[0])] })
  let tried = $state('⿱⿱艹日⿰月月')

  const shapes = equivalences()
  /** @type {Rule[]} */
  const kana = shapes.kana.map(row => ({ from: row.shapes, to: row.components }))
  /** @type {Rule[]} */
  const hangul = shapes.hangul.map(row => ({ from: row.shapes, to: row.components }))
  /** @type {Rule[]} */
  const forms = formsText.split('\n').filter(line => line && !line.startsWith('#') && !line.startsWith('form\t'))
    .map(line => { const [form, to, source = '', detail = ''] = line.split('\t'); return { from: [form], to: [to], note: [source, detail].filter(Boolean).join(' · ') } })
  /** @type {Rule[]} */
  const families = Object.entries(/** @type {Record<string, string[]>} */ (identity.families)).map(([ideograph, members]) => ({ from: members.map(char), to: [char(ideograph)] }))
  /** @type {Rule[]} */
  const chains = Object.entries(STROKE_CHAINS).map(([chain, to]) => ({ from: [`#(${chain})`], to: [to] }))
  /** @type {Rule[]} */
  const operators = Object.entries(ALIASES).map(([name, op]) => ({ from: [name], to: [op] }))

  // A rewrite replaces what is typed; a match keeps it as written and treats it as the same.
  const GROUPS = /** @type {const} */ ([
    ['rewrite', [['chains', chains], ['operators', operators]]],
    ['match', [['structure', structures], ['kana', kana], ['hangul', hangul], ['forms', forms], ['families', families]]],
  ])
  let query = $state(params.get('q') ?? '')
  const needle = $derived(query.trim().toLowerCase())
  /** @param {readonly Rule[]} rules */
  const found = rules => needle ? rules.filter(rule => [...rule.from, ...rule.to, rule.note ?? ''].join('\n').toLowerCase().includes(needle)) : rules
  $effect(() => {
    const next = new URLSearchParams(location.search)
    if (query.trim()) next.set('q', query.trim()); else next.delete('q')
    const text = next.toString()
    history.replaceState(null, '', `${location.pathname}${text ? `?${text}` : ''}${location.hash}`)
  })
</script>

<div class="page">
  <PageHeader title={t('normalization.title')} {t} bind:locale />

  <div class="body">
    <nav class="toc" aria-label={t('normalization.title')}>
      <label class="search">
        <span class="ui-visually-hidden">{t('normalization.search')}</span>
        <input class="ui-input" type="search" bind:value={query} placeholder={t('normalization.search')} autocomplete="off" spellcheck="false" />
      </label>
      {#each GROUPS as [mode, sections] (mode)}
        <div class="group">
          <a class="mode" href={`#${mode}`} title={t(`normalization.hint.${mode}`)}><span aria-hidden="true">{mode === 'rewrite' ? '→' : '≈'}</span> {t(`normalization.mode.${mode}`)}</a>
          <ul>
            {#each sections as [id, rules] (id)}
              <li><a href={`#${id}`}>{t(`normalization.${id}`)}</a><span class="n">{found(rules).length}</span></li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>

    <main>
      {#each GROUPS as [mode, sections] (mode)}
      <section id={mode} class="mode-group" aria-labelledby={`${mode}-title`}>
      <h2 id={`${mode}-title`} title={t(`normalization.hint.${mode}`)}><span class="sign" aria-hidden="true">{mode === 'rewrite' ? '→' : '≈'}</span>{t(`normalization.mode.${mode}`)}</h2>
      {#each sections as [id, rules] (id)}
        {@const shown = found(rules)}
        <section {id} aria-labelledby={`${id}-title`}>
          <h3 id={`${id}-title`}>{t(`normalization.${id}`)} <span class="scope">{t(`normalization.scope.${id}`)}</span></h3>
          {#if id === 'structure'}
            <label class="try">
              <span class="ui-visually-hidden">{t('normalization.try')}</span>
              <input class="ui-input" bind:value={tried} lang="ja" autocomplete="off" spellcheck="false" placeholder={t('normalization.try')} />
              <output lang="ja">{skeleton(tried) || '—'}</output>
            </label>
          {/if}
          {#if id === 'kana'}
            <p class="cite"><a href="https://ashide.otodo.net/setumei/ziboziso.html" target="_blank" rel="noreferrer">葦手入力</a> · <a href="https://www.unicode.org/reports/tr38/#kStrange" target="_blank" rel="noreferrer">Unihan kStrange</a></p>
          {/if}
          {#if id === 'chains'}
            <p class="cite"><a href="https://nightfurysl2001.github.io/bai-ids/" target="_blank" rel="noreferrer">（白式）IDS 延展语法导论 §5.3</a></p>
          {/if}
          {#if id === 'families'}
            <p class="cite"><a href="https://www.unicode.org/Public/18.0.0/ucd/EquivalentUnifiedIdeograph.txt" target="_blank" rel="noreferrer">EquivalentUnifiedIdeograph.txt 18.0.0</a></p>
          {/if}
          {#if id === 'operators'}
            <p class="cite"><a href="https://zi.tools/?secondary=ids" target="_blank" rel="noreferrer">zi.tools</a></p>
          {/if}
          {#if shown.length === 0}
            <p class="empty">{t('normalization.empty')}</p>
          {:else}
            <div class="grid" class:wide={id === 'structure'}>
              {#each shown as rule (rule.from.join(' ') + rule.to.join(' '))}
                <div class="rule" lang="ja" title={rule.note}>
                  <span class="from">{rule.from.join(id === 'structure' ? '  ' : ' ')}</span>
                  <span class="arrow" aria-hidden="true">{mode === 'rewrite' ? '→' : '≈'}</span>
                  <span class="to">{rule.to.join(' ')}</span>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
      </section>
      {/each}
    </main>
  </div>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  .body{display:grid;grid-template-columns:220px minmax(0,1fr);gap:28px;width:100%;max-width:1180px;margin:0 auto;padding:24px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  .toc{position:sticky;top:74px;align-self:start;display:flex;flex-direction:column;gap:12px}
  .group{display:flex;flex-direction:column;gap:2px}
  .toc ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
  .toc li{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
  .toc a{flex:1;padding:5px 8px;border-radius:var(--ui-radius-sm);color:var(--ui-color-ink-soft);text-decoration:none;font-size:13px}
  .toc a:hover{background:var(--ui-color-surface-sunken);color:var(--ui-color-ink)}
  .toc a.mode{padding:5px 8px 3px;font-size:11.5px;font-weight:600;color:var(--ui-color-ink-muted)}
  .toc a.mode:hover{background:none;color:var(--ui-color-ink)}
  .n{font-size:11px;color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  .search input,.try input{width:100%}
  section{scroll-margin-top:74px;margin:0 0 30px}
  .mode-group{margin:0 0 40px}
  h2{display:flex;align-items:baseline;gap:8px;font-size:16px;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid var(--ui-color-border)}
  .sign{color:var(--ui-color-ink-muted);font-weight:400}
  h3{display:flex;align-items:baseline;gap:8px;font-size:14px;margin:0 0 10px}
  .scope{padding:0 6px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xs);font-size:10px;font-weight:500;line-height:1.7;color:var(--ui-color-ink-muted)}
  .cite{font-size:11.5px;color:var(--ui-color-ink-muted);margin:0 0 8px}
  .cite a{color:var(--ui-color-accent);text-decoration:none}
  .cite a:hover{text-decoration:underline}
  .try{display:flex;align-items:center;gap:10px;margin:0 0 10px}
  .try input{max-width:260px;font-family:var(--ids-font);font-size:16px}
  .try output{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;color:var(--ui-color-ink-soft);overflow-wrap:anywhere}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
  .grid.wide{grid-template-columns:repeat(auto-fill,minmax(420px,1fr))}
  .rule{display:flex;align-items:baseline;gap:6px;min-width:0;padding:5px 8px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface);font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:15px}
  .from{font-weight:600;color:var(--ui-color-ink);overflow-wrap:anywhere;white-space:pre-wrap}
  .arrow{color:var(--ui-color-ink-muted)}
  .to{color:var(--ui-color-ink-soft);overflow-wrap:anywhere}
  .empty{color:var(--ui-color-ink-muted);font-size:12.5px;margin:0}
  @media (max-width:760px) {
    .body{grid-template-columns:minmax(0,1fr);gap:16px}
    .toc{position:static}
    .toc ul{flex-direction:row;flex-wrap:wrap;gap:4px 10px}
    .group{gap:0}
    .grid.wide{grid-template-columns:minmax(0,1fr)}
  }
</style>
