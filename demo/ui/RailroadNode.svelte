<svelte:options namespace="svg" />

<script>
  // One rule spliced into the railroad canvas: its own markup, and each rule spliced into it in
  // turn. A node that has not changed is the same object, so opening a rule deep down redraws only
  // the rules that hold it.
  import Self from './RailroadNode.svelte'

  /** @type {{ node: import('../lib/railroad.js').RailNode }} */
  let { node } = $props()
</script>

{@html node.svg}
{#each node.children as child (child.node.path)}
  <g transform={`translate(${child.x} ${child.y})`}><Self node={child.node} /></g>
{/each}
