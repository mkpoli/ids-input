<script>
  // A document view of the active description: the composer's separated drawing, rendered through
  // the layer document, with a layer list and an affine transform for the chosen layer.
  import { documentSource } from '../../src/composer/index.js'
  import { affineForChain, applyAffine, boxCorners, findLayer, invertAffine, layerFrames, renderScopes, scopesSvg } from '../../src/document/index.js'
  import Dialog from './Dialog.svelte'

  /** @typedef {import('../../src/document/index.js').DocumentSession} DocumentSession */
  /** @typedef {import('../../src/document/index.js').Document} Document */
  /** @typedef {import('../../src/document/index.js').Node} Node */
  /** @typedef {import('../../src/adapter/types.js').Drawing} Drawing */
  /** @typedef {import('../../src/adapter/types.js').SketchLeaf} SketchLeaf */
  /** @type {{ open: boolean, session: DocumentSession | null, preview: ((sequence: string, options?: { signal?: AbortSignal, onSketch?: (leaves: SketchLeaf[]) => void }) => Promise<Drawing>) | null, sequence: string, t: (key: string, params?: Record<string, string | number>) => string, structure?: ((char: string) => Promise<{ text: string }[]>) | null, onchange?: () => void, onstructure?: () => void }} */
  let { open = $bindable(false), session, preview, sequence, t, structure = null, onchange = () => {}, onstructure = () => {} } = $props()

  let drawing = $state.raw(/** @type {Drawing | null} */ (null))
  let sketch = $state.raw(/** @type {SketchLeaf[] | null} */ (null))
  let step = $state(/** @type {'idle' | 'loading' | 'ready' | 'failed'} */ ('idle'))
  let failed = $state('')
  let doc = $state(/** @type {Document | null} */ (null))
  let chosen = $state(/** @type {string | null} */ (null))
  let svg = $state('')
  let issue = $state('')
  /** @type {import('../../src/document/render.js').LayerSource | null} */
  let source = $state.raw(null)
  /** @type {Map<string, import('../../src/document/frames.js').LayerFrame>} */
  let layout = $state.raw(new Map())
  /** @type {{ gesture: number, kind: 'move' | 'scale' | 'rotate', p0: { x: number, y: number }, start: { x: number, y: number, scaleX: number, scaleY: number, rotate: number }, center: [number, number], local0: [number, number], d0: number, a0: number, frame: number[] } | null} */
  let drag = $state.raw(null)
  let gesture = 0

  let x = $state(0), y = $state(0), scaleX = $state(1), scaleY = $state(1), rotate = $state(0)
  let mode = $state(/** @type {'affine' | 'matrix' | 'mobius'} */ ('affine'))
  let matrix = $state([1, 0, 0, 1, 0, 0])
  let simple = $state(true)
  let mobius = $state({ a: [1, 0], b: [0, 0], c: [0, 0], d: [1, 0] })
  let nonlinear = $state(false)
  let applyError = $state('')
  let splitOptions = $state(/** @type {string[]} */ ([]))
  let splitMessage = $state('')
  let splitTarget = $state(/** @type {Node | null} */ (null))

  const layers = $derived.by(() => {
    if (!doc) return []
    /** @type {{ node: Node, depth: number }[]} */
    const out = []
    /** @param {Node} node @param {number} depth */
    const walk = (node, depth) => {
      out.push({ node, depth })
      if (node.kind === 'operator') node.children.forEach(child => walk(child, depth + 1))
      else if (node.kind === 'group') walk(node.child, depth + 1)
    }
    walk(doc.root, 0)
    return out
  })
  const selected = $derived(doc && chosen ? findLayer(doc.root, chosen)?.node ?? null : null)

  // Canvas frames for every layer, shared with the preview-side frame work.
  $effect(() => {
    layout = doc && source && sketch ? layerFrames(doc, source, sketch) : new Map()
  })

  const selection = $derived.by(() => {
    if (!selected) return null
    const entry = layout.get(selected.id)
    if (!entry) return null
    return { entry, box: boxCorners(entry.canvas, entry.box) }
  })
  /** @param {Node} node */
  const label = node => node.kind === 'component' ? node.char : node.kind === 'operator' ? node.op : node.kind === 'slot' ? '⬚' : 'group'
  /** @param {Node} node */
  const kind = node => t(`app.layers.kind.${node.kind}`)

  // Open: take the session's document and draw the sequence separately.
  $effect(() => {
    if (!open || !session) return
    doc = session.document
    chosen = session.chosen
    drawing = null
    sketch = null
    step = 'loading'
    failed = ''
    const controller = new AbortController()
    if (!preview) { step = 'failed'; failed = t('app.layers.failed'); return () => controller.abort() }
    Promise.resolve(preview(sequence, {
      signal: controller.signal,
      onSketch: leaves => { sketch = leaves },
    })).then(drawn => {
      if (controller.signal.aborted) return
      drawing = drawn
      step = 'ready'
    }, error => {
      if (controller.signal.aborted || error?.name === 'AbortError') return
      step = 'failed'
      failed = error instanceof Error ? error.message : String(error)
    })
    return () => controller.abort()
  })

  // The scoped drawing follows the document, the composer drawing and its sketch.
  $effect(() => {
    if (!doc || !drawing || !sketch || step !== 'ready') { svg = ''; issue = ''; return }
    const made = documentSource(doc, drawing, sketch)
    source = made.source
    if (!made.complete) {
      issue = made.issues[0] ?? t('app.layers.incomplete')
      svg = ''
      return
    }
    const scopes = renderScopes(doc, made.source)
    if (!scopes.complete) {
      issue = scopes.issues[0]?.message ?? t('app.layers.incomplete')
      svg = ''
      return
    }
    svg = scopesSvg(scopes, { ink: '#1d1d21', background: '#ffffff' })
    issue = ''
  })

  // Read the selected layer's transform into the fields.
  $effect(() => {
    if (!selected) { nonlinear = false; return }
    const chain = selected.transform ?? []
    applyError = ''
    if (chain.length === 1 && chain[0]?.type === 'mobius') {
      const op = chain[0]
      mode = 'mobius'
      nonlinear = false
      mobius = { a: [...op.a], b: [...op.b], c: [...op.c], d: [...op.d] }
      return
    }
    const flat = affineForChain(chain)
    if (!flat) { nonlinear = chain.length > 0; return }
    nonlinear = false
    matrix = flat
    const [a, b, c, d, e, f] = flat
    const cx = 500, cy = 500
    const nextX = Math.round((e - cx + a * cx + c * cy) * 100) / 100
    const nextY = Math.round((f - cy + b * cx + d * cy) * 100) / 100
    const nextScaleX = Math.round(Math.hypot(a, b) * 1000) / 1000
    const nextScaleY = Math.round(Math.hypot(c, d) * 1000) / 1000
    const nextRotate = Math.round(Math.atan2(b, a) * 1800 / Math.PI) / 10
    x = nextX
    y = nextY
    scaleX = nextScaleX
    scaleY = nextScaleY
    rotate = nextRotate
    const radians = nextRotate * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians)
    const expected = [cos * nextScaleX, sin * nextScaleX, -sin * nextScaleY, cos * nextScaleY, nextX, nextY]
    const isSimple = expected.every((value, index) => Math.abs(value - flat[index]) < 0.002)
    simple = isSimple
    mode = isSimple ? 'affine' : 'matrix'
  })

  function select(id) {
    if (!session) return
    if (!session.choose(id)) return
    chosen = session.chosen
    doc = session.document
    onchange()
  }

  /** @param {string} [coalesce] */
  function apply(coalesce = '') {
    if (!session || !selected) return
    if (typeof coalesce !== 'string') coalesce = ''
    applyError = ''
    try {
      if (mode === 'mobius') {
        session.setTransform([{ type: 'mobius', a: [...mobius.a], b: [...mobius.b], c: [...mobius.c], d: [...mobius.d] }], selected.id, coalesce ? { coalesce } : {})
      } else if (mode === 'matrix') {
        const flat = matrix.map(Number)
        if (flat.every((value, index) => value === [1, 0, 0, 1, 0, 0][index])) session.clearTransform(selected.id)
        else session.setTransform([{ type: 'affine', matrix: flat }], selected.id, coalesce ? { coalesce } : {})
      } else {
        const radians = rotate * Math.PI / 180
        const a = Math.cos(radians) * scaleX, b = Math.sin(radians) * scaleX
        const c = -Math.sin(radians) * scaleY, d = Math.cos(radians) * scaleY
        const cx = 500, cy = 500
        const matrix = [a, b, c, d, cx + x - a * cx - c * cy, cy + y - b * cx - d * cy]
        if (x === 0 && y === 0 && scaleX === 1 && scaleY === 1 && rotate === 0) session.clearTransform(selected.id)
        else session.setTransform([{ type: 'affine', matrix }], selected.id, coalesce ? { coalesce } : {})
      }
      doc = session.document
      chosen = session.chosen
      onchange()
    } catch (error) {
      applyError = t('app.layers.invalid')
    }
  }

  function reset() {
    if (!session || !selected) return
    session.clearTransform(selected.id)
    doc = session.document
    chosen = session.chosen
    onchange()
  }

  /** @param {'affine' | 'matrix' | 'mobius'} next */
  function setMode(next) {
    if (mode === next || !selected) return
    if (next === 'matrix') {
      matrix = affineForChain(selected.transform ?? []) ?? [1, 0, 0, 1, 0, 0]
    }
    mode = next
  }

  /** Ask for the chosen component's decompositions. @param {Node} node */
  async function decompose(node) {
    if (node.kind !== 'component' || !structure) return
    splitTarget = node
    splitOptions = []
    splitMessage = ''
    try {
      const found = await structure(node.char)
      splitOptions = [...new Set(found.map(item => item.text).filter(Boolean))]
      if (!splitOptions.length) splitMessage = t('app.layers.noSplit')
    } catch {
      splitMessage = t('app.layers.splitFailed')
    }
  }

  /** @param {string} sequence */
  function applySplit(sequence) {
    if (!session || !splitTarget) return
    try {
      session.decompose(sequence, splitTarget.id)
      doc = session.document
      chosen = session.chosen
      splitOptions = []
      splitTarget = null
      onchange()
      onstructure()
    } catch {
      splitMessage = t('app.layers.splitFailed')
    }
  }

  /** @param {SVGSVGElement} svg @param {PointerEvent} event */
  function pointAt(svg, event) {
    const matrix = svg.getScreenCTM()
    if (!matrix) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return point.matrixTransform(matrix.inverse())
  }

  /** @param {PointerEvent} event @param {'move' | 'scale' | 'rotate'} kind */
  function startDrag(event, kind) {
    if (!selection || !selection.entry.supported) return
    event.preventDefault()
    event.stopPropagation()
    const target = /** @type {SVGElement} */ (event.currentTarget)
    const svg = target instanceof SVGSVGElement ? target : target.ownerSVGElement
    if (!svg) return
    const point = pointAt(svg, event)
    if (!point) return
    const [x, y, width, height] = selection.box
    const center = /** @type {[number, number]} */ ([x + width / 2, y + height / 2])
    drag = { gesture: ++gesture, kind, p0: { x: point.x, y: point.y }, start: { x, y, scaleX, scaleY, rotate }, center,
      d0: Math.max(1, Math.hypot(point.x - center[0], point.y - center[1])),
      local0: (() => { const inverse = invertAffine(selection.entry.frame); return inverse ? /** @type {[number, number]} */ (applyAffine(inverse, [point.x, point.y])) : /** @type {[number, number]} */ ([500, 500]) })(),
      a0: Math.atan2(point.y - center[1], point.x - center[0]), frame: selection.entry.frame }
    svg.setPointerCapture?.(event.pointerId)
  }

  let lastApply = 0
  /** @param {PointerEvent} event */
  function moveDrag(event) {
    if (!drag || !selection) return
    const target = /** @type {SVGElement} */ (event.currentTarget)
    const svg = target instanceof SVGSVGElement ? target : target.ownerSVGElement
    if (!svg) return
    const point = pointAt(svg, event)
    if (!point) return
    if (drag.kind === 'move') {
      const inverse = invertAffine(drag.frame)
      if (!inverse) return
      const origin = applyAffine(inverse, [0, 0])
      const local = applyAffine(inverse, [point.x - drag.p0.x, point.y - drag.p0.y])
      x = Math.round((drag.start.x + local[0] - origin[0]) * 100) / 100
      y = Math.round((drag.start.y + local[1] - origin[1]) * 100) / 100
    } else if (drag.kind === 'scale') {
      const inverse = invertAffine(drag.frame)
      if (!inverse) return
      const local = applyAffine(inverse, [point.x, point.y])
      const ratioX = Math.abs(drag.local0[0] - 500) < 1 ? 1 : (local[0] - 500) / (drag.local0[0] - 500)
      const ratioY = Math.abs(drag.local0[1] - 500) < 1 ? 1 : (local[1] - 500) / (drag.local0[1] - 500)
      scaleX = Math.round(Math.min(20, Math.max(0.05, drag.start.scaleX * ratioX)) * 1000) / 1000
      scaleY = Math.round(Math.min(20, Math.max(0.05, drag.start.scaleY * ratioY)) * 1000) / 1000
    } else {
      const angle = Math.atan2(point.y - drag.center[1], point.x - drag.center[0])
      let next = drag.start.rotate + (angle - drag.a0) * 180 / Math.PI
      if (event.shiftKey) next = Math.round(next / 15) * 15
      rotate = Math.round(((next + 180) % 360 + 360) % 360 - 180)
    }
    const now = performance.now()
    if (now - lastApply > 90) { lastApply = now; apply(String(drag.gesture)) }
  }

  /** @param {PointerEvent} event */
  function endDrag(event) {
    if (!drag) return
    const target = /** @type {SVGElement} */ (event.currentTarget)
    const svg = target instanceof SVGSVGElement ? target : target.ownerSVGElement
    if (svg?.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId)
    const finishing = String(drag.gesture)
    drag = null
    apply(finishing)
  }
</script>

<Dialog bind:open title={t('app.layers')} closeLabel={t('app.close')} wide>
  {#if !session}
    <p class="note">{t('app.layers.none')}</p>
  {:else}
    <div class="layers">
      <div class="figure">
        <div class="canvas">
          {#if step === 'loading'}
            <span class="spinner" aria-hidden="true"></span>
            <p class="note">{t('app.layers.prepare')}</p>
          {:else if step === 'failed'}
            <p class="note">{failed || t('app.layers.failed')}</p>
          {:else if svg}
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="" />
            {#if selection?.entry.supported}
              {@const [x, y, width, height] = selection.box}
              <svg class="handles" viewBox="0 0 1000 1000"
                onpointermove={moveDrag} onpointerup={endDrag} onpointercancel={endDrag}>
                <rect class="select-box" x={x} y={y} width={width} height={height} />
                <circle class="handle move" cx={x + width / 2} cy={y + height / 2} r="26"
                  role="button" tabindex="-1" aria-label={t('app.layers.transform')}
                  onpointerdown={event => startDrag(event, 'move')} />
                <circle class="handle rotate" cx={x + width / 2} cy={y - 48} r="18"
                  role="button" tabindex="-1" aria-label={t('app.layers.rotate')}
                  onpointerdown={event => startDrag(event, 'rotate')} />
                <rect class="handle scale" x={x + width - 18} y={y + height - 18} width="36" height="36"
                  role="button" tabindex="-1" aria-label={t('app.layers.scale')}
                  onpointerdown={event => startDrag(event, 'scale')} />
              </svg>
            {/if}
          {:else}
            <p class="note">{issue || t('app.layers.incomplete')}</p>
          {/if}
        </div>
      </div>
      <div class="list" role="tree" aria-label={t('app.layers')}>
        {#each layers as row (row.node.id)}
          <button type="button" class:chosen={row.node.id === chosen} style:--depth={row.depth}
            role="treeitem" aria-selected={row.node.id === chosen} aria-level={row.depth + 1}
            onclick={() => select(row.node.id)} ondblclick={() => decompose(row.node)}>
            <span class="glyph">{label(row.node)}</span>
            <span class="layer-name">{row.node.name ?? kind(row.node)}</span>
            <code>{row.node.id}</code>
          </button>
        {/each}
      </div>
    </div>
    {#if splitOptions.length}
      <div class="splits" role="group" aria-label={t('app.layers.chooseSplit')}>
        <span>{t('app.layers.split')} {splitTarget?.char ?? ''}</span>
        {#each splitOptions as option (option)}
          <button type="button" lang="ja" onclick={() => applySplit(option)}>{option}</button>
        {/each}
      </div>
    {/if}
    {#if splitMessage}<p class="note" role="alert">{splitMessage}</p>{/if}
    {#if selected}
      <fieldset class="transform" disabled={nonlinear}>
        <legend>{t('app.layers.transform')}</legend>
        <div class="modes" role="group" aria-label={t('app.layers.mode')}>
          <button type="button" aria-pressed={mode === 'affine'} disabled={mode === 'matrix' && !simple} onclick={() => setMode('affine')}>{t('app.layers.affine')}</button>
          <button type="button" aria-pressed={mode === 'matrix'} onclick={() => setMode('matrix')}>{t('app.layers.matrix')}</button>
          <button type="button" aria-pressed={mode === 'mobius'} onclick={() => setMode('mobius')}>{t('app.layers.mobius')}</button>
        </div>
        {#if mode === 'affine'}
          <div class="affine">
            <label class="field">{t('app.layers.x')}<span class="control"><input class="num" type="number" step="1" bind:value={x} onchange={apply} /></span></label>
            <label class="field">{t('app.layers.y')}<span class="control"><input class="num" type="number" step="1" bind:value={y} onchange={apply} /></span></label>
            <label class="field">{t('app.layers.scaleX')}<span class="control"><input class="num" type="number" step="0.01" min="0.05" max="20" bind:value={scaleX} onchange={apply} /><span class="unit">×</span></span></label>
            <label class="field">{t('app.layers.scaleY')}<span class="control"><input class="num" type="number" step="0.01" min="0.05" max="20" bind:value={scaleY} onchange={apply} /><span class="unit">×</span></span></label>
            <label class="field rotate">{t('app.layers.rotate')}<span class="control"><input class="num" type="number" step="1" bind:value={rotate} onchange={apply} /><span class="unit">°</span></span></label>
          </div>
        {:else if mode === 'matrix'}
          <div class="matrix">
            {#each ['a', 'b', 'c', 'd', 'e', 'f'] as name, index (name)}
              <label class="field">{name}<span class="control"><input class="num" aria-label={`${t('app.layers.matrix')} ${name}`} type="number" step="0.001" bind:value={matrix[index]} onchange={apply} /></span></label>
            {/each}
          </div>
          <p class="note">{t('app.layers.matrixHint')}</p>
        {:else}
          <div class="mobius">
            {#each ['a', 'b', 'c', 'd'] as name (name)}
              <div class="coef">
                <span class="coef-name">{name}</span>
                <label class="field">{t('app.layers.real')}<span class="control"><input class="num" aria-label={`${name} ${t('app.layers.real')}`} type="number" step="0.001" bind:value={mobius[name][0]} onchange={apply} /></span></label>
                <label class="field">{t('app.layers.imag')}<span class="control"><input class="num" aria-label={`${name} ${t('app.layers.imag')}`} type="number" step="0.001" bind:value={mobius[name][1]} onchange={apply} /></span></label>
              </div>
            {/each}
          </div>
        {/if}
      </fieldset>
      {#if nonlinear}<p class="note">{t('app.layers.nonlinear')}</p>{/if}
      {#if applyError}<p class="note" role="alert">{applyError}</p>{/if}
      <button type="button" class="reset" disabled={!selected.transform?.length} onclick={reset}>{t('app.layers.reset')}</button>
      <p class="hint">{t('app.layers.hint')}</p>
    {/if}
  {/if}
</Dialog>

<style>
  .layers{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:12px;align-items:start}
  .figure{display:grid;place-items:center;min-height:220px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#fff}
  .canvas{position:relative;width:min(100%,48vh);aspect-ratio:1}
  .canvas img{display:block;width:100%;height:100%;object-fit:contain}
  .handles{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:all;touch-action:none}
  .select-box{fill:none;stroke:#2f5fd0;stroke-width:3;vector-effect:non-scaling-stroke}
  .handle{fill:#fff;stroke:#2f5fd0;stroke-width:3;vector-effect:non-scaling-stroke;pointer-events:all;cursor:grab}
  .handle.move{cursor:move}
  .handle.rotate{cursor:crosshair}
  .handle.scale{cursor:nwse-resize}
  .list{display:flex;flex-direction:column;gap:2px;max-height:48vh;overflow:auto}
  .list button{display:grid;grid-template-columns:1.5em minmax(0,1fr) auto;gap:6px;align-items:center;width:100%;padding:5px 6px;border:0;border-radius:6px;background:transparent;color:var(--ink);text-align:left;font:inherit;cursor:pointer}
  .list button:hover{background:color-mix(in srgb,var(--accent) 10%,transparent)}
  .list button.chosen{background:color-mix(in srgb,var(--accent) 18%,transparent)}
  .list button{padding-left:calc(6px + var(--depth) * 10px)}
  .glyph{font-size:1.05rem}
  .layer-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .list code{font:10px ui-monospace,monospace;color:var(--muted)}
  .transform{border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:14px;background:var(--surface-2)}
  .transform legend{padding:0 6px;font-size:12px;color:var(--muted)}
  .modes{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
  .modes button{height:26px;padding:0 11px;border:0;border-radius:7px;background:none;color:var(--muted);font:inherit;font-size:12px;cursor:pointer}
  .modes button[aria-pressed="true"]{background:var(--accent-soft);color:var(--accent);font-weight:600}
  .affine{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
  .field{display:grid;gap:4px;min-width:0;font-size:11px;font-weight:600;letter-spacing:.02em;color:var(--muted)}
  .field.rotate{grid-column:2/4}
  .control{display:flex;align-items:center;gap:4px;height:34px;padding:0 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
  .control:focus-within{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)}
  .num{width:100%;min-width:0;border:0;outline:0;background:none;color:var(--ink);font:12.5px ui-monospace,"SF Mono",Menlo,Consolas,monospace;text-align:right;appearance:textfield;-moz-appearance:textfield}
  .num::-webkit-inner-spin-button,.num::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  .unit{flex:none;font-size:11px;color:var(--muted)}
  .matrix{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
  .mobius{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
  .coef{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr);align-items:end;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
  .coef-name{font:italic 600 15px ui-serif,serif;color:var(--muted);align-self:center;padding-bottom:2px}
  .splits{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:12px;padding:8px 10px;border:1px solid var(--line);border-radius:10px}
  .splits span{font-size:12px;color:var(--muted)}
  .splits button{height:28px;padding:0 10px;border:1px solid var(--line);border-radius:999px;background:var(--surface-2);color:var(--ink);font-family:var(--cjk);font-size:13px;cursor:pointer}
  .splits button:hover{background:var(--hover)}
  .reset{margin-top:12px;height:32px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:12px;cursor:pointer}
  .note,.hint{margin:8px 0 0;color:var(--muted);font-size:12px}
  .hint{grid-column:1/-1}
  .spinner{width:20px;height:20px;border:2px solid color-mix(in srgb,var(--muted) 30%,transparent);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(1turn)}}
  @media (max-width:640px){.layers{grid-template-columns:1fr}.affine{grid-template-columns:repeat(2,minmax(0,1fr))}.field.rotate{grid-column:auto}.matrix{grid-template-columns:repeat(2,minmax(0,1fr))}.mobius{grid-template-columns:1fr}}
</style>
