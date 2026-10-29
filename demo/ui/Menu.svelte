<script module>
  /** @typedef {{ label: string, icon?: string, shortcut?: string, hint?: string, disabled?: boolean, checked?: boolean, lang?: string, leading?: string, sequence?: string, note?: string, reading?: string, readingLang?: string, unencoded?: boolean, drawing?: { d: string }, run?: () => void } | { heading: string } | { separator: true }} Item */
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
   * view?: { list: string, cards: string, cardsSelected: boolean, onchange: (cards: boolean) => void } | null,
   * templates?: { heading: string, items: Item[] } | null }} */
  let { label, icon, items, align = 'start', text = true, keyHints = true, keys, ariaLabel, wide = false, compact = false,
    open = $bindable(false), menubar = false, tabIndex, onopenchange, onfocus, onhover, onmove, view = null, templates = null } = $props()
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
    target?.scrollIntoView({ block: 'start' })
    active = heading
  }
  // The chip of the section at the top of the scrollport is marked, and kept in view in its row.
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
    setOpen(true)
    if (focus) { await tick(); if (open) enabled().at(last ? -1 : 0)?.focus() }
  }
  function hide() { setOpen(false); trigger?.focus() }
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
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide() }
    else if (event.key === 'ArrowDown') { event.preventDefault(); all[(at + 1) % all.length]?.focus() }
    else if (event.key === 'ArrowUp') { event.preventDefault(); all[(at - 1 + all.length) % all.length]?.focus() }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); all.at(event.key === 'End' ? -1 : 0)?.focus() }
    else if (menubar && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); onmove?.(event.key) }
    else if (event.key === 'Tab') { trigger?.focus(); setOpen(false) }
  }
</script>

<svelte:window onpointerdown={event => { if (open && !trigger?.parentElement?.contains(/** @type {Node} */ (event.target))) setOpen(false) }}
  onfocusin={event => { if (open && !trigger?.parentElement?.contains(/** @type {Node} */ (event.target))) setOpen(false) }} />

{#snippet groupHeading(heading)}
  <button type="button" class="heading" data-heading={heading} aria-expanded={expanded(heading)} onclick={() => toggle(heading)}>
    <Icon name="chevron" size={12} /><span>{heading}</span>
  </button>
{/snippet}

{#snippet cardItem(item)}
  <button type="button" role="menuitem" class="card" disabled={item.disabled}
    aria-label={item.sequence !== undefined && item.reading === undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
    title={item.hint} onclick={() => { hide(); item.run?.() }}>
    {#if item.drawing?.d}
      <svg class="card-art" viewBox="0 0 1000 1000" aria-hidden="true"><path d={item.drawing.d} /></svg>
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
  <button type="button" class="tool" class:menubar class:on={open} class:key-hint={Boolean(keys?.length)} bind:this={trigger} role={menubar ? 'menuitem' : undefined} tabindex={tabIndex} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${uid}-menu` : undefined}
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
    <div class="menu" class:end={align === 'end'} class:wide class:compact role="menu" id={`${uid}-menu`} tabindex="-1" aria-label={label} bind:this={box} onkeydown={key}>
      {#if templates}
        <p class="heading">{templates.heading}</p>
        <div class="templates" role="group" aria-label={templates.heading}>
          {#each templates.items as item (item.label)}
            <button type="button" role="menuitem" class="template" title={item.hint ?? item.label} aria-label={item.label}
              onclick={() => { hide(); item.run?.() }}><span aria-hidden="true">{item.leading ?? item.label}</span></button>
          {/each}
        </div>
        <div class="sep" role="separator"></div>
      {/if}
      {#if view}
        <div class="menu-head">
          <div class="views" role="group" aria-label={label}>
            <button type="button" class="view" role="menuitemradio" aria-checked={!view.cardsSelected} onclick={() => view?.onchange(false)}><Icon name="list" size={13} /><span>{view.list}</span></button>
            <button type="button" class="view" role="menuitemradio" aria-checked={view.cardsSelected} onclick={() => view?.onchange(true)}><Icon name="grid" size={13} /><span>{view.cards}</span></button>
          </div>
          <div class="filter">
            <input class="filter-input" type="search" placeholder={view.filter.label} aria-label={view.filter.label} bind:value={query}
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
          {#if group.heading}{@render groupHeading(group.heading)}{/if}
          {#if expanded(group.heading)}<div class="cards">{#each group.items as item (item.sequence ?? item.label)}{@render cardItem(item)}{/each}</div>{/if}
        {/each}
      {:else if view}
        {#each groups as group (group.heading)}
          {#if group.heading}{@render groupHeading(group.heading)}{/if}
          {#if expanded(group.heading)}{#each group.items as item (item.sequence ?? item.label)}{@render listRow(item)}{/each}{/if}
        {/each}
      {:else}
        {#each items as item, i (i)}
          {#if 'separator' in item}<div class="sep" role="separator"></div>
          {:else if 'heading' in item}<p class="heading">{item.heading}</p>
          {:else}{@render listRow(item)}{/if}
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .tool.menubar{padding:0 8px;border-color:transparent;background:none;border-radius:6px;color:var(--muted)}
  .tool.menubar:is(:hover,:focus-visible,.on){color:var(--ink)}
  .menu-wrap{position:relative}
  .menu{position:absolute;z-index:40;top:calc(100% + 6px);left:0;min-width:220px;max-width:min(340px,calc(100vw - 32px));max-height:min(70vh,520px);overflow:auto;
    padding:6px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:var(--shadow-pop)}
  .menu.wide{width:min(960px,calc(100vw - 48px));max-width:min(960px,calc(100vw - 48px));max-height:min(82vh,760px)}
  @media (min-width:1500px){.menu.wide{width:min(1280px,calc(100vw - 96px));max-width:min(1280px,calc(100vw - 96px))}}
  .menu.compact{min-width:150px;padding:4px}
  .menu.compact .item{padding:4px 8px;font-size:13px;gap:8px;border-radius:7px}
  .menu.compact .mark{width:14px}
  @media (max-width:1000px){.menu.wide{left:auto;right:0}}
  .menu.end{left:auto;right:0}
  .item{display:flex;align-items:center;gap:10px;width:100%;padding:7px 10px;border:0;border-radius:8px;background:none;color:var(--ink);font:inherit;font-size:13.5px;text-align:left;cursor:pointer}
  .item.rich{min-height:52px;padding:5px 8px;gap:11px;border-radius:10px}
  .item:not(:disabled):is(:hover,:focus-visible){background:var(--hover);outline:none}
  .item.rich:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .item:disabled{opacity:.45;cursor:default}
  .mark{display:grid;place-items:center;width:16px;color:var(--muted)}
  .leading{display:grid;place-items:center;flex:none;width:40px;height:40px;color:var(--ink);font-family:var(--cjk);font-size:26px;line-height:1}
  .leading.spacer{visibility:hidden}
  .label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .item.rich .label{overflow:visible;text-overflow:clip;white-space:normal;line-height:1.35;word-break:break-word}
  .label:is(:lang(ja),:lang(txg)){font-family:var(--cjk)}
  .note{flex:none;color:var(--muted);font:500 11px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.02em;white-space:nowrap}
  .note.unencoded{font:inherit;font-size:12px;font-style:italic}
  kbd{font:500 11px ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--muted)}
  .sep{height:1px;margin:5px 4px;background:var(--line)}
  .heading{display:flex;align-items:center;gap:4px;width:calc(100% - 20px);margin:9px 10px 3px;padding:0;border:0;background:none;font:inherit;font-size:10.5px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);text-align:left;cursor:pointer}
  .heading{scroll-margin-top:92px}
  .heading svg{flex:none;transition:transform .12s}
  .heading[aria-expanded="false"] svg{transform:rotate(-90deg)}
  .heading:hover{color:var(--ink)}
  .heading:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .empty{margin:14px 10px;color:var(--muted);font-size:12.5px}
  .templates{display:flex;flex-wrap:wrap;gap:4px;padding:0 6px 2px}
  .template{display:grid;place-items:center;width:42px;height:36px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font-family:var(--cjk);font-size:20px;line-height:1;cursor:pointer}
  .template:hover{background:var(--hover)}
  .template:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .heading:first-child{margin-top:4px}
  .jump{display:flex;gap:4px;overflow-x:auto;padding:1px 1px 2px;scrollbar-width:thin}
  .chip{flex:none;padding:4px 8px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--muted);font:inherit;font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer}
  .chip:hover{color:var(--ink);border-color:var(--ink)}
  .chip[aria-current="true"]{border-color:var(--ink);background:var(--ink);color:var(--surface)}
  .chip:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .menu-head{position:sticky;top:-6px;z-index:2;display:flex;flex-direction:column;gap:5px;margin:0 0 5px;background:var(--surface)}
  .views{display:flex;gap:2px;padding:3px;border-radius:9px;background:var(--surface)}
  .filter{display:flex;align-items:center;gap:6px}
  .filter-input{flex:1;min-width:0;height:30px;padding:0 9px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:12.5px}
  .filter-input:focus-visible{outline:2px solid var(--focus);outline-offset:-1px}
  .modes{display:flex;flex:none;gap:2px;padding:2px;border-radius:8px;background:var(--hover)}
  .mode{padding:4px 7px;border:0;border-radius:6px;background:none;color:var(--muted);font:inherit;font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer}
  .mode[aria-checked="true"]{background:var(--surface);color:var(--ink)}
  .mode:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .view{display:flex;align-items:center;justify-content:center;gap:5px;flex:1;padding:4px 8px;border:0;border-radius:7px;background:none;color:var(--muted);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
  .view[aria-checked="true"]{background:var(--hover);color:var(--ink)}
  .view:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:8px;padding:4px 6px 8px}
  .card{display:flex;align-items:center;gap:9px;min-width:0;min-height:60px;padding:7px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font:inherit;text-align:left;cursor:pointer}
  .card:not(:disabled):is(:hover,:focus-visible){background:var(--hover);outline:none}
  .card:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .card:disabled{opacity:.45;cursor:default}
  .card-art{display:block;flex:none;width:46px;height:46px;color:var(--ink)}
  .card-art path{fill:currentColor}
  .card-glyph{display:block;flex:none;width:46px;height:46px;overflow:hidden;font-family:var(--cjk);font-size:25px;line-height:46px;color:var(--ink);text-align:center;white-space:nowrap;text-overflow:ellipsis}
  .card-text{display:flex;flex:1;flex-direction:column;gap:2px;min-width:0}
  .card-label{font-family:var(--cjk);font-size:11.5px;line-height:1.35;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note{color:var(--muted);font:500 10.5px/1.4 ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note.unencoded{font:inherit;font-size:11px;font-style:italic}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>
