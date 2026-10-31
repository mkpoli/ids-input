<script>
  // A menu's items laid out as a list, for a sheet that holds several menus at once (the phone's menu).
  import Icon from './Icon.svelte'
  /** @type {{ items: import('./Menu.svelte').Item[], label: string, onpick?: () => void, view?: { list: string, cards: string, cardsSelected: boolean, onchange: (cards: boolean) => void } | null, open?: boolean }} */
  import { tick, untrack } from 'svelte'
  let { items, label, onpick, view = null, open = true } = $props()
  const uid = $props.id()
  /** @type {HTMLElement | null} */ let root = $state(null)
  let query = $state('')
  /** @type {'all' | 'encoded' | 'unencoded'} */
  let mode = $state('all')
  /** @type {Set<string>} */
  let collapsed = $state(new Set())
  let active = $state('')
  // The index of the one submenu shown inline, or -1.
  let openSubmenu = $state(-1)
  $effect(() => { if (!open) openSubmenu = -1 })
  const filtering = $derived(query.trim().length > 0 || mode !== 'all')
  /** @param {import('./Menu.svelte').Item} item */
  function matches(item) {
    if ('heading' in item || 'separator' in item) return true
    if (mode === 'encoded' && item.unencoded) return false
    if (mode === 'unencoded' && !item.unencoded) return false
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return [item.sequence, item.label, item.leading, item.reading, item.note].filter(Boolean).join(' ').toLowerCase().includes(needle)
  }
  const visible = $derived(items.filter(matches))
  const groups = $derived.by(() => {
    /** @type {{ heading: string, items: import('./Menu.svelte').Item[] }[]} */
    const out = []
    let group = { heading: '', items: /** @type {import('./Menu.svelte').Item[]} */ ([]) }
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
  /** @param {number} i */
  function expand(i) {
    openSubmenu = i
    tick().then(() => root?.querySelector('.submenu')?.scrollIntoView({ block: 'nearest' }))
  }
  /** @param {number} i */
  function toggleSubmenu(i) {
    if (openSubmenu === i) openSubmenu = -1
    else expand(i)
  }
  /** @param {string} heading */
  function jump(heading) {
    const list = groups.filter(group => group.heading)
    const at = list.findIndex(group => group.heading === heading)
    const buttons = root?.querySelectorAll('button.heading') ?? []
    /** @type {HTMLElement | undefined} */ (buttons[at])?.scrollIntoView({ block: 'start' })
    active = heading
  }
  /** @param {HTMLElement | null} el */
  function scrollParent(el) {
    for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) return node
    }
    return null
  }
  $effect(() => {
    const list = root
    if (!list || !view) return
    const scroller = scrollParent(list) ?? window
    const update = () => {
      const top = scroller === window ? 8 : /** @type {HTMLElement} */ (scroller).getBoundingClientRect().top + 8
      const headings = [...list.querySelectorAll('button.heading')]
      const box = scroller === window ? document.documentElement : /** @type {HTMLElement} */ (scroller)
      let current = ''
      if (box.scrollHeight > box.clientHeight + 4 && box.scrollTop + box.clientHeight >= box.scrollHeight - 4) {
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
      const chip = /** @type {HTMLElement | undefined} */ (list.querySelectorAll('.chip')[at])
      const row = chip?.parentElement
      if (chip && row) {
        const chipRect = chip.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        if (chipRect.left < rowRect.left) row.scrollLeft -= rowRect.left - chipRect.left
        else if (chipRect.right > rowRect.right) row.scrollLeft += chipRect.right - rowRect.right
      }
    }
    const frame = requestAnimationFrame(update)
    scroller.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(list)
    return () => { cancelAnimationFrame(frame); scroller.removeEventListener('scroll', update); observer.disconnect() }
  })
</script>

{#snippet groupHeading(heading)}
  <button type="button" class="heading" data-heading={heading} aria-expanded={expanded(heading)} onclick={() => toggle(heading)}>
    <Icon name="chevron" size={12} /><span>{heading}</span>
  </button>
{/snippet}

{#snippet cardItem(item)}
  <button type="button" class="card" disabled={item.disabled}
    aria-label={item.sequence !== undefined && item.reading === undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
    title={item.hint} onclick={() => { openSubmenu = -1; onpick?.(); item.run?.() }}>
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

<!-- Inline disclosure: the trigger uses aria-expanded and aria-controls for the group. -->
{#snippet submenuRow(item, i)}
  {@const open = openSubmenu === i}
  <button type="button" class="item submenu-item" aria-expanded={open} aria-controls={open ? `${uid}-sub-${i}` : undefined}
    disabled={item.disabled} onclick={() => toggleSubmenu(i)}>
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
  <button type="button" class="item" class:rich={item.sequence !== undefined}
    disabled={item.disabled} aria-label={item.sequence !== undefined && item.reading === undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
    title={item.hint} onclick={() => { openSubmenu = -1; onpick?.(); item.run?.() }}>
    {#if item.leading !== undefined}
      <span class="leading" lang={item.lang}>{item.leading}</span>
    {:else if item.sequence !== undefined}
      <span class="leading spacer" aria-hidden="true"></span>
    {:else}
      <span class="mark">{#if item.checked}<Icon name="check" size={14} />{:else if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
    {/if}
    <span class="label" lang={item.lang}>{item.sequence ?? item.label}</span>
    {#if item.note !== undefined || item.reading !== undefined}<span class="note" class:unencoded={item.unencoded}>{#if item.reading !== undefined}<span lang={item.readingLang}>{item.reading}</span>{' · '}{/if}{item.note}</span>{/if}
  </button>
{/snippet}

<div class="list" role="group" aria-label={label} bind:this={root}>
  <div class="title-row">
    <p class="title">{label}</p>
    {#if view}
      <div class="views">
        <button type="button" class="view" aria-pressed={!view.cardsSelected} onclick={() => view?.onchange(false)}><Icon name="list" size={13} /><span>{view.list}</span></button>
        <button type="button" class="view" aria-pressed={view.cardsSelected} onclick={() => view?.onchange(true)}><Icon name="grid" size={13} /><span>{view.cards}</span></button>
      </div>
    {/if}
  </div>
  {#if view}
    <div class="filter">
      <input class="filter-input" type="search" placeholder={view.filter.label} aria-label={view.filter.label} bind:value={query} />
      <div class="modes" role="group" aria-label={view.filter.label}>
        {#each [['all', view.filter.all], ['encoded', view.filter.encoded], ['unencoded', view.filter.unencoded]] as [key, text] (key)}
          <button type="button" class="mode" aria-pressed={mode === key} onclick={() => { mode = key }}>{text}</button>
        {/each}
      </div>
    </div>
    <div class="jump" role="group" aria-label={label}>
      {#each groups as group (group.heading)}
        {#if group.heading}<button type="button" class="chip" aria-current={active === group.heading ? 'true' : undefined} onclick={() => jump(group.heading)}>{group.heading}</button>{/if}
      {/each}
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
      {:else if 'submenu' in item && item.submenu}{@render submenuRow(item, i)}
      {:else}{@render listRow(item)}{/if}
    {/each}
  {/if}
</div>

<style>
  .list{display:flex;flex-direction:column;gap:2px}
  .title-row{display:flex;align-items:center;gap:8px;margin:0 0 4px}
  .title{flex:1;margin:0;font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--ui-color-ink-muted)}
  .item{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:6px 10px;border:0;border-radius:var(--ui-radius-md);background:none;color:var(--ui-color-ink);font:inherit;font-size:14px;text-align:left;cursor:pointer}
  .item.rich{min-height:52px;padding:5px 8px;gap:11px;border-radius:var(--ui-radius-lg)}
  .item:not(:disabled):is(:hover,:focus-visible){background:var(--ui-color-surface-hover);outline:none}
  .item.rich:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-2px}
  .item:disabled{opacity:.45;cursor:default}
  .item.submenu-item .chev{display:grid;place-items:center;flex:none;color:var(--ui-color-ink-muted);transform:rotate(-90deg);transition:transform .12s}
  .item.submenu-item .chev.open{transform:none}
  .submenu{margin:0 0 4px 26px;padding:2px 0 2px 6px;border-left:1px solid var(--ui-color-border)}
  .submenu .item{min-height:36px;padding:5px 8px;font-size:13.5px}
  .submenu .sep{margin:4px 2px}
  .mark{display:grid;place-items:center;width:16px;color:var(--ui-color-ink-muted)}
  .leading{display:grid;place-items:center;flex:none;width:40px;height:40px;color:var(--ui-color-ink);font-family:var(--cjk);font-size:26px;line-height:1}
  .leading.spacer{visibility:hidden}
  .label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .item.rich .label{overflow:visible;text-overflow:clip;white-space:normal;line-height:1.35;word-break:break-word}
  .label:is(:lang(ja),:lang(txg)){font-family:var(--cjk)}
  .note{flex:none;color:var(--ui-color-ink-muted);font:500 11px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.02em;white-space:nowrap}
  .note.unencoded{font:inherit;font-size:12px;font-style:italic}
  .sep{height:1px;margin:4px;background:var(--ui-color-border)}
  .heading{display:flex;align-items:center;gap:4px;width:calc(100% - 20px);margin:9px 10px 3px;padding:0;border:0;background:none;font:inherit;font-size:10.5px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--ui-color-ink-muted);text-align:left;cursor:pointer}
  .heading svg{flex:none;transition:transform .12s}
  .heading[aria-expanded="false"] svg{transform:rotate(-90deg)}
  .empty{margin:14px 10px;color:var(--ui-color-ink-muted);font-size:13px}
  .jump{display:flex;gap:4px;overflow-x:auto;padding:1px 1px 2px}
  .chip{flex:none;padding:4px 8px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-pill);background:var(--ui-color-surface);color:var(--ui-color-ink-muted);font:inherit;font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer}
  .chip:hover{color:var(--ui-color-ink);border-color:var(--ui-color-ink)}
  .chip[aria-current="true"]{border-color:var(--ui-color-ink);background:var(--ui-color-ink);color:var(--ui-color-surface)}
  .heading{scroll-margin-top:8px}
  .filter{display:flex;flex-direction:column;align-items:stretch;gap:5px;margin:0 0 4px}
  .filter-input{flex:1;min-width:0;height:32px;padding:0 9px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface);color:var(--ui-color-ink);font:inherit;font-size:13px}
  .modes{display:flex;align-self:flex-start;gap:2px;padding:2px;border-radius:var(--ui-radius-md);background:var(--ui-color-surface-hover)}
  .mode{padding:4px 7px;border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink-muted);font:inherit;font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer}
  .mode[aria-pressed="true"]{background:var(--ui-color-surface);color:var(--ui-color-ink)}
  .title-row + .heading{margin-top:4px}
  .views{display:flex;gap:2px;padding:2px;border-radius:var(--ui-radius-md);background:var(--ui-color-surface-hover)}
  .view{display:flex;align-items:center;gap:4px;padding:3px 7px;border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink-muted);font:inherit;font-size:11px;font-weight:600;cursor:pointer}
  .view[aria-pressed="true"]{background:var(--ui-color-surface);color:var(--ui-color-ink)}
  .view:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-2px}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;padding:2px 2px 6px}
  .card{display:flex;align-items:center;gap:6px;min-width:0;min-height:48px;padding:6px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface);color:var(--ui-color-ink);font:inherit;text-align:left;cursor:pointer}
  .card:not(:disabled):is(:hover,:focus-visible){background:var(--ui-color-surface-hover);outline:none}
  .card:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-2px}
  .card:disabled{opacity:.45;cursor:default}
  .card-art{display:block;flex:none;width:36px;height:36px;color:var(--ui-color-ink)}
  .card-art path{fill:currentColor}
  .card-glyph{display:block;flex:none;width:36px;height:36px;overflow:hidden;font-family:var(--cjk);font-size:20px;line-height:36px;color:var(--ui-color-ink);text-align:center;white-space:nowrap;text-overflow:ellipsis}
  .card-text{display:flex;flex:1;flex-direction:column;gap:1px;min-width:0}
  .card-label{font-family:var(--cjk);font-size:10.5px;line-height:1.35;color:var(--ui-color-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note{color:var(--ui-color-ink-muted);font:500 9.5px/1.4 ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note.unencoded{font:inherit;font-size:10px;font-style:italic}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>
