<script module>
  /** @typedef {{ href: string, label: string, current?: boolean, logo?: string, out?: boolean } | { separator: true }} Link */
</script>

<script>
  // A button that opens a list of links, the current one ticked. Opening focuses the current row;
  // arrow keys, Home and End move, Escape closes and returns the focus; the menu's keys stay in it
  // so the page's shortcuts do not act behind it.
  import Icon from './Icon.svelte'

  /** @type {{ label: string, ariaLabel: string, links: Link[], trigger: import('svelte').Snippet }} */
  let { label, ariaLabel, links, trigger: content } = $props()

  let open = $state(false)
  /** @type {HTMLElement | undefined} */ let root = $state()
  /** @type {HTMLButtonElement | undefined} */ let trigger = $state()
  const items = () => /** @type {HTMLElement[]} */ ([...(root?.querySelectorAll('[role="menuitem"]') ?? [])])

  function show() {
    open = true
    requestAnimationFrame(() => /** @type {HTMLElement | null | undefined} */ (root?.querySelector('[aria-current]') ?? root?.querySelector('[role="menuitem"]'))?.focus())
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

<div class="link-select" bind:this={root}>
  <button bind:this={trigger} type="button" class="trigger" aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel}
    onclick={() => open ? hide() : show()} onkeydown={triggerKey}>
    {@render content()}
    <span class="chev" class:up={open}><Icon name="chevron" size={14} /></span>
  </button>
  {#if open}
    <div class="ui-menu menu" role="menu" tabindex="-1" aria-label={label} onkeydown={menuKey}>
      {#each links as link, at (at)}
        {#if 'separator' in link}
          <div class="ui-menu-separator" role="separator"></div>
        {:else}
          <a class="ui-menu-item item" class:out={link.out} role="menuitem" tabindex="-1" href={link.href}
            aria-current={link.current ? 'page' : undefined} onclick={() => hide(link.current)}>
            {#if link.logo}<img src={link.logo} alt="" width="28" height="28" />{/if}
            <span class="label">{link.label}</span>
            {#if link.current}<span class="tick"><Icon name="check" size={16} /></span>{/if}
            {#if link.out}<span aria-hidden="true">↗</span>{/if}
          </a>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .link-select{position:relative;flex:none;min-width:0}
  .trigger{display:flex;align-items:center;gap:8px;margin:-4px -6px;padding:4px 6px;border:0;border-radius:var(--ui-radius-md);background:none;color:inherit;
    font:inherit;white-space:nowrap;cursor:pointer}
  .trigger:hover{background:var(--ui-color-surface-hover)}
  .trigger:focus-visible{outline:var(--ui-ring-width) solid var(--ui-color-focus);outline-offset:1px}
  .chev{display:grid;place-items:center;color:var(--ui-color-ink-muted);transition:transform var(--ui-duration-fast)}
  .chev.up{transform:rotate(180deg)}
  .menu{position:absolute;z-index:var(--ui-z-menu);top:calc(100% + var(--ui-space-md));left:-6px;inline-size:max-content;min-inline-size:240px;max-inline-size:calc(100vw - 24px)}
  .item{text-decoration:none;font-size:var(--ui-text-md);font-weight:400;color:var(--ui-color-ink)}
  .item img{flex:none;border-radius:6px}
  .item[aria-current]::before{display:none}
  .label{flex:1;min-width:0}
  .tick{display:grid;color:var(--ui-color-accent)}
  .out{color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm)}
  @media (prefers-reduced-motion:reduce){.chev{transition:none}}
</style>
