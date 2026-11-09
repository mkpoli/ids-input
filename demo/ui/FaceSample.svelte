<script>
  // A description drawn in one face, for the font switch: the character being built stands where
  // the specimen "Aa" used to, so the faces are compared on the reader's own description. The
  // drawing waits for a pause in editing; the last one stays while the next is made, and a
  // description this face cannot draw falls back to the specimen.
  import { drawingSvg, parse, write } from '../../src/core/index.js'
  /** @typedef {Parameters<typeof drawingSvg>[0]} Drawing */
  /** @type {{ sequence: string, draw: ((sequence: string) => Promise<Drawing | null>) & { cancel?: () => void }, delay?: number, fallback?: import('svelte').Snippet }} */
  let { sequence, draw, delay = 400, fallback } = $props()
  const uid = $props.id()
  const read = $derived(parse(sequence, { open: true }))
  const source = $derived(!read.problem && read.tree !== null ? write(read.tree) : '')
  let drawing = $state.raw(/** @type {Drawing | null} */ (null))

  $effect(() => {
    const text = source, ask = draw
    let live = true, timer = 0
    if (!text) { drawing = null; ask.cancel?.(); return }
    // A first failure may be the export's connection, not the face: ask once more after a pause.
    /** @param {boolean} retry */
    const make = retry => {
      timer = setTimeout(() => ask(text).then(found => {
        if (!live) return
        if (found && (found.d?.trim() || found.slots?.length || found.emoji?.length)) { drawing = found; return }
        if (retry) drawing = null
        else make(true)
      }, () => {
        if (!live) return
        if (retry) drawing = null
        else make(true)
      }), retry ? 1200 : delay)
    }
    make(false)
    return () => { live = false; clearTimeout(timer) }
  })
</script>

{#if drawing}
  <span class="sample" aria-hidden="true">{@html drawingSvg(drawing, { ink: 'currentColor', placeholders: true, idPrefix: `${uid}-` })}</span>
{:else}
  {@render fallback?.()}
{/if}

<style>
  .sample{display:block;width:100%;height:100%}
  .sample :global(svg){display:block;width:100%;height:100%}
</style>
