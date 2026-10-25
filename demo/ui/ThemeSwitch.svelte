<script>
  // System, light or dark, as three buttons of one control.
  import Icon from './Icon.svelte'
  /** @type {{ theme: import('../lib/theme.js').Theme, labels: Record<string, string>, label: string, onchange: (theme: import('../lib/theme.js').Theme) => void }} */
  let { theme, labels, label, onchange } = $props()
  const ICONS = /** @type {const} */ ({ system: 'system', light: 'sun', dark: 'moon' })
</script>

<div class="switch" role="radiogroup" aria-label={label}>
  {#each /** @type {const} */ (['system', 'light', 'dark']) as name (name)}
    <button type="button" role="radio" aria-checked={theme === name} title={labels[name]} aria-label={labels[name]} onclick={() => onchange(name)}><Icon name={ICONS[name]} size={16} /></button>
  {/each}
</div>

<style>
  .switch{display:flex;gap:2px;padding:2px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line)}
  button{display:grid;place-items:center;width:30px;height:28px;border:0;border-radius:8px;background:none;color:var(--muted);cursor:pointer}
  button:hover{color:var(--ink)}
  button[aria-checked="true"]{background:var(--surface);color:var(--ink);box-shadow:0 1px 2px rgb(0 0 0 / .14)}
  button:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
</style>
