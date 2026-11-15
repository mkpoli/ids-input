<script>
  // The logo as a select: the input sites of this family and the glyph reader served beside this
  // site at /ocr/, then the wider gallery. The current site's row leads where the logo always led.
  import LinkSelect from './LinkSelect.svelte'

  /** @type {{ title: string, label: string, more: string, locale?: string, href: string, compact?: boolean }} */
  let { title, label, more, locale = 'en', href, compact = false } = $props()

  const SITES = [
    { id: 'tangut', name: 'Tangut Input', href: 'https://tangut.mkpo.li/', logo: '/brand/tangut-input.svg' },
    { id: 'jurchen', name: 'Jurchen Input', href: 'https://jurchen.mkpo.li/', logo: '/brand/jurchen-input.svg' },
    { id: 'han', name: 'Han Input', href: 'https://han.mkpo.li/', logo: '/brand/han-input.svg' },
    { id: 'ids', name: 'IDS Workshop', href: '', logo: '/brand/ids-workshop.svg' },
    { id: 'han2ids', name: 'han2ids', href: '/ocr/', logo: '/brand/han2ids.svg' },
  ]
  const GALLERY = ['ja', 'zh-Hans', 'zh-Hant', 'ko']
  const gallery = $derived(`https://moji.mkpo.li/${GALLERY.includes(locale) ? `${locale}/` : ''}`)
  /** @type {import('./LinkSelect.svelte').Link[]} */
  const links = $derived([
    ...SITES.map(site => ({ href: site.id === 'ids' ? href : site.href, label: site.name, logo: site.logo, current: site.id === 'ids' ? 'true' : undefined })),
    { separator: true },
    { href: gallery, label: more, out: true },
  ])
</script>

<div class="site-select">
  <LinkSelect {label} ariaLabel={`${title} — ${label}`} {links}>
    {#snippet trigger()}
      <svg viewBox="2.5 2.5 19 19" width="30" height="30" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="var(--ui-color-accent)" /><path d="M7 7h4v10H7zM13 7h4v4h-4zM13 13h4v4h-4z" fill="var(--ui-color-on-accent)" /></svg>
      <span class="name" class:compact>{title}</span>
    {/snippet}
  </LinkSelect>
</div>

<style>
  .site-select{flex:none;color:var(--ui-color-ink);font-weight:650;font-size:15px}
  svg{flex:none}
  @media (max-width:640px){.name.compact{display:none}}
</style>
