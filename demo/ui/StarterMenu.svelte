<script>
  // The tab strip's starter: the chevron opens a popover whose Template tab is the editor's full
  // template catalogue (the same component the input pane shows), whose Examples tab lists the
  // examples the toolbar menu draws, and whose Recently closed tab holds the tabs and groups closed
  // this session. A template or example opens a new tab; a closed entry brings its tabs back.
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import MenuList from './MenuList.svelte'
  import TabIcon from './TabIcon.svelte'
  import { IdsTemplates } from '../../src/svelte/index.js'
  /** @typedef {'templates' | 'examples' | 'recent'} StarterTab */
  /** @type {StarterTab[]} */
  const TABS = ['templates', 'examples', 'recent']
  /**
   * @type {{ t: (key: string, params?: Record<string, string | number>) => string, editor: any,
   *   items: import('./Menu.svelte').Item[], view: { list: string, cards: string, cardsSelected: boolean, onchange: (cards: boolean) => void } | null,
   *   onstart: (sequence: string) => void, onstarted?: () => void,
   *   draw: (sequence: string) => Promise<any>,
   *   recent?: { key: string, names: string[], sequences: string[], count: number, reopen: () => void }[] }}
   */
  let { t, editor, items, view, onstart, onstarted, draw, recent = [] } = $props()
  const uid = $props.id()
  let open = $state(false)
  /** @type {StarterTab} */ let tab = $state('templates')
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
  /** Open the starter on a tab, for a menu entry elsewhere. @param {StarterTab} [which] */
  export function openAt(which = 'templates') {
    tab = which
    show()
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
  /** Bring a closed tab or group back, and let the workshop show and focus it. @param {{ reopen: () => void }} entry */
  function reopenClosed(entry) {
    hide()
    entry.reopen()
  }
  /** @param {KeyboardEvent} event */
  function tabKey(event) {
    const at = TABS.indexOf(tab)
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      tab = TABS[(at + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length]
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      tab = event.key === 'Home' ? TABS[0] : TABS[TABS.length - 1]
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
    <div class="starter-panel" role="dialog" aria-label={t('app.tabs.start')} data-tab={tab} bind:this={panel}>
      <div class="starter-tabs" role="tablist" aria-label={t('app.tabs.start')}>
        <button type="button" class="starter-tab" role="tab" data-tab="templates" id={`${uid}-tab-templates`}
          aria-controls={`${uid}-panel-templates`} aria-selected={tab === 'templates'} tabindex={tab === 'templates' ? 0 : -1}
          onclick={() => tab = 'templates'} onkeydown={tabKey}>{t('app.tabs.templates')}</button>
        <button type="button" class="starter-tab" role="tab" data-tab="examples" id={`${uid}-tab-examples`}
          aria-controls={`${uid}-panel-examples`} aria-selected={tab === 'examples'} tabindex={tab === 'examples' ? 0 : -1}
          onclick={() => tab = 'examples'} onkeydown={tabKey}>{t('app.examples.label')}</button>
        <button type="button" class="starter-tab" role="tab" data-tab="recent" id={`${uid}-tab-recent`}
          aria-controls={`${uid}-panel-recent`} aria-selected={tab === 'recent'} tabindex={tab === 'recent' ? 0 : -1}
          onclick={() => tab = 'recent'} onkeydown={tabKey}>{t('app.tabs.recent')}</button>
      </div>
      {#if tab === 'templates'}
        <div class="starter-body" role="tabpanel" id={`${uid}-panel-templates`} aria-labelledby={`${uid}-tab-templates`} tabindex="0">
          <IdsTemplates {editor} onpick={choose} />
        </div>
      {:else if tab === 'examples'}
        <div class="starter-body" role="tabpanel" id={`${uid}-panel-examples`} aria-labelledby={`${uid}-tab-examples`} tabindex="0">
          <MenuList label={t('app.examples.label')} items={exampleItems} {view} onpick={() => hide(true)} />
        </div>
      {:else}
        <div class="starter-body starter-recent" role="tabpanel" id={`${uid}-panel-recent`} aria-labelledby={`${uid}-tab-recent`} tabindex="0">
          {#if recent.length}
            <ul class="starter-recent-list" aria-label={t('app.tabs.recent')}>
              {#each recent as entry (entry.key)}
                {@const name = entry.names.join(' · ')}
                <li>
                  <button type="button" class="starter-recent-item" title={name} aria-label={t('app.tabs.reopenRecent', { name })}
                    onclick={() => reopenClosed(entry)}>
                    <span class="starter-recent-thumbs">
                      {#each entry.sequences.slice(0, 3) as sequence, at (at)}
                        <span class="starter-recent-thumb"><TabIcon {sequence} {draw} delay={0} /></span>
                      {/each}
                    </span>
                    <span class="starter-recent-name">{name}</span>
                    {#if entry.count > 1}<span class="starter-recent-count">{t('app.tabs.recentCount', { count: entry.count })}</span>{/if}
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="starter-recent-empty">{t('app.tabs.recentEmpty')}</p>
          {/if}
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
  .starter-panel[data-tab="recent"]{width:min(560px,calc(100vw - 24px))}
  .starter-tabs{position:sticky;top:-6px;z-index:2;display:flex;gap:2px;margin:0 0 5px;padding:3px;border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .starter-tab{flex:1;padding:5px 10px;border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink-muted);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
  .starter-tab[aria-selected="true"]{background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  .starter-tab:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-2px}
  /* The third tab's name is long; on phones it fits on one line at these sizes. */
  @media (max-width:400px){.starter-tab{padding:5px 5px;font-size:11px}}
  @media (max-width:340px){.starter-tab{font-size:10.5px}}
  .starter-body{padding:4px 4px 2px}
  .starter-body:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-2px;border-radius:var(--ui-radius-md)}
  .starter-recent-list{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
  .starter-recent-item{display:flex;align-items:center;gap:var(--ui-space-sm);width:100%;min-height:var(--ui-control-h-lg);padding:0 var(--ui-space-sm);
    border:0;border-radius:var(--ui-radius-md);background:none;color:var(--ui-color-ink);font:inherit;font-size:var(--ui-text-sm);text-align:left;cursor:pointer}
  .starter-recent-item:hover{background:var(--ui-color-surface-hover)}
  .starter-recent-item:focus-visible{background:var(--ui-color-surface-hover);outline:2px solid var(--ui-color-focus);outline-offset:-2px}
  .starter-recent-thumbs{display:flex;align-items:center;gap:3px;flex:none;color:var(--ui-color-ink-muted)}
  .starter-recent-thumb{display:grid;place-items:center;width:24px;height:24px;padding:2px;border-radius:var(--ui-radius-sm);background:var(--ui-color-surface-sunken)}
  .starter-recent-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ids-font);font-size:14px}
  .starter-recent-count{flex:none;color:var(--ui-color-ink-muted);font-size:11px;font-variant-numeric:tabular-nums}
  .starter-recent-empty{margin:0;padding:var(--ui-space-md) var(--ui-space-sm);color:var(--ui-color-ink-muted);font-size:12.5px}
</style>
