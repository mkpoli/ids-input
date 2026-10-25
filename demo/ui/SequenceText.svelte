<script>
  // A sequence drawn as its components and the operators' SVG icons, so an IDC glyph's dotted
  // frame does not clutter it. The whole sequence stays in the accessible name.
  import { arity } from '../../src/core/index.js'
  import OperatorIcon from '../../src/svelte/OperatorIcon.svelte'
  /** @type {{ sequence: string, size?: number }} */
  let { sequence, size = 14 } = $props()
  /** @type {{ op?: string, text?: string }[]} */
  const segments = $derived.by(() => {
    /** @type {{ op?: string, text?: string }[]} */
    const out = []
    for (const char of sequence) {
      if (arity(char)) out.push({ op: char })
      else {
        const last = out.at(-1)
        if (last && last.text !== undefined) last.text += char
        else out.push({ text: char })
      }
    }
    return out
  })
</script>

<span class="sequence" aria-label={sequence}>
  {#each segments as segment, i (i)}
    {#if segment.op}<span class="op" aria-hidden="true"><OperatorIcon op={segment.op} size={size} /></span>
    {:else}<span class="text">{segment.text}</span>{/if}
  {/each}
</span>

<style>
  .sequence{display:inline-flex;align-items:center;flex-wrap:wrap;column-gap:1px;row-gap:0;min-width:0;font-family:var(--cjk);line-height:1.35}
  .op{display:inline-grid;place-items:center;flex:none;width:1.15em;height:1.15em;margin:0 1px}
  .text{white-space:pre-wrap;overflow-wrap:anywhere}
</style>
