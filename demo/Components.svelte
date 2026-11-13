<script>
  // Every part the workshop can put in a description, at full size: the parts palette of the
  // editor with room to browse, the forms no code point names among its parts, and a panel that
  // says what the chosen part is.
  import PageHeader from './ui/PageHeader.svelte'
  import { IdsParts, translator } from '../src/svelte/index.js'
  import IdsPartIcon from '../src/svelte/IdsPartIcon.svelte'
  import { composerPreview } from '@han-compose/composer'
  import engineOutlines from 'ids-engine-outlines'
  import { isCustom, isSequence } from '../src/core/index.js'
  import { componentIdentity } from '../src/core/component-identity.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { dataAdapter } from './lib/workshop-adapter.js'
  import { createIconDrawings } from './lib/icons.js'
  import { COMPOSER_BASE, readFrom } from './lib/composer.js'

  const params = new URLSearchParams(location.search)
  const wanted = String(params.get('lang') ?? load('locale', null) ?? navigator.language ?? '')
  const traditional = /^zh-(?:Hant|TW|HK|MO)\b/i
  let locale = $state(LOCALES.find(([code]) => code === wanted)?.[0]
    ?? (traditional.test(wanted) ? 'zh-Hant' : undefined)
    ?? LOCALES.find(([code]) => wanted.startsWith(code.split('-')[0]))?.[0] ?? 'en')
  $effect(() => save('locale', locale))
  $effect(() => { document.documentElement.lang = locale })
  const messages = $derived(/** @type {Record<string, string>} */ ({ ...appMessages('en'), ...LOCALES.find(([code]) => code === locale)?.[2], ...appMessages(locale) }))
  const t = $derived(translator(messages, locale))

  // The palette's parts, and after them every custom component the dictionary lists.
  const icon = createIconDrawings(composerPreview({ base: readFrom(COMPOSER_BASE), fontStyle: 'sans', loaders: engineOutlines }))
  /** @type {Promise<import('../src/adapter/types.js').PalettePart[]> | null} */
  let all = null
  const adapter = /** @type {import('../src/adapter/types.js').IdsAdapter} */ (/** @type {unknown} */ ({
    ...dataAdapter, icon, fontStyle: 'sans',
    parts: () => all ??= (async () => {
      const [parts, custom] = await Promise.all([dataAdapter.parts(), dataAdapter.customComponents?.() ?? []])
      const seen = new Set(parts.map(part => part.part))
      return [...parts, ...custom.filter(row => !seen.has(row.text)).map(row => ({ part: row.text, uses: row.uses, kind: /** @type {const} */ ('d') }))]
    })(),
  }))

  let chosen = $state(params.get('part') ?? '')
  $effect(() => {
    const next = new URLSearchParams(location.search)
    if (chosen) next.set('part', chosen); else next.delete('part')
    const text = next.toString()
    history.replaceState(null, '', `${location.pathname}${text ? `?${text}` : ''}`)
  })
  /** @type {{ part: string, sequences: import('../src/adapter/types.js').Sequence[], custom: import('../src/core/custom-components.js').CustomComponent | undefined, strokes: number | null, uses: number | null } | null} */
  let detail = $state.raw(null)
  $effect(() => {
    const part = chosen
    detail = null
    if (!part) return
    let alive = true
    Promise.all([
      isSequence(part) ? [] : adapter.structure(part).catch(() => []),
      isCustom(part) ? (dataAdapter.customComponents?.() ?? Promise.resolve([])).then(rows => rows.find(row => row.text === part)) : undefined,
      adapter.parts().then(parts => parts.find(row => row.part === part)),
    ]).then(([sequences, custom, row]) => { if (alive) detail = { part, sequences, custom, strokes: row?.strokes ?? null, uses: row?.uses ?? custom?.uses ?? null } })
    return () => { alive = false }
  })
  const identity = $derived(chosen && !isCustom(chosen) ? componentIdentity(chosen) : null)
  const points = $derived(chosen && !isCustom(chosen) && !isSequence(chosen) ? [...chosen].map(char => `U+${/** @type {number} */ (char.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`).join(' ') : '')
  let copied = $state(false)
  async function copy() {
    await navigator.clipboard.writeText(chosen)
    copied = true
    setTimeout(() => { copied = false }, 1400)
  }
</script>

<div class="page">
  <PageHeader title={t('library.title')} {t} bind:locale links={[{ href: `./unencoded.html?lang=${locale}`, label: t('appendix.title') }]} />
  <div class="body">
    <!-- A cell is chosen by the part it shows, whether or not the editor could insert it: a numbered
         component with no fragment is read-only in the palette and still has a card here. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <main class="library" onclick={event => {
      const part = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest('.part[data-character]'))?.dataset.character
      if (part) chosen = part
    }}>
      <IdsParts {adapter} {messages} {locale} recentKey={null} />
    </main>
    <aside class="detail" aria-live="polite">
      {#if !chosen}
        <p class="ui-empty">{t('library.empty')}</p>
      {:else}
        <div class="glyph" lang="ja">
          {#if isCustom(chosen) || isSequence(chosen)}<IdsPartIcon sequence={chosen} {adapter} />{:else}{chosen}{/if}
        </div>
        {#if isCustom(chosen) || isSequence(chosen)}<p class="written" lang="ja">{chosen}</p>{/if}
        {#if identity?.name}<p class="name">{identity.name}</p>{/if}
        <dl>
          {#if points}<dt>{t('library.code')}</dt><dd class="mono">{points}</dd>{/if}
          {#if detail?.strokes != null}<dt>{t('library.strokes')}</dt><dd>{detail.strokes}</dd>{/if}
          {#if detail?.uses != null}<dt>{t('library.uses')}</dt><dd>{detail.uses}</dd>{/if}
          {#if detail?.custom?.id}<dt>{t('library.unencoded')}</dt><dd><a class="mono" href={`./unencoded.html?lang=${locale}&q=${detail.custom.id}`}>{detail.custom.id}</a></dd>{/if}
        </dl>
        {#if identity?.equivalents.length}<p class="same" lang="ja">{identity.equivalents.join(' ')}</p>{/if}
        {#if detail?.sequences.length}
          <h2>{t('library.descriptions')}</h2>
          <ul class="sequences" lang="ja">
            {#each detail.sequences.slice(0, 12) as sequence (sequence.text + sequence.regions)}
              <li><a href={`./?lang=${locale}&ids=${encodeURIComponent(sequence.text)}`}>{sequence.text}</a>{#if sequence.regions}<span class="regions">{sequence.regions}</span>{/if}</li>
            {/each}
          </ul>
        {/if}
        <div class="actions">
          <button type="button" class="ui-button" onclick={copy}>{copied ? t('library.copied') : t('library.copy')}</button>
          <a class="ui-button" data-variant="primary" href={`./?lang=${locale}&ids=${encodeURIComponent(chosen)}`}>{t('library.open')}</a>
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  .body{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;width:100%;box-sizing:border-box;padding:20px max(18px,env(safe-area-inset-right)) 48px max(18px,env(safe-area-inset-left))}
  .library{min-width:0;padding:16px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xl);background:var(--ui-color-surface)}
  /* The palette at browsing size: larger cells, and the page scrolls instead of the grid. */
  .library :global(.parts-grid){grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:5px;max-height:none;overflow:visible}
  .library :global(.part){font-size:30px}
  .library :global(.jamo-grid){grid-template-columns:repeat(auto-fill,minmax(46px,1fr));max-height:none}
  .detail{position:sticky;top:74px;align-self:start;display:flex;flex-direction:column;gap:10px;padding:18px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xl);background:var(--ui-color-surface);max-height:calc(100dvh - 96px);overflow:auto;scrollbar-width:thin;scrollbar-color:var(--ui-color-scrollbar) transparent}
  .glyph{display:grid;place-items:center;min-height:132px;font:96px/1.1 var(--ids-font),var(--ids-glyph-fallback);color:var(--ui-color-ink)}
  .written{margin:0;text-align:center;font:18px/1.3 var(--ids-font),var(--ui-font-mono);color:var(--ui-color-ink-soft);overflow-wrap:anywhere}
  .name{margin:0;text-align:center;font-size:12px;color:var(--ui-color-ink-muted)}
  dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:6px 0 0;font-size:13px}
  dt{color:var(--ui-color-ink-muted)}
  dd{margin:0;color:var(--ui-color-ink);text-align:end}
  .mono{font-family:var(--ui-font-mono);font-size:12.5px}
  dd a{color:var(--ui-color-accent);text-decoration:none}
  dd a:hover{text-decoration:underline}
  .same{margin:0;font:20px/1.4 var(--ids-font);color:var(--ui-color-ink-soft);text-align:center}
  h2{margin:8px 0 0;font-size:12px;font-weight:600;color:var(--ui-color-ink-muted)}
  .sequences{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;font:16px/1.4 var(--ids-font),var(--ids-glyph-fallback)}
  .sequences li{display:flex;align-items:baseline;gap:8px}
  .sequences a{color:var(--ui-color-ink);text-decoration:none;overflow-wrap:anywhere}
  .sequences a:hover{color:var(--ui-color-accent)}
  .regions{font:11px var(--ui-font-mono);color:var(--ui-color-ink-muted)}
  .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  .actions .ui-button{flex:1;justify-content:center;text-decoration:none}
  @media (max-width:860px) {
    .body{grid-template-columns:minmax(0,1fr)}
    .detail{position:static;max-height:none;order:-1}
  }
</style>
