<script>
  // A menu's items laid out as a list, for a sheet that holds several menus at once (the phone's menu).
  import Icon from './Icon.svelte'

  /** @type {{ items: import('./Menu.svelte').Item[], label: string, onpick?: () => void, view?: { list: string, cards: string, cardsSelected: boolean, onchange: (cards: boolean) => void } | null, open?: boolean, chips?: boolean }} */
  import { tick, untrack } from 'svelte'
  let { items, label, onpick, view = null, open = true, chips = true } = $props()
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
  $effect(() => {
    if (!open) openSubmenu = -1
  })
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
  // Without the category chips the headings are the whole map of the list, so every section starts
  // folded and the reader opens the one they want. The chip row lets a wide panel keep them open.
  // This runs once, when the list first has its sections; after that the reader owns the state.
  let foldedOnce = false
  $effect(() => {
    const headings = chips || foldedOnce ? [] : groups.filter(group => group.heading).map(group => group.heading)
    if (!headings.length) return
    foldedOnce = true
    collapsed = new Set(headings)
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
  // The outermost ancestor that actually scrolls. A wrapper can declare `overflow:auto` and still
  // hold its whole content, so a wrapper that merely fits is not the scrollport.
  /** @param {HTMLElement | null} el */
  function scrollParent(el) {
    let found = null
    for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) found = node
    }
    return found
  }
  $effect(() => {
    const list = root
    if (!list || !view || !chips) return
    // The scrollport is resolved on each pass: the dialog only overflows once its content lays out,
    // which happens after this effect first runs.
    let scroller = /** @type {HTMLElement | null} */ (null)
    const update = () => {
      scroller = scrollParent(list) ?? scroller
      const box = scroller ?? (/** @type {HTMLElement} */ (document.documentElement))
      const top = scroller ? scroller.getBoundingClientRect().top + 8 : 8
      const headings = [...list.querySelectorAll('button.heading')]
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
      const chip = /** @type {HTMLElement | undefined} */ (list.querySelectorAll('.ui-chip')[at])
      const row = chip?.parentElement
      if (chip && row) {
        const chipRect = chip.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        if (chipRect.left < rowRect.left) row.scrollLeft -= rowRect.left - chipRect.left
        else if (chipRect.right > rowRect.right) row.scrollLeft += chipRect.right - rowRect.right
      }
    }
    // Listen on the document: scroll does not bubble, but it reaches the capture phase, so the
    // scroller is heard wherever it turns out to be.
    const listen = event => {
      const box = scrollParent(list)
      if (box && (event.target === box || box.contains(/** @type {Node} */ (event.target)))) update()
      else if (!box) update()
    }
    const frame = requestAnimationFrame(update)
    document.addEventListener('scroll', listen, { passive: true, capture: true })
    const observer = new ResizeObserver(update)
    observer.observe(list)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('scroll', listen, { capture: true }); observer.disconnect() }
  })
</script>

{#snippet groupHeading(heading, count)}
  <button type="button" class="heading" data-heading={heading} aria-expanded={expanded(heading)} aria-label={`${heading}, ${count}`} onclick={() => toggle(heading)}>
    <Icon name="chevron" size={12} /><span class="heading-name">{heading}</span><span class="count" aria-hidden="true">{count}</span>
  </button>
{/snippet}

{#snippet cardItem(item)}
  <button type="button" class="ui-menu-item card" disabled={item.disabled}
    aria-label={item.sequence !== undefined && item.reading === undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
    title={item.hint} onclick={() => { openSubmenu = -1; onpick?.(); item.run?.() }}>
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

<!-- Inline disclosure: the trigger uses aria-expanded and aria-controls for the group. -->
{#snippet submenuRow(item, i)}
  {@const open = openSubmenu === i}
  <button type="button" class="ui-menu-item item submenu-item" aria-expanded={open} aria-controls={open ? `${uid}-sub-${i}` : undefined}
    disabled={item.disabled} onclick={() => toggleSubmenu(i)}>
    <span class="mark">{#if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
    <span class="label">{item.label}</span>
    <span class="chev" class:open><Icon name="chevron" size={14} /></span>
  </button>
  {#if open}
    <div class="submenu" id={`${uid}-sub-${i}`} role="group" aria-label={item.label}>
      {#each item.submenu as sub, j (j)}
        {#if 'separator' in sub}<div class="ui-menu-separator sep" role="separator"></div>
        {:else if 'heading' in sub}<p class="heading">{sub.heading}</p>
        {:else}{@render listRow(sub)}{/if}
      {/each}
    </div>
  {/if}
{/snippet}

{#snippet listRow(item)}
  <button type="button" class="ui-menu-item item" class:rich={item.sequence !== undefined}
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
      <div class="ui-switch-bar views">
        <button type="button" class="ui-button view" data-size="xs" aria-pressed={!view.cardsSelected} onclick={() => view?.onchange(false)}><Icon name="list" size={13} /><span>{view.list}</span></button>
        <button type="button" class="ui-button view" data-size="xs" aria-pressed={view.cardsSelected} onclick={() => view?.onchange(true)}><Icon name="grid" size={13} /><span>{view.cards}</span></button>
      </div>
    {/if}
  </div>
  {#if view}
    <div class="filter">
      <input class="ui-input filter-input" type="search" placeholder={view.filter.label} aria-label={view.filter.label} bind:value={query} />
      <div class="ui-switch-bar modes" role="group" aria-label={view.filter.label}>
        {#each [['all', view.filter.all], ['encoded', view.filter.encoded], ['unencoded', view.filter.unencoded]] as [key, text] (key)}
          <button type="button" class="ui-button mode" data-size="xs" aria-pressed={mode === key} onclick={() => { mode = key }}>{text}</button>
        {/each}
      </div>
    </div>
    {#if chips}<div class="jump" role="group" aria-label={label}>
      {#each groups as group (group.heading)}
        {#if group.heading}<button type="button" class="ui-chip" data-interactive data-variant={active === group.heading ? 'selected' : undefined} aria-current={active === group.heading ? 'true' : undefined} onclick={() => jump(group.heading)}>{group.heading}</button>{/if}
      {/each}
    </div>{/if}
  {/if}
  {#if view && !groups.length}
    <p class="ui-empty">{view.filter.empty}</p>
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

<style>
  .list{display:flex;flex-direction:column;gap:var(--ui-space-3xs)}
  .title-row{display:flex;align-items:center;gap:var(--ui-space-sm);margin:0 0 var(--ui-space-2xs)}
  .title{flex:1;margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-bold);letter-spacing:.04em;text-transform:uppercase}
  .item{display:flex;align-items:center;gap:var(--ui-space-md);width:100%;min-height:40px;padding:var(--ui-space-xs) var(--ui-space-md);border:0;border-radius:var(--ui-radius-md);background:none;color:var(--ui-color-ink);font:inherit;font-size:var(--ui-text-md);text-align:left;cursor:pointer}
  .item.rich{min-height:52px;gap:var(--ui-space-md);padding:var(--ui-space-2xs) var(--ui-space-sm);border-radius:var(--ui-radius-lg)}
  .item:not(:disabled):is(:hover,:focus-visible){background:var(--ui-color-surface-hover)}
  .item.rich:focus-visible{outline:var(--ui-ring-width) solid var(--ui-color-focus);outline-offset:calc(-1 * var(--ui-ring-width))}
  .item:disabled{opacity:var(--ui-disabled-opacity);cursor:not-allowed}
  .item.submenu-item .chev{display:grid;place-items:center;flex:none;color:var(--ui-color-ink-muted);transform:rotate(-90deg);transition:transform var(--ui-duration-fast)}
  .item.submenu-item .chev.open{transform:none}
  .submenu{margin:0 0 var(--ui-space-2xs) 26px;padding:var(--ui-space-3xs) 0 var(--ui-space-3xs) var(--ui-space-xs);border-left:1px solid var(--ui-color-border)}
  .submenu .item{min-height:var(--ui-control-h-lg);padding:var(--ui-space-2xs) var(--ui-space-sm);font-size:var(--ui-text-md)}
  .submenu .sep{margin:var(--ui-space-2xs) var(--ui-space-3xs)}
  .mark{display:grid;place-items:center;width:16px;color:var(--ui-color-ink-muted)}
  .leading{display:grid;place-items:center;flex:none;width:40px;height:40px;color:var(--ui-color-ink);font-family:var(--cjk);font-size:26px;line-height:1}
  .leading.spacer{visibility:hidden}
  .label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .item.rich .label{overflow:visible;text-overflow:clip;white-space:normal;line-height:1.35;word-break:break-word}
  .label:is(:lang(ja),:lang(txg),:lang(swi),:lang(juc)){font-family:var(--cjk)}
  .note{flex:none;color:var(--ui-color-ink-muted);font:var(--ui-weight-medium) var(--ui-text-2xs)/var(--ui-leading-normal) var(--ui-font-mono);letter-spacing:.02em;white-space:nowrap}
  .note.unencoded{font:inherit;font-size:var(--ui-text-xs);font-style:italic}
  .sep{height:1px;margin:var(--ui-space-2xs);background:var(--ui-color-border)}
  .heading{display:flex;align-items:center;gap:var(--ui-space-2xs);width:calc(100% - 2 * var(--ui-space-md));margin:var(--ui-space-sm) var(--ui-space-md) var(--ui-space-3xs);padding:0;border:0;background:none;
    color:var(--ui-color-ink-muted);font:inherit;font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-bold);letter-spacing:.07em;text-transform:uppercase;text-align:left;cursor:pointer;scroll-margin-top:var(--ui-space-sm)}
  .title-row + .heading{margin-top:var(--ui-space-2xs)}
  .heading svg{flex:none;transition:transform var(--ui-duration-fast)}
  .heading[aria-expanded="false"] svg{transform:rotate(-90deg)}
  .heading-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .count{flex:none;margin-left:auto;padding:1px var(--ui-space-xs);border-radius:var(--ui-radius-pill);background:var(--ui-color-surface-hover);color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-semibold);letter-spacing:.02em;font-variant-numeric:tabular-nums}
  .ui-empty{margin:var(--ui-space-sm) var(--ui-space-md);min-block-size:0;padding:var(--ui-space-lg) var(--ui-space-md)}
  .jump{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs);padding:1px 1px var(--ui-space-3xs)}
  .ui-chip{flex:none}
  .view:focus-visible,.mode:focus-visible,.ui-chip:focus-visible{outline-offset:calc(-1 * var(--ui-ring-width))}
  .filter{display:flex;flex-direction:column;align-items:stretch;gap:var(--ui-space-xs);margin:0 0 var(--ui-space-2xs)}
  .modes{align-self:flex-start;padding:var(--ui-space-3xs)}
  .mode{padding-inline:var(--ui-space-xs);font-size:var(--ui-text-2xs)}
  .views{padding:var(--ui-space-3xs)}
  .view{padding-inline:var(--ui-space-xs);font-size:var(--ui-text-2xs);white-space:nowrap}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--ui-space-xs);padding:var(--ui-space-3xs) var(--ui-space-3xs) var(--ui-space-xs)}
  .card{display:flex;align-items:center;gap:var(--ui-space-xs);min-width:0;min-height:48px;padding:var(--ui-space-xs);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface);color:var(--ui-color-ink);font:inherit;text-align:left;cursor:pointer}
  .card:not(:disabled):is(:hover,:focus-visible){background:var(--ui-color-surface-hover)}
  .card:focus-visible{outline-offset:calc(-1 * var(--ui-ring-width))}
  .card:disabled{opacity:var(--ui-disabled-opacity);cursor:not-allowed}
  .card-art{display:block;flex:none;width:36px;height:36px;color:var(--ui-color-ink)}
  .card-art path{fill:currentColor}
  .card-glyph{display:block;flex:none;width:36px;height:36px;overflow:hidden;font-family:var(--cjk);font-size:20px;line-height:36px;color:var(--ui-color-ink);text-align:center;white-space:nowrap;text-overflow:ellipsis}
  .card-text{display:flex;flex:1;flex-direction:column;gap:1px;min-width:0}
  .card-label{font-family:var(--cjk);font-size:10.5px;line-height:1.35;color:var(--ui-color-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note{color:var(--ui-color-ink-muted);font:var(--ui-weight-medium) 9.5px/1.4 var(--ui-font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note.unencoded{font:inherit;font-size:10px;font-style:italic}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>
