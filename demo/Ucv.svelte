<script>
  // The IRG's unifiable and non-unifiable component variations as a reference page. A form or an
  // example character opens in the workshop; `#ucv-321` asks for that entry.
  import SiteSelect from './ui/SiteSelect.svelte'
  import ThemeSwitch from './ui/ThemeSwitch.svelte'
  import { IdsVariations, translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { applyTheme, storedTheme } from './lib/theme.js'
  import { load, save } from './lib/storage.js'

  const params = new URLSearchParams(location.search)
  const wanted = String(params.get('lang') ?? load('locale', null) ?? navigator.language ?? '')
  const traditional = /^zh-(?:Hant|TW|HK|MO)\b/i
  let locale = $state(LOCALES.find(([code]) => code === wanted)?.[0]
    ?? (traditional.test(wanted) ? 'zh-Hant' : undefined)
    ?? LOCALES.find(([code]) => wanted.startsWith(code.split('-')[0]))?.[0] ?? 'en')
  $effect(() => save('locale', locale))
  $effect(() => { document.documentElement.lang = locale })
  const messages = $derived(LOCALES.find(([code]) => code === locale)?.[2])
  const t = $derived(translator({ ...appMessages('en'), ...messages, ...appMessages(locale) }, locale))

  let theme = $state(storedTheme())
  /** @param {import('./lib/theme.js').Theme} next */
  const setTheme = next => { theme = next; applyTheme(next) }

  /** The entry a `#ucv-321` address asks for. */
  const entryOf = () => /^#ucv-(\d+[a-z]*)$/.exec(location.hash)?.[1] ?? ''
  let query = $state(entryOf())
</script>

<svelte:window onhashchange={() => { query = entryOf() }} />
<svelte:head>
  <title>{t('ucv.title')} — {t('app.title')}</title>
</svelte:head>

<div class="page">
  <header class="bar">
    <SiteSelect title={t('app.title')} label={t('app.sitesLabel')} more={t('app.sitesMore')} {locale} href={`./?lang=${locale}`} />
    <span class="slash" aria-hidden="true">/</span>
    <h1>{t('ucv.title')}</h1>
    <div class="end">
      <label class="lang">
        <span class="ui-visually-hidden">{t('sources.language')}</span>
        <select bind:value={locale}>
          {#each LOCALES as [code, name] (code)}<option value={code}>{name}</option>{/each}
        </select>
      </label>
      <a class="back" href={`./sources.html?lang=${locale}#iwds-ucv`}>{t('ucv.source')}</a>
      <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={{ system: t('app.theme.system'), light: t('app.theme.light'), dark: t('app.theme.dark') }} onchange={setTheme} />
      <a class="back" href={`./?lang=${locale}`}>{t('sources.back')}</a>
    </div>
  </header>

  <main>
    <IdsVariations {t} bind:query href={text => `./?lang=${locale}&ids=${encodeURIComponent(text)}`} />
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  .bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px max(18px,env(safe-area-inset-right)) 10px max(18px,env(safe-area-inset-left));border-bottom:1px solid var(--ids-line)}
  h1{font-size:15px;font-weight:600;margin:0}
  .slash{color:var(--ids-muted)}
  .end{display:flex;align-items:center;gap:10px;margin-inline-start:auto}
  .back{font-size:12px;color:var(--ids-muted);text-decoration:none}
  .back:hover{color:var(--ids-ink)}
  main{width:100%;max-width:760px;margin:0 auto;padding:22px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
</style>
