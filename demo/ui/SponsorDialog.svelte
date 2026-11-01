<script>
  // The author's portrait, what a tip pays for, then three steps that end at the tip buttons: Ko-fi
  // and OFUSE, OFUSE first in Japanese. Each button carries its service's own mark and colour,
  // unaltered as both brand kits require. Each service handles the amount and the payment;
  // companies can write in to sponsor. The header's Sponsor button opens it.
  import Dialog from './Dialog.svelte'
  import Icon from './Icon.svelte'
  /** @type {{ open: boolean, locale: string, t: (key: string, params?: Record<string, string | number>) => string }} */
  let { open = $bindable(false), locale, t } = $props()
  const ofuseFirst = $derived(locale.split('-')[0] === 'ja')
</script>

<svelte:head>
  <script type="module" src="https://supporters.mkpo.li/roll.js"></script>
</svelte:head>

{#snippet kofi()}
  <a class="tip kofi" href="https://ko-fi.com/mkpoli" target="_blank" rel="noreferrer">
    <img class="mark" src="/brand/kofi-symbol.svg" alt="" width="34" height="27" />
    <span class="copy"><strong>Ko-fi</strong><small>{t('app.sponsor.kofi')}</small></span>
    <Icon name="arrow-right" />
  </a>
{/snippet}

{#snippet ofuse()}
  <a class="tip ofuse" href="https://ofuse.me/mkpoli" target="_blank" rel="noreferrer">
    <img class="mark" src="/brand/ofuse-icon.svg" alt="" width="26" height="28" />
    <span class="copy"><strong>OFUSE</strong><small>{t('app.sponsor.ofuse')}</small></span>
    <Icon name="arrow-right" />
  </a>
{/snippet}

<Dialog bind:open title={t('app.sponsor.label')} closeLabel={t('app.close')}>
  <div class="sheet">
    <div class="hero" aria-hidden="true">
      <span class="portrait">
        <img src="/sponsor-portrait.webp" alt="" width="112" height="112" decoding="async" />
        <svg class="heart" viewBox="0 0 24 24">
          <path d="M12 21s-8.5-5.1-8.5-11.3A4.7 4.7 0 0 1 12 6.9a4.7 4.7 0 0 1 8.5 2.8C20.5 15.9 12 21 12 21Z" />
          <ellipse class="shine" cx="7.6" cy="9.6" rx="1.5" ry="2.1" transform="rotate(-30 7.6 9.6)" />
        </svg>
      </span>
      <span class="spark s1">✦</span><span class="spark s2">✦</span><span class="spark s3">✦</span>
    </div>
    <p class="lead">{t('app.sponsor.lead')}</p>
    <p class="ask">{t('app.sponsor.ask')}</p>
    <section class="how">
      <h3>{t('app.sponsor.howTo')}</h3>
      <ol class="steps" role="list">
        <li>{t('app.sponsor.step1')}</li>
        <li>{t('app.sponsor.step2')}</li>
        <li>{t('app.sponsor.step3')}</li>
      </ol>
    </section>
    <div class="tips">
      {#if ofuseFirst}{@render ofuse()}{@render kofi()}{:else}{@render kofi()}{@render ofuse()}{/if}
    </div>
    <a class="company" href="mailto:mkpoli@mkpo.li?subject=Sponsorship%20on%20ids.mkpo.li">
      <Icon name="mail" size={16} />
      <span class="copy"><strong>{t('app.sponsor.company')}</strong><small>{t('app.sponsor.companyHint')}</small></span>
    </a>
    <supporters-roll label={t('app.sponsor.supporters')} anonymous={t('app.sponsor.anonymous')}></supporters-roll>
    <p class="thanks">{t('app.sponsor.thanks')}</p>
  </div>
</Dialog>

<style>
  .sheet{--sp-ink:light-dark(#c2185b,#ffb3cd);--sp-heart:light-dark(#ff4f88,#ff7aa6);--sp-soft:light-dark(#fff1f5,#2f1822);
    --sp-line:light-dark(#ffd0de,#5a2a3f);display:flex;flex-direction:column;gap:14px}
  .hero{position:relative;display:grid;place-items:center;height:136px;margin:-4px -4px 0;border-radius:var(--ui-radius-3xl);
    background:radial-gradient(closest-side,light-dark(#ffd9e5,#4a1e31),transparent)}
  .portrait{position:relative;width:112px;height:112px}
  .portrait img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover;
    box-shadow:0 0 0 4px var(--ui-color-surface),0 0 0 6px var(--sp-line),0 10px 24px rgb(255 79 136 / .3)}
  .heart{position:absolute;right:-2px;bottom:2px;width:34px;height:34px;fill:var(--sp-heart);stroke:var(--ui-color-surface);stroke-width:2;paint-order:stroke;
    overflow:visible;transform-origin:50% 60%;animation:beat 2.8s ease-in-out infinite;filter:drop-shadow(0 3px 6px rgb(255 79 136 / .35))}
  .heart .shine{fill:#fff;opacity:.6}
  .spark{position:absolute;color:var(--sp-heart);opacity:.75;animation:twinkle 2.4s ease-in-out infinite}
  .s1{top:22px;left:calc(50% - 84px);font-size:14px}
  .s2{top:12px;left:calc(50% + 66px);font-size:10px;animation-delay:.8s}
  .s3{bottom:20px;left:calc(50% - 76px);font-size:11px;animation-delay:1.6s}
  @keyframes beat{0%,70%,100%{transform:scale(1)}78%{transform:scale(1.18)}86%{transform:scale(.96)}93%{transform:scale(1.1)}}
  @keyframes twinkle{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:.9;transform:scale(1)}}
  .lead{margin:0;font-size:14px;line-height:1.65}
  .ask{margin:0;font-size:14.5px;font-weight:650;line-height:1.5;color:var(--sp-ink)}
  .lead:lang(ko),.ask:lang(ko),.steps:lang(ko),.company small:lang(ko),.thanks:lang(ko){word-break:keep-all}
  .how{padding:12px 14px;border:1px dashed var(--sp-line);border-radius:var(--ui-radius-2xl);background:var(--sp-soft)}
  h3{margin:0 0 8px;font-size:12px;font-weight:700;color:var(--sp-ink)}
  .steps{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none;counter-reset:step}
  .steps li{display:flex;align-items:baseline;gap:8px;font-size:13px;line-height:1.45;counter-increment:step}
  .steps li::before{content:counter(step);display:grid;place-items:center;flex:none;width:20px;height:20px;border-radius:50%;
    background:var(--sp-ink);color:var(--sp-soft);font-size:11px;font-weight:700;line-height:1;transform:translateY(-1px)}
  .tips{display:flex;flex-direction:column;gap:10px}
  .tip{display:flex;align-items:center;gap:12px;padding:12px 16px 12px 12px;border-radius:var(--ui-radius-pill);
    color:#fff;text-decoration:none;box-shadow:0 6px 16px var(--tip-glow);transition:transform .18s ease,box-shadow .18s ease}
  .kofi{--tip-glow:rgb(32 32 32 / .28);--tip-glow-hover:rgb(32 32 32 / .38);background:#202020;border:1px solid light-dark(#202020,rgb(255 255 255 / .2))}
  /* OFUSE Blue (#2882a7) taken 4% darker, so the white labels reach 4.5:1. */
  .ofuse{--tip-glow:rgb(38 125 160 / .3);--tip-glow-hover:rgb(38 125 160 / .42);background:#267da0;border:1px solid #267da0}
  .tip:hover{transform:translateY(-1px);box-shadow:0 8px 22px var(--tip-glow-hover)}
  .tip:active{transform:scale(.98)}
  .tip:focus-visible,.company:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:2px}
  .tip .mark{display:block;flex:none;width:38px;height:30px;object-fit:contain}
  .tip .copy strong{font-size:15px}
  .tip .copy small{color:#fff}
  .copy{display:flex;flex:1;flex-direction:column;gap:1px;min-width:0}
  .copy strong{font-size:13.5px;font-weight:700}
  .copy small{font-size:12px;line-height:1.4}
  .company{display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-radius:var(--ui-radius-xl);color:var(--ui-color-ink-muted);text-decoration:none}
  .company:hover{background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  .company :global(.icon){flex:none;margin-top:2px}
  .company .copy strong{font-size:12.5px;color:var(--ui-color-ink)}
  supporters-roll{--sp-text:var(--ui-color-ink);--sp-muted:var(--ui-color-ink-muted)}
  .thanks{margin:0;font-size:12.5px;line-height:1.5;color:var(--ui-color-ink-muted);text-align:center}
  @media (prefers-reduced-motion:reduce){.heart,.spark,.tip{animation:none;transition:none}}
</style>
