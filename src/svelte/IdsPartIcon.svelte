<script>
  // Draw compound palette entries only when their cells enter the scroll area.
  import { repetitionDrawing } from '../composer/repetition.js'
  import { parse } from '../core/ids.js'
  import { roughLayout, runPreview } from '../core/preview.js'

  /** @type {{ sequence: string, adapter: import('../adapter/types.js').IdsAdapter }} */
  let { sequence, adapter } = $props()
  const uid = $props.id()
  const tree = $derived(parse(sequence).tree ?? null)
  const fallback = $derived(roughLayout(tree))
  let visible = $state(false)
  let drawn = $state.raw(/** @type {import('../adapter/types.js').Drawing | null} */ (null))
  let url = $state(/** @type {string | null} */ (null))

  /** @param {HTMLElement} node */
  function watch(node) {
    if (typeof IntersectionObserver === 'undefined') { visible = true; return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { visible = true; observer.disconnect() }
    })
    observer.observe(node)
    return { destroy: () => observer.disconnect() }
  }

  $effect(() => {
    const text = sequence, { icon, drawing } = adapter
    const localDrawing = repetitionDrawing(text)
    drawn = localDrawing
    url = null
    if (!visible || localDrawing) return
    const controller = new AbortController()
    runPreview(text, { preview: icon, drawing, signal: controller.signal }, patch => {
      if (patch.url) url = patch.url
      if (patch.drawn) drawn = /** @type {import('../adapter/types.js').Drawing} */ (patch.drawn)
    })
    return () => controller.abort()
  })
</script>

{#snippet glyph(/** @type {{ char: string | null, box: number[], flip: boolean[] }} */ leaf)}
  <g transform={`translate(${leaf.box[0] * 1000} ${leaf.box[1] * 1000}) scale(${leaf.box[2] - leaf.box[0]} ${leaf.box[3] - leaf.box[1]})`}>
    <g transform={`translate(${leaf.flip[0] ? 1000 : 0} ${leaf.flip[1] ? 1000 : 0}) scale(${leaf.flip[0] ? -1 : 1} ${leaf.flip[1] ? -1 : 1})`}>
      <text x="500" y="850" font-size="1000" text-anchor="middle">{leaf.char ?? ''}</text>
    </g>
  </g>
{/snippet}

<span class="part-icon" use:watch aria-hidden="true">
  {#if url}
    <img src={url} alt="" draggable="false" />
  {:else}
    <svg viewBox="0 0 1000 1000" fill="currentColor" focusable="false">
      {#if drawn}
        {#if drawn.cut}
          <defs><mask id={`${uid}-cut`}><rect width="1000" height="1000" fill="white" /><path d={drawn.cut} fill="black" /></mask></defs>
        {/if}
        <path d={drawn.d} mask={drawn.cut ? `url(#${uid}-cut)` : undefined} />
      {:else}
        <defs>
          <mask id={`${uid}-fallback-cut`}>
            <rect width="1000" height="1000" fill="white" />
            <g fill="black">{#each fallback.filter(leaf => leaf.cut) as leaf}{@render glyph(leaf)}{/each}</g>
          </mask>
        </defs>
        <g mask={`url(#${uid}-fallback-cut)`}>
          {#each fallback.filter(leaf => !leaf.cut) as leaf}{@render glyph(leaf)}{/each}
        </g>
      {/if}
    </svg>
  {/if}
</span>

<style>
  .part-icon{display:block;width:28px;height:28px;pointer-events:none}
  svg,img{display:block;width:100%;height:100%;object-fit:contain}
</style>
