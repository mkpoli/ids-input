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
  import { leaves, samePath, write } from '../core/ids.js'
  import { FACE, STROKE, badge, placeholder, roughLayout, runPreview } from '../core/preview.js'
  import { translator } from './i18n.js'

  /**
   * @typedef {import('../adapter/types.js').IdsAdapter} IdsAdapter
   * @typedef {import('../adapter/types.js').Drawing} Drawing
   * @typedef {import('../adapter/types.js').SketchLeaf} SketchLeaf
   * @typedef {import('../core/ids.js').Part} Part
   * @typedef {import('../core/ids.js').Path} Path
   */

  /** @type {{ adapter: IdsAdapter, tree: Part, chosen?: Path | null, messages?: Record<string, string>, locale?: string, small?: boolean, notes?: boolean, delay?: number, drawing?: Drawing | null }} */
  let { adapter, tree, chosen = null, messages, locale = 'en', small = true, notes = true, delay = 150, drawing = $bindable(null) } = $props()
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
    const text = sequence, empty = tree === null, ask = adapter.preview, final = adapter.drawing
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

  // The drawing shown, for a host to export; none while it is out of date or failed.
  $effect(() => { drawing = step === 'composed' && shown?.drawn ? shown.drawn : null })
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
</script>

{#snippet slot(/** @type {number[]} */ box, /** @type {number} */ stroke, /** @type {boolean} */ selected, /** @type {boolean} */ faint)}
  {@const p = placeholder(box, stroke)}
  <g class="slot" class:selected class:faint>
    <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} class="slot-fill" />
    <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} class="slot-line"
      stroke-width={p.dot} pathLength={p.dots} stroke-dasharray="0 1" />
  </g>
{/snippet}

{#snippet picture(/** @type {string} */ name)}
  <div class="frame">
    {#if shown}
      {#key shown.key}
        <div class="layer" transition:fade={{ duration: 180 }}>
          {#if shown.url}
            <span class="final" style:--drawing={`url("${shown.url}")`}></span>
          {:else if shown.drawn}
            {@const drawn = shown.drawn}
            <svg viewBox="0 0 1000 1000" aria-hidden="true">
              {#if drawn.cut}
                <mask id="{uid}-{name}"><rect width="1000" height="1000" fill="#fff" /><path d={drawn.cut} fill="#000" /></mask>
              {/if}
              <path class="ink" d={drawn.d} mask={drawn.cut ? `url(#${uid}-${name})` : undefined} />
              {#each drawn.slots ?? [] as s (s.index)}
                {@render slot(s.box, drawn.stroke?.[0] ?? STROKE, inChosen(slotLeaf(s.index)), false)}
              {/each}
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

<figure class="ids-preview" data-step={step} data-label={said.label} aria-busy={step === 'loading'} aria-label={t('ids.preview.drawing', { sequence })}>
  <div class="ids-preview-large">
    {@render picture('large')}
    {#if step === 'loading'}<span class="ids-preview-progress" aria-hidden="true"></span>{/if}
  </div>
  {#if small || !quiet}
    <figcaption class="ids-preview-meta">
      {#if small}<div class="ids-preview-small">{@render picture('small')}</div>{/if}
      {#if !quiet}
        {#if step === 'loading'}<span class="ids-preview-spinner" aria-hidden="true"></span>{/if}
        <span class="ids-preview-badge" title={note || undefined}>{t(`ids.preview.${said.label}`)}</span>
      {/if}
    </figcaption>
  {/if}
  {#if note && notes}<p class="ids-preview-note">{note}</p>{/if}
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
