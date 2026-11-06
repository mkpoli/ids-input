<script>
  // A tab's composed drawing: the description drawn small in the tab's ink, its emoji in colour.
  // Until it arrives, or when the export cannot draw it, a muted empty frame stands in its place.
  // Drawn after a short pause, so a run of typing asks for one drawing rather than each keystroke;
  // a list of settled tabs asks at once with a delay of 0.
  import { parse, write } from '../../src/core/index.js'
  import { drawingSvg } from '../../src/core/index.js'
  /**
   * @typedef {Parameters<typeof drawingSvg>[0]} Drawing
   * @type {{ sequence: string, draw: (sequence: string) => Promise<Drawing | null>, delay?: number }}
   */
  let { sequence, draw, delay = 200 } = $props()
  const uid = $props.id()
  const read = $derived(parse(sequence, { open: true }))
  const source = $derived(!read.problem && read.tree !== null ? write(read.tree) : '')
  let drawing = $state.raw(/** @type {Drawing | null} */ (null))

  $effect(() => {
    const text = source, ask = draw
    let live = true
    if (!text) { drawing = null; return }
    const timer = setTimeout(() => ask(text).then(found => {
      if (live) drawing = found && (found.d?.trim() || found.slots?.length || found.emoji?.length) ? found : null
    }, () => { if (live) drawing = null }), delay)
    return () => { live = false; clearTimeout(timer) }
  })
</script>

{#if drawing}
  <span class="tab-glyph" aria-hidden="true">{@html drawingSvg(drawing, { ink: 'currentColor', placeholders: true, idPrefix: `${uid}-` })}</span>
{:else}
  <svg class="tab-empty" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false"><rect x="150" y="150" width="700" height="700" rx="90" /></svg>
{/if}

<style>
  .tab-glyph{display:block;width:100%;height:100%}
  .tab-glyph :global(svg){display:block;width:100%;height:100%}
  .tab-empty{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-opacity:.28;stroke-width:26;stroke-dasharray:0 58;stroke-linecap:round}
</style>
