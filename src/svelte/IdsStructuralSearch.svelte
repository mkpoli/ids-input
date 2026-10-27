<script>
  import { STRUCTURAL_PRESETS } from '../core/structural-search.js'
  import { translator } from './i18n.js'
  import IdsSearch from './IdsSearch.svelte'
  /** @type {{ adapter: import('../adapter/types.js').IdsAdapter, messages?: Record<string, string>, locale?: string,
   * onopen?: (hit: import('../adapter/types.js').IdsHit) => void, ontake?: (hit: import('../adapter/types.js').IdsHit) => void }} */
  let { adapter, messages, locale = 'en', onopen, ontake } = $props()
  const id = $props.id()
  const t = $derived(translator(messages, locale))
  let query = $state(STRUCTURAL_PRESETS[0].query)
  const selected = $derived(STRUCTURAL_PRESETS.find(p => p.query === query)?.id ?? '')
</script>

<div class="structural-search">
  <div class="presets" aria-label={t('ids.structural.examples')}>
    {#each STRUCTURAL_PRESETS.slice(0, 4) as preset}
      <button type="button" aria-pressed={selected === preset.id} onclick={() => query = preset.query}>
        <span class="glyphs" lang="ja">{preset.examples}</span><span>{t(`ids.structural.${preset.id}`)}</span>
      </button>
    {/each}
  </div>
  <label class="other">{t('ids.structural.other')}
    <select value={selected} onchange={event => { const p = STRUCTURAL_PRESETS.find(p => p.id === event.currentTarget.value); if (p) query = p.query }}>
      <option value="" disabled>{t('ids.structural.custom')}</option>
      {#each STRUCTURAL_PRESETS as preset}<option value={preset.id}>{t(`ids.structural.${preset.id}`)} · {preset.examples}</option>{/each}
    </select>
  </label>
  <label class="pattern">{t('ids.structural.pattern')}
    <input type="text" bind:value={query} spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby={`${id}-help`} />
  </label>
  <p id={`${id}-help`} class="help">{t('ids.structural.help')}</p>
  <IdsSearch {adapter} {query} {messages} {locale} mode="structure" {onopen} {ontake} />
</div>

<style>
  .structural-search{display:flex;flex-direction:column;gap:8px;min-width:0}
  .presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
  button,select,input{font:inherit;color:inherit;background:var(--ids-surface,light-dark(#fff,#202026));border:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43));border-radius:7px}
  button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 3px;font-size:11px;cursor:pointer}
  button[aria-pressed=true]{border-color:var(--ids-accent,#4465d6);background:var(--ids-accent-light,light-dark(#e7edfc,#24304f))}
  .glyphs{font-family:var(--ids-font,sans-serif);font-size:23px;line-height:1.3}
  .other,.pattern{display:flex;align-items:center;gap:8px;font-size:12px}
  select,input{min-width:0;flex:1;padding:6px 8px}
  input{font-family:var(--ids-font,sans-serif);font-size:16px}
  .help{margin:0;color:var(--ids-muted,light-dark(#696973,#aaa));font-size:11px;line-height:1.5}
  button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--ids-accent,#4465d6);outline-offset:2px}
</style>
