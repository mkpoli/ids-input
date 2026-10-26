<script>
  // A tab's composed drawing, and nothing else: the description drawn small in the tab's ink.
  // Until it arrives, or when the export cannot draw it, a muted empty frame stands in its place.
  // Drawn after a short pause, so a run of typing asks for one drawing rather than each keystroke.
  import { parse, write } from '../../src/core/index.js'
  /**
   * @typedef {{ d?: string, cut?: string, slots?: { index: number, box: number[] }[] }} Drawing
   * @type {{ sequence: string, draw: (sequence: string) => Promise<Drawing | null> }}
   */
  let { sequence, draw } = $props()
  const uid = $props.id()
  const read = $derived(parse(sequence, { open: true }))
  const source = $derived(!read.problem && read.tree !== null ? write(read.tree) : '')
  let drawing = $state.raw(/** @type {Drawing | null} */ (null))

  $effect(() => {
    const text = source, ask = draw
    let live = true
    if (!text) { drawing = null; return }
    const timer = setTimeout(() => ask(text).then(found => {
      if (live) drawing = found && (found.d?.trim() || found.slots?.length) ? found : null
    }, () => { if (live) drawing = null }), 200)
    return () => { live = false; clearTimeout(timer) }
  })
</script>

{#if drawing}
  <svg class="tab-glyph" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
    {#if drawing.cut}
      <mask id="{uid}-cut"><rect x="0" y="0" width="1000" height="1000" fill="#fff" /><path d={drawing.cut} fill="#000" /></mask>
    {/if}
    <path d={drawing.d} mask={drawing.cut ? `url(#${uid}-cut)` : undefined} />
    {#each drawing.slots ?? [] as slot (slot.index)}
      <rect class="tab-slot" x={slot.box[0]} y={slot.box[1]} width={slot.box[2]} height={slot.box[3]} rx="60" />
    {/each}
  </svg>
{:else}
  <svg class="tab-empty" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false"><rect x="150" y="150" width="700" height="700" rx="90" /></svg>
{/if}

<style>
  .tab-glyph{display:block;width:100%;height:100%;fill:currentColor}
  .tab-slot{fill:none;stroke:currentColor;stroke-opacity:.35;stroke-width:24;stroke-dasharray:48 40}
  .tab-empty{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-opacity:.28;stroke-width:26;stroke-dasharray:0 58;stroke-linecap:round}
</style>
