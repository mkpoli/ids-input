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
    <button type="button" class="ui-button" data-size="sm" aria-pressed={direction === 'containing'} onclick={() => direction = 'containing'}>{t('app.componentLookup.containing')}</button>
    <button type="button" class="ui-button" data-size="sm" aria-pressed={direction === 'parts'} onclick={() => direction = 'parts'}>{t('app.componentLookup.parts')}</button>
  </div>
  <label class="ui-label" for={`${id}-character`}>{t('app.componentLookup.input')}</label>
  <input id={`${id}-character`} class="ui-input character" bind:value={character} spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby={`${id}-help`} />
  <p id={`${id}-help`} class="ui-hint">{written && !query ? t('app.componentLookup.invalid') : t('app.componentLookup.help')}</p>
  <IdsSearch {adapter} {query} {messages} {locale} {onopen} {ontake} />
</div>

<style>
  .component-lookup{display:flex;flex-direction:column;gap:var(--ui-space-sm);min-width:0}
  .directions{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .character{font-family:var(--cjk);font-size:var(--ui-text-lg)}
</style>
