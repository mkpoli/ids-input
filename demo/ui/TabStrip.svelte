<script>
  // The workspace's tabs: one per description being edited, each showing only its composed drawing
  // and a dot while it has edits since its last save. A tab is chosen by a click, by the arrow keys
  // while the strip has the focus (Home and End too), or by the page's own tab shortcuts; Delete
  // closes the focused tab, as does its ×. A tab dragged sideways takes the place it is dropped in,
  // and Shift with the arrow keys moves the focused tab the same way. Right-clicking a tab offers
  // reopening the last closed tab or group, Duplicate and the close actions, with Close all asking
  // first. The sequence is in the tab's tooltip and its name.
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import TabIcon from './TabIcon.svelte'
  /**
   * @type {{ tabs: import('../lib/tabs.js').Tab[], activeId: string, panelId: string, draw: (sequence: string) => Promise<any>,
   *   t: (key: string, params?: Record<string, string | number>) => string,
   *   onselect: (id: string) => void, onclose: (id: string) => void, onnew: () => void, onduplicate: (id: string) => void,
   *   oncloseothers: (id: string) => void, oncloseleft: (id: string) => void, oncloseright: (id: string) => void, oncloseall: () => void,
   *   onreopen: () => void, canreopen: boolean, onmove: (from: number, to: number) => void, oncommit: () => void }}
   */
  let { tabs, activeId, panelId, draw, t, onselect, onclose, onnew, onduplicate, oncloseothers, oncloseleft, oncloseright, oncloseall, onreopen, canreopen, onmove, oncommit } = $props()
  /** @type {HTMLElement | null} */ let strip = $state(null)
  /** @param {import('../lib/tabs.js').Tab} tab */
  const label = tab => (tab.whole || (tab.sequence && tab.sequence !== '⬚')) ? tab.sequence : t('app.tabs.untitled')
  /** @param {import('../lib/tabs.js').Tab} tab */
  const edited = tab => tab.sequence !== tab.saved

  // Keep the chosen tab in view without moving the page.
  let frame = 0
  /** @param {string} id */
  function reveal(id) {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      if (!strip) return
      const tab = /** @type {HTMLElement | undefined} */ ([...strip.children].find(child => /** @type {HTMLElement} */ (child).dataset.tabId === id))
      if (!tab) return
      const left = tab.offsetLeft - 10, right = tab.offsetLeft + tab.offsetWidth + 10
      if (left < strip.scrollLeft) strip.scrollLeft = left
      else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth
    })
  }
  $effect(() => {
    const id = activeId
    tick().then(() => reveal(id))
  })
  $effect(() => {
    const id = activeId
    document.fonts?.ready?.then(() => reveal(id), () => {})
  })
  $effect(() => {
    const el = strip
    const id = activeId
    if (!el) return
    let frame = 0
    const watch = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => reveal(id))
    })
    watch.observe(el)
    return () => { watch.disconnect(); cancelAnimationFrame(frame) }
  })

  /** @type {{ id: string, x: number, y: number } | null} */ let menu = $state(null)
  /** @type {HTMLDivElement | null} */ let menuEl = $state(null)
  /** @param {string} id @param {number} x @param {number} y */
  async function openMenu(id, x, y) {
    menu = { id, x, y }
    await tick()
    if (!menuEl || menu?.id !== id) return
    menuEl.showPopover()
    const rect = menuEl.getBoundingClientRect()
    menuEl.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`
    menuEl.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`
    menuEl.querySelector('button:not(:disabled)')?.focus()
  }
  /** @param {boolean} [refocus] */
  function dismiss(refocus = false) {
    const id = menu?.id
    menu = null
    if (refocus && id) focus(id)
  }
  /** Run an action for the tab the menu was opened on. @param {(id: string) => void} action */
  async function run(action) {
    const id = menu?.id
    if (!id) return
    dismiss()
    action(id)
    await tick()
    focus(activeId)
  }
  /** Reopen the last closed tab or group, and show it. */
  async function reopen() {
    if (!canreopen) return
    dismiss(true)
    onreopen()
    await tick()
    focus(activeId)
  }
  /** Ask before closing every tab. */
  function closeAll() {
    if (!menu?.id) return
    dismiss(true)
    oncloseall()
  }
  /** @param {KeyboardEvent} event */
  function menuKey(event) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault()
      event.stopPropagation()
      dismiss(true)
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = /** @type {HTMLButtonElement[]} */ ([...(menuEl?.querySelectorAll('button:not(:disabled)') ?? [])])
    if (!items.length) return
    const current = items.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement))
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : current < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1)
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next].focus()
  }

  /** @param {string} id */
  function focus(id) {
    const found = /** @type {HTMLElement | undefined} */ ([...(strip?.children ?? [])].find(child => /** @type {HTMLElement} */ (child).dataset.tabId === id))
    if (!found) return
    const button = /** @type {HTMLElement | null} */ (found.querySelector('[role="tab"]'))
    if (button) button.focus()
  }
  async function move(at) {
    onselect(tabs[at].id)
    await tick()
    focus(activeId)
  }
  /** @param {string} id */
  async function close(id) {
    onclose(id)
    await tick()
    focus(activeId)
  }

  // A tab dragged sideways follows the pointer and takes the place it is dropped in: the tabs it
  // passes swap around it as its middle crosses theirs, and the strip scrolls while the pointer
  // waits at an edge. A press that moves less than a few pixels is still a click. Touch keeps
  // scrolling the strip instead.
  /** @type {{ id: string, pointer: number, startX: number, offset: number, live: boolean, moved: boolean, dx: number } | null} */
  let drag = $state(null)
  /** @type {string | null} */
  let dropped = null
  let scrollFrame = 0
  let edgeX = 0
  /**
   * @param {PointerEvent} event
   * @param {string} id
   */
  function grab(event, id) {
    // A new press starts a new gesture, so a release click left over from the last one is spent.
    dropped = null
    if (event.button !== 0 || !event.isPrimary || event.pointerType === 'touch' || drag || tabs.length < 2) return
    const button = /** @type {HTMLElement} */ (event.currentTarget)
    const tab = button.closest('.tab')
    if (!tab) return
    button.setPointerCapture(event.pointerId)
    drag = { id, pointer: event.pointerId, startX: event.clientX, offset: event.clientX - tab.getBoundingClientRect().left, live: false, moved: false, dx: 0 }
  }
  /** Place the held tab for pointer `x`, swapping it past the tabs its middle has crossed. @param {number} x */
  async function place(x) {
    if (!drag || !strip) return
    const box = strip.getBoundingClientRect()
    const local = x - box.left + strip.scrollLeft
    const children = /** @type {HTMLElement[]} */ ([...strip.children])
    const el = children.find(child => child.dataset.tabId === drag?.id)
    if (!el) { drag = null; return }
    const from = tabs.findIndex(tab => tab.id === drag?.id)
    if (from < 0) { drag = null; return }
    // The swap follows the held tab's middle, not the pointer, so where it was grabbed does not matter.
    const lead = local - drag.offset + el.offsetWidth / 2
    let to = 0
    for (const child of children) {
      if (child === el) continue
      if (lead > child.offsetLeft + child.offsetWidth / 2) to++
    }
    if (to !== from) { drag.moved = true; onmove(from, to); await tick() }
    if (!drag) return
    // Keep the held tab inside the strip rather than letting the overflow clip it away.
    drag.dx = Math.max(strip.scrollLeft - el.offsetLeft,
      Math.min(local - drag.offset - el.offsetLeft, strip.scrollLeft + strip.clientWidth - el.offsetLeft - el.offsetWidth))
  }
  /** Scroll the strip while the pointer waits at an edge, so the held tab can pass the tabs out of view. */
  async function scrollEdge() {
    scrollFrame = 0
    if (!drag || !drag.live || !strip) return
    const box = strip.getBoundingClientRect()
    const dir = edgeX < box.left + 24 ? -1 : edgeX > box.right - 24 ? 1 : 0
    if (!dir) return
    const before = strip.scrollLeft
    strip.scrollLeft += dir * 12
    if (strip.scrollLeft === before) return
    await place(edgeX)
    if (drag?.live) scrollFrame = requestAnimationFrame(scrollEdge)
  }
  /** End the drag; `click` marks the release whose click should not choose the tab. @param {boolean} click */
  function end(click) {
    if (scrollFrame) { cancelAnimationFrame(scrollFrame); scrollFrame = 0 }
    edgeX = 0
    const held = drag
    drag = null
    if (!held?.moved) return
    if (click) {
      dropped = held.id
      // Reordering moves the button in the DOM and drops its focus; put it back where it was held.
      tick().then(() => { if (document.activeElement === document.body) focus(held.id) })
    }
    oncommit()
  }
  /** @param {PointerEvent} event */
  async function slide(event) {
    if (!drag || drag.pointer !== event.pointerId) return
    // A release outside the page leaves no pointerup here; the next move shows the button is up.
    if (event.buttons === 0) { end(false); return }
    if (!drag.live) {
      if (Math.abs(event.clientX - drag.startX) < 5) return
      drag.live = true
    }
    if (!strip) return
    edgeX = event.clientX
    const box = strip.getBoundingClientRect()
    const atEdge = event.clientX < box.left + 24 || event.clientX > box.right - 24
    if (atEdge) { if (!scrollFrame) scrollFrame = requestAnimationFrame(scrollEdge) }
    else if (scrollFrame) { cancelAnimationFrame(scrollFrame); scrollFrame = 0 }
    await place(event.clientX)
  }
  /** @param {PointerEvent} event */
  function letGo(event) {
    if (!drag || drag.pointer !== event.pointerId) return
    end(event.type === 'pointerup')
  }
  /** Move the focused tab one place, keeping its focus. @param {number} at @param {number} step */
  async function shuffle(at, step) {
    const to = at + step
    if (to < 0 || to >= tabs.length) return
    const id = tabs[at].id
    onmove(at, to)
    oncommit()
    await tick()
    focus(id)
  }
  /**
   * @param {KeyboardEvent} event
   * @param {number} at
   */
  function key(event, at) {
    const last = tabs.length - 1
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      const rect = /** @type {HTMLElement} */ (event.currentTarget).getBoundingClientRect()
      openMenu(tabs[at].id, rect.left, rect.bottom)
    }
    else if (event.shiftKey && event.key === 'ArrowRight') { event.preventDefault(); shuffle(at, 1) }
    else if (event.shiftKey && event.key === 'ArrowLeft') { event.preventDefault(); shuffle(at, -1) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); move((at + 1) % tabs.length) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); move((at - 1 + tabs.length) % tabs.length) }
    else if (event.key === 'Home') { event.preventDefault(); move(0) }
    else if (event.key === 'End') { event.preventDefault(); move(last) }
    else if ((event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); close(tabs[at].id) }
  }
</script>

<svelte:window onpointerdown={event => { if (menu && !menuEl?.contains(/** @type {Node} */ (event.target))) dismiss() }}
  onfocusin={event => { if (menu && menuEl && !menuEl.contains(/** @type {Node} */ (event.target))) dismiss() }}
  onresize={() => dismiss()} onpointermove={slide} onpointerupcapture={letGo} onpointercancelcapture={letGo}
  onblur={() => { if (drag) end(true) }} />

<div class="tabbar">
  <div class="tabs" class:dragging={drag?.live} role="tablist" aria-label={t('app.tabs.label')} bind:this={strip}>
    {#each tabs as tab, at (tab.id)}
      {@const name = label(tab)}
      {@const marked = edited(tab)}
      <div class="tab" class:on={tab.id === activeId} class:dragging={drag?.id === tab.id && drag.live} data-tab-id={tab.id}
        style:transform={drag?.id === tab.id && drag.live ? `translateX(${drag.dx}px)` : undefined}
        onauxclick={event => { if (event.button === 1) { event.preventDefault(); close(tab.id) } }}
        oncontextmenu={event => { event.preventDefault(); openMenu(tab.id, event.clientX, event.clientY) }}>
        <button type="button" class="tab-main" role="tab" id={`${panelId}-tab-${tab.id}`} aria-selected={tab.id === activeId}
          aria-controls={panelId} tabindex={tab.id === activeId ? 0 : -1} title={name} aria-posinset={at + 1} aria-setsize={tabs.length}
          aria-label={marked ? `${name}, ${t('app.tabs.edited')}` : name}
          onpointerdown={event => grab(event, tab.id)} onkeydown={event => key(event, at)}
          onclick={event => {
            // The click that ends a drag is not a choice; one on any other tab still is.
            const ended = dropped === tab.id && event.detail > 0
            dropped = null
            if (!ended) onselect(tab.id)
          }}>
          <span class="tab-icon"><TabIcon sequence={tab.whole || tab.sequence} {draw} />
            {#if marked}<span class="tab-dot" title={t('app.tabs.edited')} aria-hidden="true"></span>{/if}
          </span>
        </button>
          <button type="button" class="tab-close" tabindex="-1" title={t('app.tabs.close', { name })} aria-label={t('app.tabs.close', { name })}
            onclick={() => close(tab.id)} onkeydown={event => key(event, at)}><Icon name="close" size={11} /></button>
      </div>
    {/each}
  </div>
  <button type="button" class="tab-new" title={t('app.tabs.new')} aria-label={t('app.tabs.new')} onclick={onnew}><Icon name="plus" size={16} /></button>
</div>

{#if menu}
  {@const at = tabs.findIndex(tab => tab.id === menu.id)}
  <div class="tab-menu" role="menu" tabindex="-1" popover="manual" bind:this={menuEl}
    aria-label={at >= 0 ? `${t('app.tabs.menu')}: ${label(tabs[at])}` : t('app.tabs.menu')}
    style:left="{menu.x}px" style:top="{menu.y}px" onkeydown={menuKey}>
    <button type="button" role="menuitem" disabled={!canreopen} onclick={reopen}><Icon name="history" size={16} />{t('app.tabs.reopen')}</button>
    <hr />
    <button type="button" role="menuitem" onclick={() => run(onduplicate)}><Icon name="copy" size={16} />{t('app.tabs.duplicate')}</button>
    <hr />
    <button type="button" role="menuitem" onclick={() => run(onclose)}><Icon name="close" size={16} />{t('app.tabs.closeOne')}</button>
    <button type="button" role="menuitem" disabled={tabs.length < 2} onclick={() => run(oncloseothers)}><Icon name="close" size={16} />{t('app.tabs.closeOthers')}</button>
    <button type="button" role="menuitem" disabled={at <= 0} onclick={() => run(oncloseleft)}><span class="flip"><Icon name="arrow-right" size={16} /></span>{t('app.tabs.closeLeft')}</button>
    <button type="button" role="menuitem" disabled={at >= tabs.length - 1} onclick={() => run(oncloseright)}><Icon name="arrow-right" size={16} />{t('app.tabs.closeRight')}</button>
    <hr />
    <button type="button" role="menuitem" onclick={closeAll}><Icon name="trash" size={16} />{t('app.tabs.closeAll')}</button>
  </div>
{/if}

<style>
  .tab-menu{position:fixed;inset:auto;margin:0;min-width:160px;max-width:calc(100vw - 16px);padding:5px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);box-shadow:0 8px 28px #0003}
  .tab-menu button{display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border:0;border-radius:6px;background:none;color:inherit;font:inherit;font-size:13px;text-align:left;cursor:pointer}
  .tab-menu hr{border:0;border-top:1px solid var(--line);margin:4px 2px}
  .tab-menu button:not(:disabled):hover,.tab-menu button:focus-visible{background:var(--hover);outline:none}
  .tab-menu button:disabled{opacity:.45;cursor:default}
  .tab-menu .flip{display:grid;transform:rotate(180deg)}
  .tabbar{display:flex;align-items:flex-end;gap:8px;flex:1;min-width:0;height:100%}
  .tabs{position:relative;display:flex;align-items:flex-end;gap:4px;flex:0 1 auto;min-width:0;height:100%;padding-inline:10px;
    overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain}
  .tabs::-webkit-scrollbar{display:none}
  .tabs.dragging{user-select:none}
  .tab{position:relative;isolation:isolate;flex:none;width:80px;height:40px;border:0;border-radius:12px 12px 0 0;color:var(--muted)}
  .tab:not(.on):hover{background:var(--hover);color:var(--ink)}
  .tab.on{background:var(--bg);color:var(--ink);box-shadow:inset 0 2px 0 var(--accent)}
  .tab.on::before,.tab.on::after{content:"";position:absolute;bottom:0;width:10px;height:10px;pointer-events:none}
  .tab.on::before{left:-10px;background:radial-gradient(circle at 0 0,transparent 10px,var(--bg) 10.5px)}
  .tab.on::after{right:-10px;background:radial-gradient(circle at 100% 0,transparent 10px,var(--bg) 10.5px)}
  .tab.dragging{z-index:4;color:var(--ink);filter:drop-shadow(0 5px 9px #0003)}
  .tab.dragging .tab-main{cursor:grabbing}
  .tab-main{display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:6px 32px 6px 8px;border:0;border-radius:inherit;background:none;color:inherit;cursor:pointer}
  .tab:not(.on) .tab-main{padding-inline:12px}
  .tab-main:focus-visible{outline:2px solid var(--focus);outline-offset:-3px}
  .tab-icon{position:relative;display:grid;place-items:center;flex:none;width:28px;height:28px}
  .tab:not(.on) .tab-icon{opacity:.7}
  .tab-dot{position:absolute;top:0;right:-4px;width:4px;height:4px;border-radius:50%;background:var(--accent)}
  .tab-close{position:absolute;z-index:2;top:8px;right:8px;display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:7px;
    background:none;color:var(--muted);cursor:pointer;pointer-events:none;opacity:0;transition:opacity .1s,background-color .1s,color .1s}
  .tab.on .tab-close,.tab-close:focus-visible{opacity:1;pointer-events:auto}
  .tab-close:not(:disabled):hover{background:var(--hover);color:var(--ink)}
  .tab-close:focus-visible{outline:2px solid var(--focus);outline-offset:-1px}
  .tab-new{display:grid;place-items:center;flex:none;width:28px;height:28px;margin:0 0 6px -6px;padding:0;border:0;border-radius:8px;background:none;color:var(--muted);cursor:pointer}
  .tab-new:hover{background:var(--hover);color:var(--ink)}
  .tab-new:focus-visible{outline:2px solid var(--focus);outline-offset:-1px}
  @media (hover:none){.tab.on .tab-close{opacity:1;pointer-events:auto}}
</style>
