<script>
  import { parse } from '../../src/core/ids.js'
  import { roughLayout } from '../../src/core/preview.js'
  let { text, label } = $props()
  const uid = $props.id()
  const parsed = $derived(parse(text, { open: true }))
  const parts = $derived(parsed.problem ? [] : roughLayout(parsed.tree ?? null))
</script>

{#snippet leaf(part)}
  <g transform={`translate(${part.box[0] * 1000} ${part.box[1] * 1000}) scale(${part.box[2] - part.box[0]} ${part.box[3] - part.box[1]})`}>
    <g transform={`translate(${part.flip[0] ? 1000 : 0} ${part.flip[1] ? 1000 : 0}) scale(${part.flip[0] ? -1 : 1} ${part.flip[1] ? -1 : 1})`}>
      {#if part.char}<text x="500" y="850" font-size="1000" text-anchor="middle">{part.char}</text>
      {:else}<rect x="70" y="70" width="860" height="860" fill="none" stroke="currentColor" stroke-width="24" stroke-dasharray="40 30" />{/if}
    </g>
  </g>
{/snippet}
<figure>
  <svg role="img" aria-label={label} viewBox="0 0 1000 1000" fill="currentColor">
    <defs><mask id={`${uid}-cut`}><rect width="1000" height="1000" fill="white" /><g fill="black">{#each parts.filter(p=>p.cut) as part}{@render leaf(part)}{/each}</g></mask></defs>
    <g mask={`url(#${uid}-cut)`}>{#each parts.filter(p=>!p.cut) as part}{@render leaf(part)}{/each}</g>
  </svg>
  <figcaption>{label}</figcaption>
</figure>
<style>
  figure{margin:0;text-align:center;width:130px;flex:none}svg{width:130px;height:130px;font-family:"IDS Seal","IDS Strokes",var(--ids-font),serif;border:1px solid var(--line);border-radius:8px;background:var(--surface)}figcaption{font-size:11px;color:var(--muted);margin-top:4px}
</style>
