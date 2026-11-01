<script>
  // The tab strip's starter: the chevron opens a popover whose Template tab is the editor's full
  // template catalogue (the same component the input pane shows) and whose Examples tab is the same
  // list the phone's menu sheet uses. A template or example opens a new tab.
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import MenuList from './MenuList.svelte'
  import { IdsTemplates } from '../../src/svelte/index.js'
  /**
   * @type {{ t: (key: string, params?: Record<string, string | number>) => string, editor: any,
   *   items: import('./Menu.svelte').Item[], view: { list: string, cards: string, cardsSelected: boolean, onchange: (cards: boolean) => void } | null,
   *   onstart: (sequence: string) => void, onstarted?: () => void }}
   */
  let { t, editor, items, view, onstart, onstarted } = $props()
  const uid = $props.id()
  let open = $state(false)
  /** @type {'templates' | 'examples'} */ let tab = $state('templates')
  /** @type {HTMLDivElement | null} */ let wrap = $state(null)
  /** @type {HTMLButtonElement | null} */ let trigger = $state(null)
  /** @type {HTMLDivElement | null} */ let panel = $state(null)

  // MenuList treats an example's menu item like a menu entry; route its run through the same focus
  // the template picker uses for the new tab.
  const exampleItems = $derived(items.map(item => item.sequence !== undefined
    ? { ...item, run: () => { item.run?.(); onstarted?.() } }
    : item))
  async function show() {
    open = true
    await tick()
    wrap?.querySelector('.starter-tab[aria-selected="true"]')?.focus()
  }
  /** @param {boolean} [refocus] */
  function hide(refocus = false) {
    open = false
    if (refocus) trigger?.focus()
  }
  /** @param {string} sequence */
  function choose(sequence) {
    hide(true)
    onstart(sequence)
  }
  /** @param {KeyboardEvent} event */
  function tabKey(event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      tab = tab === 'templates' ? 'examples' : 'templates'
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      tab = event.key === 'Home' ? 'templates' : 'examples'
    } else if (event.key === 'Escape') {
      event.preventDefault()
      hide(true)
      return
    } else return
    tick().then(() => wrap?.querySelector(`.starter-tab[data-tab="${tab}"]`)?.focus())
  }
  // Keep the wide panel inside the window, and above its bottom edge, wherever the strip sits.
  $effect(() => {
    if (!open || !panel) return
    const pad = 8
    const place = () => {
      if (!panel) return
      panel.style.transform = ''
      const rect = panel.getBoundingClientRect()
      panel.style.maxHeight = `${Math.max(0, Math.min(760, innerHeight - rect.top - pad))}px`
      const dx = rect.left < pad ? pad - rect.left : rect.right > innerWidth - pad ? innerWidth - pad - rect.right : 0
      if (dx) panel.style.transform = `translateX(${dx}px)`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(panel)
    addEventListener('resize', place)
    return () => { observer.disconnect(); removeEventListener('resize', place); if (panel) { panel.style.transform = ''; panel.style.maxHeight = '' } }
  })
</script>

<svelte:window onpointerdown={event => { if (open && !wrap?.contains(/** @type {Node} */ (event.target))) hide() }}
  onkeydown={event => { if (open && event.key === 'Escape') { event.preventDefault(); hide(true) } }} />

<div class="starter" bind:this={wrap}
  onfocusout={event => { if (open && event.relatedTarget instanceof Node && !wrap?.contains(event.relatedTarget)) hide() }}>
  <button type="button" class="starter-trigger" bind:this={trigger} title={t('app.tabs.start')} aria-label={t('app.tabs.start')}
    aria-haspopup="dialog" aria-expanded={open} onclick={() => open ? hide() : show()}>
    <Icon name="chevron" size={14} />
  </button>
  {#if open}
    <div class="starter-panel" role="dialog" aria-label={t('app.tabs.start')} bind:this={panel}>
      <div class="starter-tabs" role="tablist" aria-label={t('app.tabs.start')}>
        <button type="button" class="starter-tab" role="tab" data-tab="templates" id={`${uid}-tab-templates`}
          aria-controls={`${uid}-panel-templates`} aria-selected={tab === 'templates'} tabindex={tab === 'templates' ? 0 : -1}
          onclick={() => tab = 'templates'} onkeydown={tabKey}>{t('app.tabs.templates')}</button>
        <button type="button" class="starter-tab" role="tab" data-tab="examples" id={`${uid}-tab-examples`}
          aria-controls={`${uid}-panel-examples`} aria-selected={tab === 'examples'} tabindex={tab === 'examples' ? 0 : -1}
          onclick={() => tab = 'examples'} onkeydown={tabKey}>{t('app.examples.label')}</button>
      </div>
      {#if tab === 'templates'}
        <div class="starter-body" role="tabpanel" id={`${uid}-panel-templates`} aria-labelledby={`${uid}-tab-templates`} tabindex="0">
          <IdsTemplates {editor} onpick={choose} />
        </div>
      {:else}
        <div class="starter-body" role="tabpanel" id={`${uid}-panel-examples`} aria-labelledby={`${uid}-tab-examples`} tabindex="0">
          <MenuList label={t('app.examples.label')} items={exampleItems} {view} onpick={() => hide(true)} />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .starter{position:relative;display:flex;flex:none}
  .starter-trigger{display:grid;place-items:center;width:20px;height:28px;padding:0;border:0;border-radius:var(--ui-radius-md);background:none;color:var(--ui-color-ink-muted);cursor:pointer}
  .starter-trigger:hover,.starter-trigger[aria-expanded="true"]{background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  .starter-trigger:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-1px}
  .starter-panel{position:absolute;z-index:40;top:calc(100% + 6px);left:0;display:flex;flex-direction:column;width:min(960px,calc(100vw - 24px));max-height:min(82vh,760px);
    overflow:auto;padding:6px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xl);background:var(--ui-color-surface);box-shadow:var(--ui-shadow-2)}
  .starter-tabs{position:sticky;top:-6px;z-index:2;display:flex;gap:2px;margin:0 0 5px;padding:3px;border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .starter-tab{flex:1;padding:5px 10px;border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink-muted);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
  .starter-tab[aria-selected="true"]{background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  .starter-tab:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-2px}
  .starter-body{padding:4px 4px 2px}
  .starter-body:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-2px;border-radius:var(--ui-radius-md)}
</style>
