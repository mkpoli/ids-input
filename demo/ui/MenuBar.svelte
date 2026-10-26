<script>
  import Menu from './Menu.svelte'
  /** @type {{ label: string, menus: { label: string, items: import('./Menu.svelte').Item[] }[], keyHints?: boolean }} */
  let { label, menus, keyHints = true } = $props()
  let active = $state(-1), focused = $state(0)
  /** @type {Array<{ focus: (expand?: boolean) => void }>} */
  const entries = []

  /** @param {string} key */
  function move(key) {
    const expand = active >= 0
    focused = key === 'Home' ? 0 : key === 'End' ? menus.length - 1
      : (focused + (key === 'ArrowLeft' ? -1 : 1) + menus.length) % menus.length
    active = expand ? focused : -1
    entries[focused]?.focus(expand)
  }
</script>

<div class="menubar" role="menubar" aria-label={label}>
  {#each menus as menu, i (i)}
    <Menu {...menu} {keyHints} menubar bind:this={entries[i]} open={active === i} tabIndex={focused === i ? 0 : -1}
      onopenchange={open => { if (open) active = i; else if (active === i) active = -1 }}
      onfocus={() => focused = i} onhover={() => { if (active >= 0 && active !== i) { active = i; entries[i]?.focus() } }} onmove={move} />
  {/each}
</div>

<style>
  .menubar{display:flex;align-items:center;gap:2px}
</style>
