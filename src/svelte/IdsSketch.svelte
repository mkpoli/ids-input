<script>
  // Find a part by drawing it. The pad keeps the strokes in its own square; on the first pause it
  // compares them with the palette's shapes, built from the page's fonts, and lists the closest as
  // the Find tab's own buttons. A part picked is handed to `onpick`, and the pad is cleared for the
  // next drawing.
  import { onMount, untrack } from 'svelte'
  import { SIZE, rank, shapesOf } from '../core/sketch.js'
  import { sketchTemplates } from './sketch-templates.js'
  import { translator } from './i18n.js'

  /** @typedef {{ x: number, y: number }} Point */
  /** @type {{ adapter: import('../adapter/types.js').IdsAdapter, disabled?: boolean, messages?: Record<string, string>, locale?: string,
   *   onpick: (part: string) => void, onclose: () => void }} */
  let { adapter, disabled = false, messages, locale = 'en', onpick, onclose } = $props()
  const t = $derived(translator(messages, locale))
  const uid = $props.id()

  /** The pad's own square; the canvas is scaled by CSS, the strokes stay in these units. */
  const PAD = 240
  /** Where the part is looked for: the core's square. */
  const PITCH = SIZE
  let host = $state(/** @type {HTMLElement | null} */ (null))
  let canvas = $state(/** @type {HTMLCanvasElement | null} */ (null))
  /** @type {CanvasRenderingContext2D | null} */
  let context = null
  let font = $state('')
  let ink = '#000'

  /** @type {Point[][]} */
  let strokes = $state.raw([])
  /** @type {{ part: string, strokes: number | null }[]} */
  let results = $state.raw([])
  let preparing = $state(true)
  let progress = $state(/** @type {{ done: number, total: number }} */ ({ done: 0, total: 0 }))
  let failed = $state(false)
  let searching = $state(false)
  let looked = $state(false)
  /** @type {import('./sketch-templates.js').SketchTemplate[]} */
  let templates = []
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let compute
  let asks = 0
  /** @type {number | null} */
  let drawing = null

  onMount(() => {
    if (!host || !canvas) return
    const element = host
    font = getComputedStyle(element).fontFamily || 'sans-serif'
    ink = getComputedStyle(element).color || '#000'
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = PAD * scale
    canvas.height = PAD * scale
    context = canvas.getContext('2d')
    context?.setTransform(scale, 0, 0, scale, 0, 0)
    paint()
    canvas.focus({ preventScroll: true })
    // The pad's ink follows the theme; redraw when the page changes it.
    const scheme = matchMedia('(prefers-color-scheme: dark)')
    const repaint = () => { ink = getComputedStyle(element).color || ink; paint() }
    const observer = new MutationObserver(repaint)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    scheme.addEventListener('change', repaint)
    return () => { clearTimeout(timer); clearTimeout(compute); observer.disconnect(); scheme.removeEventListener('change', repaint) }
  })

  $effect(() => {
    // The palette and its shapes wait until the pad is open, then stay for this page.
    const read = adapter.parts, family = font
    if (!read) { preparing = false; failed = true; return }
    if (!family) return
    let live = true
    untrack(() => { preparing = true; failed = false; progress = { done: 0, total: 0 } })
    read().then(parts => sketchTemplates(parts, {
      font: family,
      onProgress: (done, total) => { if (live) progress = { done, total } },
    })).then(found => {
      if (!live) return
      templates = found
      preparing = false
      failed = !found.length
      if (found.length) recognize()
    }, () => { if (live) { preparing = false; failed = true } })
    return () => { live = false }
  })

  /** Where the pointer is in the pad's units. @param {PointerEvent} event */
  function point(event) {
    if (!canvas) return { x: 0, y: 0 }
    const box = canvas.getBoundingClientRect()
    const width = canvas.clientWidth || box.width, height = canvas.clientHeight || box.height
    return { x: (event.clientX - box.left - canvas.clientLeft) / width * PAD, y: (event.clientY - box.top - canvas.clientTop) / height * PAD }
  }

  /** @param {PointerEvent} event */
  function down(event) {
    if (disabled || event.button !== 0 || !context || !canvas || !event.isPrimary || drawing !== null) return
    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    drawing = event.pointerId
    clearTimeout(timer)
    results = []
    looked = false
    strokes = [...strokes, [point(event)]]
    paint()
  }

  /** @param {PointerEvent} event */
  function move(event) {
    if (drawing !== event.pointerId || !context) return
    const last = strokes[strokes.length - 1]
    if (!last) return
    const together = event.getCoalescedEvents?.() ?? []
    let next = last
    for (const at of (together.length ? together : [event]).map(point)) {
      const before = next[next.length - 1]
      if (Math.hypot(at.x - before.x, at.y - before.y) >= 1.2) next = [...next, at]
    }
    if (next === last) return
    strokes = [...strokes.slice(0, -1), next]
    paint()
  }

  /** @param {PointerEvent} event */
  function up(event) {
    if (drawing !== event.pointerId) return
    drawing = null
    schedule()
  }

  function paint() {
    if (!context || !canvas) return
    context.clearRect(0, 0, PAD, PAD)
    context.save()
    context.globalAlpha = 0.22
    context.strokeStyle = ink
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(PAD / 2, 0); context.lineTo(PAD / 2, PAD)
    context.moveTo(0, PAD / 2); context.lineTo(PAD, PAD / 2)
    context.moveTo(0, 0); context.lineTo(PAD, PAD)
    context.moveTo(PAD, 0); context.lineTo(0, PAD)
    context.stroke()
    context.restore()
    context.save()
    context.strokeStyle = ink
    context.lineWidth = 2.6
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (const stroke of strokes) {
      if (!stroke.length) continue
      context.beginPath()
      context.moveTo(stroke[0].x, stroke[0].y)
      if (stroke.length === 1) context.lineTo(stroke[0].x + 0.1, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) context.lineTo(stroke[i].x, stroke[i].y)
      context.stroke()
    }
    context.restore()
  }

  function schedule() {
    clearTimeout(timer)
    if (!strokes.length) { results = []; return }
    timer = setTimeout(recognize, 220)
  }

  /** The closest parts to the strokes, after the palette's shapes are ready. */
  function recognize() {
    if (!templates.length || !strokes.length) { results = []; searching = false; return }
    searching = true
    const id = ++asks
    // Let the searching note paint before the comparison runs.
    clearTimeout(compute)
    compute = setTimeout(() => {
      if (id !== asks) return
      const found = rank(shapesOf(strokes, { size: PITCH }), templates, { limit: 24, strokes: strokes.length })
      results = found.map(template => ({ part: template.part, strokes: template.strokes }))
      looked = true
      searching = false
    }, 0)
  }

  function undo() {
    if (!strokes.length) return
    strokes = strokes.slice(0, -1)
    results = []
    looked = false
    paint()
    schedule()
  }

  function clear() {
    strokes = []
    results = []
    looked = false
    asks++
    clearTimeout(timer)
    clearTimeout(compute)
    searching = false
    paint()
  }

  /** @param {string} part */
  function take(part) {
    onpick(part)
    clear()
    canvas?.focus({ preventScroll: true })
  }

  /** Escape closes the pad before a dialog around it hears the key. @param {KeyboardEvent} event */
  function key(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return
    event.preventDefault()
    event.stopPropagation()
    onclose()
  }
  const status = $derived(preparing ? t('ids.draw.preparing') : failed ? t('ids.draw.failed')
    : searching ? t('ids.from.searching') : results.length ? t('ids.search.count', { count: results.length })
    : looked && strokes.length ? t('ids.draw.none') : '')
</script>

<div class="ids-sketch" bind:this={host} role="group" aria-label={t('ids.draw.label')} onkeydowncapture={key}>
  <p class="hint" id={`${uid}-hint`}>{t('ids.draw.hint')}</p>
  <canvas bind:this={canvas} class="pad" tabindex="0" aria-label={t('ids.draw.canvas')} aria-describedby={`${uid}-hint`}
    class:disabled onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onlostpointercapture={up}></canvas>
  <div class="actions">
    <button type="button" disabled={disabled || !strokes.length} onclick={undo}>{t('ids.draw.undo')}</button>
    <button type="button" disabled={disabled || !strokes.length} onclick={clear}>{t('ids.draw.clear')}</button>
    <button type="button" class="close" onclick={onclose}>{t('ids.draw.close')}</button>
  </div>
  <p class="ids-note status" class:fault={failed} role="status">{status}</p>
  {#if preparing}
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={progress.total || 1} aria-valuenow={progress.done} aria-label={t('ids.draw.preparing')}><span style:width={`${progress.total ? progress.done / progress.total * 100 : 0}%`}></span></div>
  {/if}
  {#if results.length}
    <div class="found" role="group" aria-label={t('ids.draw.results')}>
      {#each results as result (result.part)}
        <button type="button" class="hit" disabled={disabled} lang="ja"
          title={`${result.part}${result.strokes === null ? '' : ` · ${t('parts.strokeCount', { count: result.strokes })}`}`}
          draggable="true" ondragstart={event => event.dataTransfer?.setData('text/plain', result.part)}
          onclick={() => take(result.part)}><span class="char">{result.part}</span></button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .ids-sketch{--_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));
    --_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));
    --_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));--_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));
    --_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));--_font:var(--ids-font,sans-serif);
    display:flex;flex-direction:column;gap:6px;min-width:0;color:var(--_ink);font-family:var(--_font)}
  .hint{margin:0;font-size:11px;line-height:1.45;color:var(--_muted)}
  .pad{display:block;width:100%;max-width:260px;aspect-ratio:1;margin:0 auto;border:1px solid var(--_line);border-radius:12px;
    background:var(--_surface);cursor:crosshair;touch-action:none}
  .pad.disabled{cursor:not-allowed;opacity:.55}
  .pad:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .actions{display:flex;gap:4px;flex-wrap:wrap}
  .actions button{font:inherit;font-size:12px;padding:4px 9px;border:1px solid var(--_line);border-radius:7px;background:var(--_surface);color:inherit;cursor:pointer}
  .actions button:disabled{opacity:.45;cursor:default}
  .actions button:not(:disabled):hover{border-color:var(--_accent)}
  .actions .close{margin-left:auto;color:var(--_muted)}
  .actions button:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-note{margin:0;font-size:11px;color:var(--_muted)}
  .ids-note.fault{color:var(--_fault)}
  .status{min-height:16px}
  .bar{height:3px;border-radius:2px;background:var(--_surface-subtle);overflow:hidden}
  .bar span{display:block;height:100%;background:var(--_accent);transition:width .15s}
  .found{display:flex;flex-wrap:wrap;gap:4px}
  .hit{display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:2px 8px;border:1px solid transparent;
    border-radius:8px;background:var(--_surface-subtle);color:inherit;cursor:pointer;font:inherit}
  .hit:not(:disabled):hover{border-color:var(--_accent)}
  .hit:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .char{font-family:var(--_font);font-size:24px;line-height:1.2}
  @media (max-width:560px){.pad{max-width:200px}}
</style>
