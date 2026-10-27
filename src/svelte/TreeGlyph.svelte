<script>
  // Ask for an outline only when the browser renders this character as its missing-glyph box.
  import { tick } from 'svelte'
  /** @type {{ part: string, draw?: ((part: string) => Promise<import('../adapter/types.js').Drawing | null>) | null, fontStyle?: string }} */
  let { part, draw = null, fontStyle = '' } = $props()
  /** @type {HTMLElement | undefined} */ let element = $state()
  /** @type {import('../adapter/types.js').Drawing | null} */ let drawing = $state(null)
  $effect(() => {
    const text = part, request = draw, style = fontStyle, host = element
    let cancelled = false
    drawing = null
    if (!host || !request || [...text].length !== 1) return
    async function check() {
      await tick()
      await document.fonts.ready
      if (cancelled || !host || !request) return
      const canvas = document.createElement('canvas')
      canvas.width = 128; canvas.height = 96
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.font = `48px ${getComputedStyle(host).fontFamily}`
      ctx.textBaseline = 'middle'
      const pixels = (/** @type {string} */ character) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillText(character, 8, 48)
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data
      }
      const actual = pixels(text), missing = pixels('\u{10FFFF}')
      if (!actual.some((value, i) => value !== missing[i])) {
        const result = await request(text).catch(() => null)
        if (!cancelled && result?.d) drawing = result
      }
    }
    void style
    check().catch(() => {})
    return () => { cancelled = true }
  })
</script>

<span class="glyph" bind:this={element} aria-hidden="true">
  {#if drawing}<svg viewBox="0 0 1000 1000" focusable="false"><path d={drawing.d} /></svg>{:else}{part}{/if}
</span>

<style>
  .glyph{display:grid;place-items:center;width:1em;height:1.4em;font:inherit;line-height:1.4}
  svg{display:block;width:1em;height:1em;fill:currentColor;overflow:visible}
</style>
