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
  import { askDrawable, EMOJI_CUT_MATRIX, FACE, STROKE, badge, emojiPlace, emojiTransform, placeholder, roughLayout, runPreview } from '../core/preview.js'
  import { documentView } from '@han-compose/composer/document-view'
  import { affineForChain, applyAffine, boxCorners, findLayer, invertAffine, layerAtPath, multiplyAffine, pathOfLayer, scopesMarkup } from '../document/index.js'
  import { layerFrames, renderScopes } from '../document/index.js'
  import { translator } from './i18n.js'
  /** @typedef {import('../document/frames.js').LayerFrame} LayerFrame */
  /** @typedef {import('../document/model.js').Document} LocalDocument */
  /** @typedef {import('@han-compose/composer/document-view').DocumentView} DocumentView */
  /** The engine's view, with the frames and the scoped drawing this file's renderer makes.
   *  @typedef {Omit<DocumentView, 'scopes' | 'frames'> & { scopes: import('../document/render.js').ScopeTree | null, frames: Map<string, LayerFrame> }} View */

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
   * @type {{ adapter: IdsAdapter, tree: Part, chosen?: Path | null, messages?: Record<string, string>, locale?: string, small?: boolean, notes?: boolean, delay?: number, detail?: string, detailContent?: import('svelte').Snippet, drawing?: Drawing | null, document?: Document | null, session?: DocumentSession | null, version?: number, scopes?: ScopeTree | null, slots?: number[][], emoji?: NonNullable<Drawing['emoji']> | null, cut?: string | null, cutLeaf?: number | null, editable?: boolean, onchoose?: ((path: number[]) => void) | null, onedit?: (() => void) | null }}
   */
  let { adapter, tree, chosen = null, messages, locale = 'en', small = true, notes = true, delay = 150, detail = '', detailContent, drawing = $bindable(null),
    document = null, session = null, version = 0, scopes = $bindable(null), slots = $bindable(/** @type {number[][]} */ ([])), emoji = $bindable(null), cut = $bindable(null), cutLeaf = $bindable(null), editable = false, onchoose = null, onedit = null } = $props()
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
    const text = sequence, empty = text === EMPTY, ask = askDrawable(adapter.preview, adapter.drawable), final = adapter.drawing
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
  const NOTES = { approximate: 'ids.preview.approximateNote', failed: 'ids.preview.failedNote', cells: 'ids.preview.cellsNote', tooLarge: 'ids.preview.tooLargeNote' }
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
  // Raw: the session already hands out a fresh clone, and a deep proxy would make its plain
  // transform chains unclonable on the way back into the session.
  let localDoc = $state.raw(/** @type {Document | null} */ (null))
  $effect(() => { void version; localDoc = session?.document ?? document })
  const view = $derived.by(() => {
    const drawn = shown?.drawn
    if (!localDoc || !drawn || !sketched || sketched.text !== sequence) return null
    return /** @type {View} */ (/** @type {unknown} */ (documentView(/** @type {LocalDocument} */ (localDoc), drawn, sketched.leaves, { renderer: { layerFrames, renderScopes } })))
  })
  const adjustNote = $derived(editable && step === 'composed' && shown?.drawn && !view?.complete ? t('ids.adjust.unavailable') : '')
  $effect(() => {
    scopes = view?.scopes ?? null
    slots = view ? [...view.frames.values()].filter(frame => frame.node.kind === 'slot').map(frame => boxCorners(frame.canvas, frame.box)) : []
    drawing = view?.scopes ? null : step === 'composed' && shown?.drawn ? shown.drawn : null
    emoji = view?.scopes ? shown?.drawn?.emoji ?? null : null
    cut = view?.scopes ? shown?.drawn?.cut ?? null : null
    cutLeaf = view?.scopes ? shown?.drawn?.parts?.find(part => part.cut)?.leaf ?? null : null
  })
  const chosenLayer = $derived.by(() => {
    if (!localDoc || !chosen) return null
    const selected = session?.chosen ? findLayer(localDoc.root, session.chosen)?.node ?? null : null
    const selectedPath = selected ? pathOfLayer(localDoc.root, selected.id) : null
    if (selected && selectedPath && selectedPath.join('.') === chosen.join('.')) return selected
    return layerAtPath(localDoc.root, chosen)
  })
  const frame = $derived(chosenLayer ? view?.frames.get(chosenLayer.id) ?? null : null)
  /** @type {[number, number, number, number]} */
  const CELL = [0, 0, 1000, 1000]
  /**
   * The layer's painted bounds in its own frame. A glyph can paint outside the layout cell the
   * composer gives it, so the selection hugs what is drawn rather than the cell.
   * @param {import('../document/model.js').Node} node @param {import('../document/frames.js').LayerFrame} at
   * @returns {[number, number, number, number]}
   */
  function inkBounds(node, at) {
    if (!view || node.kind !== 'component') return CELL
    const leaf = view.source.info.get(node.id)?.leaf
    if (typeof leaf !== 'number') return CELL
    const inverse = invertAffine(at.base)
    if (!inverse) return CELL
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const part of view.partsByLeaf.get(leaf) ?? []) {
      const box = /** @type {import('../adapter/types.js').DrawingPart} */ (part).box
      if (!Array.isArray(box) || box.length < 4) continue
      const [x, y, width, height] = box
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) continue
      for (const point of [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]) {
        const [lx, ly] = applyAffine(inverse, /** @type {[number, number]} */ (point))
        x0 = Math.min(x0, lx); y0 = Math.min(y0, ly); x1 = Math.max(x1, lx); y1 = Math.max(y1, ly)
      }
    }
    return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : CELL
  }
  const bounds = $derived(chosenLayer && frame ? inkBounds(chosenLayer, frame) : CELL)
  // The eight resize handles, named by the side of the layer's own frame they hold.
  const HANDLES = /** @type {const} */ ([
    ['nw', 0, 0], ['n', 0.5, 0], ['ne', 1, 0], ['e', 1, 0.5],
    ['se', 1, 1], ['s', 0.5, 1], ['sw', 0, 1], ['w', 0, 0.5],
  ])
  /** A point in the layer's own frame, by fractions of its bounds. @param {number[]} bounds @param {number} fx @param {number} fy */
  const pointIn = (bounds, fx, fy) => /** @type {[number, number]} */ ([
    bounds[0] + (bounds[2] - bounds[0]) * fx,
    bounds[1] + (bounds[3] - bounds[1]) * fy,
  ])
  /** The four canvas corners of a local box. @param {{ full: number[] }} at @param {number[]} bounds */
  const quadOf = (at, bounds) => [[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]], [bounds[0], bounds[3]]].map(([x, y]) => applyAffine(at.full, /** @type {[number, number]} */ ([x, y])))
  /** @param {number[][]} quad */
  const quadArea = quad => Math.abs(quad.reduce((sum, point, index) => {
    const next = quad[(index + 1) % quad.length]
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0)) / 2
  /** @param {number[]} point @param {number[][]} quad */
  const insideQuad = (point, quad) => {
    let inside = false
    for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
      const [xi, yi] = quad[i], [xj, yj] = quad[j]
      if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  // Every layer under the pointer, resolved by geometry rather than paint order: a small part inside
  // an enclosing one keeps its own box, so the enclosure cannot take the click.
  const hits = $derived.by(() => {
    if (!view || !editable) return []
    return [...view.frames.values()]
      .filter(item => item.node.kind !== 'slot')
      .map(item => {
        const quad = quadOf(item, CELL)
        return { frame: item, quad, area: quadArea(quad) }
      })
  })
  const selectionQuad = $derived(frame ? quadOf(frame, bounds) : null)
  const flat = $derived(chosenLayer ? affineForChain(chosenLayer.transform ?? []) : null)
  const rotationValue = $derived(flat ? Math.round(Math.atan2(flat[1], flat[0]) * 1800 / Math.PI) / 10 : 0)
  /** The handle's own place in the layer's frame. @param {string} key @param {number[]} bounds */
  const handleOf = (key, bounds) => pointIn(bounds,
    key.includes('w') ? 0 : key.includes('e') ? 1 : 0.5,
    key.includes('n') ? 0 : key.includes('s') ? 1 : 0.5)
  /** The point a resize handle holds still, in the layer's frame. @param {string} key @param {number[]} bounds */
  const anchorOf = (key, bounds) => pointIn(bounds,
    key.includes('w') ? 1 : key.includes('e') ? 0 : 0.5,
    key.includes('n') ? 1 : key.includes('s') ? 0 : 0.5)
  /** @typedef {{ gesture: number, kind: 'move' | 'scale' | 'rotate', id: string, svg: SVGSVGElement, p0: { x: number, y: number }, center: [number, number], place: number[], base: import('../document/index.js').Chain, inverseFull: number[] | null, corner: string, handle: [number, number], anchor: [number, number], q0: [number, number], perPixel: number, a0: number }} Drag */
  /** @type {Drag | null} */
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
  /** @param {number} value */
  const round = value => Math.round(value * 100) / 100
  /** @param {number} value @param {number} low @param {number} high */
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
  /** Apply a canvas-space affine operation, after the layer's authored chain. @param {number[]} operation @param {import('../document/index.js').Chain} base @param {string} id @param {number[]} place @param {string} coalesce */
  function applyCanvas(operation, base, id, place, coalesce) {
    if (!session) return
    const inverse = invertAffine(place)
    if (!inverse) return
    const local = multiplyAffine(inverse, multiplyAffine(operation, place))
    session.setTransform([...base, { type: 'affine', matrix: local }], id, { coalesce })
    localDoc = session.document
    onedit?.()
  }
  /** Apply an operation in the layer's own frame, before its authored chain. @param {number[]} operation @param {import('../document/index.js').Chain} base @param {string} id @param {string} coalesce */
  function applyLocal(operation, base, id, coalesce) {
    if (!session) return
    session.setTransform([{ type: 'affine', matrix: operation }, ...base], id, { coalesce })
    localDoc = session.document
    onedit?.()
  }
  /** @param {KeyboardEvent} event */
  function adjustKey(event) {
    if (!editable || !session || !chosenLayer || !frame?.supported) return
    // The bracket keys by position: with Shift held they report { and } on most layouts.
    const key = event.code === 'BracketLeft' ? '[' : event.code === 'BracketRight' ? ']' : event.key
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '[', ']', '0'].includes(key)) return
    event.preventDefault()
    event.stopPropagation()
    if (key === '0') {
      session.clearTransform(chosenLayer.id)
      localDoc = session.document
      onedit?.()
      return
    }
    const base = chosenLayer.transform ?? []
    if (key.startsWith('Arrow')) {
      const step = event.shiftKey ? 10 : 1
      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0
      const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0
      applyCanvas([1, 0, 0, 1, dx, dy], base, chosenLayer.id, frame.place, `key-${key}`)
      return
    }
    const center = pointIn(inkBounds(chosenLayer, frame), 0.5, 0.5)
    if (key === '+' || key === '=' || key === '-') {
      const scale = key === '-' ? 1 / 1.05 : 1.05
      applyLocal([scale, 0, 0, scale, center[0] * (1 - scale), center[1] * (1 - scale)], base, chosenLayer.id, `key-${key}`)
      return
    }
    // A turn is made on the canvas, as the rotate handle makes it: in the layer's own frame, which a
    // slot can squash, it would shear the part.
    const [cx, cy] = applyAffine(frame.full, center)
    const degrees = key === '[' ? -(event.shiftKey ? 15 : 5) : event.shiftKey ? 15 : 5
    const radians = degrees * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians)
    applyCanvas([cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy], base, chosenLayer.id, frame.place, `key-${key}`)
  }
  /** @param {string} id */
  function chooseLayer(id) {
    if (!session || !localDoc) return
    if (!session.choose(id)) return
    localDoc = session.document
    const path = pathOfLayer(localDoc.root, id)
    if (path) onchoose?.(path)
    onedit?.()
  }
  /** The smallest layer whose own box holds the point, so an enclosed part wins over its enclosure. @param {number[]} point */
  function pickAt(point) {
    let found = /** @type {import('../document/frames.js').LayerFrame | null} */ (null)
    let area = Infinity, depth = -1
    for (const hit of hits) {
      if (!insideQuad(point, hit.quad)) continue
      // The smallest box wins. A tie is a group and its child sharing one box: the deeper frame
      // wins, and at equal depth the later one, which is painted on top.
      if (hit.area < area || hit.area === area && hit.frame.depth >= depth) { found = hit.frame; area = hit.area; depth = hit.frame.depth }
    }
    return found
  }
  /**
   * Begin a canvas gesture. The frame supplies the map from the canvas into the layer's own units,
   * so the same gesture means the same thing on a nested layer and on a root one.
   * @param {PointerEvent} event
   * @param {{ kind: 'move' | 'scale' | 'rotate', node: import('../document/model.js').Node, frame: import('../document/frames.js').LayerFrame, corner?: string, bounds?: [number, number, number, number] }} start
   */
  function startDrag(event, start) {
    const { kind, node, frame: at } = start
    if (!editable || !session || !at.supported) return
    const bounds = start.bounds ?? inkBounds(node, at)
    if (event.button !== 0 || !event.isPrimary) return
    event.preventDefault()
    event.stopPropagation()
    const element = /** @type {SVGElement | null} */ (event.currentTarget)
    const svg = element instanceof SVGSVGElement ? element : element?.ownerSVGElement ?? null
    if (!svg) return
    const p = pointAt(svg, event)
    if (!p) return
    const base = node.transform ?? []
    if (!affineForChain(base)) return
    const center = applyAffine(at.full, pointIn(bounds, 0.5, 0.5))
    const inverseFull = invertAffine(at.full)
    const q0 = inverseFull ? applyAffine(inverseFull, [p.x, p.y]) : [500, 500]
    const corner = start.corner ?? ''
    const matrix = svg.getScreenCTM()
    const perPixel = matrix?.a ? 1 / matrix.a : 1
    docDrag = { gesture: ++gesture, kind, id: node.id, svg, p0: { x: p.x, y: p.y }, center: [center[0], center[1]], place: at.place, base,
      inverseFull, corner, handle: handleOf(corner, bounds), anchor: anchorOf(corner, bounds), q0: /** @type {[number, number]} */ ([q0[0], q0[1]]), perPixel,
      a0: Math.atan2(p.y - center[1], p.x - center[0]) }
    svg.setPointerCapture?.(event.pointerId)
    svg.focus?.({ preventScroll: true })
  }
  /** A pointerdown on the drawing itself chooses the layer under it and starts moving that layer. @param {PointerEvent} event */
  function pointerDown(event) {
    if (!editable || !session || !view) return
    if (event.button !== 0 || !event.isPrimary) return
    const svg = /** @type {SVGSVGElement} */ (event.currentTarget)
    const p = pointAt(svg, event)
    if (!p) return
    // A painted part answers where its ink is, even when the composer drew it outside the layout
    // box; empty areas fall back to the smallest box that holds the point.
    const ink = event.target instanceof Element ? event.target.closest('[data-layer]') : null
    const inked = ink && view ? view.frames.get(ink.getAttribute('data-layer') ?? '') ?? null : null
    const picked = inked ?? pickAt([p.x, p.y])
    if (!picked) return
    if (session.chosen !== picked.node.id) chooseLayer(picked.node.id)
    startDrag(event, { kind: 'move', node: picked.node, frame: picked })
  }
  /** @param {PointerEvent} event */
  function moveDrag(event) {
    if (!docDrag) return
    const p = pointAt(docDrag.svg, event)
    if (!p) return
    const [cx, cy] = docDrag.center
    if (docDrag.kind === 'move') {
      const dx = p.x - docDrag.p0.x, dy = p.y - docDrag.p0.y
      if (Math.hypot(dx, dy) < 3 * docDrag.perPixel) return
      applyCanvas([1, 0, 0, 1, dx, dy], docDrag.base, docDrag.id, docDrag.place, `drag-${docDrag.gesture}`)
      return
    }
    if (Math.hypot(p.x - docDrag.p0.x, p.y - docDrag.p0.y) < 2 * docDrag.perPixel) return
    if (docDrag.kind === 'rotate') {
      let angle = (Math.atan2(p.y - cy, p.x - cx) - docDrag.a0) * 180 / Math.PI
      if (event.shiftKey) angle = Math.round(angle / 15) * 15
      const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians)
      applyCanvas([cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy], docDrag.base, docDrag.id, docDrag.place, `drag-${docDrag.gesture}`)
      return
    }
    if (!docDrag.inverseFull) return
    const q = applyAffine(docDrag.inverseFull, [p.x, p.y])
    const [ax, ay] = docDrag.anchor
    const horizontal = docDrag.corner.includes('w') || docDrag.corner.includes('e')
    const vertical = docDrag.corner.includes('n') || docDrag.corner.includes('s')
    // The pointer may grab the handle off its centre. Its own corner is the reference, so the
    // handle follows the pointer's movement instead of measuring from where the grab happened.
    /** @param {number} value @param {number} from @param {number} anchor @param {number} at */
    const ratio = (value, from, anchor, at) => Math.abs(at - anchor) < 1e-6 ? 1 : 1 + (value - from) / (at - anchor)
    let sx = horizontal ? ratio(q[0], docDrag.q0[0], ax, docDrag.handle[0]) : 1
    let sy = vertical ? ratio(q[1], docDrag.q0[1], ay, docDrag.handle[1]) : 1
    if (event.shiftKey) {
      const uniform = horizontal && vertical ? (Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy) : horizontal ? sx : sy
      sx = uniform; sy = uniform
    }
    sx = clamp(sx, 0.05, 20); sy = clamp(sy, 0.05, 20)
    if (Math.abs(sx - 1) < 0.002 && Math.abs(sy - 1) < 0.002) return
    applyLocal([sx, 0, 0, sy, ax * (1 - sx), ay * (1 - sy)], docDrag.base, docDrag.id, `drag-${docDrag.gesture}`)
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
              onpointerdown={interactive ? pointerDown : undefined}
              onpointermove={interactive ? moveDrag : undefined}
              onpointerup={interactive ? endDrag : undefined}
              onpointercancel={interactive ? endDrag : undefined}
              onkeydown={interactive ? adjustKey : undefined}
>
              {#if interactive}
                <!-- One transparent surface makes the whole canvas hear a drag; the layer under it is
                     picked by geometry, so paint order never decides which part can be grabbed. -->
                <rect class="surface" width="1000" height="1000" fill="transparent" pointer-events="all" aria-hidden="true" />
              {/if}
              {#if view?.scopes}
                <!-- The scoped drawing carries its own ink, cut and emoji, as the export does. -->
                {@const markup = scopesMarkup(view.scopes, { ink: 'currentColor', idPrefix: `${uid}-${name}`, emoji: drawn.emoji, cut: drawn.cut, cutLeaf: drawn.parts?.find(part => part.cut)?.leaf ?? null, layers: true })}
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
                        {@const place = emojiPlace(item)}
                        <text filter={`url(#${uid}-${name}-emoji-cut)`} transform={emojiTransform(item) || undefined} x={place.x} y={place.y} text-anchor="middle" dominant-baseline="central" font-size={place.size} font-family="system-ui, sans-serif">{item.text}</text>
                      {/if}
                    {/each}
                  </mask>
                {/if}
                <path class="ink" d={drawn.d} mask={hasCut ? `url(#${uid}-${name})` : undefined} />
                {#each drawn.emoji ?? [] as item}
                  {#if !item.cut}
                    {@const place = emojiPlace(item)}
                    <text mask={hasCut && !item.restored ? `url(#${uid}-${name})` : undefined} transform={emojiTransform(item) || undefined} x={place.x} y={place.y} text-anchor="middle" dominant-baseline="central" font-size={place.size} font-family="system-ui, sans-serif">{item.text}</text>
                  {/if}
                {/each}
              {/if}
              {#each drawn.slots ?? [] as s (s.index)}
                {@render slot(s.box, drawn.stroke?.[0] ?? STROKE, inChosen(slotLeaf(s.index)), false)}
              {/each}
              {#if interactive && frame?.supported && selectionQuad && chosenLayer}
                {@const size = 32}
                {@const part = chosenLayer.kind === 'component' ? chosenLayer.char : ''}
                {@const points = selectionQuad.map(point => `${round(point[0])} ${round(point[1])}`).join(' ')}
                {@const top = applyAffine(frame.full, pointIn(bounds, 0.5, 0))}
                {@const inward = applyAffine(frame.full, pointIn(bounds, 0.5, 0.2))}
                {@const span = Math.hypot(top[0] - inward[0], top[1] - inward[1]) || 1}
                {@const turned = [top[0] + (top[0] - inward[0]) / span * 80, top[1] + (top[1] - inward[1]) / span * 80]}
                <!-- The turn grip stays inside the canvas, so a layer against an edge keeps it reachable. -->
                {@const turn = /** @type {[number, number]} */ ([clamp(turned[0], 40, 960), clamp(turned[1], 40, 960)])}
                <g class="selection">
                  <polygon class="select-box" points={points} />
                  <polygon class="select-grip" points={points} role="button" tabindex="-1"
                    aria-label={t('ids.adjust.move', { part })}
                    onpointerdown={event => startDrag(event, { kind: 'move', node: chosenLayer, frame, bounds })} />
                  <line class="turn-line" x1={top[0]} y1={top[1]} x2={turn[0]} y2={turn[1]} />
                  {#each HANDLES as [key, fx, fy] (key)}
                    {@const at = applyAffine(frame.full, pointIn(bounds, fx, fy))}
                    <g class={`handle resize ${key}`} role="button" tabindex="-1" aria-label={`${t('ids.adjust.scale', { part })} ${key.toUpperCase()}`}
                      onpointerdown={event => startDrag(event, { kind: 'scale', node: chosenLayer, frame, corner: key, bounds })}>
                      <circle class="handle-hit" cx={at[0]} cy={at[1]} r={size * 0.95} fill="transparent" />
                      <rect class="handle-face" x={at[0] - size / 2} y={at[1] - size / 2} width={size} height={size} rx={size / 5} />
                    </g>
                  {/each}
                  <g class="handle rotate" role="slider" tabindex="-1" aria-label={t('ids.adjust.rotate', { part })}
                    aria-valuemin="-180" aria-valuemax="180" aria-valuenow={rotationValue}
                    onpointerdown={event => startDrag(event, { kind: 'rotate', node: chosenLayer, frame, bounds })}>
                    <circle class="handle-hit" cx={turn[0]} cy={turn[1]} r={size * 0.9} fill="transparent" />
                    <circle class="handle-face" cx={turn[0]} cy={turn[1]} r={size * 0.55} />
                  </g>
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

<figure class="ids-preview" data-step={step} data-label={said.label} data-composed={shown?.drawn?.composed ? 'true' : undefined} data-adjusting={editable ? 'true' : undefined}
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
        {#if step === 'composed' && shown?.drawn?.faceFallback}<span class="ids-preview-fallback">{t('ids.preview.faceFallback')}</span>{/if}
      {/if}
    </figcaption>
  {/if}
  {#if note && notes}<p class="ids-preview-note">{note}</p>{/if}
  {#if adjustNote}<p class="ids-preview-note">{adjustNote}</p>{/if}
</figure>

<style>
  .ids-preview{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_muted:var(--ids-muted,light-dark(#686874,#9d9daa));
    --_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));--_surface:var(--ids-surface,light-dark(#fff,#1b1b20));
    --_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    margin:0;display:flex;flex-direction:column;align-items:center;gap:6px;width:var(--ids-preview-size,120px);max-width:100%;flex:none}
  .ids-preview-large{position:relative;width:100%;aspect-ratio:1;border:1px solid var(--_line);border-radius:10px;background:var(--_surface);color:var(--_ink);overflow:hidden}
  .ids-preview-progress{position:absolute;right:0;bottom:0;left:0;height:2px;overflow:hidden;background:color-mix(in srgb,var(--_line) 55%,transparent);pointer-events:none}
  .ids-preview-progress::before{content:"";position:absolute;inset-block:0;left:0;width:42%;border-radius:2px;background:var(--_accent);animation:ids-preview-sweep 1.15s ease-in-out infinite}
  .ids-preview-spinner{flex:none;width:11px;height:11px;border:1.5px solid color-mix(in srgb,var(--_muted) 28%,transparent);border-top-color:var(--_accent);border-radius:50%;animation:ids-preview-spin .8s linear infinite}
  .ids-preview-meta{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 8px;min-height:22px;max-width:100%}
  .ids-preview-small{width:20px;height:20px;color:var(--_ink)}
  .ids-preview-detail{font:11px "IDS New Korean","IDS Shuishu","IDS Jurchen",ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--_muted)}
  .frame{position:relative;width:100%;height:100%}
  .layer{position:absolute;inset:0}
  .ids-preview-large .layer{inset:5%}
  .layer :is(svg,.final){display:block;width:100%;height:100%}
  .final{background:currentColor;-webkit-mask:var(--drawing) center/100% 100% no-repeat;mask:var(--drawing) center/100% 100% no-repeat}
  @media (forced-colors: active){.final{forced-color-adjust:none;background:CanvasText}.ink{fill:CanvasText}}
  .ink{fill:currentColor}
  .ids-preview-large svg[tabindex]:focus-visible{outline:2px solid var(--_accent);outline-offset:-2px;border-radius:10px}
  .ids-preview[data-adjusting] .ids-preview-meta{display:none}
  .adjusting{touch-action:none;cursor:move}
  .selection{pointer-events:none}
  .select-box{fill:none;stroke:var(--_accent);stroke-width:1.5;stroke-dasharray:6 5;vector-effect:non-scaling-stroke;pointer-events:none}
  .select-grip{fill:none;stroke:transparent;stroke-width:14;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:move}
  .turn-line{stroke:var(--_accent);stroke-width:1.5;vector-effect:non-scaling-stroke;pointer-events:none}
  .handle{pointer-events:none}
  .handle-hit{fill:transparent;pointer-events:all}
  .handle-face{fill:var(--_surface);stroke:var(--_accent);stroke-width:1.5;vector-effect:non-scaling-stroke;pointer-events:none}
  .handle.rotate{cursor:grab}
  .handle.nw,.handle.se{cursor:nwse-resize}
  .handle.ne,.handle.sw{cursor:nesw-resize}
  .handle.n,.handle.s{cursor:ns-resize}
  .handle.e,.handle.w{cursor:ew-resize}
  @media (forced-colors: active){.handle-face{fill:Canvas;stroke:CanvasText}.select-box,.turn-line{stroke:CanvasText}}
  .slot-fill{fill:color-mix(in srgb,var(--_accent) 6%,transparent)}
  .slot-line{fill:none;stroke:color-mix(in srgb,var(--_accent) 50%,var(--_muted));stroke-linecap:round}
  .slot.faint .slot-fill{fill:color-mix(in srgb,var(--_ink) 3%,transparent)}
  .slot.faint .slot-line{stroke:color-mix(in srgb,var(--_ink) 20%,transparent)}
  .slot.selected .slot-fill{fill:color-mix(in srgb,var(--_accent) 16%,transparent)}
  .slot.selected .slot-line{stroke:var(--_accent)}
  .ids-preview-badge{padding:0 7px;border-radius:999px;font-size:11px;line-height:18px;color:var(--_muted);border:1px solid var(--_line);text-align:center}
  .ids-preview-fallback{font-size:11px;color:var(--_muted);text-align:center}
  .ids-preview[data-label="loading"] .ids-preview-badge{color:var(--_accent);border-color:color-mix(in srgb,var(--_accent) 35%,var(--_line))}
  .ids-preview[data-label="final"] .ids-preview-badge{color:var(--_accent);border-color:color-mix(in srgb,var(--_accent) 45%,var(--_line))}
  .ids-preview[data-composed] .ink{fill:var(--_muted);opacity:.85}
.ids-preview:is([data-label="failed"],[data-label="tooLarge"]) .ids-preview-badge{color:var(--_fault);border-color:color-mix(in srgb,var(--_fault) 35%,var(--_line))}
  .ids-preview-note{margin:0;width:100%;font-size:11px;line-height:1.4;color:var(--_muted);text-align:center;overflow-wrap:anywhere}
  @keyframes ids-preview-spin{to{transform:rotate(1turn)}}
  @keyframes ids-preview-sweep{from{transform:translateX(-110%)}to{transform:translateX(260%)}}
  @media (prefers-reduced-motion: reduce){
    .ids-preview-spinner{animation:none;border-top-color:var(--_muted)}
    .ids-preview-progress::before{animation:none;width:100%;background:var(--_line)}
  }
</style>
