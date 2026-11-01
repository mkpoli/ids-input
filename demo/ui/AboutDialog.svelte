<script>
  // What the workshop is, what it runs on, and what shaped it.
  import { INSPIRED, SOURCES } from '../lib/credits.js'
  import { EXAMPLE_SOURCES } from '../lib/example-sources.js'
  import Dialog from './Dialog.svelte'
  /** @type {{ open: boolean, t: (key: string, params?: Record<string, string | number>) => string }} */
  let { open = $bindable(false), t } = $props()
</script>

{#snippet list(/** @type {import('../lib/credits.js').Credit[]} */ items, /** @type {(key: string) => string} */ label)}
  <ul>
    {#each items as item (item.key)}
      <li>
        <a href={item.url} target="_blank" rel="noreferrer">{item.name}</a>{#if item.by}<span class="by">{item.by}</span>{/if}{#if item.licence}<span class="licence">{item.licence}</span>{/if}
        <p>{label(item.key)}</p>
      </li>
    {/each}
  </ul>
{/snippet}

<Dialog bind:open title={t('app.about.title')} closeLabel={t('app.close')} wide>
  <div class="about">
    <p class="lead">{t('app.about.lead')}</p>
    <p class="links"><a href="https://github.com/mkpoli/ids-input" target="_blank" rel="noreferrer">ids-input</a> · <a href="https://github.com/mkpoli/han-compose" target="_blank" rel="noreferrer">han-compose</a> · <a href="https://mkpo.li" rel="me">mkpoli</a> · <a href="./compare.html">{t('app.compare')}</a> · <a href="./engines.html">{t('app.engines')}</a></p>
    <h3>{t('app.about.licenses')}</h3>
    <p><a href="https://github.com/mkpoli/ids-input/blob/main/LICENSE" rel="license">{t('app.about.codeLicense')}</a></p>
    <p>{t('app.about.dataLicense')} <a href="https://github.com/mkpoli/ids-input/blob/main/data/README.md">{t('app.about.sources')}</a></p>
    <p>{t('app.about.outputLicense')}</p>
    <h3>{t('app.footer.sources')}</h3>
    {@render list(SOURCES, key => t(`app.source.${key}`))}
    <h3>{t('app.about.exampleSources')}</h3>
    <ol class="bib">
      {#each EXAMPLE_SOURCES as source, i (source.id)}
        <li value={i + 1}>
          {#if source.url}<a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>{:else}{source.title}{/if}
          {#if source.author}<span class="by">{source.author}</span>{/if}
          {#if source.date}<span class="by">{source.date}</span>{/if}
          <p>{source.note}</p>
        </li>
      {/each}
    </ol>
    <h3>{t('app.about.inspired')}</h3>
    {@render list(INSPIRED, key => t(`app.inspired.${key}`))}
    <h3>{t('app.about.acknowledgments')}</h3>
    <p>{t('app.about.feedbackThanks')}</p>
    <p class="feedback-names"><a href="https://x.com/zoenshiueh_lieu" target="_blank" rel="noreferrer">परवद💙💛</a> · <a href="https://x.com/integuraru_P" target="_blank" rel="noreferrer">Fn</a> · <a href="https://x.com/nakiha_kanji" target="_blank" rel="noreferrer">なきは</a> · <a href="https://x.com/umanoyui" target="_blank" rel="noreferrer">馬のゆい</a></p>
  </div>
</Dialog>

<style>
  .about{font-size:var(--ui-text-sm)}
  .lead{margin:0 0 var(--ui-space-xs);font-size:var(--ui-text-md)}
  .links{margin:0 0 var(--ui-space-2xs);color:var(--ui-color-ink-muted)}
  h3{margin:var(--ui-space-xl) 0 var(--ui-space-xs);font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-bold);letter-spacing:.04em;text-transform:uppercase;color:var(--ui-color-ink-muted)}
  ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:var(--ui-space-sm)}
  li{padding:var(--ui-space-sm) var(--ui-space-md);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface-sunken)}
  a{color:var(--ui-color-accent);font-weight:var(--ui-weight-semibold);text-underline-offset:2px}
  .by,.licence{margin-left:var(--ui-space-sm);font-size:var(--ui-text-xs);color:var(--ui-color-ink-muted)}
  .licence{padding:1px var(--ui-space-xs);border-radius:var(--ui-radius-pill);border:1px solid var(--ui-color-border)}
  p{margin:var(--ui-space-3xs) 0 0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm);line-height:1.45}
  .bib{margin:0;padding-left:1.6em}
  .bib li + li{margin-top:var(--ui-space-sm)}
</style>
