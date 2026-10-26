<script module>
  /** @typedef {{ label: string, icon?: string, shortcut?: string, hint?: string, disabled?: boolean, checked?: boolean, lang?: string, leading?: string, root?: string, sequence?: string, note?: string, unencoded?: boolean, run?: () => void } | { heading: string } | { separator: true }} Item */
</script>

<script>
  // A menu behind a button: items with an optional icon, a shortcut on the right, and a separator
  // or a heading between groups. A rich item leads with a character or a root operator and ends
  // with a note, as the examples menu does with a code point; its sequence keeps the IDS written
  // with the IDC characters. Arrow keys move, Escape closes and gives the focus back.
  import Icon from './Icon.svelte'
  /** @type {{ label: string, icon?: string, items: Item[], align?: 'start' | 'end', text?: boolean, keyHints?: boolean, wide?: boolean }} */
  let { label, icon, items, align = 'start', text = true, keyHints = true, wide = false } = $props()
  let open = $state(false)
  /** @type {HTMLElement | null} */ let box = $state(null)
  /** @type {HTMLButtonElement | null} */ let trigger = $state(null)
  const uid = $props.id()
  /** @param {boolean} [focus] */
  function show(focus = false) {
    open = true
    if (focus) queueMicrotask(() => /** @type {HTMLElement | null | undefined} */ (box?.querySelector(':is([role="menuitem"],[role="menuitemradio"]):not([disabled])'))?.focus())
  }
  function hide() { open = false; trigger?.focus() }
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
    const all = /** @type {HTMLElement[]} */ ([...(box?.querySelectorAll(':is([role="menuitem"],[role="menuitemradio"]):not([disabled])') ?? [])])
    const at = all.indexOf(/** @type {HTMLElement} */ (document.activeElement))
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide() }
    else if (event.key === 'ArrowDown') { event.preventDefault(); all[(at + 1) % all.length]?.focus() }
    else if (event.key === 'ArrowUp') { event.preventDefault(); all[(at - 1 + all.length) % all.length]?.focus() }
    else if (event.key === 'Tab') open = false
  }
</script>

<svelte:window onpointerdown={event => { if (open && !box?.parentElement?.contains(/** @type {Node} */ (event.target))) open = false }} />

<div class="menu-wrap">
  <button type="button" class="tool" class:on={open} bind:this={trigger} aria-haspopup="menu" aria-expanded={open} aria-controls={`${uid}-menu`}
    title={label} aria-label={text ? undefined : label} onclick={() => open ? (open = false) : show()}
    onkeydown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); show(true) } }}>
    {#if icon}<Icon name={icon} />{/if}{#if text}<span>{label}</span>{/if}<Icon name="chevron" size={14} />
  </button>
  {#if open}
    <div class="menu" class:end={align === 'end'} class:wide role="menu" id={`${uid}-menu`} tabindex="-1" aria-label={label} bind:this={box} onkeydown={key}>
      {#each items as item, i (i)}
        {#if 'separator' in item}<div class="sep" role="separator"></div>
        {:else if 'heading' in item}<p class="heading">{item.heading}</p>
        {:else}
          <button type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} class="item"
            class:rich={item.leading !== undefined || item.root !== undefined} disabled={item.disabled}
            aria-label={item.sequence !== undefined ? `${item.leading ?? item.root ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
            title={item.hint} onclick={() => { hide(); item.run?.() }}>
            {#if item.leading !== undefined}
              <span class="leading" lang={item.lang}>{item.leading}</span>
            {:else if item.root !== undefined}
              <span class="leading root" lang={item.lang}>{item.root}</span>
            {:else}
              <span class="mark">{#if item.checked}<Icon name="check" size={14} />{:else if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
            {/if}
            <span class="label" lang={item.lang}>{item.sequence ?? item.label}</span>
            {#if item.note !== undefined}<span class="note" class:unencoded={item.unencoded}>{item.note}</span>{/if}
            {#if item.shortcut && keyHints}<kbd>{item.shortcut}</kbd>{/if}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu-wrap{position:relative}
  .menu{position:absolute;z-index:40;top:calc(100% + 6px);left:0;min-width:220px;max-width:min(340px,calc(100vw - 32px));max-height:min(70vh,520px);overflow:auto;
    padding:6px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:var(--shadow-pop)}
  .menu.wide{width:min(480px,calc(100vw - 32px));max-width:min(480px,calc(100vw - 32px));max-height:min(78vh,640px)}
  @media (max-width:1000px){.menu.wide{left:auto;right:0}}
  .menu.end{left:auto;right:0}
  .item{display:flex;align-items:center;gap:10px;width:100%;padding:7px 10px;border:0;border-radius:8px;background:none;color:var(--ink);font:inherit;font-size:13.5px;text-align:left;cursor:pointer}
  .item.rich{min-height:52px;padding:5px 8px;gap:11px;border-radius:10px}
  .item:not(:disabled):is(:hover,:focus-visible){background:var(--hover);outline:none}
  .item.rich:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .item:disabled{opacity:.45;cursor:default}
  .mark{display:grid;place-items:center;width:16px;color:var(--muted)}
  .leading{display:grid;place-items:center;flex:none;width:40px;height:40px;color:var(--ink);font-family:var(--cjk);font-size:26px;line-height:1}
  .leading.root{color:var(--muted)}
  .label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .item.rich .label{overflow:visible;text-overflow:clip;white-space:normal;line-height:1.35;word-break:break-word}
  .label:lang(ja){font-family:var(--cjk)}
  .note{flex:none;color:var(--muted);font:500 11px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.02em;white-space:nowrap}
  .note.unencoded{font:inherit;font-size:12px;font-style:italic}
  kbd{font:500 11px ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--muted)}
  .sep{height:1px;margin:5px 4px;background:var(--line)}
  .heading{margin:9px 10px 3px;font-size:10.5px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
  .heading:first-child{margin-top:4px}
</style>
