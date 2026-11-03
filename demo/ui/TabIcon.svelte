<script>
  // A tab's composed drawing: the description drawn small in the tab's ink, its emoji in colour.
  // Until it arrives, or when the export cannot draw it, a muted empty frame stands in its place.
  // Drawn after a short pause, so a run of typing asks for one drawing rather than each keystroke;
  // a list of settled tabs asks at once with a delay of 0.
  import { parse, write } from '../../src/core/index.js'
  import { EMOJI_CUT_MATRIX, emojiTransform } from '../../src/core/preview.js'
  /**
   * @typedef {{ d?: string, cut?: string, slots?: { index: number, box: number[] }[],
   *   emoji?: { text: string, box: number[], flip?: [boolean, boolean], cut?: boolean, restored?: boolean }[] }} Drawing
   * @type {{ sequence: string, draw: (sequence: string) => Promise<Drawing | null>, delay?: number }}
   */
  let { sequence, draw, delay = 200 } = $props()
  const uid = $props.id()
  const read = $derived(parse(sequence, { open: true }))
  const source = $derived(!read.problem && read.tree !== null ? write(read.tree) : '')
  let drawing = $state.raw(/** @type {Drawing | null} */ (null))
  /** An emoji's box and glyph size, with every number finite. @param {{ box?: number[] }} item */
  const emojiBox = item => {
    const [x, y, width, height] = (item.box ?? []).slice(0, 4).map(value => Number.isFinite(Number(value)) ? Number(value) : 0)
    return { x, y, width, height, size: Math.max(0, Math.min(width, height) * 0.85) }
  }

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
  {@const emoji = drawing.emoji ?? []}
  {@const hasCut = Boolean(drawing.cut || emoji.some(item => item.cut))}
  <svg class="tab-glyph" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
    {#if hasCut}
      {#if emoji.some(item => item.cut)}
        <filter id="{uid}-emoji-cut" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values={EMOJI_CUT_MATRIX} /></filter>
      {/if}
      <mask id="{uid}-cut"><rect x="0" y="0" width="1000" height="1000" fill="#fff" />
        {#if drawing.cut}<path d={drawing.cut} fill="#000" />{/if}
        {#each emoji as item}
          {#if item.cut}
            {@const box = emojiBox(item)}
            <text filter={`url(#${uid}-emoji-cut)`} transform={emojiTransform(item) || undefined} x={box.x + box.width / 2} y={box.y + box.height / 2} text-anchor="middle" dominant-baseline="central" font-size={box.size} font-family="system-ui, sans-serif">{item.text}</text>
          {/if}
        {/each}
      </mask>
    {/if}
    <path d={drawing.d} mask={hasCut ? `url(#${uid}-cut)` : undefined} />
    {#each emoji as item}
      {#if !item.cut}
        {@const box = emojiBox(item)}
        <text mask={hasCut && !item.restored ? `url(#${uid}-cut)` : undefined} transform={emojiTransform(item) || undefined} x={box.x + box.width / 2} y={box.y + box.height / 2} text-anchor="middle" dominant-baseline="central" font-size={box.size} font-family="system-ui, sans-serif">{item.text}</text>
      {/if}
    {/each}
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
