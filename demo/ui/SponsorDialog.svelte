<script>
  // What the workshop has cost, and the ways to help. Ko-fi takes cards and handles the amount;
  // companies can reach the author for an ad on the site. The header's Sponsor button opens it.
  import Dialog from './Dialog.svelte'
  import Icon from './Icon.svelte'
  /** @type {{ open: boolean, t: (key: string, params?: Record<string, string | number>) => string }} */
  let { open = $bindable(false), t } = $props()
</script>

<Dialog bind:open title={t('app.sponsor.label')} closeLabel={t('app.close')}>
  <div class="sheet">
    <p class="lead">{t('app.sponsor.lead')}</p>
    <p class="ask">{t('app.sponsor.ask')}</p>
    <h3>{t('app.sponsor.choose')}</h3>
    <ul class="ways">
      <li>
        <a class="way kofi" href="https://ko-fi.com/mkpoli" target="_blank" rel="noreferrer">
          <span class="mark" aria-hidden="true">K</span>
          <span class="copy"><strong>Ko-fi</strong><small>{t('app.sponsor.kofi')}</small></span>
          <Icon name="arrow-right" />
        </a>
      </li>
      <li>
        <a class="way paypal" href="https://paypal.me/mkpoli" target="_blank" rel="noreferrer">
          <span class="mark" aria-hidden="true">P</span>
          <span class="copy"><strong>PayPal</strong><small>{t('app.sponsor.paypal')}</small></span>
          <Icon name="arrow-right" />
        </a>
      </li>
      <li>
        <a class="way company" href="mailto:git@mkpo.li?subject=Sponsorship%20on%20ids.mkpo.li">
          <span class="mark" aria-hidden="true"><Icon name="mail" size={17} /></span>
          <span class="copy"><strong>{t('app.sponsor.company')}</strong><small>{t('app.sponsor.companyHint')}</small></span>
          <Icon name="arrow-right" />
        </a>
      </li>
    </ul>
    <p class="thanks">{t('app.sponsor.thanks')}</p>
  </div>
</Dialog>

<style>
  .sheet{display:flex;flex-direction:column;gap:14px}
  .lead{margin:0;font-size:14px;line-height:1.6;text-wrap:balance}
  .ask{margin:0;font-size:14px;font-weight:600;line-height:1.5}
  h3{margin:2px 0 0;font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
  .ways{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
  .way{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--ink);text-decoration:none}
  .way:hover{border-color:var(--line-strong);background:var(--hover)}
  .way:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .way :global(.icon){flex:none;color:var(--muted)}
  .way:hover :global(.icon){color:var(--ink)}
  .mark{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:10px;font-size:15px;font-weight:800;color:#fff}
  .kofi .mark{background:#ff5e5b;box-shadow:0 0 14px #ff5e5b66}
  .paypal .mark{background:#0070ba;box-shadow:0 0 14px #0070ba66}
  .company .mark{background:var(--ink);color:var(--bg);box-shadow:0 0 14px rgb(0 0 0 / .18)}
  .copy{display:flex;flex:1;flex-direction:column;gap:1px;min-width:0}
  .copy strong{font-size:13.5px;font-weight:650}
  .copy small{font-size:12px;line-height:1.4;color:var(--muted);text-wrap:balance}
  .copy small:lang(ko){word-break:keep-all}
  .thanks{margin:2px 0 0;font-size:12.5px;color:var(--muted)}
</style>
