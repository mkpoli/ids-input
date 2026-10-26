<script>
  // The workspace's tabs: one per description being edited, each showing only its composed drawing
  // and a dot while it has edits since its last save. A tab is chosen by a click, by the arrow keys
  // while the strip has the focus (Home and End too), or by the page's own tab shortcuts; Delete
  // closes the focused tab, as does its ×. The sequence is in the tab's tooltip and its name.
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import TabIcon from './TabIcon.svelte'
  /**
   * @type {{ tabs: import('../lib/tabs.js').Tab[], activeId: string, panelId: string, draw: (sequence: string) => Promise<any>,
   *   t: (key: string, params?: Record<string, string | number>) => string,
   *   onselect: (id: string) => void, onclose: (id: string) => void, onnew: () => void }}
   */
  let { tabs, activeId, panelId, draw, t, onselect, onclose, onnew } = $props()
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
      const left = tab.offsetLeft, right = left + tab.offsetWidth
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
    if (tabs.length < 2) return
    onclose(id)
    await tick()
    focus(activeId)
  }
  /**
   * @param {KeyboardEvent} event
   * @param {number} at
   */
  function key(event, at) {
    const last = tabs.length - 1
    if (event.key === 'ArrowRight') { event.preventDefault(); move((at + 1) % tabs.length) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); move((at - 1 + tabs.length) % tabs.length) }
    else if (event.key === 'Home') { event.preventDefault(); move(0) }
    else if (event.key === 'End') { event.preventDefault(); move(last) }
    else if ((event.key === 'Delete' || event.key === 'Backspace') && tabs.length > 1) { event.preventDefault(); close(tabs[at].id) }
  }
</script>

<div class="tabbar">
  <div class="tabs" role="tablist" aria-label={t('app.tabs')} bind:this={strip}>
    {#each tabs as tab, at (tab.id)}
      {@const name = label(tab)}
      {@const marked = edited(tab)}
      <div class="tab" class:on={tab.id === activeId} data-tab-id={tab.id}
        onauxclick={event => { if (event.button === 1) { event.preventDefault(); if (tabs.length > 1) close(tab.id) } }}>
        <button type="button" class="tab-main" role="tab" id={`${panelId}-tab-${tab.id}`} aria-selected={tab.id === activeId}
          aria-controls={panelId} tabindex={tab.id === activeId ? 0 : -1} title={name} aria-label={marked ? `${name}, ${t('app.tabs.edited')}` : name}
          onclick={() => onselect(tab.id)} onkeydown={event => key(event, at)}>
          <span class="tab-icon"><TabIcon sequence={tab.whole || tab.sequence} {draw} /></span>
          {#if marked}<span class="tab-dot" title={t('app.tabs.edited')} aria-hidden="true"></span>{/if}
        </button>
        {#if tabs.length > 1}
          <button type="button" class="tab-close" tabindex="-1" title={t('app.tabs.close', { name })} aria-label={t('app.tabs.close', { name })}
            onclick={() => close(tab.id)} onkeydown={event => key(event, at)}><Icon name="close" size={11} /></button>
        {/if}
      </div>
    {/each}
  </div>
  <button type="button" class="tab-new" title={t('app.tabs.new')} aria-label={t('app.tabs.new')} onclick={onnew}><Icon name="plus" size={16} /></button>
</div>

<style>
  .tabbar{display:flex;align-items:stretch;gap:6px;flex:1;min-width:0;height:100%}
  .tabs{display:flex;align-items:flex-end;gap:4px;flex:0 1 auto;min-width:0;height:100%;overflow-x:auto;overflow-y:hidden;
    scrollbar-width:none;overscroll-behavior-x:contain}
  .tabs::-webkit-scrollbar{display:none}
  .tab{position:relative;flex:none;width:76px;height:36px;border:1px solid transparent;border-bottom:0;border-radius:10px 10px 0 0;color:var(--muted)}
  .tab:not(.on):hover{background:var(--hover);color:var(--ink)}
  .tab.on{background:var(--surface);border-color:var(--line);color:var(--ink);box-shadow:inset 0 2px 0 var(--accent)}
  .tab-main{display:flex;align-items:center;width:100%;height:100%;padding:6px 24px 4px 11px;border:0;background:none;color:inherit;cursor:pointer}
  .tab-main:focus-visible{outline:2px solid var(--focus);outline-offset:-3px}
  .tab-icon{display:grid;place-items:center;flex:none;width:26px;height:26px}
  .tab:not(.on) .tab-icon{opacity:.6}
  .tab-dot{position:absolute;right:12px;bottom:5px;width:5px;height:5px;border-radius:50%;background:var(--accent)}
  .tab-close{position:absolute;z-index:2;top:4px;right:7px;display:grid;place-items:center;width:18px;height:18px;padding:0;border:0;border-radius:5px;
    background:none;color:var(--muted);cursor:pointer;pointer-events:none;opacity:0;transition:opacity .1s,background-color .1s,color .1s}
  .tab.on .tab-close,.tab:hover .tab-close,.tab-close:focus-visible{opacity:1;pointer-events:auto}
  .tab-close:not(:disabled):hover{background:var(--hover);color:var(--ink)}
  .tab-close:focus-visible{outline:2px solid var(--focus);outline-offset:-1px}
  .tab-new{display:grid;place-items:center;flex:none;align-self:center;width:28px;height:28px;padding:0;border:0;border-radius:7px;background:none;color:var(--muted);cursor:pointer}
  .tab-new:hover{background:var(--hover);color:var(--ink)}
  .tab-new:focus-visible{outline:2px solid var(--focus);outline-offset:-1px}
  @media (hover:none){.tab.on .tab-close{opacity:1;pointer-events:auto}}
</style>
