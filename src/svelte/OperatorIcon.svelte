<script>
  // An operator's icon: the box it fills (the accent) and the places of its parts inside it (dashed),
  // each a line or a box as [left, top, right, bottom] in a unit square; ⿻ is two boxes over each
  // other, the first in the accent. 〾 marks its part as a variant, drawn as a wave.
  /** @type {{ op: string, size?: number }} */
  let { op, size = 22 } = $props()
  /** @type {Record<string, number[][]>} */
  const ICON = {
    '⿰': [[.5, 0, .5, 1]], '⿱': [[0, .5, 1, .5]], '⿲': [[.33, 0, .33, 1], [.67, 0, .67, 1]], '⿳': [[0, .33, 1, .33], [0, .67, 1, .67]],
    '⿴': [[.25, .25, .75, .75]], '⿵': [[.25, .3, .75, 1]], '⿶': [[.25, 0, .75, .7]], '⿷': [[.3, .25, 1, .75]],
    '⿸': [[.35, .35, 1, 1]], '⿹': [[0, .35, .65, 1]], '⿺': [[.35, 0, 1, .65]], '⿻': [[.25, .25, 1, 1]],
    '⿼': [[0, .25, .7, .75]], '⿽': [[0, 0, .65, .65]], '⿾': [[.5, .1, .5, .9]], '⿿': [[.2, .2, .8, .8]],
    '㇯': [[.3, .3, .7, .7]], '〾': [],
  }
  /** @type {Record<string, number[]>} */
  const OUTER = { '⿻': [0, 0, .75, .75] }
  const outer = $derived(OUTER[op] ?? [0, 0, 1, 1])
</script>

<svg viewBox="-1.5 -1.5 23 23" width={size} height={size} aria-hidden="true" class="ids-icon">
  {#each ICON[op] ?? [] as [a, b, c, d], i (i)}
    {#if a === c || b === d}<line class="inner" x1={a * 20} y1={b * 20} x2={c * 20} y2={d * 20} />
    {:else}<rect class="inner" x={a * 20} y={b * 20} width={(c - a) * 20} height={(d - b) * 20} />{/if}
  {/each}
  {#if op === '〾'}<path class="inner" d="M3 10q2.5-4 5 0t5 0 5 0" />{/if}
  <rect x={outer[0] * 20} y={outer[1] * 20} width={(outer[2] - outer[0]) * 20} height={(outer[3] - outer[1]) * 20} />
</svg>

<style>
  .ids-icon{display:block;overflow:visible}
  .ids-icon :is(rect,line,path){fill:none;stroke:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));stroke-width:1.6}
  .ids-icon .inner{stroke:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));stroke-dasharray:2 1.5}
</style>
