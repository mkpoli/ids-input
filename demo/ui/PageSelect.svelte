<script>
  // A page's title as a select: the workshop, then every page beside it, this one ticked.
  import LinkSelect from './LinkSelect.svelte'
  import { pages } from '../lib/pages.js'

  /** @type {{ title: string, page: string, t: (key: string) => string, home: string, query: string }} */
  let { title, page, t, home, query } = $props()
  /** @type {import('./LinkSelect.svelte').Link[]} */
  const links = $derived([
    { href: `${home}${query}`, label: t('sources.back') },
    { separator: true },
    ...pages(t).map(entry => ({ href: `./${entry.id}.html${query}`, label: entry.label, current: entry.id === page })),
  ])
</script>

<h1><LinkSelect label={t('app.about.pages')} ariaLabel={`${title} — ${t('app.about.pages')}`} {links}>{#snippet trigger()}{title}{/snippet}</LinkSelect></h1>

<style>
  h1{min-width:0;margin:0;font-size:15px;font-weight:600;color:var(--ui-color-ink-muted)}
</style>
