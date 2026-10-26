<script>
  // A shortcut as keycaps: one cap per key, a plus between the keys of one combination, and a
  // slash between alternatives. Shown under its control on hover or focus.
  import { isApple } from '../../src/svelte/shortcut.js'
  /** @type {{ combos: string[] }} */
  let { combos } = $props()
  const apple = isApple()
  /** @type {Record<string, [string, string]>} */
  const NAMES = {
    mod: ['⌘', 'Ctrl'], shift: ['⇧', 'Shift'], alt: ['⌥', 'Alt'], enter: ['↩', 'Enter'],
    backspace: ['⌫', 'Backspace'], delete: ['⌦', 'Del'], tab: ['⇥', 'Tab'], escape: ['Esc', 'Esc'],
  }
  /** @param {string} combo */
  const keysOf = combo => combo.split('+').map(key => NAMES[key.toLowerCase()]?.[apple ? 0 : 1] ?? (key.length === 1 ? key.toUpperCase() : key))
</script>

<span class="key-hint-pop" aria-hidden="true">
  {#each combos as combo, i (combo)}
    {#if i}<span class="alt" aria-hidden="true">/</span>{/if}
    <span class="combo">
      {#each keysOf(combo) as key, j (j)}{#if j}<span class="plus" aria-hidden="true">+</span>{/if}<kbd>{key}</kbd>{/each}
    </span>
  {/each}
</span>
