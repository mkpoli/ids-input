<script module>
  /** @typedef {{ label: string, icon?: string, shortcut?: string, hint?: string, disabled?: boolean, checked?: boolean, lang?: string, run?: () => void } | { heading: string } | { separator: true }} Item */
</script>

<script>
  // A menu behind a button: items with an optional icon, a shortcut on the right, and a separator
  // or a heading between groups. Arrow keys move, Escape closes and gives the focus back.
  import Icon from './Icon.svelte'
  /** @type {{ label: string, icon?: string, items: Item[], align?: 'start' | 'end', text?: boolean, keyHints?: boolean }} */
  let { label, icon, items, align = 'start', text = true, keyHints = true } = $props()
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
    <div class="menu" class:end={align === 'end'} role="menu" id={`${uid}-menu`} tabindex="-1" aria-label={label} bind:this={box} onkeydown={key}>
      {#each items as item, i (i)}
        {#if 'separator' in item}<div class="sep" role="separator"></div>
        {:else if 'heading' in item}<p class="heading">{item.heading}</p>
        {:else}
          <button type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} class="item" disabled={item.disabled}
            title={item.hint} onclick={() => { hide(); item.run?.() }}>
            <span class="mark">{#if item.checked}<Icon name="check" size={14} />{:else if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
            <span class="label" lang={item.lang}>{item.label}</span>
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
  .menu.end{left:auto;right:0}
  .item{display:flex;align-items:center;gap:10px;width:100%;padding:7px 10px;border:0;border-radius:8px;background:none;color:var(--ink);font:inherit;font-size:13.5px;text-align:left;cursor:pointer}
  .item:not(:disabled):is(:hover,:focus-visible){background:var(--hover);outline:none}
  .item:disabled{opacity:.45;cursor:default}
  .mark{display:grid;place-items:center;width:16px;color:var(--muted)}
  .label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  kbd{font:500 11px ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--muted)}
  .sep{height:1px;margin:5px 4px;background:var(--line)}
  .heading{margin:6px 10px 2px;font-size:11px;font-weight:600;letter-spacing:.03em;color:var(--muted)}
</style>
