<script>
  // What the workshop is, what it runs on, and what shaped it.
  import Dialog from './Dialog.svelte'
  /** @type {{ open: boolean, t: (key: string, params?: Record<string, string | number>) => string }} */
  let { open = $bindable(false), locale, t } = $props()
</script>

<Dialog bind:open title={t('app.about.title')} closeLabel={t('app.close')} wide>
  <div class="about">
    <p class="lead">{t('app.about.lead')}</p>
    <p class="links"><a href="https://github.com/mkpoli/ids-input" target="_blank" rel="noreferrer">ids-input</a> · <a href="https://github.com/mkpoli/han-compose" target="_blank" rel="noreferrer">han-compose</a> · <a href="https://mkpo.li" rel="me">mkpoli</a> · <a href="./compare.html">{t('app.compare')}</a> · <a href="./engines.html">{t('app.engines')}</a></p>
    <h3>{t('app.about.licenses')}</h3>
    <p><a href="https://github.com/mkpoli/ids-input/blob/main/LICENSE" rel="license">{t('app.about.codeLicense')}</a></p>
    <p>{t('app.about.dataLicense')} <a href="https://github.com/mkpoli/ids-input/blob/main/data/README.md">{t('app.about.sources')}</a></p>
    <p>{t('app.about.outputLicense')}</p>
    <h3>{t('app.footer.sources')}</h3>
    <p>{t('app.about.fullSources')}</p>
    <p><a class="catalogue" href={`./sources.html?lang=${locale}`}>{t('app.about.openSources')}</a></p>
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
  a{color:var(--ui-color-accent);font-weight:var(--ui-weight-semibold);text-underline-offset:2px}
  p{margin:var(--ui-space-3xs) 0 0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm);line-height:1.45}
  .catalogue{white-space:nowrap}
</style>
