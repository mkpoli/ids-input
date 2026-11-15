<script>
  // A page's title as a select: the workshop, then every page beside it, this one ticked.
  import LinkSelect from './LinkSelect.svelte'
  import { pages } from '../lib/pages.js'

  /** @type {{ title: string, page: string, t: (key: string) => string, home: string, query: string }} */
  let { title, page, t, home, query } = $props()
  /** @type {import('./LinkSelect.svelte').Link[]} */
  const links = $derived([
    { href: `${home}${query}`, label: t('sources.back'), icon: 'pencil' },
    { separator: true },
    ...pages(t).map(entry => ({ href: `./${entry.id}.html${query}`, label: entry.label, icon: entry.icon, current: entry.id === page ? 'page' : undefined })),
  ])
</script>

<div class="page-select"><LinkSelect label={t('app.about.pages')} {links} heading>{#snippet trigger()}{title}{/snippet}</LinkSelect></div>

<style>
  .page-select{min-width:0;font-size:15px;font-weight:600;color:var(--ui-color-ink-muted)}
</style>
