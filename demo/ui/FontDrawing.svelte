<script module>
  // Mask and filter ids have to differ between cells.
  let next = 0
</script>

<script>
  // One sequence drawn by a face's composer export, fetched when the cell is created. The drawing is
  // the same SVG the rest of the app uses: emoji in their boxes, ㇯ cuts masked, and the path of the
  // face's ink.
  import { drawingSvg } from '@han-compose/composer/drawing-svg'
  /** @type {{ sequence: string, draw: (sequence: string) => Promise<{ d: string } | null>, label?: string, fallback?: string | null }} */
  let { sequence, draw, label = '', fallback = null } = $props()
  const uid = `font-drawing-${++next}`
  // The shared renderer sizes an Emoji for Noto Emoji's 0.73-em ink. system-ui picks the colour face
  // in the page, whose ink fills the em, so its text is scaled back to 0.85 of the shorter box side.
  const EMOJI_FIT = 0.85 / 1.36
  const fitEmoji = svg => svg.replace(/font-size="([0-9.]+)"/g, (_, size) => `font-size="${(Number(size) * EMOJI_FIT).toFixed(2)}"`)
  /** @type {string} */
  let svg = $state(fallback ? drawingSvg({ d: fallback }, { ink: 'currentColor' }) : '')
  let failed = $state(false)
  $effect(() => {
    let live = true
    svg = fallback ? drawingSvg({ d: fallback }, { ink: 'currentColor' }) : ''
    failed = false
    draw(sequence).then(drawing => {
      if (!live) return
      if (drawing) {
        svg = fitEmoji(drawingSvg(drawing, { ink: 'currentColor', idPrefix: `${uid}-` }))
      } else {
        failed = true
        svg = ''
      }
    }).catch(() => { if (live) failed = true })
    return () => { live = false }
  })
</script>

<div class="drawing" role="img" aria-label={label || sequence}>
  {#if svg}{@html svg}{:else if failed}<svg viewBox="0 0 1000 1000" aria-hidden="true"><text x="500" y="540" text-anchor="middle" font-size="90">—</text></svg>{/if}
</div>

<style>
  .drawing{display:block;width:100%;height:auto;aspect-ratio:1;background:var(--ui-color-surface-sunken);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);color:var(--ui-color-ink);overflow:hidden}
  .drawing :global(svg){display:block;width:100%;height:100%}
  .drawing :global(text){fill:var(--ui-color-ink-muted);font-family:system-ui,sans-serif}
</style>
