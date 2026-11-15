<script>
  // The grammar of the zi.tools IDS Extension as one railroad diagram filling the window, with a
  // full-screen mode. The rule chosen in it is the address's fragment (its anchor on the
  // specification page), so a link opens the diagram at that rule.
  import PageHeader from './ui/PageHeader.svelte'
  import RailroadCanvas from './ui/RailroadCanvas.svelte'
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { ruleId } from './lib/baishi-sections.js'
  import { readGrammar } from './lib/railroad.js'
  import corrected from '../data/baishi-ids.ebnf?raw'

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

  const rules = readGrammar(corrected)
  const TOP = 'row'
  /** The rule an address names, by its anchor. */
  const named = () => { const id = decodeURIComponent(location.hash.slice(1)); return [...rules.keys()].find(name => ruleId(name) === id) }
  const first = named()
  let chosen = $state(first ?? TOP)
  $effect(() => { history.replaceState(history.state, '', `${location.pathname}${location.search}#${ruleId(chosen)}`) })
</script>

<svelte:head>
  <title>{t('railroad.title')} — {t('app.title')}</title>
</svelte:head>
<svelte:window onhashchange={() => { const name = named(); if (name) chosen = name }} />

<div class="page">
  <PageHeader page="baishi-railroad" title={t('railroad.title')} {t} bind:locale links={[
    { href: `./baishi.html?lang=${locale}#${ruleId(chosen)}`, label: t('baishi.title') },
    { href: `./baishi-cheatsheet.html?lang=${locale}`, label: t('cheatsheet.title') },
  ]} />
  <main>
    <h1 class="ui-visually-hidden">{t('railroad.title')}</h1>
    <RailroadCanvas {rules} top={TOP} {t} bind:selected={chosen} fill reveal={Boolean(first && first !== TOP)} />
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;height:100dvh}
  main{flex:1;min-height:0;display:flex;flex-direction:column;padding:12px 16px 16px}
</style>
