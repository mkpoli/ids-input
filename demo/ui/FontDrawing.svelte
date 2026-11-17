<script>
  // One sequence drawn by a face's composer export, fetched when the cell is created.
  /** @type {{ sequence: string, draw: (sequence: string) => Promise<{ d: string } | null>, label?: string, fallback?: string | null }} */
  let { sequence, draw, label = '', fallback = null } = $props()
  /** @type {string | null} */
  let d = $state(/** @type {string | null} */ (fallback))
  let failed = $state(false)
  $effect(() => {
    let live = true
    d = fallback
    failed = false
    draw(sequence).then(drawing => { if (!live) return; if (drawing) d = drawing.d; else { failed = true; d = null } }).catch(() => { if (live) failed = true })
    return () => { live = false }
  })
</script>

<svg viewBox="0 0 1000 1000" role="img" aria-label={label || sequence}>
  {#if d}<path {d} fill="currentColor"/>{:else if failed}<text x="500" y="540" text-anchor="middle" font-size="90">—</text>{/if}
</svg>

<style>
  svg{display:block;width:100%;height:auto;aspect-ratio:1;background:var(--ui-color-surface-sunken);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);color:var(--ui-color-ink)}
  text{fill:var(--ui-color-ink-muted);font-family:system-ui,sans-serif}
</style>
