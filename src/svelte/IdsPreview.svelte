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
  import { EMOJI_CUT_MATRIX, FACE, STROKE, badge, emojiTransform, placeholder, roughLayout, runPreview } from '../core/preview.js'
  import { documentView } from '../composer/index.js'
  import { affineForChain, boxCorners, invertAffine, layerAtPath, multiplyAffine, scopesMarkup } from '../document/index.js'
  import { translator } from './i18n.js'

  /**
   * @typedef {import('../adapter/types.js').IdsAdapter} IdsAdapter
   * @typedef {import('../adapter/types.js').Drawing} Drawing
   * @typedef {import('../adapter/types.js').SketchLeaf} SketchLeaf
   * @typedef {import('../core/ids.js').Part} Part
   * @typedef {import('../core/ids.js').Path} Path
   */

  /** @typedef {import('../document/index.js').Document} Document */
  /** @typedef {import('../document/session.js').DocumentSession} DocumentSession */
  /** @typedef {import('../document/render.js').ScopeTree} ScopeTree */
  /**
   * @type {{ adapter: IdsAdapter, tree: Part, chosen?: Path | null, messages?: Record<string, string>, locale?: string, small?: boolean, notes?: boolean, delay?: number, detail?: string, detailContent?: import('svelte').Snippet, drawing?: Drawing | null, document?: Document | null, session?: DocumentSession | null, version?: number, scopes?: ScopeTree | null, editable?: boolean, onedit?: (() => void) | null }}
   */
  let { adapter, tree, chosen = null, messages, locale = 'en', small = true, notes = true, delay = 150, detail = '', detailContent, drawing = $bindable(null),
    document = null, session = null, version = 0, scopes = $bindable(null), editable = false, onedit = null } = $props()
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
    ask?.warm?.(text)
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

  // ---------------------------------------------------------------- document transforms
  let localDoc = $state(/** @type {Document | null} */ (null))
  $effect(() => { version; localDoc = session?.document ?? document })
  const view = $derived.by(() => {
    const drawn = shown?.drawn
    if (!localDoc || !drawn || !sketched || sketched.text !== sequence) return null
    return documentView(localDoc, drawn, sketched.leaves)
  })
  const adjustNote = $derived(editable && step === 'composed' && shown?.drawn && !view?.complete ? t('ids.adjust.unavailable') : '')
  $effect(() => {
    scopes = view?.scopes ?? null
    drawing = view?.scopes ? null : step === 'composed' && shown?.drawn ? shown.drawn : null
  })
  const chosenLayer = $derived(localDoc && chosen ? layerAtPath(localDoc.root, chosen) : null)
  const frame = $derived(chosenLayer ? view?.frames.get(chosenLayer.id) ?? null : null)
  const selectionBox = $derived(frame ? boxCorners(frame.canvas, frame.box) : null)
  const flat = $derived(chosenLayer ? affineForChain(chosenLayer.transform ?? []) : null)
  const rotationValue = $derived(flat ? Math.round(Math.atan2(flat[1], flat[0]) * 1800 / Math.PI) / 10 : 0)
  const scaleValue = $derived(flat ? Math.round(Math.hypot(flat[0], flat[1]) * 1000) / 1000 : 1)
  /** @type {{ gesture: number, kind: 'move' | 'scale' | 'rotate', id: string, svg: SVGSVGElement, p0: { x: number, y: number }, center: [number, number], frame: number[], base: import('../document/index.js').Chain, d0: number, a0: number } | null} */
  let docDrag = $state.raw(null)
  let gesture = 0
  /** A pointer in the drawing's own coordinates. @param {SVGSVGElement} svg @param {PointerEvent} event */
  function pointAt(svg, event) {
    const matrix = svg.getScreenCTM()
    if (!matrix) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return point.matrixTransform(matrix.inverse())
  }
  /** An emoji's box and glyph size, with every number finite. @param {{ box?: number[] }} item */
  const emojiBox = item => {
    const [x, y, width, height] = (item.box ?? []).slice(0, 4).map(value => Number.isFinite(Number(value)) ? Number(value) : 0)
    return { x, y, width, height, size: Math.max(0, Math.min(width, height) * 0.85) }
  }
  /** @param {number} value */
  const round = value => Math.round(value * 100) / 100
  /** @param {number} value @param {number} low @param {number} high */
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
  /** Apply a canvas-space affine operation to the chosen layer. @param {number[]} operation @param {import('../document/index.js').Chain} base @param {string} id @param {number[]} frameMatrix @param {string} coalesce */
  function applyCanvas(operation, base, id, frameMatrix, coalesce) {
    if (!session) return
    const inverse = invertAffine(frameMatrix)
    if (!inverse) return
    const local = multiplyAffine(inverse, multiplyAffine(operation, frameMatrix))
    session.setTransform([...base, { type: 'affine', matrix: local }], id, { coalesce })
    localDoc = session.document
    onedit?.()
  }
  /** @param {KeyboardEvent} event */
  function adjustKey(event) {
    if (!editable || !session || !chosenLayer || !frame?.supported || !selectionBox || !flat) return
    const key = event.key
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '[', ']', '0'].includes(key)) return
    event.preventDefault()
    event.stopPropagation()
    if (key === '0') {
      session.clearTransform(chosenLayer.id)
      localDoc = session.document
      onedit?.()
      return
    }
    const [cx, cy] = [selectionBox[0] + selectionBox[2] / 2, selectionBox[1] + selectionBox[3] / 2]
    const step = event.shiftKey ? 10 : 1
    let operation = [1, 0, 0, 1, 0, 0]
    if (key === 'ArrowLeft') operation = [1, 0, 0, 1, -step, 0]
    else if (key === 'ArrowRight') operation = [1, 0, 0, 1, step, 0]
    else if (key === 'ArrowUp') operation = [1, 0, 0, 1, 0, -step]
    else if (key === 'ArrowDown') operation = [1, 0, 0, 1, 0, step]
    else if (key === '+' || key === '=') { const scale = 1.05; operation = [scale, 0, 0, scale, cx * (1 - scale), cy * (1 - scale)] }
    else if (key === '-') { const scale = 1 / 1.05; operation = [scale, 0, 0, scale, cx * (1 - scale), cy * (1 - scale)] }
    else {
      const degrees = key === '[' ? -(event.shiftKey ? 15 : 5) : event.shiftKey ? 15 : 5
      const radians = degrees * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians)
      operation = [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy]
    }
    applyCanvas(operation, [{ type: 'affine', matrix: flat }], chosenLayer.id, frame.frame, `key-${key}`)
  }
  /** @param {PointerEvent} event @param {'move' | 'scale' | 'rotate'} kind */
  function startDrag(event, kind) {
    if (!editable || !session || !chosenLayer || !frame?.supported || !selectionBox) return
    event.preventDefault()
    event.stopPropagation()
    const element = /** @type {SVGElement | null} */ (event.currentTarget)
    const svg = /** @type {SVGSVGElement | null} */ (element?.ownerSVGElement ?? null)
    if (!svg) return
    const p = pointAt(svg, event)
    if (!p) return
    const base = chosenLayer.transform ?? []
    if (!affineForChain(base)) return
    const [x, y, width, height] = selectionBox
    const center = /** @type {[number, number]} */ ([x + width / 2, y + height / 2])
    docDrag = { gesture: ++gesture, kind, id: chosenLayer.id, svg, p0: p, center, frame: frame.frame, base, d0: Math.max(1, Math.hypot(p.x - center[0], p.y - center[1])), a0: Math.atan2(p.y - center[1], p.x - center[0]) }
    svg.setPointerCapture?.(event.pointerId)
    svg.focus?.({ preventScroll: true })
  }
  /** @param {PointerEvent} event */
  function moveDrag(event) {
    if (!docDrag) return
    const p = pointAt(docDrag.svg, event)
    if (!p) return
    const [cx, cy] = docDrag.center
    let operation = [1, 0, 0, 1, 0, 0]
    if (docDrag.kind === 'move') operation = [1, 0, 0, 1, p.x - docDrag.p0.x, p.y - docDrag.p0.y]
    else if (docDrag.kind === 'scale') {
      const scale = clamp(Math.hypot(p.x - cx, p.y - cy) / docDrag.d0, 0.25, 4)
      operation = [scale, 0, 0, scale, cx * (1 - scale), cy * (1 - scale)]
    } else {
      let angle = (Math.atan2(p.y - cy, p.x - cx) - docDrag.a0) * 180 / Math.PI
      if (event.shiftKey) angle = Math.round(angle / 15) * 15
      const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians)
      operation = [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy]
    }
    applyCanvas(operation, docDrag.base, docDrag.id, docDrag.frame, `drag-${docDrag.gesture}`)
  }
  /** @param {PointerEvent} event */
  function endDrag(event) {
    if (!docDrag) return
    if (docDrag.svg.hasPointerCapture?.(event.pointerId)) docDrag.svg.releasePointerCapture(event.pointerId)
    docDrag = null
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
            {@const hasCut = Boolean(drawn.cut || drawn.emoji?.some(item => item.cut))}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <svg viewBox="0 0 1000 1000" class:adjusting={interactive}
              aria-hidden={interactive ? undefined : 'true'}
              role={interactive ? 'application' : undefined}
              aria-label={interactive ? t('ids.adjust.hint') : undefined}
              tabindex={interactive ? 0 : undefined}
              onpointermove={interactive ? moveDrag : undefined}
              onpointerup={interactive ? endDrag : undefined}
              onpointercancel={interactive ? endDrag : undefined}
              onkeydown={interactive ? adjustKey : undefined}
>
              {#if view?.scopes}
                {@const markup = scopesMarkup(view.scopes, { ink: 'currentColor', idPrefix: `${uid}-${name}` })}
                <g class="document" style:color="var(--_ink)">
                  {@html markup.defs}
                  {@html markup.body}
                </g>
              {:else}
                {#if hasCut}
                  {#if drawn.emoji?.some(item => item.cut)}
                    <filter id="{uid}-{name}-emoji-cut" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values={EMOJI_CUT_MATRIX} /></filter>
                  {/if}
                  <mask id="{uid}-{name}">
                    <rect width="1000" height="1000" fill="#fff" />
                    {#if drawn.cut}<path d={drawn.cut} fill="#000" />{/if}
                    {#each drawn.emoji ?? [] as item}
                      {#if item.cut}
                        {@const box = emojiBox(item)}
                        <text filter={`url(#${uid}-${name}-emoji-cut)`} transform={emojiTransform(item) || undefined} x={box.x + box.width / 2} y={box.y + box.height / 2} text-anchor="middle" dominant-baseline="central" font-size={box.size} font-family="system-ui, sans-serif">{item.text}</text>
                      {/if}
                    {/each}
                  </mask>
                {/if}
                <path class="ink" d={drawn.d} mask={hasCut ? `url(#${uid}-${name})` : undefined} />
                {#each drawn.emoji ?? [] as item}
                  {#if !item.cut}
                    {@const box = emojiBox(item)}
                    <text mask={hasCut && !item.restored ? `url(#${uid}-${name})` : undefined} transform={emojiTransform(item) || undefined} x={box.x + box.width / 2} y={box.y + box.height / 2} text-anchor="middle" dominant-baseline="central" font-size={box.size} font-family="system-ui, sans-serif">{item.text}</text>
                  {/if}
                {/each}
              {/if}
              {#each drawn.slots ?? [] as s (s.index)}
                {@render slot(s.box, drawn.stroke?.[0] ?? STROKE, inChosen(slotLeaf(s.index)), false)}
              {/each}
              {#if interactive && selectionBox && frame?.supported}
                {@const [x, y, width, height] = selectionBox}
                {@const size = 26}
                <g class="selection">
                  <rect class="select-box" x={x} y={y} width={width} height={height} rx={6} />
                  <circle class="handle move" cx={x + width / 2} cy={y + height / 2} r={size * 0.45}
                    role="button" tabindex="-1" aria-label={t('ids.adjust.move', { part: chosenLayer?.kind === 'component' ? chosenLayer.char : '' })}
                    onpointerdown={event => startDrag(event, 'move')} />
                  <line class="turn-line" x1={x + width / 2} y1={y} x2={x + width / 2} y2={y - size * 1.35} />
                  <circle class="handle rotate" cx={x + width / 2} cy={y - size * 1.9} r={size * 0.55}
                    role="slider" tabindex="-1" aria-label={t('ids.adjust.rotate', { part: chosenLayer?.kind === 'component' ? chosenLayer.char : '' })}
                    aria-valuemin="-180" aria-valuemax="180" aria-valuenow={rotationValue}
                    onpointerdown={event => startDrag(event, 'rotate')} />
                  <rect class="handle scale" x={x + width - size / 2} y={y + height - size / 2} width={size} height={size} rx={size / 5}
                    role="slider" tabindex="-1" aria-label={t('ids.adjust.scale', { part: chosenLayer?.kind === 'component' ? chosenLayer.char : '' })}
                    aria-valuemin="0.25" aria-valuemax="4" aria-valuenow={scaleValue}
                    onpointerdown={event => startDrag(event, 'scale')} />
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
    {@render picture('large', editable)}
    {#if step === 'loading'}<span class="ids-preview-progress" aria-hidden="true"></span>{/if}
  </div>
  {#if small || !quiet}
    <figcaption class="ids-preview-meta">
      {#if small}<div class="ids-preview-small">{@render picture('small', false)}</div>{/if}
      {#if detailContent}{@render detailContent()}{:else if detail}<code class="ids-preview-detail">{detail}</code>{/if}
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
  .ids-preview-detail{font:11px "IDS New Korean",ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--_muted)}
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
  .selection{pointer-events:none}
  .select-box{fill:none;stroke:var(--_accent);stroke-width:1.5;stroke-dasharray:6 5;vector-effect:non-scaling-stroke}
  .turn-line{stroke:var(--_accent);stroke-width:1.5;vector-effect:non-scaling-stroke}
  .handle{fill:var(--_surface);stroke:var(--_accent);stroke-width:1.5;vector-effect:non-scaling-stroke;pointer-events:all}
  .handle.scale{cursor:nwse-resize}
  .handle.rotate{cursor:grab}
  .handle.move{cursor:move}
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
