<script>
  // A document view of the active description: the composer's separated drawing, rendered through
  // the layer document, with a layer list and an affine transform for the chosen layer.
  import { documentSource } from '../../src/composer/index.js'
  import { affineForChain, applyAffine, applyGeometryEdits, boxCorners, findLayer, fingerprintGeometry, invertAffine, layerAtPath, layerFrames, pathOfLayer, renderScopes, scopesSvg, transformPath } from '../../src/document/index.js'
  import Dialog from './Dialog.svelte'

  /** @typedef {import('../../src/document/index.js').DocumentSession} DocumentSession */
  /** @typedef {import('../../src/document/index.js').Document} Document */
  /** @typedef {import('../../src/document/index.js').Node} Node */
  /** @typedef {import('../../src/adapter/types.js').Drawing} Drawing */
  /** @typedef {import('../../src/adapter/types.js').SketchLeaf} SketchLeaf */
  /** @type {{ open: boolean, session: DocumentSession | null, preview: ((sequence: string, options?: { signal?: AbortSignal, onSketch?: (leaves: SketchLeaf[]) => void }) => Promise<Drawing>) | null, sequence: string, t: (key: string, params?: Record<string, string | number>) => string, chosenPath?: number[] | null, structure?: ((char: string) => Promise<{ text: string, sources?: string[] }[]>) | null, onchange?: () => void, onchoose?: ((path: number[]) => void) | null, onstructure?: () => void, oncanvas?: (() => void) | null }} */
  let { open = $bindable(false), session, preview, sequence, t, chosenPath = null, structure = null, onchange = () => {}, onchoose = null, onstructure = () => {}, oncanvas = null } = $props()

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
  /** @type {{ gesture: number, kind: 'move' | 'scale' | 'rotate', p0: { x: number, y: number }, start: { x: number, y: number, scaleX: number, scaleY: number, rotate: number }, center: [number, number], local0: [number, number], d0: number, a0: number, place: number[] } | null} */
  let drag = $state.raw(null)
  let gesture = 0

  let x = $state(0), y = $state(0), scaleX = $state(1), scaleY = $state(1), rotate = $state(0)
  let mode = $state(/** @type {'affine' | 'matrix' | 'mobius'} */ ('affine'))
  let matrix = $state([1, 0, 0, 1, 0, 0])
  let simple = $state(true)
  let mobius = $state({ a: [1, 0], b: [0, 0], c: [0, 0], d: [1, 0] })
  let nonlinear = $state(false)
  let applyError = $state('')
  let splitOptions = $state(/** @type {{ text: string, sources: string[] }[]} */ ([]))
  let splitMessage = $state('')
  let splitTarget = $state(/** @type {Node | null} */ (null))
  let strokeId = $state(/** @type {string | null} */ (null))

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

  // Keep the editor's selected path and the inspector's selected layer on the same node.
  $effect(() => {
    const path = chosenPath
    if (!open || !path || !session) return
    const next = session.document
    const selectedPath = session.chosen ? pathOfLayer(next.root, session.chosen) : null
    if (selectedPath && selectedPath.join('.') === path.join('.')) return
    const node = layerAtPath(next.root, path)
    if (!node || session.chosen === node.id) return
    if (!session.choose(node.id)) return
    chosen = session.chosen
    doc = session.document
    onchange()
  })

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
  const strokeGeometry = $derived.by(() => {
    if (!selected || !source || selected.kind !== 'component') return null
    try { return source.geometry(selected) } catch { return null }
  })
  const strokes = $derived(strokeGeometry?.strokes ?? [])
  // A chosen stroke belongs to the chosen layer.
  let strokeOwner = null
  $effect(() => {
    const id = selected?.id ?? null
    if (id === strokeOwner) return
    strokeOwner = id
    strokeId = null
  })
  // A chosen stroke the layer no longer draws, after a split or a new composer drawing, is dropped.
  $effect(() => {
    if (strokeId && !strokes.some(stroke => stroke.id === strokeId)) strokeId = null
  })
  /** Every geometry edit moving the chosen stroke, in the order the renderer applies them. */
  const strokeEdits = $derived.by(() => {
    if (!strokeId || !selected || !doc?.geometryEdits) return []
    return doc.geometryEdits.filter(edit => edit.node === selected.id && edit.target.kind === 'stroke' && edit.target.id === strokeId)
  })
  const strokeEdit = $derived(strokeEdits[0] ?? null)
  /** @param {string} id */
  function chooseStroke(id) {
    strokeId = strokeId === id ? null : id
    if (strokeId) { mode = 'affine'; applyError = '' }
  }

  /** The chosen layer's strokes on the canvas, for clicking one on the drawing. */
  const strokePaths = $derived.by(() => {
    if (!selected || !source || !strokes.length) return []
    const frame = layout.get(selected.id)
    if (!frame?.supported) return []
    let geometry
    try { geometry = source.geometry(selected) } catch { return [] }
    if (!geometry) return []
    const edited = applyGeometryEdits(geometry, doc?.geometryEdits ?? [], selected.id).geometry
    return strokes.flatMap(stroke => {
      const d = stroke.pieces.map(index => edited.pieces[index]?.d).filter(Boolean)
        .map(piece => transformPath(piece, [{ type: 'affine', matrix: frame.canvas }]).d).join('')
      return d ? [{ id: stroke.id, d }] : []
    })
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
    svg = scopesSvg(scopes, { ink: '#1d1d21', background: '#ffffff', emoji: drawing?.emoji ?? [], cut: drawing?.cut ?? '' })
    issue = ''
  })

  // Read the selected layer's transform into the fields.
  $effect(() => {
    if (strokeId) {
      const flat = affineForChain(strokeEdits.flatMap(edit => edit.transform))
      if (!flat) { nonlinear = true; return }
      nonlinear = false
      mode = 'affine'
      matrix = flat
      const [a, b, c, d, e, f] = flat
      const cx = 500, cy = 500
      x = Math.round((e - cx + a * cx + c * cy) * 100) / 100
      y = Math.round((f - cy + b * cx + d * cy) * 100) / 100
      scaleX = Math.round(Math.hypot(a, b) * 1000) / 1000
      scaleY = Math.round(Math.hypot(c, d) * 1000) / 1000
      rotate = Math.round(Math.atan2(b, a) * 1800 / Math.PI) / 10
      const radians = rotate * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians)
      const expected = [cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY]
      simple = expected.every((value, index) => Math.abs(value - flat[index]) < 0.002)
      applyError = ''
      return
    }
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
    const path = pathOfLayer(doc.root, id)
    if (path && onchoose) onchoose(path)
    onchange()
  }

  /** @param {string} [coalesce] */
  function apply(coalesce = '') {
    if (!session || !selected) return
    if (typeof coalesce !== 'string') coalesce = ''
    applyError = ''
    try {
      if (strokeId && strokeGeometry) {
        const radians = rotate * Math.PI / 180
        // A stroke edit with shear or a reflection keeps its linear part; only X and Y move it.
        const [a, b, c, d] = simple
          ? [Math.cos(radians) * scaleX, Math.sin(radians) * scaleX, -Math.sin(radians) * scaleY, Math.cos(radians) * scaleY]
          : matrix
        const cx = 500, cy = 500
        const next = [a, b, c, d, cx + x - a * cx - c * cy, cy + y - b * cx - d * cy]
        if (next.every((value, index) => value === [1, 0, 0, 1, 0, 0][index])) {
          if (strokeEdits.length) session.clearGeometryEdit(strokeEdits.map(edit => edit.id), coalesce ? { coalesce } : {})
        } else {
          session.setGeometryEdit({
            id: strokeEdit?.id ?? session.allocator.next(), node: selected.id,
            geometry: strokeEdit?.geometry ?? fingerprintGeometry(strokeGeometry),
            target: { kind: 'stroke', id: strokeId }, transform: [{ type: 'affine', matrix: next }],
          }, { ...(coalesce ? { coalesce } : {}), replace: strokeEdits.map(edit => edit.id) })
        }
        doc = session.document
        chosen = session.chosen
        onchange()
        return
      }
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
    if (strokeId) { if (strokeEdits.length) session.clearGeometryEdit(strokeEdits.map(edit => edit.id)) }
    else session.clearTransform(selected.id)
    doc = session.document
    chosen = session.chosen
    onchange()
  }
  /** @param {number} count @param {boolean} undo */
  function travel(count, undo) {
    if (!session) return
    for (let i = 0; i < count; i++) { if (!(undo ? session.undo() : session.redo())) break }
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
      /** @type {Map<string, string[]>} */
      const byText = new Map()
      for (const item of found) {
        if (!item.text) continue
        const had = byText.get(item.text) ?? []
        byText.set(item.text, [...new Set([...had, ...(item.sources ?? [])])])
      }
      splitOptions = [...byText].map(([text, sources]) => ({ text, sources }))
      if (!splitOptions.length) splitMessage = t('app.layers.noSplit')
    } catch {
      splitMessage = t('app.layers.splitFailed')
    }
  }

  const SOURCES = new Set(['babelstone', 'zitools', 'chise', 'project'])
  /** @param {string[]} sources @returns {string[]} */
  const visibleSources = sources => sources.filter(source => SOURCES.has(source))
  /** @param {string[]} sources */
  const sourcesTitle = sources => {
    const names = visibleSources(sources).map(source => t(`ids.source.${source}`))
    return names.length ? t('ids.from.sources', { sources: names.join(' · ') }) : ''
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
    const [boxX, boxY, width, height] = selection.box
    const center = /** @type {[number, number]} */ ([boxX + width / 2, boxY + height / 2])
    drag = { gesture: ++gesture, kind, p0: { x: point.x, y: point.y }, start: { x, y, scaleX, scaleY, rotate }, center,
      d0: Math.max(1, Math.hypot(point.x - center[0], point.y - center[1])),
      local0: (() => { const inverse = invertAffine(selection.entry.place); return inverse ? /** @type {[number, number]} */ (applyAffine(inverse, [point.x, point.y])) : /** @type {[number, number]} */ ([500, 500]) })(),
      a0: Math.atan2(point.y - center[1], point.x - center[0]), place: selection.entry.place }
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
      const inverse = invertAffine(drag.place)
      if (!inverse) return
      const origin = applyAffine(inverse, [0, 0])
      const local = applyAffine(inverse, [point.x - drag.p0.x, point.y - drag.p0.y])
      x = Math.round((drag.start.x + local[0] - origin[0]) * 100) / 100
      y = Math.round((drag.start.y + local[1] - origin[1]) * 100) / 100
    } else if (drag.kind === 'scale') {
      const inverse = invertAffine(drag.place)
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

<Dialog bind:open title={t('app.layers.label')} closeLabel={t('app.close')} wide>
  {#if !session}
    <p class="note">{t('app.layers.none')}</p>
  {:else}
    <div class="layers">
      <div class="figure">
        <div class="canvas">
          {#if step === 'loading'}
            <span class="ui-spinner" aria-hidden="true"></span>
            <p class="note">{t('app.layers.prepare')}</p>
          {:else if step === 'failed'}
            <p class="note">{failed || t('app.layers.failed')}</p>
          {:else if svg}
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="" />
            {#if selection?.entry.supported}
              {@const [x, y, width, height] = selection.box}
              <svg class="handles" viewBox="0 0 1000 1000"
                onpointermove={moveDrag} onpointerup={endDrag} onpointercancel={endDrag}>
                {#each strokePaths as stroke (stroke.id)}
                  <path class="stroke-hit" class:active={stroke.id === strokeId} d={stroke.d} data-stroke={stroke.id}
                    onclick={() => chooseStroke(stroke.id)} />
                {/each}
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
      <div class="ui-list list" role="tree" aria-label={t('app.layers.label')}>
        {#each layers as row (row.node.id)}
          <button type="button" class="ui-list-row" data-interactive class:chosen={row.node.id === chosen} style:--depth={row.depth}
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
        {#each splitOptions as option (option.text)}
          <button type="button" lang="ja" onclick={() => applySplit(option.text)} title={sourcesTitle(option.sources)}>
            {option.text}{#if visibleSources(option.sources).length}<span class="split-sources">{#each visibleSources(option.sources) as source (source)}<span class="split-source">{t(`ids.source.${source}`)}</span>{/each}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
    {#if splitMessage}<p class="note" role="alert">{splitMessage}</p>{/if}
    {#if selected}
      {#if strokes.length}
        <div class="strokes" role="group" aria-label={t('app.layers.strokes')}>
          <span class="ui-label">{t('app.layers.strokes')}</span>
          {#each strokes as stroke (stroke.id)}
            <button type="button" class="ui-button" data-size="sm" aria-pressed={strokeId === stroke.id}
              onclick={() => chooseStroke(stroke.id)}>{stroke.id}</button>
          {/each}
        </div>
      {:else if strokeGeometry}
        <p class="note">{t('app.layers.noStrokeData')}</p>
      {/if}
      <fieldset class="ui-card transform" data-variant="sunken" data-padding="sm" disabled={nonlinear}>
        <legend>{t('app.layers.transform')}</legend>
        <div class="transform-body">
          <div class="modes" role="group" aria-label={t('app.layers.mode')}>
            <button type="button" class="ui-button" data-size="sm" aria-pressed={mode === 'affine'} disabled={mode === 'matrix' && !simple} onclick={() => setMode('affine')}>{t('app.layers.affine')}</button>
            <button type="button" class="ui-button" data-size="sm" aria-pressed={mode === 'matrix'} disabled={Boolean(strokeId)} onclick={() => setMode('matrix')}>{t('app.layers.matrix')}</button>
            <button type="button" class="ui-button" data-size="sm" aria-pressed={mode === 'mobius'} disabled={Boolean(strokeId)} onclick={() => setMode('mobius')}>{t('app.layers.mobius')}</button>
          </div>
          {#if mode === 'affine'}
            <div class="affine">
              <label class="ui-field field"><span class="ui-label">{t('app.layers.x')}</span><span class="control"><input class="ui-input num" data-mono type="number" step="1" bind:value={x} onchange={apply} /></span></label>
              <label class="ui-field field"><span class="ui-label">{t('app.layers.y')}</span><span class="control"><input class="ui-input num" data-mono type="number" step="1" bind:value={y} onchange={apply} /></span></label>
              <label class="ui-field field"><span class="ui-label">{t('app.layers.scaleX')}</span><span class="control"><input class="ui-input num" data-mono type="number" step="0.01" min="0.05" max="20" bind:value={scaleX} disabled={Boolean(strokeId) && !simple} onchange={apply} /><span class="unit">×</span></span></label>
              <label class="ui-field field"><span class="ui-label">{t('app.layers.scaleY')}</span><span class="control"><input class="ui-input num" data-mono type="number" step="0.01" min="0.05" max="20" bind:value={scaleY} disabled={Boolean(strokeId) && !simple} onchange={apply} /><span class="unit">×</span></span></label>
              <label class="ui-field field rotate"><span class="ui-label">{t('app.layers.rotate')}</span><span class="control"><input class="ui-input num" data-mono type="number" step="1" bind:value={rotate} disabled={Boolean(strokeId) && !simple} onchange={apply} /><span class="unit">°</span></span></label>
            </div>
          {:else if mode === 'matrix'}
            <div class="matrix">
              {#each ['a', 'b', 'c', 'd', 'e', 'f'] as name, index (name)}
                <label class="ui-field field"><span class="ui-label">{name}</span><span class="control"><input class="ui-input num" data-mono aria-label={`${t('app.layers.matrix')} ${name}`} type="number" step="0.001" bind:value={matrix[index]} onchange={apply} /></span></label>
              {/each}
            </div>
            <p class="note">{t('app.layers.matrixHint')}</p>
          {:else}
            <div class="mobius">
              {#each ['a', 'b', 'c', 'd'] as name (name)}
                <div class="coef">
                  <span class="coef-name">{name}</span>
                  <label class="ui-field field"><span class="ui-label">{t('app.layers.real')}</span><span class="control"><input class="ui-input num" data-mono aria-label={`${name} ${t('app.layers.real')}`} type="number" step="0.001" bind:value={mobius[name][0]} onchange={apply} /></span></label>
                  <label class="ui-field field"><span class="ui-label">{t('app.layers.imag')}</span><span class="control"><input class="ui-input num" data-mono aria-label={`${name} ${t('app.layers.imag')}`} type="number" step="0.001" bind:value={mobius[name][1]} onchange={apply} /></span></label>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </fieldset>
      {#if nonlinear}<p class="note">{t('app.layers.nonlinear')}</p>{/if}
      {#if applyError}<p class="note" role="alert">{applyError}</p>{/if}
      {@const history = doc && session ? { done: [...session.steps.done], undone: [...session.steps.undone] } : { done: [], undone: [] }}
      <div class="actions">
        <button type="button" class="ui-button" disabled={strokeId ? !strokeEdit : !selected.transform?.length} onclick={reset}>{t('app.layers.reset')}</button>
        <button type="button" class="ui-button" onclick={() => { open = false; oncanvas?.() }}>{t('app.layers.oncanvas')}</button>
      </div>
      {#if history.done.length || history.undone.length}
        <details class="history">
          <summary>{t('app.layers.history')} <span>{history.done.length + history.undone.length}</span></summary>
          <div class="history-list">
            {#each history.done as label, i (i)}
              <button type="button" onclick={() => travel(history.done.length - i, true)}>{label}</button>
            {/each}
            {#if history.undone.length}
              <p>{t('app.history.undone')}</p>
              {#each history.undone.slice().reverse() as label, i (i)}
                <button type="button" onclick={() => travel(i + 1, false)}>{label}</button>
              {/each}
            {/if}
          </div>
        </details>
      {/if}
      <p class="hint">{t('app.layers.hint')}</p>
    {/if}
  {/if}
</Dialog>

<style>
  .layers{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:var(--ui-space-lg);align-items:start}
  .figure{display:grid;place-items:center;min-height:220px;padding:var(--ui-space-md);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:#fff}
  .canvas{position:relative;width:min(100%,48vh);aspect-ratio:1}
  .canvas img{display:block;width:100%;height:100%;object-fit:contain}
  .handles{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:all;touch-action:none}
  /* The figure is a white export in both schemes, so its handles stay a dark blue. */
  .select-box{fill:none;stroke:#2944c7;stroke-width:3;vector-effect:non-scaling-stroke;pointer-events:none}
  .handle{fill:#fff;stroke:#2944c7;stroke-width:3;vector-effect:non-scaling-stroke;pointer-events:all;cursor:grab}
  .stroke-hit{fill:rgba(41,68,199,0.001);pointer-events:all;cursor:pointer}
  .stroke-hit:hover,.stroke-hit.active{fill:rgba(41,68,199,0.18)}
  .handle.move{cursor:move}
  .handle.rotate{cursor:crosshair}
  .handle.scale{cursor:nwse-resize}
  /* The same white figure keeps its notes in the light scheme's muted ink. */
  .figure .note{color:#686874}
  .list{display:flex;flex-direction:column;gap:var(--ui-space-3xs);max-height:48vh;overflow:auto}
  .list button{display:grid;grid-template-columns:1.5em minmax(0,1fr) auto;gap:var(--ui-space-xs);align-items:center;width:100%;min-height:var(--ui-control-h-lg);
    padding:0 var(--ui-space-xs) 0 calc(var(--ui-space-xs) + var(--depth) * var(--ui-space-md));border:1px solid transparent;border-radius:var(--ui-radius-sm);background:transparent;color:var(--ui-color-ink);text-align:left;font:inherit;cursor:pointer}
  .list button:hover{border-color:var(--ui-color-border);background:var(--ui-color-surface-hover)}
  .list button.chosen{border-color:var(--ui-color-accent);background:var(--ui-color-accent-soft);color:var(--ui-color-ink)}
  .glyph{font-size:var(--ui-text-lg)}
  .layer-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .list code{font-family:var(--ui-font-mono);font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted)}
  .transform{margin-top:var(--ui-space-lg)}
  .transform legend{padding:0 var(--ui-space-xs);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  .transform-body{display:flex;flex-direction:column;gap:var(--ui-space-lg)}
  .strokes{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs)}
  .strokes .ui-button[aria-pressed="true"]{background:var(--ui-color-accent);color:var(--ui-color-on-accent)}
  .transform-body .note{margin:0}
  .modes{display:inline-flex;align-self:flex-start;gap:2px;padding:2px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken)}
  .modes .ui-button{min-block-size:var(--ui-control-h-xs);padding-inline:var(--ui-space-md);border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);box-shadow:none}
  .modes .ui-button:not(:disabled):hover{background:color-mix(in srgb,var(--ui-color-surface) 60%,transparent);color:var(--ui-color-ink)}
  .modes .ui-button[aria-pressed='true']{background:var(--ui-color-surface);color:var(--ui-color-ink);box-shadow:var(--ui-shadow-1)}
  .modes .ui-button[aria-pressed='true']:not(:disabled):hover{background:var(--ui-color-surface);color:var(--ui-color-ink)}
  .modes .ui-button:focus-visible{outline-offset:calc(-1 * var(--ui-ring-width))}
  .affine{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--ui-space-md)}
  .field.rotate{grid-column:2/4}
  /* The unit sits inside the field's box, after the number. */
  .control{position:relative;display:block}
  .num{text-align:right;appearance:textfield;-moz-appearance:textfield}
  .num::-webkit-inner-spin-button,.num::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  .control:has(.unit) .num{padding-inline-end:calc(var(--ui-space-md) + 1em)}
  .unit{position:absolute;inset-inline-end:var(--ui-space-md);top:50%;transform:translateY(-50%);color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);pointer-events:none}
  .matrix{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ui-space-md)}
  .mobius{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ui-space-md)}
  .coef{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr);align-items:end;gap:var(--ui-space-sm);padding:var(--ui-space-sm) var(--ui-space-md);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .coef-name{align-self:center;padding-bottom:var(--ui-space-3xs);color:var(--ui-color-ink-muted);font:italic var(--ui-weight-semibold) var(--ui-text-lg) ui-serif,serif}
  .splits{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs);margin-top:var(--ui-space-lg);padding:var(--ui-space-sm) var(--ui-space-md);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg)}
  .splits span{font-size:var(--ui-text-xs);color:var(--ui-color-ink-muted)}
  .splits button{display:inline-flex;align-items:center;gap:6px;height:var(--ui-control-h-sm);padding:0 var(--ui-space-md);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-pill);background:var(--ui-color-surface-sunken);color:var(--ui-color-ink);font-family:var(--cjk);font-size:var(--ui-text-sm);cursor:pointer}
  .splits button:hover{border-color:var(--ui-color-border-strong);background:var(--ui-color-surface-hover)}
  .split-sources{display:inline-flex;gap:3px}
  .split-source{padding:0 4px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);font-family:var(--ui-font-sans);font-size:10px;line-height:15px;color:var(--ui-color-ink-muted);white-space:nowrap}
  .actions{display:flex;gap:var(--ui-space-sm);margin-top:var(--ui-space-lg)}
  .history{margin-top:var(--ui-space-md);font-size:var(--ui-text-xs);color:var(--ui-color-ink-muted)}
  .history summary{cursor:pointer}
  .history summary span{margin-left:var(--ui-space-2xs);color:var(--ui-color-ink-muted)}
  .history-list{display:flex;flex-direction:column;gap:var(--ui-space-3xs);margin-top:var(--ui-space-xs);max-height:140px;overflow:auto}
  .history-list button{min-height:var(--ui-control-h-xs);padding:var(--ui-space-2xs) var(--ui-space-sm);border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink);font:inherit;font-size:var(--ui-text-xs);text-align:left;cursor:pointer}
  .history-list button:hover{background:var(--ui-color-surface-hover)}
  .history-list p{margin:var(--ui-space-xs) 0 0;font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted)}
  .note,.hint{margin:var(--ui-space-sm) 0 0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  .hint{grid-column:1/-1}
  @media (max-width:640px){.layers{grid-template-columns:1fr}.affine{grid-template-columns:repeat(2,minmax(0,1fr))}.field.rotate{grid-column:auto}.matrix{grid-template-columns:repeat(2,minmax(0,1fr))}.mobius{grid-template-columns:1fr}}
</style>
