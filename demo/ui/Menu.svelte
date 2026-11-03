<script module>
  /** @typedef {{ label: string, icon?: string, shortcut?: string, hint?: string, disabled?: boolean, checked?: boolean, lang?: string, leading?: string, sequence?: string, note?: string, reading?: string, readingLang?: string, unencoded?: boolean, drawing?: { d: string }, run?: () => void, submenu?: Item[] } | { heading: string } | { separator: true }} Item */
</script>

<script>
  // A menu behind a button: items with an optional icon, a shortcut on the right, and a separator
  // or a heading between groups. A rich item leads with a character or a root operator and ends
  // with a note, as the examples menu does with a code point; its sequence keeps the IDS written
  // with the IDC characters. Arrow keys move, Escape closes and gives the focus back.
  import { tick, untrack } from 'svelte'
  import Icon from './Icon.svelte'

  import KeyHint from './KeyHint.svelte'
  /** @type {{ label: string, icon?: string, items: Item[], align?: 'start' | 'end', text?: boolean, keyHints?: boolean, keys?: string[], ariaLabel?: string, wide?: boolean, compact?: boolean,
   * open?: boolean, menubar?: boolean, tabIndex?: number, onopenchange?: (open: boolean) => void, onfocus?: () => void, onhover?: () => void, onmove?: (key: string) => void,
   * view?: { list: string, cards: string, cardsSelected: boolean, onchange: (cards: boolean) => void } | null }} */
  let { label, icon, items, align = 'start', text = true, keyHints = true, keys, ariaLabel, wide = false, compact = false,
    open = $bindable(false), menubar = false, tabIndex, onopenchange, onfocus, onhover, onmove, view = null } = $props()
  /** @type {HTMLElement | null} */ let box = $state(null)
  /** @type {HTMLButtonElement | null} */ let trigger = $state(null)
  const uid = $props.id()
  /** @param {boolean} next */
  function setOpen(next) { open = next; onopenchange?.(next) }
  const enabled = () => /** @type {HTMLElement[]} */ ([...(box?.querySelectorAll(':is([role="menuitem"],[role="menuitemradio"]):not([disabled])') ?? [])])
  // The examples menu filters by a query and by the code-point state, and folds whole sections
  // away; menus without a `view` keep the plain list.
  let query = $state('')
  /** @type {'all' | 'encoded' | 'unencoded'} */
  let mode = $state('all')
  /** @type {Set<string>} */
  let collapsed = $state(new Set())
  let active = $state('')
  // The label of the one submenu shown inline, or ''.
  // The index of the one submenu shown inline, or -1.
  let openSubmenu = $state(-1)
  $effect(() => { if (!open) openSubmenu = -1 })
  const filtering = $derived(query.trim().length > 0 || mode !== 'all')
  /** @param {Item} item */
  function matches(item) {
    if ('heading' in item || 'separator' in item) return true
    if (mode === 'encoded' && item.unencoded) return false
    if (mode === 'unencoded' && !item.unencoded) return false
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return [item.sequence, item.label, item.leading, item.reading, item.note].filter(Boolean).join(' ').toLowerCase().includes(needle)
  }
  const visible = $derived(items.filter(matches))
  // Cards keep the headings of the list; separators have no place in a grid.
  const groups = $derived.by(() => {
    /** @type {{ heading: string, items: Item[] }[]} */
    const out = []
    let group = { heading: '', items: /** @type {Item[]} */ ([]) }
    for (const item of visible) {
      if ('heading' in item) {
        if (group.items.length) out.push(group)
        group = { heading: item.heading, items: [] }
      } else if (!('separator' in item)) group.items.push(item)
    }
    if (group.items.length) out.push(group)
    return out
  })
  /** @param {string} heading */
  const expanded = heading => filtering || !collapsed.has(heading)
  /** @param {string} heading */
  function toggle(heading) {
    const next = new Set(collapsed)
    if (next.has(heading)) next.delete(heading)
    else next.add(heading)
    collapsed = next
  }
  /** @param {string} heading */
  function jump(heading) {
    const list = groups.filter(group => group.heading)
    const at = list.findIndex(group => group.heading === heading)
    const buttons = box?.querySelectorAll('button.heading') ?? []
    const target = /** @type {HTMLElement | undefined} */ (buttons[at])
    // The chip row wraps, so the sticky head is taller than the fixed margin allows for. Measure it.
    if (target && box) {
      target.style.scrollMarginTop = `${box.querySelector('.menu-head')?.getBoundingClientRect().height ?? 0}px`
      target.scrollIntoView({ block: 'start' })
      target.style.scrollMarginTop = ''
    }
    active = heading
  }
  // The chip of the section at the top of the scrollport is marked.
  $effect(() => {
    const menu = box
    if (!open || !menu || !view) return
    const update = () => {
      const headings = [...menu.querySelectorAll('button.heading')]
      const head = menu.querySelector('.menu-head')
      const top = menu.getBoundingClientRect().top + (head?.getBoundingClientRect().height ?? 0) + 4
      let current = ''
      if (menu.scrollHeight > menu.clientHeight + 4 && menu.scrollTop + menu.clientHeight >= menu.scrollHeight - 4) {
        current = /** @type {HTMLElement | undefined} */ (headings.at(-1))?.dataset.heading ?? ''
      }
      if (!current) {
        for (const button of headings) {
          if (button.getBoundingClientRect().top <= top) current = /** @type {HTMLElement} */ (button).dataset.heading ?? current
        }
      }
      if (!current) current = groups.find(group => group.heading)?.heading ?? ''
      if (current === untrack(() => active)) return
      active = current
      const at = groups.filter(group => group.heading).findIndex(group => group.heading === current)
      const chip = /** @type {HTMLElement | undefined} */ (menu.querySelectorAll('.chip')[at])
      const row = chip?.parentElement
      if (chip && row) {
        const chipRect = chip.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        if (chipRect.left < rowRect.left) row.scrollLeft -= rowRect.left - chipRect.left
        else if (chipRect.right > rowRect.right) row.scrollLeft += chipRect.right - rowRect.right
      }
    }
    update()
    menu.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(menu)
    return () => { menu.removeEventListener('scroll', update); observer.disconnect() }
  })
  /** @param {boolean} [focus] @param {boolean} [last] */
  async function show(focus = false, last = false) {
    query = ''
    mode = 'all'
    collapsed = new Set()
    openSubmenu = -1
    setOpen(true)
    if (focus) { await tick(); if (open) enabled().at(last ? -1 : 0)?.focus() }
  }
  function hide() { openSubmenu = -1; setOpen(false); trigger?.focus() }
  /** Open one submenu inline, keep it in the menu's scrollport, and optionally take its first item. @param {number} i @param {boolean} [focus] */
  async function expand(i, focus = false) {
    openSubmenu = i
    await tick()
    const group = /** @type {HTMLElement | null} */ (box?.querySelector('.submenu'))
    if (!group) return
    group.scrollIntoView({ block: 'nearest' })
    if (focus) /** @type {HTMLElement | null} */ (group.querySelector('[role="menuitem"]:not([disabled])'))?.focus()
  }
  /** @param {number} i */
  function toggleSubmenu(i) {
    if (openSubmenu === i) openSubmenu = -1
    else void expand(i)
  }
  /** Focus a menubar entry, optionally opening its menu. @param {boolean} [expand] */
  export function focus(expand = false) { trigger?.focus(); if (expand) show(true) }
  // A wide menu can start left of the window when its trigger sits near that edge, as a short
  // locale label or a narrow desktop can put it. Shift the open menu back inside the window.
  $effect(() => {
    const menu = box
    if (!open || !menu) return
    const pad = 8
    /** @param {DOMRect} rect */
    const shift = rect => rect.left < pad ? pad - rect.left : rect.right > innerWidth - pad ? innerWidth - pad - rect.right : 0
    const place = () => {
      menu.style.transform = ''
      const dx = shift(menu.getBoundingClientRect())
      menu.style.transform = dx ? `translateX(${dx}px)` : ''
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(menu)
    addEventListener('resize', place)
    return () => { observer.disconnect(); removeEventListener('resize', place); menu.style.transform = '' }
  })
  /** @param {KeyboardEvent} event */
  function key(event) {
    if (event.target instanceof HTMLInputElement && event.key !== 'Escape') return
    const all = enabled()
    const at = all.indexOf(/** @type {HTMLElement} */ (document.activeElement))
    if (event.key === 'ArrowLeft' && openSubmenu >= 0) {
      const parent = /** @type {HTMLElement | null} */ (box?.querySelector('.submenu-item[aria-expanded="true"]'))
      const group = box?.querySelector('.submenu')
      if (parent === document.activeElement || group?.contains(document.activeElement)) {
        event.preventDefault()
        openSubmenu = -1
        parent?.focus()
        return
      }
      openSubmenu = -1
    }
    if (event.key === 'ArrowRight' && openSubmenu >= 0 && box?.querySelector('.submenu')?.contains(document.activeElement)) {
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (openSubmenu >= 0) {
        const parent = /** @type {HTMLElement | null} */ (box?.querySelector('.submenu-item[aria-expanded="true"]'))
        openSubmenu = -1
        parent?.focus()
      } else hide()
      return
    }
    else if (event.key === 'ArrowDown') { event.preventDefault(); all[(at + 1) % all.length]?.focus() }
    else if (event.key === 'ArrowUp') { event.preventDefault(); all[(at - 1 + all.length) % all.length]?.focus() }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); all.at(event.key === 'End' ? -1 : 0)?.focus() }
    else if (menubar && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); onmove?.(event.key) }
    else if (event.key === 'Tab') { trigger?.focus(); setOpen(false) }
  }
</script>

<svelte:window onpointerdown={event => { if (open && !trigger?.parentElement?.contains(/** @type {Node} */ (event.target))) setOpen(false) }}
  onfocusin={event => { if (open && !trigger?.parentElement?.contains(/** @type {Node} */ (event.target))) setOpen(false) }} />

{#snippet groupHeading(heading, count)}
  <button type="button" class="heading" data-heading={heading} aria-expanded={expanded(heading)} aria-label={`${heading}, ${count}`} onclick={() => toggle(heading)}>
    <Icon name="chevron" size={12} /><span class="heading-name">{heading}</span><span class="count" aria-hidden="true">{count}</span>
  </button>
{/snippet}

{#snippet cardItem(item)}
  <button type="button" role="menuitem" class="card" disabled={item.disabled}
    aria-label={item.sequence !== undefined && item.reading === undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
    title={item.hint} onclick={() => { hide(); item.run?.() }}>
    {#if item.drawing?.d || item.drawing?.emoji?.length}
      <svg class="card-art" viewBox="0 0 1000 1000" aria-hidden="true">
        {#if item.drawing.d}<path d={item.drawing.d} />{/if}
        {#each item.drawing.emoji ?? [] as text}
          <text x={text.box[0] + text.box[2] / 2} y={text.box[1] + text.box[3] / 2} text-anchor="middle" dominant-baseline="central"
            font-size={Math.max(0, Math.min(text.box[2], text.box[3]) * 0.85)}
            font-family="system-ui, sans-serif">{text.text}</text>
        {/each}
      </svg>
    {:else}
      <span class="card-glyph" lang={item.lang}>{item.leading ?? item.sequence ?? item.label}</span>
    {/if}
    <span class="card-text">
      {#if item.reading !== undefined && item.leading !== undefined}<span class="sr" lang={item.lang}>{item.leading}</span>{/if}
      <span class="card-label" lang={item.lang}>{item.sequence ?? item.label}</span>
      {#if item.note !== undefined || item.reading !== undefined}<span class="card-note" class:unencoded={item.unencoded}>{#if item.reading !== undefined}<span lang={item.readingLang}>{item.reading}</span>{' · '}{/if}{item.note}</span>{/if}
    </span>
  </button>
{/snippet}

<!-- Inline disclosure: the trigger uses aria-expanded and aria-controls for the group, which is
     not a popup, so it carries no aria-haspopup. -->
{#snippet submenuRow(item, i)}
  {@const open = openSubmenu === i}
  <button type="button" role="menuitem" class="item submenu-item" aria-expanded={open} aria-controls={open ? `${uid}-sub-${i}` : undefined}
    disabled={item.disabled} onclick={() => toggleSubmenu(i)}
    onkeydown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); void expand(i, true) } }}>
    <span class="mark">{#if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
    <span class="label">{item.label}</span>
    <span class="chev" class:open><Icon name="chevron" size={14} /></span>
  </button>
  {#if open}
    <div class="submenu" id={`${uid}-sub-${i}`} role="group" aria-label={item.label}>
      {#each item.submenu as sub, j (j)}
        {#if 'separator' in sub}<div class="sep" role="separator"></div>
        {:else if 'heading' in sub}<p class="heading">{sub.heading}</p>
        {:else}{@render listRow(sub)}{/if}
      {/each}
    </div>
  {/if}
{/snippet}

{#snippet listRow(item)}
  <button type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} class="item"
    class:rich={item.sequence !== undefined} disabled={item.disabled}
    aria-label={item.sequence !== undefined && item.reading === undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
    title={item.hint} onclick={() => { hide(); item.run?.() }}>
    {#if item.leading !== undefined}
      <span class="leading" lang={item.lang}>{item.leading}</span>
    {:else if item.sequence !== undefined}
      <span class="leading spacer" aria-hidden="true"></span>
    {:else}
      <span class="mark">{#if item.checked}<Icon name="check" size={14} />{:else if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
    {/if}
    <span class="label" lang={item.lang}>{item.sequence ?? item.label}</span>
    {#if item.note !== undefined || item.reading !== undefined}<span class="note" class:unencoded={item.unencoded}>{#if item.reading !== undefined}<span lang={item.readingLang}>{item.reading}</span>{' · '}{/if}{item.note}</span>{/if}
    {#if item.shortcut && keyHints}<kbd>{item.shortcut}</kbd>{/if}
  </button>
{/snippet}

<div class="menu-wrap">
  <button type="button" class="ui-button" class:menubar class:is-on={open} class:key-hint={Boolean(keys?.length)} bind:this={trigger} role={menubar ? 'menuitem' : undefined} tabindex={tabIndex} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${uid}-menu` : undefined}
    title={label} aria-label={ariaLabel ?? (text ? undefined : label)} onclick={() => open ? setOpen(false) : show(true)} {onfocus} onpointerenter={onhover}
    onkeydown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(true, event.key === 'ArrowUp') }
      else if (menubar && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); onmove?.(event.key) }
      else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); hide() }
      else if (event.key === 'Tab') setOpen(false)
    }}>
    {#if icon}<Icon name={icon} />{/if}{#if text}<span>{label}</span>{/if}{#if !menubar}<Icon name="chevron" size={14} />{/if}{#if keys?.length}<KeyHint combos={keys} />{/if}
  </button>
  {#if open}
    <div class="menu" class:end={align === 'end'} class:wide class:compact role="menu" id={`${uid}-menu`} tabindex="-1" aria-label={label} bind:this={box} onkeydown={key}
      onfocusin={event => {
        if (openSubmenu < 0) return
        const parent = box?.querySelector('.submenu-item[aria-expanded="true"]')
        const group = box?.querySelector('.submenu')
        if (parent !== event.target && !group?.contains(/** @type {Node} */ (event.target))) openSubmenu = -1
      }}>
      {#if view}
        <div class="menu-head">
          <div class="views" role="group" aria-label={label}>
            <button type="button" class="view" role="menuitemradio" aria-checked={!view.cardsSelected} onclick={() => view?.onchange(false)}><Icon name="list" size={13} /><span>{view.list}</span></button>
            <button type="button" class="view" role="menuitemradio" aria-checked={view.cardsSelected} onclick={() => view?.onchange(true)}><Icon name="grid" size={13} /><span>{view.cards}</span></button>
          </div>
          <div class="filter">
            <input class="ui-input filter-input" type="search" placeholder={view.filter.label} aria-label={view.filter.label} bind:value={query}
              onkeydown={event => { if (event.key !== 'Escape') event.stopPropagation() }} />
            <div class="modes" role="group" aria-label={view.filter.label}>
              {#each [['all', view.filter.all], ['encoded', view.filter.encoded], ['unencoded', view.filter.unencoded]] as [key, text] (key)}
                <button type="button" class="mode" role="menuitemradio" aria-checked={mode === key} onclick={() => { mode = key }}>{text}</button>
              {/each}
            </div>
          </div>
          <div class="jump" role="group" aria-label={label}>
            {#each groups as group (group.heading)}
              {#if group.heading}<button type="button" class="chip" aria-current={active === group.heading ? 'true' : undefined} onclick={() => jump(group.heading)}>{group.heading}</button>{/if}
            {/each}
          </div>
        </div>
      {/if}
      {#if view && !groups.length}
        <p class="empty">{view.filter.empty}</p>
      {:else if view?.cardsSelected}
        {#each groups as group (group.heading)}
          {#if group.heading}{@render groupHeading(group.heading, group.items.length)}{/if}
          {#if expanded(group.heading)}<div class="cards">{#each group.items as item (item.sequence ?? item.label)}{@render cardItem(item)}{/each}</div>{/if}
        {/each}
      {:else if view}
        {#each groups as group (group.heading)}
          {#if group.heading}{@render groupHeading(group.heading, group.items.length)}{/if}
          {#if expanded(group.heading)}{#each group.items as item (item.sequence ?? item.label)}{@render listRow(item)}{/each}{/if}
        {/each}
      {:else}
        {#each items as item, i (i)}
          {#if 'separator' in item}<div class="sep" role="separator"></div>
          {:else if 'heading' in item}<p class="heading">{item.heading}</p>
          {:else if 'submenu' in item && item.submenu}{@render submenuRow(item, i)}
          {:else}{@render listRow(item)}{/if}
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .ui-button.menubar{padding:0 var(--ui-space-sm);border-color:transparent;background:none;border-radius:var(--ui-radius-sm);color:var(--ui-color-ink-muted)}
  .ui-button.menubar:is(:hover,:focus-visible,.is-on){color:var(--ui-color-ink)}
  .menu-wrap{position:relative}
  .menu{position:absolute;z-index:var(--ui-z-menu);top:calc(100% + var(--ui-space-xs));left:0;min-width:220px;max-width:min(340px,calc(100vw - var(--ui-space-4xl)));max-height:min(70vh,520px);overflow:auto;
    padding:var(--ui-space-xs);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xl);background:var(--ui-color-surface);box-shadow:var(--ui-shadow-2)}
  .menu.wide{width:min(960px,calc(100vw - 48px));max-width:min(960px,calc(100vw - 48px));max-height:min(82vh,760px)}
  @media (min-width:1500px){.menu.wide{width:min(1280px,calc(100vw - 96px));max-width:min(1280px,calc(100vw - 96px))}}
  .menu.compact{min-width:150px;padding:var(--ui-space-2xs)}
  .menu.compact .item{gap:var(--ui-space-sm);padding:var(--ui-space-2xs) var(--ui-space-sm);border-radius:var(--ui-radius-sm);font-size:var(--ui-text-sm)}
  .menu.compact .mark{width:14px}
  @media (max-width:1000px){.menu.wide{left:auto;right:0}}
  .menu.end{left:auto;right:0}
  .item{display:flex;align-items:center;gap:var(--ui-space-md);width:100%;padding:var(--ui-space-xs) var(--ui-space-md);border:0;border-radius:var(--ui-radius-md);background:none;color:var(--ui-color-ink);font:inherit;font-size:var(--ui-text-md);text-align:left;cursor:pointer}
  .item.rich{min-height:52px;gap:var(--ui-space-md);padding:var(--ui-space-2xs) var(--ui-space-sm);border-radius:var(--ui-radius-lg)}
  .item:not(:disabled):is(:hover,:focus-visible){background:var(--ui-color-surface-hover);outline:none}
  .item.rich:focus-visible{outline:var(--ui-ring-width) solid var(--ui-color-focus);outline-offset:calc(-1 * var(--ui-ring-width))}
  .item:disabled{opacity:var(--ui-disabled-opacity);cursor:not-allowed}
  .item.submenu-item .chev{display:grid;place-items:center;flex:none;color:var(--ui-color-ink-muted);transform:rotate(-90deg);transition:transform var(--ui-duration-fast)}
  .item.submenu-item .chev.open{transform:none}
  .submenu{margin:0 0 var(--ui-space-2xs) 26px;padding:var(--ui-space-3xs) 0 var(--ui-space-3xs) var(--ui-space-xs);border-left:1px solid var(--ui-color-border)}
  .submenu .item{padding:var(--ui-space-xs) var(--ui-space-sm);border-radius:var(--ui-radius-sm);font-size:var(--ui-text-sm)}
  .submenu .sep{margin:var(--ui-space-2xs) var(--ui-space-3xs)}
  .mark{display:grid;place-items:center;width:16px;color:var(--ui-color-ink-muted)}
  .leading{display:grid;place-items:center;flex:none;width:40px;height:40px;color:var(--ui-color-ink);font-family:var(--cjk);font-size:26px;line-height:1}
  .leading.spacer{visibility:hidden}
  .label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .label:is(:lang(ja),:lang(txg),:lang(swi)){font-family:var(--cjk)}
  .item.rich .label{overflow:visible;text-overflow:clip;white-space:normal;line-height:1.35;word-break:break-word}
  .note{flex:none;color:var(--ui-color-ink-muted);font:var(--ui-weight-medium) var(--ui-text-2xs)/var(--ui-leading-normal) var(--ui-font-mono);letter-spacing:.02em;white-space:nowrap}
  .note.unencoded{font:inherit;font-size:var(--ui-text-xs);font-style:italic}
  kbd{color:var(--ui-color-ink-muted);font:var(--ui-weight-medium) var(--ui-text-2xs) var(--ui-font-mono)}
  .sep{height:1px;margin:var(--ui-space-2xs);background:var(--ui-color-border)}
  .heading{display:flex;align-items:center;gap:var(--ui-space-2xs);width:calc(100% - 2 * var(--ui-space-md));margin:var(--ui-space-sm) var(--ui-space-md) var(--ui-space-3xs);padding:0;border:0;background:none;
    color:var(--ui-color-ink-muted);font:inherit;font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-bold);letter-spacing:.07em;text-transform:uppercase;text-align:left;cursor:pointer;scroll-margin-top:92px}
  .heading:first-child{margin-top:var(--ui-space-2xs)}
  .heading svg{flex:none;transition:transform var(--ui-duration-fast)}
  .heading[aria-expanded="false"] svg{transform:rotate(-90deg)}
  .heading:hover{color:var(--ui-color-ink)}
  .heading:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:1px}
  .heading-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .count{flex:none;margin-left:auto;padding:1px var(--ui-space-xs);border-radius:var(--ui-radius-pill);background:var(--ui-color-surface-hover);color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-semibold);letter-spacing:.02em;font-variant-numeric:tabular-nums}
  .empty{margin:var(--ui-space-lg) var(--ui-space-md);color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm)}
  .jump{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs);padding:1px 1px var(--ui-space-3xs)}
  .chip{flex:none;min-height:var(--ui-control-h-xs);padding:0 var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-pill);background:var(--ui-color-surface);color:var(--ui-color-ink-muted);
    font:inherit;font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-semibold);white-space:nowrap;cursor:pointer}
  .chip:hover{color:var(--ui-color-ink);border-color:var(--ui-color-ink)}
  .chip[aria-current="true"]{border-color:var(--ui-color-ink);background:var(--ui-color-ink);color:var(--ui-color-surface)}
  .chip:focus-visible,.mode:focus-visible,.view:focus-visible{outline-offset:calc(-1 * var(--ui-ring-width))}
  .menu-head{position:sticky;top:calc(-1 * var(--ui-space-xs));z-index:2;display:flex;flex-direction:column;gap:var(--ui-space-xs);margin:0 0 var(--ui-space-xs);background:var(--ui-color-surface)}
  .views{display:flex;gap:var(--ui-space-3xs);padding:var(--ui-space-3xs);border-radius:var(--ui-radius-md);background:var(--ui-color-surface)}
  .filter{display:flex;align-items:center;gap:var(--ui-space-xs)}
  .filter-input{flex:1}
  .modes{display:flex;flex:none;gap:var(--ui-space-3xs);padding:var(--ui-space-3xs);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-hover)}
  .mode{min-height:var(--ui-control-h-xs);padding:0 var(--ui-space-xs);border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink-muted);font:inherit;font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-semibold);white-space:nowrap;cursor:pointer}
  .mode[aria-checked="true"]{background:var(--ui-color-surface);color:var(--ui-color-ink)}
  .view{display:flex;align-items:center;justify-content:center;gap:var(--ui-space-2xs);flex:1;min-height:var(--ui-control-h-xs);padding:0 var(--ui-space-sm);border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink-muted);
    font:inherit;font-size:var(--ui-text-xs);font-weight:var(--ui-weight-semibold);cursor:pointer}
  .view[aria-checked="true"]{background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:var(--ui-space-sm);padding:var(--ui-space-2xs) var(--ui-space-xs) var(--ui-space-sm)}
  .card{display:flex;align-items:center;gap:var(--ui-space-sm);min-width:0;min-height:60px;padding:var(--ui-space-xs);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface);color:var(--ui-color-ink);font:inherit;text-align:left;cursor:pointer}
  .card:not(:disabled):is(:hover,:focus-visible){background:var(--ui-color-surface-hover)}
  .card:focus-visible{outline-offset:calc(-1 * var(--ui-ring-width))}
  .card:disabled{opacity:var(--ui-disabled-opacity);cursor:not-allowed}
  .card-art{display:block;flex:none;width:46px;height:46px;color:var(--ui-color-ink)}
  .card-art path{fill:currentColor}
  .card-glyph{display:block;flex:none;width:46px;height:46px;overflow:hidden;font-family:var(--cjk);font-size:25px;line-height:46px;color:var(--ui-color-ink);text-align:center;white-space:nowrap;text-overflow:ellipsis}
  .card-text{display:flex;flex:1;flex-direction:column;gap:var(--ui-space-3xs);min-width:0}
  .card-label{font-family:var(--cjk);font-size:var(--ui-text-2xs);line-height:1.35;color:var(--ui-color-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note{color:var(--ui-color-ink-muted);font:var(--ui-weight-medium) var(--ui-text-2xs)/1.4 var(--ui-font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note.unencoded{font:inherit;font-size:var(--ui-text-2xs);font-style:italic}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>
