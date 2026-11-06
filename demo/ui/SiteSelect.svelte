<script>
  // The logo as a select: the input sites of this family, then the wider gallery. The current
  // site's row leads where the logo always led. Arrow keys, Home and End move, Escape closes and
  // returns the focus; the menu's keys stay in it so the page's shortcuts do not act behind it.
  import Icon from './Icon.svelte'

  /** @type {{ title: string, label: string, more: string, locale?: string, href: string, compact?: boolean }} */
  let { title, label, more, locale = 'en', href, compact = false } = $props()

  const SITES = [
    { id: 'tangut', name: 'Tangut Input', href: 'https://tangut.mkpo.li/', logo: '/brand/tangut-input.svg' },
    { id: 'jurchen', name: 'Jurchen Input', href: 'https://jurchen.mkpo.li/', logo: '/brand/jurchen-input.svg' },
    { id: 'han', name: 'Han Input', href: 'https://han.mkpo.li/', logo: '/brand/han-input.svg' },
    { id: 'ids', name: 'IDS Workshop', href: '', logo: '/brand/ids-workshop.svg' },
  ]
  const GALLERY = ['ja', 'zh-Hans', 'zh-Hant', 'ko']
  const gallery = $derived(`https://moji.mkpo.li/${GALLERY.includes(locale) ? `${locale}/` : ''}`)

  let open = $state(false)
  /** @type {HTMLElement | undefined} */ let root = $state()
  /** @type {HTMLButtonElement | undefined} */ let trigger = $state()
  const items = () => /** @type {HTMLElement[]} */ ([...(root?.querySelectorAll('[role="menuitem"]') ?? [])])

  function show() {
    open = true
    requestAnimationFrame(() => /** @type {HTMLElement | null | undefined} */ (root?.querySelector('[aria-current]'))?.focus())
  }
  /** @param {boolean} [refocus] */
  function hide(refocus = false) {
    open = false
    if (refocus) trigger?.focus()
  }
  /** @param {KeyboardEvent} event */
  function triggerKey(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); show() }
  }
  /** @param {KeyboardEvent} event */
  function menuKey(event) {
    event.stopPropagation()
    const list = items()
    const at = list.indexOf(/** @type {HTMLElement} */ (document.activeElement))
    if (event.key === 'Escape') { event.preventDefault(); hide(true) }
    else if (event.key === 'Tab') hide()
    else if (event.key === ' ') { event.preventDefault(); list[at]?.click() }
    else {
      const to = /** @type {Record<string, number>} */ ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 })[event.key]
      if (to === undefined) return
      event.preventDefault()
      list[(to + list.length) % list.length].focus()
    }
  }

  $effect(() => {
    if (!open) return
    /** @param {Event} event */
    const away = event => { if (root && !event.composedPath().includes(root)) hide() }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  })
</script>

<div class="site-select" bind:this={root}>
  <button bind:this={trigger} type="button" class="trigger" aria-haspopup="menu" aria-expanded={open} aria-label={`${title} — ${label}`}
    onclick={() => open ? hide() : show()} onkeydown={triggerKey}>
    <svg viewBox="2.5 2.5 19 19" width="30" height="30" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="var(--ui-color-accent)" /><path d="M7 7h4v10H7zM13 7h4v4h-4zM13 13h4v4h-4z" fill="var(--ui-color-on-accent)" /></svg>
    <span class="name" class:compact>{title}</span>
    <span class="chev" class:up={open}><Icon name="chevron" size={14} /></span>
  </button>
  {#if open}
    <div class="ui-menu menu" role="menu" tabindex="-1" aria-label={label} onkeydown={menuKey}>
      {#each SITES as site (site.id)}
        {@const current = site.id === 'ids'}
        <a class="ui-menu-item item" role="menuitem" tabindex="-1" href={current ? href : site.href}
          aria-current={current ? 'true' : undefined} onclick={() => hide(current)}>
          <img src={site.logo} alt="" width="28" height="28" />
          <span class="site">{site.name}</span>
          {#if current}<span class="tick"><Icon name="check" size={16} /></span>{/if}
        </a>
      {/each}
      <div class="ui-menu-separator" role="separator"></div>
      <a class="ui-menu-item item more" role="menuitem" tabindex="-1" href={gallery} onclick={() => hide()}>
        <span class="site">{more}</span>
        <span class="out" aria-hidden="true">↗</span>
      </a>
    </div>
  {/if}
</div>

<style>
  .site-select{position:relative;flex:none}
  .trigger{display:flex;align-items:center;gap:8px;margin:-4px -6px;padding:4px 6px;border:0;border-radius:var(--ui-radius-md);background:none;color:var(--ui-color-ink);
    font:inherit;font-weight:650;font-size:15px;white-space:nowrap;cursor:pointer}
  .trigger:hover{background:var(--ui-color-surface-hover)}
  .trigger:focus-visible{outline:var(--ui-ring-width) solid var(--ui-color-focus);outline-offset:1px}
  .trigger svg{flex:none}
  .chev{display:grid;place-items:center;color:var(--ui-color-ink-muted);transition:transform var(--ui-duration-fast)}
  .chev.up{transform:rotate(180deg)}
  .menu{position:absolute;z-index:var(--ui-z-menu);top:calc(100% + var(--ui-space-md));left:-6px;inline-size:max-content;min-inline-size:240px;max-inline-size:calc(100vw - 24px)}
  .item{text-decoration:none;font-size:var(--ui-text-md)}
  .item img{flex:none;border-radius:6px}
  .item[aria-current]::before{display:none}
  .site{flex:1;min-width:0}
  .tick{display:grid;color:var(--ui-color-accent)}
  .more{color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm)}
  .out{color:var(--ui-color-ink-muted)}
  @media (max-width:640px){.name.compact{display:none}}
  @media (prefers-reduced-motion:reduce){.chev{transition:none}}
</style>
