<script>
  // Why the author needs help, then three steps that end at the Ko-fi button. Ko-fi handles the
  // amount and the payment; companies can write in for an ad on the site. The header's Sponsor
  // button opens it.
  import Dialog from './Dialog.svelte'
  import Icon from './Icon.svelte'
  /** @type {{ open: boolean, t: (key: string, params?: Record<string, string | number>) => string }} */
  let { open = $bindable(false), t } = $props()
</script>

<Dialog bind:open title={t('app.sponsor.label')} closeLabel={t('app.close')}>
  <div class="sheet">
    <div class="hero" aria-hidden="true">
      <svg class="heart" viewBox="0 0 24 24">
        <path d="M12 21s-8.5-5.1-8.5-11.3A4.7 4.7 0 0 1 12 6.9a4.7 4.7 0 0 1 8.5 2.8C20.5 15.9 12 21 12 21Z" />
        <ellipse class="shine" cx="7.6" cy="9.6" rx="1.5" ry="2.1" transform="rotate(-30 7.6 9.6)" />
      </svg>
      <span class="spark s1">✦</span><span class="spark s2">✦</span><span class="spark s3">✦</span>
    </div>
    <p class="lead">{t('app.sponsor.lead')}</p>
    <p class="ask">{t('app.sponsor.ask')}</p>
    <section class="how">
      <h3>{t('app.sponsor.howTo')}</h3>
      <ol class="steps">
        <li>{t('app.sponsor.step1')}</li>
        <li>{t('app.sponsor.step2')}</li>
        <li>{t('app.sponsor.step3')}</li>
      </ol>
    </section>
    <a class="kofi" href="https://ko-fi.com/mkpoli" target="_blank" rel="noreferrer">
      <span class="mark" aria-hidden="true"><Icon name="coffee" size={20} /></span>
      <span class="copy"><strong>Ko-fi</strong><small>{t('app.sponsor.kofi')}</small></span>
      <Icon name="arrow-right" />
    </a>
    <a class="company" href="mailto:mkpoli@mkpo.li?subject=Sponsorship%20on%20ids.mkpo.li">
      <Icon name="mail" size={16} />
      <span class="copy"><strong>{t('app.sponsor.company')}</strong><small>{t('app.sponsor.companyHint')}</small></span>
    </a>
    <p class="thanks">{t('app.sponsor.thanks')}</p>
  </div>
</Dialog>

<style>
  .sheet{--sp-ink:light-dark(#c2185b,#ffb3cd);--sp-heart:light-dark(#ff4f88,#ff7aa6);--sp-soft:light-dark(#fff1f5,#2f1822);
    --sp-line:light-dark(#ffd0de,#5a2a3f);display:flex;flex-direction:column;gap:14px}
  .hero{position:relative;display:grid;place-items:center;height:76px;margin:-4px -4px 0;border-radius:16px;
    background:radial-gradient(closest-side,light-dark(#ffd9e5,#4a1e31),transparent)}
  .heart{width:48px;height:48px;fill:var(--sp-heart);transform-origin:50% 60%;animation:beat 2.8s ease-in-out infinite;
    filter:drop-shadow(0 4px 8px rgb(255 79 136 / .35))}
  .heart .shine{fill:#fff;opacity:.6}
  .spark{position:absolute;color:var(--sp-heart);opacity:.75;animation:twinkle 2.4s ease-in-out infinite}
  .s1{top:14px;left:calc(50% - 46px);font-size:12px}
  .s2{top:10px;left:calc(50% + 34px);font-size:9px;animation-delay:.8s}
  .s3{bottom:12px;left:calc(50% + 42px);font-size:11px;animation-delay:1.6s}
  @keyframes beat{0%,70%,100%{transform:scale(1)}78%{transform:scale(1.18)}86%{transform:scale(.96)}93%{transform:scale(1.1)}}
  @keyframes twinkle{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:.9;transform:scale(1)}}
  .lead{margin:0;font-size:14px;line-height:1.65}
  .ask{margin:0;font-size:14.5px;font-weight:650;line-height:1.5;color:var(--sp-ink)}
  .lead:lang(ko),.ask:lang(ko),.steps:lang(ko),.company small:lang(ko),.thanks:lang(ko){word-break:keep-all}
  .how{padding:12px 14px;border:1px dashed var(--sp-line);border-radius:14px;background:var(--sp-soft)}
  h3{margin:0 0 8px;font-size:12px;font-weight:700;color:var(--sp-ink)}
  .steps{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none;counter-reset:step}
  .steps li{display:flex;align-items:baseline;gap:8px;font-size:13px;line-height:1.45;counter-increment:step}
  .steps li::before{content:counter(step);display:grid;place-items:center;flex:none;width:20px;height:20px;border-radius:50%;
    background:var(--sp-heart);color:#fff;font-size:11px;font-weight:700;line-height:1;transform:translateY(-1px)}
  .kofi{display:flex;align-items:center;gap:12px;padding:12px 16px 12px 12px;border-radius:999px;
    background:linear-gradient(135deg,#ff5e5b,#ff4f88);color:#fff;text-decoration:none;box-shadow:0 6px 16px rgb(255 79 136 / .32);
    transition:transform .18s ease,box-shadow .18s ease}
  .kofi:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgb(255 79 136 / .42)}
  .kofi:active{transform:scale(.98)}
  .kofi:focus-visible,.company:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
  .kofi .mark{display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:50%;background:rgb(255 255 255 / .22)}
  .kofi .copy strong{font-size:15px}
  .kofi .copy small{color:rgb(255 255 255 / .88)}
  .copy{display:flex;flex:1;flex-direction:column;gap:1px;min-width:0}
  .copy strong{font-size:13.5px;font-weight:700}
  .copy small{font-size:12px;line-height:1.4}
  .company{display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-radius:12px;color:var(--muted);text-decoration:none}
  .company:hover{background:var(--hover);color:var(--ink)}
  .company :global(.icon){flex:none;margin-top:2px}
  .company .copy strong{font-size:12.5px;color:var(--ink)}
  .thanks{margin:0;font-size:12.5px;line-height:1.5;color:var(--muted);text-align:center}
  @media (prefers-reduced-motion:reduce){.heart,.spark,.kofi{animation:none;transition:none}}
</style>
