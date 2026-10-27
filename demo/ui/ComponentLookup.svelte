<script>
  import { componentQuery } from '../../src/core/index.js'
  import { IdsSearch } from '../../src/svelte/index.js'

  /** @type {{ adapter: import('../../src/adapter/types.js').IdsAdapter, messages?: Record<string, string>, locale: string,
   * t: (key: string) => string, onopen?: (hit: import('../../src/adapter/types.js').IdsHit) => void,
   * ontake?: (hit: import('../../src/adapter/types.js').IdsHit) => void }} */
  let { adapter, messages, locale, t, onopen, ontake } = $props()
  let character = $state('木')
  /** @type {'containing' | 'parts'} */
  let direction = $state('containing')
  const id = $props.id()
  const written = $derived(character.trim())
  const candidate = $derived(direction === 'containing' ? `㇯⬚${written}` : `㇯${written}⬚`)
  const query = $derived(componentQuery(candidate) ? candidate : '')
</script>

<div class="component-lookup">
  <div class="directions" role="group" aria-label={t('app.componentLookup.title')}>
    <button type="button" aria-pressed={direction === 'containing'} onclick={() => direction = 'containing'}>{t('app.componentLookup.containing')}</button>
    <button type="button" aria-pressed={direction === 'parts'} onclick={() => direction = 'parts'}>{t('app.componentLookup.parts')}</button>
  </div>
  <label for={`${id}-character`}>{t('app.componentLookup.input')}</label>
  <input id={`${id}-character`} bind:value={character} spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby={`${id}-help`} />
  <p id={`${id}-help`} class="help">{written && !query ? t('app.componentLookup.invalid') : t('app.componentLookup.help')}</p>
  <IdsSearch {adapter} {query} {messages} {locale} {onopen} {ontake} />
</div>

<style>
  .component-lookup{display:flex;flex-direction:column;gap:8px;min-width:0}
  .directions{display:flex;flex-wrap:wrap;gap:5px}
  button,input{font:inherit;color:inherit;background:var(--ids-surface,light-dark(#fff,#202026));border:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43));border-radius:7px}
  button{padding:6px 8px;font-size:12px;cursor:pointer;text-align:left}
  button[aria-pressed=true]{border-color:var(--ids-accent,#4465d6);background:var(--ids-accent-light,light-dark(#e7edfc,#24304f))}
  label{font-size:12px}
  input{min-width:0;padding:6px 8px;font-family:var(--ids-font,sans-serif);font-size:16px}
  .help{margin:0;color:var(--ids-muted,light-dark(#696973,#aaa));font-size:11px;line-height:1.5}
  button:focus-visible,input:focus-visible{outline:2px solid var(--ids-accent,#4465d6);outline-offset:2px}
</style>
