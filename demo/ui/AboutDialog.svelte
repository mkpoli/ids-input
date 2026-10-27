<script>
  // What the workshop is, what it runs on, and what shaped it.
  import { INSPIRED, SOURCES } from '../lib/credits.js'
  import Dialog from './Dialog.svelte'
  /** @type {{ open: boolean, t: (key: string, params?: Record<string, string | number>) => string }} */
  let { open = $bindable(false), t } = $props()
</script>

{#snippet list(/** @type {import('../lib/credits.js').Credit[]} */ items, /** @type {string} */ prefix)}
  <ul>
    {#each items as item (item.key)}
      <li>
        <a href={item.url} target="_blank" rel="noreferrer">{item.name}</a>{#if item.by}<span class="by">{item.by}</span>{/if}{#if item.licence}<span class="licence">{item.licence}</span>{/if}
        <p>{t(`${prefix}.${item.key}`)}</p>
      </li>
    {/each}
  </ul>
{/snippet}

<Dialog bind:open title={t('app.about.title')} closeLabel={t('app.close')} wide>
  <div class="about">
    <p class="lead">{t('app.about.lead')}</p>
    <p class="links"><a href="https://github.com/mkpoli/ids-input" target="_blank" rel="noreferrer">github.com/mkpoli/ids-input</a></p>
    <h3>{t('app.about.licenses')}</h3>
    <p><a href="https://github.com/mkpoli/ids-input/blob/main/LICENSE" rel="license">{t('app.about.codeLicense')}</a></p>
    <p>{t('app.about.dataLicense')} <a href="https://github.com/mkpoli/ids-input/blob/main/data/README.md">{t('app.about.sources')}</a></p>
    <p>{t('app.about.outputLicense')}</p>
    <h3>{t('app.about.sources')}</h3>
    {@render list(SOURCES, 'app.source')}
    <h3>{t('app.about.inspired')}</h3>
    {@render list(INSPIRED, 'app.inspired')}
    <h3>{t('app.about.acknowledgments')}</h3>
    <p>{t('app.about.feedbackThanks')}</p>
    <p class="feedback-names"><a href="https://x.com/zoenshiueh_lieu" target="_blank" rel="noreferrer">परवद💙💛</a> · <a href="https://x.com/integuraru_P" target="_blank" rel="noreferrer">Fn</a> · <a href="https://x.com/nakiha_kanji" target="_blank" rel="noreferrer">なきは</a> · <a href="https://x.com/umanoyui" target="_blank" rel="noreferrer">馬のゆい</a></p>
  </div>
</Dialog>

<style>
  .about{font-size:13.5px}
  .lead{margin:0 0 6px;font-size:14px}
  .links{margin:0 0 4px;color:var(--muted)}
  h3{margin:18px 0 6px;font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
  ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
  li{padding:8px 10px;border-radius:10px;background:var(--surface-2)}
  a{color:var(--accent);font-weight:600;text-underline-offset:2px}
  .by,.licence{margin-left:8px;font-size:12px;color:var(--muted)}
  .licence{padding:1px 6px;border-radius:999px;border:1px solid var(--line)}
  p{margin:2px 0 0;color:var(--muted);font-size:12.5px;line-height:1.45}
</style>
