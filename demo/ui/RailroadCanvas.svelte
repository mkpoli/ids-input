<script>
  // One railroad diagram of a whole grammar, grown in place: every rule named on the line is a box
  // that opens into that rule's own diagram, spliced into the same track, and closes back. The
  // diagram is laid out again from the grammar on every change (lib/railroad.js). The canvas pans
  // and zooms; a rule clicked or focused shows on its own in the panel beside it.
  import { onMount, tick } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { openable, placeOf, railroad } from '../lib/railroad.js'

  /** @type {{ rules: Map<string, { text: string, expr: import('../lib/railroad.js').Expr }>, top: string,
   *   t: (key: string, params?: Record<string, unknown>) => string, selected?: string }} */
  let { rules, top, t, selected = $bindable(top) } = $props()

  const open = new SvelteSet()
  const diagram = $derived(railroad(rules, top, open))
  /** Where the selected rule was last picked in the diagram, and which rule that was. */
  let pickedAt = /** @type {string | null} */ (null), pickedFor = ''
  const single = $derived(rules.has(selected) ? railroad(rules, selected) : null)

  let scale = $state(1), x = $state(0), y = $state(0)
  /** @type {HTMLElement | undefined} */
  let viewport = $state()
  const MIN = 0.02, MAX = 3
  /** Zoom by `factor` about a point of the viewport. @param {number} factor @param {number} [px] @param {number} [py] */
  function zoom(factor, px = (viewport?.clientWidth ?? 0) / 2, py = (viewport?.clientHeight ?? 0) / 2) {
    const next = Math.min(MAX, Math.max(MIN, scale * factor))
    x = px - (px - x) * next / scale
    y = py - (py - y) * next / scale
    scale = next
  }
  function fit() {
    if (!viewport) return
    const w = viewport.clientWidth, h = viewport.clientHeight
    scale = Math.min(MAX, Math.max(MIN, Math.min(w / diagram.width, h / diagram.height) * 0.96))
    x = (w - diagram.width * scale) / 2
    y = (h - diagram.height * scale) / 2
  }
  /** Actual size, the top rule's line halfway down the canvas. */
  function reset() { scale = 1; x = 0; y = Math.max(0, ((viewport?.clientHeight ?? 0) - diagram.height) / 2) }
  onMount(reset)

  /** The element at a path: its box when closed, its frame when open. @param {string} path */
  const at = path => /** @type {SVGGElement | null} */ (viewport?.querySelector(`.spliced[data-path="${path}"], .non-terminal[data-path="${path}"]`) ?? null)
  /** The point of the line where an element starts, in the diagram's units. @param {Element} element */
  const anchor = element => ({ ax: Number(element.getAttribute('data-x')), ay: Number(element.getAttribute('data-y')) })

  /** Open or close a rule where it sits, keeping its place on screen and the focus on it. @param {string} path */
  async function toggle(path) {
    const before = at(path)
    const was = before ? anchor(before) : null
    if (open.has(path)) { for (const one of open) if (one === path || one.startsWith(`${path}/`)) open.delete(one) }
    else open.add(path)
    await tick()
    const after = at(path)
    if (was && after) {
      const now = anchor(after)
      x += (was.ax - now.ax) * scale
      y += (was.ay - now.ay) * scale
      // An opened rule grows above its line too: its label stays in view.
      await tick()
      const box = after.getBoundingClientRect(), view = viewport?.getBoundingClientRect()
      if (view && box.top < view.top + 8) y += view.top + 8 - box.top
      if (view && box.left < view.left + 8) x += view.left + 8 - box.left
    }
    await tick()
    focusAt(path)
  }
  /** @param {string} path */
  function focusAt(path) {
    const target = viewport?.querySelector(`.frame-label[data-path="${path}"], .non-terminal[data-path="${path}"]`)
    if (target instanceof SVGElement) target.focus({ preventScroll: true })
  }
  /** Bring a path into view at a readable size, opening what holds it. @param {string} path */
  async function locate(path) {
    const parts = path.split('/').slice(1)
    for (let n = 1; n < parts.length; n++) open.add(`/${parts.slice(0, n).join('/')}`)
    await tick()
    const element = path === '' ? null : at(path)
    const { ax, ay } = element ? anchor(element) : { ax: 30, ay: diagram.height / 2 }
    scale = Math.max(scale, 1)
    x = (viewport?.clientWidth ?? 0) / 3 - ax * scale
    y = (viewport?.clientHeight ?? 0) / 2 - ay * scale
    await tick()
    if (path) focusAt(path)
  }
  function showSelected() {
    const path = pickedFor === selected && pickedAt !== null ? pickedAt : placeOf(rules, top, selected)
    if (path !== null) locate(path)
  }

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
    const link = element.getAttribute('data-link')
    if (link !== null) { locate(link); return }
    const path = element.getAttribute('data-path')
    if (path !== null) toggle(path)
  }
  /** The rule a pointer or key event is on: a box, a link or an open rule's label. @param {Event} event */
  const ruleOf = event => /** @type {Element | null} */ (event.target instanceof Element ? event.target.closest('.non-terminal[data-path], .frame-label') : null)

  // Panning by dragging and pinching; a press that does not move is a click.
  /** @type {Map<number, { x: number, y: number }>} */
  const pointers = new Map()
  let moved = false, pinch = 0
  /** @param {PointerEvent} event */
  function down(event) {
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
  /** @param {WheelEvent} event */
  function wheel(event) {
    event.preventDefault()
    const box = viewport?.getBoundingClientRect()
    if (!box) return
    if (event.ctrlKey || !event.shiftKey) zoom(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0015)), event.clientX - box.left, event.clientY - box.top)
    else x -= event.deltaY
  }
  /** @param {KeyboardEvent} event */
  function key(event) {
    const element = ruleOf(event)
    if (element && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); act(element); return }
    const step = 60
    const moves = /** @type {Record<string, () => void>} */ ({
      ArrowLeft: () => { x += step }, ArrowRight: () => { x -= step }, ArrowUp: () => { y += step }, ArrowDown: () => { y -= step },
      '+': () => zoom(1.25), '=': () => zoom(1.25), '-': () => zoom(0.8), '0': fit,
    })
    if (moves[event.key]) { event.preventDefault(); moves[event.key]() }
  }
  /** A rule focused shows in the panel, and comes into view. @param {FocusEvent} event */
  function focused(event) {
    if (viewport) { viewport.scrollLeft = 0; viewport.scrollTop = 0 }
    const element = ruleOf(event)
    if (!element || !viewport) return
    pick(element)
    const box = element.getBoundingClientRect(), view = viewport.getBoundingClientRect()
    if (box.left < view.left || box.right > view.right) x += view.left + view.width / 3 - box.left
    if (box.top < view.top || box.bottom > view.bottom) y += view.top + view.height / 2 - box.top
  }

  // The selected rule stands out wherever it is drawn.
  $effect(() => {
    void diagram
    const name = selected
    for (const element of viewport?.querySelectorAll('[data-rule]') ?? []) element.classList.toggle('selected', element.getAttribute('data-rule') === name)
  })
</script>

<div class="rr">
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
    </span>
  </div>
  <div class="body">
    <!-- The canvas pans and zooms by keyboard, wheel and pointer; its rules are focusable buttons. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div class="canvas" bind:this={viewport} tabindex="0" role="application" aria-label={t('baishi.grand.label')}
      onwheel={wheel} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onclick={click} onkeydown={key} onfocusin={focused}>
      <div class="plane" style:transform={`translate(${x}px, ${y}px) scale(${scale})`}>{@html diagram.svg}</div>
    </div>
    <aside class="panel" aria-live="polite">
      {#if single}
        <h4><code>{selected}</code></h4>
        <button type="button" class="ui-button" onclick={showSelected}>{t('baishi.grand.locate')}</button>
        <pre>{rules.get(selected)?.text}</pre>
        <div class="single">{@html single.svg}</div>
      {/if}
    </aside>
  </div>
  <div class="index" role="group" aria-label={t('baishi.grand.rules')}>
    {#each [...rules.keys()] as name (name)}
      <button type="button" class="ui-chip" aria-pressed={name === selected} onclick={() => { selected = name }}>{name}</button>
    {/each}
  </div>
</div>

<style>
  .rr{display:flex;flex-direction:column;gap:8px;margin:0 0 16px}
  .tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .zoom{display:flex;gap:4px;align-items:center;margin-left:auto}
  .zoom output{min-width:44px;text-align:center;font-family:var(--ui-font-mono);font-size:12px;color:var(--ui-color-ink-soft)}
  .body{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:8px}
  .canvas{position:relative;height:min(70dvh,640px);overflow:clip;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface);touch-action:none;cursor:grab;outline-offset:2px}
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
  @media (max-width:760px){
    .body{grid-template-columns:minmax(0,1fr)}
    .canvas{height:60dvh}
    .panel{max-height:none}
    .zoom{margin-left:0}
  }
</style>
