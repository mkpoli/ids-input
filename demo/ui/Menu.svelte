<script module>
  /** @typedef {{ label: string, icon?: string, shortcut?: string, hint?: string, disabled?: boolean, checked?: boolean, lang?: string, leading?: string, sequence?: string, note?: string, unencoded?: boolean, drawing?: { d: string }, run?: () => void } | { heading: string } | { separator: true }} Item */
</script>

<script>
  // A menu behind a button: items with an optional icon, a shortcut on the right, and a separator
  // or a heading between groups. A rich item leads with a character or a root operator and ends
  // with a note, as the examples menu does with a code point; its sequence keeps the IDS written
  // with the IDC characters. Arrow keys move, Escape closes and gives the focus back.
  import { tick } from 'svelte'
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
  // Cards keep the headings of the list; separators have no place in a grid.
  const groups = $derived.by(() => {
    /** @type {{ heading: string, items: Item[] }[]} */
    const out = []
    let group = { heading: '', items: /** @type {Item[]} */ ([]) }
    for (const item of items) {
      if ('heading' in item) {
        if (group.items.length) out.push(group)
        group = { heading: item.heading, items: [] }
      } else if (!('separator' in item)) group.items.push(item)
    }
    if (group.items.length) out.push(group)
    return out
  })
  /** @param {boolean} [focus] @param {boolean} [last] */
  async function show(focus = false, last = false) {
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
      {#if view}
        <div class="views" role="group" aria-label={label}>
          <button type="button" class="view" role="menuitemradio" aria-checked={!view.cardsSelected} onclick={() => view?.onchange(false)}>{view.list}</button>
          <button type="button" class="view" role="menuitemradio" aria-checked={view.cardsSelected} onclick={() => view?.onchange(true)}>{view.cards}</button>
        </div>
      {/if}
      {#if view?.cardsSelected}
        {#each groups as group (group.heading)}
          {#if group.heading}<p class="heading">{group.heading}</p>{/if}
          <div class="cards">
            {#each group.items as item (item.sequence ?? item.label)}
              <button type="button" role="menuitem" class="card" disabled={item.disabled}
                aria-label={item.sequence !== undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
                title={item.hint} onclick={() => { hide(); item.run?.() }}>
                {#if item.drawing?.d}
                  <svg class="card-art" viewBox="0 0 1000 1000" aria-hidden="true"><path d={item.drawing.d} /></svg>
                {:else}
                  <span class="card-glyph" lang={item.lang}>{item.leading ?? item.sequence ?? item.label}</span>
                {/if}
                <span class="card-text">
                  <span class="card-label" lang={item.lang}>{item.sequence ?? item.label}</span>
                  {#if item.note !== undefined}<span class="card-note" class:unencoded={item.unencoded}>{item.note}</span>{/if}
                </span>
              </button>
            {/each}
          </div>
        {/each}
      {:else}
        {#each items as item, i (i)}
          {#if 'separator' in item}<div class="sep" role="separator"></div>
          {:else if 'heading' in item}<p class="heading">{item.heading}</p>
          {:else}
            <button type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} class="item"
              class:rich={item.sequence !== undefined} disabled={item.disabled}
              aria-label={item.sequence !== undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
              title={item.hint} onclick={() => { hide(); item.run?.() }}>
              {#if item.leading !== undefined}
                <span class="leading" lang={item.lang}>{item.leading}</span>
              {:else if item.sequence !== undefined}
                <span class="leading spacer" aria-hidden="true"></span>
              {:else}
                <span class="mark">{#if item.checked}<Icon name="check" size={14} />{:else if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
              {/if}
              <span class="label" lang={item.lang}>{item.sequence ?? item.label}</span>
              {#if item.note !== undefined}<span class="note" class:unencoded={item.unencoded}>{item.note}</span>{/if}
              {#if item.shortcut && keyHints}<kbd>{item.shortcut}</kbd>{/if}
            </button>
          {/if}
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
  .menu.wide{width:min(480px,calc(100vw - 32px));max-width:min(480px,calc(100vw - 32px));max-height:min(78vh,640px)}
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
  .heading{margin:9px 10px 3px;font-size:10.5px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
  .heading:first-child{margin-top:4px}
  .views{position:sticky;top:-6px;z-index:1;display:flex;gap:2px;margin:0 0 5px;padding:3px;border-radius:9px;background:var(--surface)}
  .view{flex:1;padding:5px 8px;border:0;border-radius:7px;background:none;color:var(--muted);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
  .view[aria-checked="true"]{background:var(--hover);color:var(--ink)}
  .view:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:4px 4px 8px}
  .card{display:flex;flex-direction:column;gap:6px;min-width:0;padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit;text-align:left;cursor:pointer}
  .card:not(:disabled):is(:hover,:focus-visible){background:var(--hover);outline:none}
  .card:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .card:disabled{opacity:.45;cursor:default}
  .card-art{display:block;width:64px;height:64px;align-self:center;color:var(--ink)}
  .card-art path{fill:currentColor}
  .card-glyph{display:grid;place-items:center;min-height:64px;font-family:var(--cjk);font-size:30px;line-height:1.15;color:var(--ink);text-align:center;overflow-wrap:anywhere}
  .card-text{display:flex;flex-direction:column;gap:2px;min-width:0}
  .card-label{font-family:var(--cjk);font-size:11.5px;line-height:1.35;color:var(--ink);overflow-wrap:anywhere}
  .card-note{color:var(--muted);font:500 10.5px/1.4 ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note.unencoded{font:inherit;font-size:11px;font-style:italic}
  @media (max-width:600px){.cards{grid-template-columns:1fr}}
</style>
