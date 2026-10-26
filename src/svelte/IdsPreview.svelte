<script>
  // A description as the adapter's `preview` draws it, large and at 1em. Each filled part is drawn as
  // the drawing draws it; an empty slot is a placeholder in the box the layout gives it, and the part
  // being edited takes the selection colour. Until the first drawing is done, the frame shows
  // placeholders where the layout puts each part (even shares before the layout has loaded); after
  // that the last drawing stays until the next is done and fades into it. Where the adapter's
  // `drawing` holds a final image of the whole description, that image is shown, badged as final. A
  // description too large to draw, or one the preview cannot draw, shows placeholders and says so;
  // while the preview's data cannot be read at all, the placeholders stand with no badge.
  import { fade } from 'svelte/transition'
  import { EMPTY, leaves, samePath, write } from '../core/ids.js'
  import { FACE, STROKE, badge, groupParts, partTransform, placeholder, roughLayout, runPreview } from '../core/preview.js'
  import { translator } from './i18n.js'

  /**
   * @typedef {import('../adapter/types.js').IdsAdapter} IdsAdapter
   * @typedef {import('../adapter/types.js').Drawing} Drawing
   * @typedef {import('../adapter/types.js').SketchLeaf} SketchLeaf
   * @typedef {import('../core/ids.js').Part} Part
   * @typedef {import('../core/ids.js').Path} Path
   */

  /** @typedef {{ dx?: number, dy?: number, scale?: number, rotate?: number }} PartAdjustment */
  /**
   * @type {{ adapter: IdsAdapter, tree: Part, chosen?: Path | null, messages?: Record<string, string>, locale?: string, small?: boolean, notes?: boolean, delay?: number, drawing?: Drawing | null, editable?: boolean, adjustments?: Record<string, PartAdjustment>, onchoose?: ((path: Path) => void) | null }}
   */
  let { adapter, tree, chosen = null, messages, locale = 'en', small = true, notes = true, delay = 150, drawing = $bindable(null),
    editable = false, adjustments = $bindable({}), onchoose = null } = $props()
  const t = $derived(translator(messages, locale))

  const uid = $props.id()
  const sequence = $derived(write(tree))
  const parts = $derived(leaves(tree))
  // Even shares of the face, for when the layout has not loaded.
  const even = $derived(roughLayout(tree).map((/** @type {{ char: string | null, box: number[] }} */ leaf, /** @type {number} */ index) => ({ index, empty: leaf.char === null,
    box: [FACE[0] + leaf.box[0] * FACE[2], FACE[1] + leaf.box[1] * FACE[3], (leaf.box[2] - leaf.box[0]) * FACE[2], (leaf.box[3] - leaf.box[1]) * FACE[3]] })))
  let sketched = $state.raw(/** @type {{ text: string, leaves: SketchLeaf[] } | null} */ (null))
  let shown = $state.raw(/** @type {{ key: number, url?: string, drawn?: Drawing } | null} */ (null))
  let step = $state(/** @type {'idle' | 'loading' | 'composed' | 'final' | 'failed' | 'capped' | 'unavailable'} */ ('idle'))
  // No badge while there is nothing to say: no preview asked, or no data to draw from.
  const quiet = $derived(step === 'idle' || step === 'unavailable')
  let count = 0

  // A description is drawn after a short pause in editing. A newer one aborts the one before, and an
  // answer for a description since replaced is dropped.
  $effect(() => {
    const text = sequence, empty = text === EMPTY, ask = adapter.preview, final = adapter.drawing
    sketched = null
    if (empty || !(ask || final)) { step = 'idle'; shown = null; return }
    step = 'loading'
    // Start the export's manifest and layout while the edit settles; the first draw then waits on
    // the parts it needs, not on the export itself.
    ask?.warm?.()
    const controller = new AbortController(), signal = controller.signal
    const timer = setTimeout(() => runPreview(text, { preview: ask, drawing: final, signal }, patch => {
      if (patch.sketch) { sketched = { text, leaves: /** @type {SketchLeaf[]} */ (patch.sketch) }; return }
      shown = patch.url ? { key: ++count, url: patch.url } : patch.drawn ? { key: ++count, drawn: /** @type {Drawing} */ (patch.drawn) } : null
      step = /** @type {typeof step} */ (patch.step)
    }), delay)
    return () => { clearTimeout(timer); controller.abort() }
  })

  const said = $derived(badge(step, shown?.drawn))
  /** @type {Record<string, string>} */
  const NOTES = { approximate: 'ids.preview.approximateNote', failed: 'ids.preview.failedNote', tooLarge: 'ids.preview.tooLargeNote' }
  const NAMES = /** @type {Record<string, string>} */ ({ '⿼': 'fromRight', '⿽': 'fromLowerRight', '⿾': 'mirrored', '⿿': 'rotated', '㇯': 'subtracted', '〾': 'variant' })
  // The operators named in words: their characters are too new for most fonts to show.
  const named = $derived(/** @type {Record<string, string>} */ (said.params.ops ? { ops: said.params.ops.split(' ').map((/** @type {string} */ op) => NAMES[op] ? t(`ids.op.${NAMES[op]}`) : op).join(' · ') } : {}))
  const note = $derived(!quiet && said.label in NOTES ? t(NOTES[said.label], named) : '')
  // The placeholders shown in place of a drawing: where the layout puts each part, else even shares.
  const boxes = $derived(sketched?.text === sequence && step !== 'capped' ? sketched.leaves : even)
  /** Whether the leaf at `index` lies in the part being edited. @param {number | undefined} index */
  const inChosen = index => {
    const leaf = index === undefined ? undefined : parts[index]
    return Boolean(chosen && leaf && (samePath(leaf.path, chosen) || leaf.path.length > chosen.length && chosen.every((x, i) => x === leaf.path[i])))
  }
  /** An empty slot of a drawing, by its number, as the leaf it is. @param {number} number */
  const slotLeaf = number => parts.map((leaf, index) => ({ leaf, index })).filter(({ leaf }) => leaf.char === null)[number]?.index

  // ---------------------------------------------------------------- adjusting the drawing
  // The drawing can be changed one leaf at a time: the composer's parts are grouped by the sketch
  // boxes, each group moved, scaled and turned about its own centre. The adjustments are keyed by
  // the leaf's path, so changing a part's character keeps them and changing the tree lets them go.
  /** @param {Path} path */
  const pathKey = path => path.join('.')
  /** @param {number[]} a @param {number[]} b */
  const overlapArea = (a, b) => {
    const width = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])
    const height = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])
    return width > 0 && height > 0 ? width * height : 0
  }
  /** Whether two boxes cover nearly the same area, as an overlay's operands do. @param {number[]} a @param {number[]} b */
  const sameBox = (a, b) => {
    const smaller = Math.min(a[2] * a[3], b[2] * b[3])
    return smaller > 0 && overlapArea(a, b) >= smaller * 0.9
  }
  /** @param {DOMPoint} point @param {number[]} box */
  const insideBox = (point, box) => point.x >= box[0] && point.x <= box[0] + box[2] && point.y >= box[1] && point.y <= box[1] + box[3]
  const saved = $derived(adjustments ?? {})
  const hasAdjustments = $derived(Object.keys(saved).length > 0)
  const groups = $derived.by(() => {
    const drawn = shown?.drawn
    if (!drawn?.parts?.length || drawn.cut || !sketched || sketched.text !== sequence) return null
    return groupParts(drawn.parts, sketched.leaves)
  })
  // Parts are drawn one by one while a host edits them, or while an adjustment needs applying.
  const useParts = $derived(Boolean(groups?.length && (editable || hasAdjustments)))
  const adjustable = $derived(Boolean(editable && groups?.length))
  const chosenIndex = $derived(chosen ? parts.findIndex(leaf => samePath(leaf.path, chosen)) : -1)
  const selection = $derived(chosenIndex >= 0 && groups ? groups.find(group => group.index === chosenIndex) ?? null : null)
  // An overlay's operands cover one box, so a move grip on the selection keeps the chosen one movable.
  const overlappingSelection = $derived(Boolean(selection && groups?.some(group => group.index !== selection.index && sameBox(group.box, selection.box))))
  const adjustNote = $derived(editable && step === 'composed' && shown?.drawn && !groups ? t('ids.adjust.unavailable') : '')
  /** The character of the leaf at `index`, for a handle's name. @param {number} index */
  const partName = index => {
    const part = parts[index]?.char
    return typeof part === 'string' ? part : ''
  }
  /** The transform of the leaf at `index`, or ''. @param {number} index */
  function transformOf(index) {
    const leaf = parts[index], group = groups?.find(candidate => candidate.index === index)
    return leaf && group ? partTransform(saved[pathKey(leaf.path)], group.box) : ''
  }
  const partTransforms = $derived.by(() => {
    if (!useParts || !groups || !shown?.drawn?.parts) return null
    const out = new Array(shown.drawn.parts.length).fill(null)
    let any = false
    for (const group of groups) {
      const leaf = parts[group.index]
      const transform = leaf ? partTransform(saved[pathKey(leaf.path)], group.box) : ''
      if (!transform) continue
      any = true
      for (const index of group.parts) out[index] = transform
    }
    return any ? out : null
  })
  // The drawing shown, for a host to export; none while it is out of date or failed. A drawing with
  // adjusted parts carries the transforms, which `drawingSvg` writes with each part's own path.
  $effect(() => {
    const raw = step === 'composed' && shown?.drawn ? shown.drawn : null
    const transforms = partTransforms
    drawing = raw ? (transforms ? { ...raw, transforms } : raw) : null
  })

  /** @type {{ kind: 'move' | 'scale' | 'rotate', index: number, svg: SVGSVGElement, p0: { x: number, y: number }, start: Required<PartAdjustment>, center: [number, number], d0: number, a0: number } | null} */
  let drag = $state.raw(null)
  /** A pointer in the drawing's own coordinates. @param {SVGSVGElement} svg @param {PointerEvent} event */
  function pointAt(svg, event) {
    const matrix = svg.getScreenCTM()
    if (!matrix) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return point.matrixTransform(matrix.inverse())
  }
  /** @param {number} value */
  const round = value => Math.round(value * 100) / 100
  /** @param {number} value @param {number} low @param {number} high */
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
  /** Put `next` on the leaf at `index`, or take its adjustment away when it changes nothing. @param {number} index @param {PartAdjustment} next */
  function adjust(index, next) {
    const leaf = parts[index]
    if (!leaf) return
    const key = pathKey(leaf.path), copy = { ...saved }
    if (!next.dx && !next.dy && (next.scale ?? 1) === 1 && !next.rotate) delete copy[key]
    else copy[key] = next
    adjustments = copy
  }
  /** @param {PointerEvent} event @param {{ index: number, box: number[] }} group @param {'move' | 'scale' | 'rotate'} kind */
  function startDrag(event, group, kind) {
    if (!adjustable) return
    event.preventDefault()
    event.stopPropagation()
    const element = /** @type {SVGElement | null} */ (event.currentTarget)
    const svg = /** @type {SVGSVGElement | null} */ (element?.ownerSVGElement ?? null)
    if (!svg) return
    const p = pointAt(svg, event)
    if (!p) return
    // A click on one of several parts sharing a box steps to the next of them, so both are reachable.
    let picked = group
    if (kind === 'move' && group.index === chosenIndex && groups && element?.classList.contains('part')) {
      const stacked = groups.filter(candidate => insideBox(p, candidate.box) && sameBox(candidate.box, group.box))
      if (stacked.length > 1) picked = stacked[(stacked.findIndex(candidate => candidate.index === group.index) + 1) % stacked.length]
    }
    const leaf = parts[picked.index]
    if (!leaf) return
    onchoose?.(leaf.path)
    const [x, y, width, height] = picked.box
    const current = saved[pathKey(leaf.path)] ?? {}
    const start = { dx: current.dx ?? 0, dy: current.dy ?? 0, scale: current.scale ?? 1, rotate: current.rotate ?? 0 }
    const center = /** @type {[number, number]} */ ([x + width / 2 + start.dx, y + height / 2 + start.dy])
    drag = { kind, index: picked.index, svg, p0: p, start, center, d0: Math.hypot(p.x - center[0], p.y - center[1]), a0: Math.atan2(p.y - center[1], p.x - center[0]) }
    svg.setPointerCapture?.(event.pointerId)
    svg.focus?.({ preventScroll: true })
  }
  /** @param {PointerEvent} event */
  function moveDrag(event) {
    if (!drag) return
    const p = pointAt(drag.svg, event)
    if (!p) return
    const start = drag.start
    const next = { ...start }
    if (drag.kind === 'move') {
      next.dx = round(start.dx + p.x - drag.p0.x)
      next.dy = round(start.dy + p.y - drag.p0.y)
    } else if (drag.kind === 'scale') {
      const distance = Math.hypot(p.x - drag.center[0], p.y - drag.center[1])
      next.scale = Math.round(clamp(start.scale * distance / Math.max(drag.d0, 1), 0.25, 4) * 1000) / 1000
    } else {
      const angle = Math.atan2(p.y - drag.center[1], p.x - drag.center[0])
      let rotate = start.rotate + (angle - drag.a0) * 180 / Math.PI
      if (event.shiftKey) rotate = Math.round(rotate / 15) * 15
      next.rotate = round(((rotate + 180) % 360 + 360) % 360 - 180)
    }
    adjust(drag.index, next)
  }
  /** @param {PointerEvent} event */
  function endDrag(event) {
    if (!drag) return
    if (drag.svg.hasPointerCapture?.(event.pointerId)) drag.svg.releasePointerCapture(event.pointerId)
    drag = null
  }
  /** The keys that adjust the selected part; the tree keeps its own keys. @param {KeyboardEvent} event */
  function adjustKey(event) {
    if (!selection) return
    const leaf = parts[selection.index]
    if (!leaf) return
    const current = saved[pathKey(leaf.path)] ?? {}
    const next = { dx: current.dx ?? 0, dy: current.dy ?? 0, scale: current.scale ?? 1, rotate: current.rotate ?? 0 }
    const step = event.shiftKey ? 10 : 1
    if (event.key === 'ArrowLeft') next.dx -= step
    else if (event.key === 'ArrowRight') next.dx += step
    else if (event.key === 'ArrowUp') next.dy -= step
    else if (event.key === 'ArrowDown') next.dy += step
    else if (event.key === '+' || event.key === '=') next.scale = Math.round(clamp(next.scale * 1.05, 0.25, 4) * 1000) / 1000
    else if (event.key === '-') next.scale = Math.round(clamp(next.scale / 1.05, 0.25, 4) * 1000) / 1000
    else if (event.key === '[') next.rotate = round(next.rotate - (event.shiftKey ? 15 : 5))
    else if (event.key === ']') next.rotate = round(next.rotate + (event.shiftKey ? 15 : 5))
    else if (event.key === '0') { adjust(selection.index, {}); event.preventDefault(); event.stopPropagation(); return }
    else return
    event.preventDefault()
    event.stopPropagation()
    adjust(selection.index, next)
  }
</script>

{#snippet slot(/** @type {number[]} */ box, /** @type {number} */ stroke, /** @type {boolean} */ selected, /** @type {boolean} */ faint)}
  {@const p = placeholder(box, stroke)}
  <g class="slot" class:selected class:faint>
    <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} class="slot-fill" />
    <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} class="slot-line"
      stroke-width={p.dot} pathLength={p.dots} stroke-dasharray="0 1" />
  </g>
{/snippet}

{#snippet picture(/** @type {string} */ name, /** @type {boolean} */ interactive)}
  <div class="frame">
    {#if shown}
      {#key shown.key}
        <div class="layer" transition:fade={{ duration: 180 }}>
          {#if shown.url}
            <span class="final" style:--drawing={`url("${shown.url}")`}></span>
          {:else if shown.drawn}
            {@const drawn = shown.drawn}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <svg viewBox="0 0 1000 1000" class:adjusting={interactive}
              aria-hidden={interactive ? undefined : 'true'}
              role={interactive ? 'application' : undefined}
              aria-label={interactive ? t('ids.adjust.hint') : undefined}
              tabindex={interactive ? 0 : undefined}
              onpointermove={interactive ? moveDrag : undefined}
              onpointerup={interactive ? endDrag : undefined}
              onpointercancel={interactive ? endDrag : undefined}
              onkeydown={interactive ? adjustKey : undefined}>
              {#if drawn.cut}
                <mask id="{uid}-{name}"><rect width="1000" height="1000" fill="#fff" /><path d={drawn.cut} fill="#000" /></mask>
              {/if}
              {#if useParts && groups}
                {#each groups as group (group.index)}
                  <g class="part" class:adjusting={interactive} data-leaf={group.index} transform={transformOf(group.index) || undefined}
                    role={interactive ? 'button' : undefined} tabindex={interactive ? -1 : undefined}
                    aria-label={interactive ? t('ids.adjust.move', { part: partName(group.index) }) : undefined}
                    onpointerdown={interactive ? event => startDrag(event, group, 'move') : undefined}>
                    {#each group.parts as index (index)}
                      <path class="ink" d={drawn.parts?.[index]?.d} />
                    {/each}
                  </g>
                {/each}
              {:else}
                <path class="ink" d={drawn.d} mask={drawn.cut ? `url(#${uid}-${name})` : undefined} />
              {/if}
              {#each drawn.slots ?? [] as s (s.index)}
                {@render slot(s.box, drawn.stroke?.[0] ?? STROKE, inChosen(slotLeaf(s.index)), false)}
              {/each}
              {#if interactive && selection}
                {@const [x, y, width, height] = selection.box}
                {@const scale = saved[pathKey(parts[selection.index].path)]?.scale ?? 1}
                {@const size = 26 / Math.max(scale, 0.05)}
                <g class="selection" transform={transformOf(selection.index) || undefined}>
                  <rect class="select-box" x={x} y={y} width={width} height={height} rx={6} />
                  {#if overlappingSelection}
                    {@const grip = Math.min(size * 0.45, Math.min(width, height) * 0.22)}
                    <circle class="handle move" cx={x + width / 2} cy={y + height / 2} r={grip}
                      role="button" tabindex="-1" aria-label={t('ids.adjust.move', { part: partName(selection.index) })}
                      onpointerdown={event => startDrag(event, selection, 'move')} />
                    <path class="grip-cross" pointer-events="none"
                      d={`M${x + width / 2 - grip * 0.5} ${y + height / 2}H${x + width / 2 + grip * 0.5}M${x + width / 2} ${y + height / 2 - grip * 0.5}V${y + height / 2 + grip * 0.5}`} />
                  {/if}
                  <line class="turn-line" x1={x + width / 2} y1={y} x2={x + width / 2} y2={y - size * 1.35} />
                  <circle class="handle rotate" cx={x + width / 2} cy={y - size * 1.9} r={size * 0.55}
                    role="slider" tabindex="-1" aria-label={t('ids.adjust.rotate', { part: partName(selection.index) })}
                    aria-valuemin="-180" aria-valuemax="180" aria-valuenow={saved[pathKey(parts[selection.index].path)]?.rotate ?? 0}
                    onpointerdown={event => startDrag(event, selection, 'rotate')} />
                  <rect class="handle scale" x={x + width - size / 2} y={y + height - size / 2} width={size} height={size} rx={size / 5}
                    role="slider" tabindex="-1" aria-label={t('ids.adjust.scale', { part: partName(selection.index) })}
                    aria-valuemin="0.25" aria-valuemax="4" aria-valuenow={scale}
                    onpointerdown={event => startDrag(event, selection, 'scale')} />
                </g>
              {/if}
            </svg>
          {/if}
        </div>
      {/key}
    {:else}
      <div class="layer" transition:fade={{ duration: 180 }}>
        <svg viewBox="0 0 1000 1000" aria-hidden="true">
          {#each boxes as leaf (leaf.index)}
            {@render slot(leaf.box, STROKE, inChosen(leaf.index), !leaf.empty)}
          {/each}
        </svg>
      </div>
    {/if}
  </div>
{/snippet}

<figure class="ids-preview" data-step={step} data-label={said.label} data-adjusting={editable ? 'true' : undefined}
  aria-busy={step === 'loading'} aria-label={t('ids.preview.drawing', { sequence })}>
  <div class="ids-preview-large">
    {@render picture('large', adjustable)}
    {#if step === 'loading'}<span class="ids-preview-progress" aria-hidden="true"></span>{/if}
  </div>
  {#if small || !quiet}
    <figcaption class="ids-preview-meta">
      {#if small}<div class="ids-preview-small">{@render picture('small', false)}</div>{/if}
      {#if !quiet}
        {#if step === 'loading'}<span class="ids-preview-spinner" aria-hidden="true"></span>{/if}
        <span class="ids-preview-badge" title={note || undefined}>{t(`ids.preview.${said.label}`)}</span>
      {/if}
    </figcaption>
  {/if}
  {#if note && notes}<p class="ids-preview-note">{note}</p>{/if}
  {#if adjustNote}<p class="ids-preview-note">{adjustNote}</p>{/if}
</figure>

<style>
  .ids-preview{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));
    --_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    margin:0;display:flex;flex-direction:column;align-items:center;gap:6px;width:var(--ids-preview-size,120px);max-width:100%;flex:none}
  .ids-preview-large{position:relative;width:100%;aspect-ratio:1;border:1px solid var(--_line);border-radius:10px;background:var(--_surface);color:var(--_ink);overflow:hidden}
  .ids-preview-progress{position:absolute;right:0;bottom:0;left:0;height:2px;overflow:hidden;background:color-mix(in srgb,var(--_line) 55%,transparent);pointer-events:none}
  .ids-preview-progress::before{content:"";position:absolute;inset-block:0;left:0;width:42%;border-radius:2px;background:var(--_accent);animation:ids-preview-sweep 1.15s ease-in-out infinite}
  .ids-preview-spinner{flex:none;width:11px;height:11px;border:1.5px solid color-mix(in srgb,var(--_muted) 28%,transparent);border-top-color:var(--_accent);border-radius:50%;animation:ids-preview-spin .8s linear infinite}
  .ids-preview-meta{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 8px;min-height:22px;max-width:100%}
  .ids-preview-small{width:20px;height:20px;color:var(--_ink)}
  .frame{position:relative;width:100%;height:100%}
  .layer{position:absolute;inset:0}
  .ids-preview-large .layer{inset:5%}
  .layer :is(svg,.final){display:block;width:100%;height:100%}
  .final{background:currentColor;-webkit-mask:var(--drawing) center/100% 100% no-repeat;mask:var(--drawing) center/100% 100% no-repeat}
  @media (forced-colors: active){.final{forced-color-adjust:none;background:CanvasText}.ink{fill:CanvasText}}
  .ink{fill:currentColor}
  .ids-preview-large svg[tabindex]:focus-visible{outline:2px solid var(--_accent);outline-offset:-2px;border-radius:10px}
  .ids-preview[data-adjusting] .ids-preview-meta{display:none}
  .adjusting{touch-action:none}
  .adjusting .part{cursor:grab}
  .adjusting .part:active{cursor:grabbing}
  .selection{pointer-events:none}
  .select-box{fill:none;stroke:var(--_accent);stroke-width:1.5;stroke-dasharray:6 5;vector-effect:non-scaling-stroke}
  .turn-line{stroke:var(--_accent);stroke-width:1.5;vector-effect:non-scaling-stroke}
  .handle{fill:var(--_surface);stroke:var(--_accent);stroke-width:1.5;vector-effect:non-scaling-stroke;pointer-events:all}
  .handle.scale{cursor:nwse-resize}
  .handle.rotate{cursor:grab}
  .handle.move{cursor:move}
  .grip-cross{stroke:var(--_accent);stroke-width:1.5;vector-effect:non-scaling-stroke}
  @media (forced-colors: active){.handle{fill:Canvas;stroke:CanvasText}.select-box,.turn-line{stroke:CanvasText}}
  .slot-fill{fill:color-mix(in srgb,var(--_accent) 6%,transparent)}
  .slot-line{fill:none;stroke:color-mix(in srgb,var(--_accent) 50%,var(--_muted));stroke-linecap:round}
  .slot.faint .slot-fill{fill:color-mix(in srgb,var(--_ink) 3%,transparent)}
  .slot.faint .slot-line{stroke:color-mix(in srgb,var(--_ink) 20%,transparent)}
  .slot.selected .slot-fill{fill:color-mix(in srgb,var(--_accent) 16%,transparent)}
  .slot.selected .slot-line{stroke:var(--_accent)}
  .ids-preview-badge{padding:0 7px;border-radius:999px;font-size:11px;line-height:18px;color:var(--_muted);border:1px solid var(--_line);text-align:center}
  .ids-preview[data-label="loading"] .ids-preview-badge{color:var(--_accent);border-color:color-mix(in srgb,var(--_accent) 35%,var(--_line))}
  .ids-preview[data-label="final"] .ids-preview-badge{color:var(--_accent);border-color:color-mix(in srgb,var(--_accent) 45%,var(--_line))}
  .ids-preview:is([data-label="failed"],[data-label="tooLarge"]) .ids-preview-badge{color:var(--_fault);border-color:color-mix(in srgb,var(--_fault) 35%,var(--_line))}
  .ids-preview-note{margin:0;width:100%;font-size:11px;line-height:1.4;color:var(--_muted);text-align:center;overflow-wrap:anywhere}
  @keyframes ids-preview-spin{to{transform:rotate(1turn)}}
  @keyframes ids-preview-sweep{from{transform:translateX(-110%)}to{transform:translateX(260%)}}
  @media (prefers-reduced-motion: reduce){
    .ids-preview-spinner{animation:none;border-top-color:var(--_muted)}
    .ids-preview-progress::before{animation:none;width:100%;background:var(--_line)}
  }
</style>
