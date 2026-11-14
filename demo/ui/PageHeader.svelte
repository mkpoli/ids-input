<script>
  // The bar of a page beside the workshop: the site, the page's title as a select of the other
  // pages, then the language menu and the theme switch the workshop itself has, and the links the
  // page gives. Without a locale the page is English only and has no language menu.
  import SiteSelect from './SiteSelect.svelte'
  import PageSelect from './PageSelect.svelte'
  import ThemeSwitch from './ThemeSwitch.svelte'
  import Menu from './Menu.svelte'
  import { LOCALES } from '../lib/locales.js'
  import { applyTheme, storedTheme } from '../lib/theme.js'

  /** @type {{ title: string, page: string, t: (key: string, params?: Record<string, unknown>) => string, locale?: string, home?: string,
   *   links?: { href: string, label: string }[], children?: import('svelte').Snippet }} */
  let { title, page, t, locale = $bindable(), home = './', links = [], children } = $props()
  let theme = $state(storedTheme())
  /** @param {import('../lib/theme.js').Theme} next */
  const setTheme = next => { theme = next; applyTheme(next) }
  const localeName = $derived(LOCALES.find(([code]) => code === locale)?.[1] ?? '')
  const localeItems = $derived(LOCALES.map(([code, name]) => ({ label: name, lang: code, checked: code === locale, run: () => { locale = code } })))
  const query = $derived(locale ? `?lang=${locale}` : '')
</script>

<header class="bar">
  <SiteSelect title={t('app.title')} label={t('app.sitesLabel')} more={t('app.sitesMore')} locale={locale ?? 'en'} href={`${home}${query}`} />
  <span class="slash" aria-hidden="true">/</span>
  <PageSelect {title} {page} {t} {home} {query} />
  {@render children?.()}
  <div class="end">
    {#each links as link (link.href)}<a class="back" href={link.href}>{link.label}</a>{/each}
    {#if locale}<Menu label={localeName} ariaLabel={`${t('app.language')}: ${localeName}`} icon="globe" items={localeItems} align="end" keyHints={false} compact />{/if}
    <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={{ system: t('app.theme.system'), light: t('app.theme.light'), dark: t('app.theme.dark') }} onchange={setTheme} />
    <a class="back" href={`${home}${query}`}>{t('sources.back')}</a>
  </div>
</header>

<style>
  .bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px max(18px,env(safe-area-inset-right)) 10px max(18px,env(safe-area-inset-left));
    border-bottom:1px solid var(--ui-color-border);background:color-mix(in srgb,var(--ui-color-canvas) 88%,transparent);backdrop-filter:blur(10px);position:sticky;top:0;z-index:10}
  .slash{color:var(--ui-color-border-strong)}
  .end{display:flex;align-items:center;gap:10px;margin-left:auto;flex-wrap:wrap}
  .back{font-size:13px;color:var(--ui-color-accent);text-decoration:none;padding:5px 9px;border-radius:var(--ui-radius-md)}
  .back:hover{background:var(--ui-color-surface-hover)}
</style>
