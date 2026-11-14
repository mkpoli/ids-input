<script>
  // The IRG's unifiable and non-unifiable component variations as a reference page. A form or an
  // example character opens in the workshop; `#ucv-321` asks for that entry.
  import PageHeader from './ui/PageHeader.svelte'
  import { IdsVariations, translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
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


  /** The entry a `#ucv-321` address asks for. */
  const entryOf = () => /^#ucv-(\d+[a-z]*)$/.exec(location.hash)?.[1] ?? ''
  let query = $state(entryOf())
</script>

<svelte:window onhashchange={() => { const entry = entryOf(); if (entry) query = entry }} />
<svelte:head>
  <title>{t('ucv.title')} — {t('app.title')}</title>
</svelte:head>

<div class="page">
  <PageHeader title={t('ucv.title')} {t} bind:locale links={[{ href: `./sources.html?lang=${locale}#iwds-ucv`, label: t('ucv.source') }]} />

  <main>
    <IdsVariations {t} bind:query href={text => `./?lang=${locale}&ids=${encodeURIComponent(text)}`} />
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  main{width:100%;max-width:760px;margin:0 auto;padding:22px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
</style>
