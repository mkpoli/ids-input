<script>
  // Render rare Han from a supplied outline when available.
  /** @type {{ part: string, draw?: ((part: string) => Promise<import('../adapter/types.js').Drawing | null>) | null, fontStyle?: string }} */
  let { part, draw = null, fontStyle = '' } = $props()
  /** @type {import('../adapter/types.js').Drawing | null} */ let drawing = $state(null)
  $effect(() => {
    const text = part, request = draw, style = fontStyle
    let cancelled = false
    drawing = null
    const cp = text.codePointAt(0) ?? 0
    // The bundled parts font is a subset; supplementary Han and Extension A may be absent.
    const rareHan = [...text].length === 1 && ((cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x323af) || (cp >= 0x323b0 && cp <= 0x33479))
    if (request && rareHan) {
      request(text).then(result => { if (!cancelled && result?.d) drawing = result }).catch(() => {})
    }
    void style
    return () => { cancelled = true }
  })
</script>

<span class="glyph" aria-hidden="true">
  {#if drawing}<svg viewBox="0 0 1000 1000" focusable="false"><path d={drawing.d} /></svg>{:else}{part}{/if}
</span>

<style>
  .glyph{display:grid;place-items:center;width:1em;height:1.4em;font:inherit;line-height:1.4}
  svg{display:block;width:1em;height:1em;fill:currentColor;overflow:visible}
</style>
