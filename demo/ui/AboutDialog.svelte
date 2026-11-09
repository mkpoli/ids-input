<script module>
  // People who wrote to us, and people who passed the post on, each with the
  // account behind the name.
  const reported = [
    { n: 'परवद💙💛', u: 'https://x.com/zoenshiueh_lieu' },
    { n: 'Fn', u: 'https://x.com/integuraru_P' },
    { n: 'なきは', u: 'https://x.com/nakiha_kanji' },
    { n: '馬のゆい', u: 'https://x.com/umanoyui' },
    { n: 'NGWU YOH', u: 'https://t.me/Ngwuyoh' },
    { n: '橘 (귥〮 귤〮) 🍊', u: 'https://en.wikisource.org/wiki/User:Fish_bowl' },
    { n: '海楫', u: 'https://x.com/sebansios' },
    { n: 'Sim-CH', u: 'https://x.com/CheonHyeongSim' }
  ]
  const quoted = [
    { n: 'teki', u: 'https://x.com/secret_teki' },
    { n: '𝓾𝓽𝓮𝓽𝓪𝓶.16', u: 'https://x.com/Utetamutete' },
    { n: '多久後語族たそ(たぐたん)/天使タツキン', u: 'https://x.com/Tagelese_taso' },
    { n: 'ろじん（闭关 ver.）', u: 'https://x.com/IsharmlaFaith' },
    { n: '津茶利休', u: 'https://x.com/ttylys' },
    { n: 'Mr. Canlonian', u: 'https://x.com/Canlonian' },
    { n: 'ᴉʞoɐu ᴉʞɐzɐɯɐʎ / Ямадзаки Наоки', u: 'https://x.com/ymzknk' },
    { n: 'Serge Achilles', u: 'https://x.com/SergeAchilles' },
    { n: '暇人', u: 'https://x.com/fimaazhjn1018' },
    { n: 'さぁもん', u: 'https://x.com/kanji_hashita' },
    { n: 'Umaĵo', u: 'https://x.com/umajxo' },
    { n: 'とてヌワン', u: 'https://x.com/tote_nu' }
  ]
  const reposted = [
    { n: '筑波大学 宮川創 研究室 / Prof. Dr. So Miyagawa', u: 'https://x.com/So_Miyagawa' },
    { n: '如木花', u: 'https://x.com/amapichannel' },
    { n: 'うに@LLfes15 day1&2参戦', u: 'https://x.com/elpwc' },
    { n: '朱鷺 / とき', u: 'https://x.com/tokiy_0904' },
    { n: 'NovaDNG', u: 'https://x.com/NovaDNG' },
    { n: 'てんさいぱるふ', u: 'https://x.com/Palf_s' },
    { n: '霑', u: 'https://x.com/BlackCatAnalogy' },
    { n: 'otoneko', u: 'https://x.com/otoneko_mk' },
    { n: '지로 誌路・げんご次郎（次郞）', u: 'https://x.com/GengoJiro' },
    { n: '國語問題協議會', u: 'https://x.com/kokumonkyo' },
    { n: '某ZR（ざんねん）', u: 'https://x.com/zr_tex8r' },
    { n: 'にせねこ', u: 'https://x.com/nixeneko' },
    { n: '《안개》FOG', u: 'https://x.com/4ourzer0ei8ht' },
    { n: '十八子', u: 'https://x.com/eighteen_child' },
    { n: '毛チーリ / 久津瀨 吝太郎', u: 'https://x.com/kechilee' },
    { n: '雷更新世', u: 'https://x.com/pleist' },
    { n: 'えけりん', u: 'https://x.com/Hoenggerberg21' },
    { n: '黒丿乀', u: 'https://x.com/kurohetsuhotsu' },
    { n: 'しひろ', u: 'https://x.com/_idemu' },
    { n: '两浙路农村鱿灾防治办华主任', u: 'https://x.com/RealHuajianguo' },
    { n: 'sahen', u: 'https://x.com/sahenjpn' },
    { n: 'そてつ郵便部', u: 'https://x.com/sotetsu_post' },
    { n: '韓泳思', u: 'https://x.com/han_yeongsy' },
    { n: '粵字改革 cantonese script reform', u: 'https://x.com/CantoneseScript' },
    { n: 'ただのホロリス', u: 'https://x.com/GQaTTSarpV47315' },
    { n: 'てんぴつ。', u: 'https://x.com/tenpitu_22eg' },
    { n: '六谷延寿/육곡연수', u: 'https://x.com/6gok_rokutani' },
    { n: 'まう', u: 'https://x.com/Mau_MauMautch' },
    { n: 'ソケセテ 本赫', u: 'https://x.com/sokesete1' },
    { n: 'サヘラン', u: 'https://x.com/saheran_108' },
    { n: '木瓜牛乳❖Egnale・文・あやぶ', u: 'https://x.com/Egnale99' },
    { n: '花生', u: 'https://x.com/is_this_pnut' },
    { n: 'LiberoCentrist', u: 'https://x.com/LiberoCentrist' },
    { n: '銀貓', u: 'https://x.com/SilverCat0009' },
    { n: '飛んでゆけ！さんさんさん', u: 'https://x.com/tondeyuke_333' },
    { n: 'Rikiya Takehi 武樋力哉', u: 'https://x.com/rikiyatakehi_jp' },
    { n: '彩(ひかり)', u: 'https://x.com/naokas_y' }
  ]
  const groups = [
    { label: 'app.about.reported', people: reported },
    { label: 'app.about.quoted', people: quoted },
    { label: 'app.about.reposted', people: reposted }
  ]
</script>

<script>
  // What the workshop is, what it runs on, and what shaped it.
  import Dialog from './Dialog.svelte'
  /** @type {{ open: boolean, t: (key: string, params?: Record<string, string | number>) => string }} */
  let { open = $bindable(false), locale, t } = $props()
</script>

<Dialog bind:open title={t('app.about.title')} closeLabel={t('app.close')} wide>
  <div class="about">
    <p class="lead">{t('app.about.lead')}</p>
    <p class="links"><a href="https://github.com/mkpoli/ids-input" target="_blank" rel="noreferrer">ids-input</a> · <a href="https://github.com/mkpoli/han-compose" target="_blank" rel="noreferrer">han-compose</a> · <a href="https://mkpo.li" rel="me">mkpoli</a> · <a href="./compare.html">{t('app.compare')}</a> · <a href="./engines.html">{t('app.engines')}</a> · <a href="./component-atlas.html">{t('app.atlas')}</a> · <a href={`./unencoded.html?lang=${locale}#equivalents`}>{t('appendix.equivalents')}</a></p>
    <h3>{t('app.about.licenses')}</h3>
    <p><a href="https://github.com/mkpoli/ids-input/blob/main/LICENSE" rel="license">{t('app.about.codeLicense')}</a></p>
    <p>{t('app.about.dataLicense')} <a href="https://github.com/mkpoli/ids-input/blob/main/data/README.md">{t('app.about.sources')}</a></p>
    <p>{t('app.about.outputLicense')}</p>
    <h3>{t('app.footer.sources')}</h3>
    <p>{t('app.about.fullSources')}</p>
    <p><a class="catalogue" href={`./sources.html?lang=${locale}`}>{t('app.about.openSources')}</a> · <a class="catalogue" href={`./unencoded.html?lang=${locale}`}>{t('app.about.openEquivalences')}</a></p>
    <h3>{t('app.about.acknowledgments')}</h3>
    <p>{t('app.about.feedbackThanks')}</p>
    {#each groups as group}
      <h4>{t(group.label)}</h4>
      <ul class="thanks">
        {#each group.people as person}
          <li><a href={person.u} target="_blank" rel="noreferrer">{person.n}</a></li>
        {/each}
      </ul>
    {/each}
  </div>
</Dialog>

<style>
  .about{font-size:var(--ui-text-sm)}
  .lead{margin:0 0 var(--ui-space-xs);font-size:var(--ui-text-md)}
  .links{margin:0 0 var(--ui-space-2xs);color:var(--ui-color-ink-muted)}
  h3{margin:var(--ui-space-xl) 0 var(--ui-space-xs);font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-bold);letter-spacing:.04em;text-transform:uppercase;color:var(--ui-color-ink-muted)}
  h4{margin:var(--ui-space-md) 0 var(--ui-space-3xs);font-size:var(--ui-text-sm);font-weight:var(--ui-weight-semibold);color:var(--ui-color-ink)}
  a{color:var(--ui-color-accent);font-weight:var(--ui-weight-semibold);text-underline-offset:2px}
  p{margin:var(--ui-space-3xs) 0 0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm);line-height:1.45}
  .thanks{margin:var(--ui-space-3xs) 0 0;padding:0;list-style:none}
  .thanks li{display:inline;color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm);line-height:1.9}
  .thanks li+li::before{content:' · '}
  .catalogue{white-space:nowrap}
</style>
