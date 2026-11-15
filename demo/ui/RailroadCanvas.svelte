<script>
  // One railroad diagram of a whole grammar, grown in place: every rule named on the line is a box
  // that opens into that rule's own diagram, spliced into the same track, and closes back. The
  // diagram is laid out again from the grammar on every change (lib/railroad.js), as nested nodes so
  // only the rules that hold a change are redrawn. The canvas pans and zooms; the page scrolls past
  // it with the wheel, and Ctrl or ⌘ with the wheel zooms. One rule at a time takes the Tab stop:
  // the arrow keys move between rules, Enter or Space opens and closes. A rule shows on its own in
  // the panel beside it. It can fill its container (`fill`) and the screen, and open at the chosen
  // rule (`reveal`).
  import { onMount, tick } from 'svelte'
  import Icon from './Icon.svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import RailroadNode from './RailroadNode.svelte'
  import { openable, placeOf, railroad, railTree } from '../lib/railroad.js'

  /** @type {{ rules: Map<string, { text: string, expr: import('../lib/railroad.js').Expr }>, top: string,
   *   t: (key: string, params?: Record<string, unknown>) => string, selected?: string, fill?: boolean, reveal?: boolean }} */
  let { rules, top, t, selected = $bindable(top), fill = false, reveal = false } = $props()

  const open = new SvelteSet()
  const tree = $derived(railTree(rules, top, open))
  /** Where the selected rule was last picked in the diagram, and which rule that was. */
  let pickedAt = /** @type {string | null} */ (null), pickedFor = ''
  const single = $derived(rules.has(selected) ? railroad(rules, selected) : null)
  /** What a screen reader hears: a rule chosen on purpose, not every focus change. */
  let announced = $state('')

  let scale = $state(1), x = $state(0), y = $state(0)
  /** @type {HTMLElement | undefined} */
  let viewport = $state()
  const MAX = 3
  /** The scale that shows the whole diagram. */
  const fitScale = () => viewport ? Math.min(viewport.clientWidth / tree.width, viewport.clientHeight / tree.height) * 0.96 : 1
  /** Zoom by `factor` about a point of the viewport, no further out than the whole diagram.
   * @param {number} factor @param {number} [px] @param {number} [py] */
  function zoom(factor, px = (viewport?.clientWidth ?? 0) / 2, py = (viewport?.clientHeight ?? 0) / 2) {
    const next = Math.min(MAX, Math.max(Math.min(0.1, fitScale()), scale * factor))
    x = px - (px - x) * next / scale
    y = py - (py - y) * next / scale
    scale = next
  }
  function fit() {
    if (!viewport) return
    scale = Math.min(MAX, fitScale())
    x = (viewport.clientWidth - tree.width * scale) / 2
    y = (viewport.clientHeight - tree.height * scale) / 2
  }
  /** Actual size, the start of the top rule's track halfway down the canvas. */
  function reset() { scale = 1; x = 0; y = (viewport?.clientHeight ?? 0) / 2 - tree.y }
  onMount(() => { reset(); if (reveal) tick().then(show) })

  // Full screen: the whole diagram with its tools, panel and index, while the browser allows it.
  /** @type {HTMLElement | undefined} */
  let root = $state()
  let full = $state(false)
  const canFull = document.fullscreenEnabled
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen()
    else root?.requestFullscreen().catch(() => {})
  }
  onMount(() => {
    const changed = () => { full = document.fullscreenElement === root }
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  })

  /** The rule elements that take focus, in document order. */
  const focusable = () => /** @type {SVGElement[]} */ ([...(viewport?.querySelectorAll('.non-terminal[data-path], .frame-label') ?? [])])
  /** A rule's element: its box when closed, its label when open. @param {string} path */
  const at = path => /** @type {SVGElement | null} */ (viewport?.querySelector(`.frame-label[data-path="${path}"], .non-terminal[data-path="${path}"]`) ?? null)
  /** Where on screen a rule's track enters it: the box's middle, or the label's top plus the
   * height above the track. @param {Element} element */
  function entry(element) {
    const box = element.getBoundingClientRect()
    const up = Number(element.getAttribute('data-up'))
    return { left: box.left, line: up ? box.top + up * scale : (box.top + box.bottom) / 2 }
  }

  // One Tab stop in the diagram: the rule last moved to, else one in view.
  let roving = $state('')
  /** Keep one rule focusable, in view. @param {boolean} [visible] keep it only if it is in view */
  function rove(visible = false) {
    const all = focusable()
    if (!all.length || !viewport) return
    const view = viewport.getBoundingClientRect()
    /** @param {Element} element */
    const seen = element => { const box = element.getBoundingClientRect(); return box.right > view.left && box.left < view.right && box.bottom > view.top && box.top < view.bottom }
    let current = all.find(element => element.getAttribute('data-path') === roving)
    if (!current || (visible && document.activeElement !== current && !seen(current))) current = all.find(seen) ?? all[0]
    roving = current.getAttribute('data-path') ?? ''
    for (const element of all) element.setAttribute('tabindex', element === current ? '0' : '-1')
  }
  $effect(() => { void tree; tick().then(() => rove()) })
  let settle = 0
  $effect(() => { void x; void y; void scale; clearTimeout(settle); settle = window.setTimeout(() => rove(true), 150) })

  /** Pan so an element is in view, then give it the focus without scrolling the page. @param {SVGElement} element */
  function focusRule(element) {
    if (!viewport) return
    const box = element.getBoundingClientRect(), view = viewport.getBoundingClientRect()
    if (box.left < view.left + 8 || box.right > view.right - 8) x += view.left + view.width / 3 - box.left
    if (box.top < view.top + 8 || box.bottom > view.bottom - 8) y += view.top + view.height / 2 - box.top
    roving = element.getAttribute('data-path') ?? ''
    for (const one of focusable()) one.setAttribute('tabindex', one === element ? '0' : '-1')
    element.focus({ preventScroll: true })
  }

  /** Open or close a rule where it sits, its track kept in place on screen and the focus on it. @param {string} path */
  async function toggle(path) {
    const before = at(path)
    const was = before ? entry(before) : null
    if (open.has(path)) { for (const one of open) if (one === path || one.startsWith(`${path}/`)) open.delete(one) }
    else open.add(path)
    await tick()
    const after = at(path)
    if (was && after) {
      const now = entry(after)
      x += was.left - now.left
      y += was.line - now.line
      await tick()
      focusRule(after)
    }
  }
  /** Bring a path into view at a readable size, opening what holds it, and focus it unless told not to.
   * @param {string} path @param {boolean} [focus] */
  async function locate(path, focus = true) {
    const parts = path.split('/').slice(1)
    for (let n = 1; n < parts.length; n++) open.add(`/${parts.slice(0, n).join('/')}`)
    await tick()
    scale = Math.max(scale, 1)
    await tick()
    const element = path === '' ? null : at(path)
    if (!element || !viewport) { reset(); return }
    const box = element.getBoundingClientRect(), view = viewport.getBoundingClientRect()
    x += view.left + view.width / 3 - box.left
    y += view.top + view.height / 2 - box.top
    await tick()
    if (focus) focusRule(element)
  }
  /** @param {boolean} [focus] */
  function showSelected(focus = true) {
    const path = pickedFor === selected && pickedAt !== null ? pickedAt : placeOf(rules, top, selected)
    if (path !== null) locate(path, focus)
  }
  /** Bring the chosen rule into view without taking the focus, as an address that names it does. */
  export function show() { showSelected(false) }

  async function expandAll() { for (const path of openable(rules, top)) open.add(path); await tick(); fit() }
  async function expandLevel() { for (const path of openable(rules, top, open)) open.add(path); await tick(); fit() }
  async function collapseAll() { open.clear(); await tick(); fit() }

  /** @param {Element | null} element */
  function pick(element) {
    if (!element) return
    const path = element.getAttribute('data-path')
    const name = element.getAttribute('data-rule')
    if (path === null || name === null) return
    selected = name
    pickedFor = name
    pickedAt = element.hasAttribute('data-link') ? element.getAttribute('data-link') : path
  }
  /** What a click or a key does to a rule. @param {Element} element */
  function act(element) {
    pick(element)
    announced = selected
    const link = element.getAttribute('data-link')
    if (link !== null) { locate(link); return }
    const path = element.getAttribute('data-path')
    if (path !== null) toggle(path)
  }
  /** The rule a pointer or key event is on: a box, a link or an open rule's label. @param {Event} event */
  const ruleOf = event => /** @type {SVGElement | null} */ (event.target instanceof Element ? event.target.closest('.non-terminal[data-path], .frame-label') : null)

  // Panning by dragging with the main button or a finger, and pinching; a press that does not move is a click.
  /** @type {Map<number, { x: number, y: number }>} */
  const pointers = new Map()
  let moved = false, pinch = 0
  /** @param {PointerEvent} event */
  function down(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    moved = false
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y) }
  }
  /** @param {PointerEvent} event */
  function move(event) {
    const last = pointers.get(event.pointerId)
    if (!last) return
    const dx = event.clientX - last.x, dy = event.clientY - last.y
    if (!moved && Math.hypot(dx, dy) < 4) return
    if (!moved) viewport?.setPointerCapture(event.pointerId)
    moved = true
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const box = viewport?.getBoundingClientRect()
      if (pinch && box) zoom(distance / pinch, (a.x + b.x) / 2 - box.left, (a.y + b.y) / 2 - box.top)
      pinch = distance
    } else { x += dx; y += dy }
  }
  /** @param {PointerEvent} event */
  function up(event) {
    pointers.delete(event.pointerId)
    if (pointers.size < 2) pinch = 0
  }
  /** @param {MouseEvent} event */
  function click(event) {
    if (moved) { moved = false; return }
    const element = ruleOf(event)
    if (element) act(element)
  }
  /** Ctrl or ⌘ with the wheel (and a trackpad pinch) zooms; a sideways scroll pans; the rest
   * scrolls the page, or pans where the canvas fills the window or the screen and there is no page
   * to scroll. @param {WheelEvent} event */
  function wheel(event) {
    const box = viewport?.getBoundingClientRect()
    if (!box) return
    const unit = event.deltaMode === 1 ? 16 : 1
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      zoom(Math.exp(-event.deltaY * unit * 0.0015), event.clientX - box.left, event.clientY - box.top)
    } else if (fill || full) {
      event.preventDefault()
      x -= event.deltaX * unit
      y -= event.deltaY * unit
    } else if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      event.preventDefault()
      x -= event.deltaX * unit
    }
  }
  /** @param {KeyboardEvent} event */
  function key(event) {
    // The browser's own shortcuts, its zoom among them, stay its own.
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const element = ruleOf(event)
    if (element && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); act(element); return }
    if (element && !event.shiftKey) {
      const all = focusable(), at = all.indexOf(element)
      const to = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 }[event.key]
      if (to !== undefined) { event.preventDefault(); const next = all[Math.max(0, Math.min(all.length - 1, to))]; if (next) focusRule(next); return }
    }
    const step = 60
    const moves = /** @type {Record<string, () => void>} */ ({
      ArrowLeft: () => { x += step }, ArrowRight: () => { x -= step }, ArrowUp: () => { y += step }, ArrowDown: () => { y -= step },
      '+': () => zoom(1.25), '=': () => zoom(1.25), '-': () => zoom(0.8), '0': fit,
    })
    if (moves[event.key]) { event.preventDefault(); moves[event.key]() }
  }
  /** A rule focused shows in the panel. @param {FocusEvent} event */
  function focused(event) {
    if (viewport) { viewport.scrollLeft = 0; viewport.scrollTop = 0 }
    const element = ruleOf(event)
    if (element) { pick(element); roving = element.getAttribute('data-path') ?? roving }
  }

  // The selected rule stands out wherever it is drawn.
  $effect(() => {
    void tree
    const name = selected
    tick().then(() => { for (const element of viewport?.querySelectorAll('[data-rule]') ?? []) element.classList.toggle('selected', element.getAttribute('data-rule') === name) })
  })
</script>

<div class="rr" class:fill bind:this={root}>
  <div class="tools" role="toolbar" aria-label={t('baishi.grand.label')}>
    <button type="button" class="ui-button" onclick={expandLevel}>{t('baishi.grand.level')}</button>
    <button type="button" class="ui-button" onclick={expandAll}>{t('baishi.grand.all')}</button>
    <button type="button" class="ui-button" onclick={collapseAll}>{t('baishi.grand.none')}</button>
    <span class="zoom">
      <button type="button" class="ui-button" aria-label={t('baishi.grand.zoomOut')} title={t('baishi.grand.zoomOut')} onclick={() => zoom(0.8)}>−</button>
      <output>{Math.round(scale * 100)}%</output>
      <button type="button" class="ui-button" aria-label={t('baishi.grand.zoomIn')} title={t('baishi.grand.zoomIn')} onclick={() => zoom(1.25)}>+</button>
      <button type="button" class="ui-button" onclick={fit}>{t('baishi.grand.fit')}</button>
      <button type="button" class="ui-button" onclick={reset}>1:1</button>
      {#if canFull}
        <button type="button" class="ui-button" onclick={toggleFull}>
          <Icon name={full ? 'shrink' : 'expand'} size={15} />{full ? t('baishi.grand.exitFullscreen') : t('baishi.grand.fullscreen')}
        </button>
      {/if}
    </span>
  </div>
  <div class="body">
    <!-- The canvas pans and zooms by keyboard, wheel and pointer; its rules are focusable buttons. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div class="canvas" bind:this={viewport} tabindex="0" role="application" aria-label={t('baishi.grand.label')}
      onwheel={wheel} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onclick={click} onkeydown={key} onfocusin={focused}>
      <div class="plane" style:transform={`translate(${x}px, ${y}px) scale(${scale})`}>
        <svg class="railroad-diagram" role="group" aria-label={top} width={tree.width} height={tree.height} viewBox={`0 0 ${tree.width} ${tree.height}`} xmlns="http://www.w3.org/2000/svg">
          <g transform={`translate(${tree.x} ${tree.y})`}><RailroadNode node={tree.root} /></g>
        </svg>
      </div>
    </div>
    <p class="ui-visually-hidden" aria-live="polite">{announced}</p>
    <aside class="panel">
      {#if single}
        <h4><code>{selected}</code></h4>
        <button type="button" class="ui-button" onclick={() => showSelected()}>{t('baishi.grand.locate')}</button>
        <pre>{rules.get(selected)?.text}</pre>
        <div class="single">{@html single.svg}</div>
      {/if}
    </aside>
  </div>
  <div class="index" role="group" aria-label={t('baishi.grand.rules')}>
    {#each [...rules.keys()] as name (name)}
      <button type="button" class="ui-chip" aria-pressed={name === selected} onclick={() => { selected = name; announced = name }}>{name}</button>
    {/each}
  </div>
</div>

<style>
  .rr{display:flex;flex-direction:column;gap:8px;margin:0 0 16px}
  .tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .zoom{display:flex;gap:4px;align-items:center;margin-left:auto}
  .zoom output{min-width:44px;text-align:center;font-family:var(--ui-font-mono);font-size:12px;color:var(--ui-color-ink-soft)}
  .body{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:8px}
  .canvas{position:relative;height:min(70dvh,640px);overflow:clip;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface);touch-action:none;-webkit-user-select:none;user-select:none;cursor:grab;outline-offset:2px}
  .canvas:active{cursor:grabbing}
  .plane{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
  .panel{min-width:0;display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface);max-height:min(70dvh,640px);overflow:auto}
  .panel h4{margin:0;font-size:14px}
  .panel pre{margin:0;padding:6px 8px;background:var(--ui-color-surface-sunken);border-radius:var(--ui-radius-xs);font-family:var(--ui-font-mono),var(--cjk-sans);font-size:11.5px;line-height:1.55;white-space:pre;overflow-x:auto}
  .single{overflow:auto}
  .panel .ui-button{align-self:flex-start}
  .index{display:flex;flex-wrap:wrap;gap:4px}
  .index .ui-chip{font-family:var(--ui-font-mono);font-size:11.5px}
  .rr :global(svg.railroad-diagram){display:block}
  .rr :global(svg.railroad-diagram path){stroke:var(--ui-color-ink-soft);stroke-width:1.5;fill:none}
  .rr :global(svg.railroad-diagram rect){stroke:var(--ui-color-border-strong);stroke-width:1.2;fill:var(--ui-color-surface)}
  .rr :global(svg.railroad-diagram .terminal rect),.rr :global(svg.railroad-diagram .special rect){fill:var(--ui-color-surface-sunken)}
  .rr :global(svg.railroad-diagram .special rect){stroke-dasharray:4 3}
  .rr :global(svg.railroad-diagram text){font:12.5px var(--ui-font-mono),var(--cjk-sans);text-anchor:middle;fill:var(--ui-color-ink)}
  .rr :global(svg.railroad-diagram .non-terminal[data-path]){cursor:pointer}
  .rr :global(svg.railroad-diagram .non-terminal[data-path] text){fill:var(--ui-color-accent)}
  .rr :global(svg.railroad-diagram .recursive rect){stroke-dasharray:3 2}
  .rr :global(svg.railroad-diagram .frame){fill:none;stroke:var(--ui-color-border-strong);stroke-dasharray:4 3}
  .rr :global(svg.railroad-diagram .frame-label){cursor:pointer}
  .rr :global(svg.railroad-diagram .frame-label rect){fill:var(--ui-color-accent-soft);stroke:none}
  .rr :global(svg.railroad-diagram .frame-label text){text-anchor:start;fill:var(--ui-color-accent);font-weight:600}
  .rr :global(svg.railroad-diagram .selected > rect){stroke:var(--ui-color-accent);stroke-width:2.2}
  .rr :global(svg.railroad-diagram [tabindex]:focus-visible){outline:none}
  .rr :global(svg.railroad-diagram [tabindex]:focus-visible > rect){stroke:var(--ui-color-focus);stroke-width:3}
  .rr.fill,.rr:fullscreen{flex:1;min-height:0;margin:0}
  .rr:fullscreen{padding:12px 16px 16px;background:var(--ui-color-surface-sunken)}
  .rr.fill .body,.rr:fullscreen .body{flex:1;min-height:0;grid-template-rows:minmax(0,1fr)}
  .rr.fill .canvas,.rr:fullscreen .canvas{height:auto}
  .rr.fill .panel,.rr:fullscreen .panel{max-height:none}
  .rr.fill .index,.rr:fullscreen .index{max-height:5.5em;overflow:auto}
  .zoom .ui-button{display:inline-flex;align-items:center;gap:5px}
  @media (max-width:760px){
    .body{grid-template-columns:minmax(0,1fr)}
    .canvas{height:60dvh}
    .rr.fill .body,.rr:fullscreen .body{grid-template-rows:minmax(0,1fr) auto}
    .rr.fill .panel,.rr:fullscreen .panel{max-height:30dvh}
    .panel{max-height:none}
    .zoom{margin-left:0}
  }
</style>
