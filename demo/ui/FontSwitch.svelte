<script>
  // The five faces as a small segmented switch. `face` is the composer style key.
  /** @type {{ faces: { key: string, label: string }[], face: string, t: (key: string) => string }} */
  let { faces, face = $bindable(), t, label = '' } = $props()
</script>

<div class="font-switch" role="group" aria-label={label}>
  {#each faces as option (option.key)}
    <button type="button" aria-pressed={face === option.key} onclick={() => { face = option.key }}>{t(option.label)}</button>
  {/each}
</div>

<style>
  .font-switch{display:flex;align-items:center;gap:2px;padding:2px;border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken);flex-wrap:wrap}
  button{height:28px;padding:0 10px;border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink-muted);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
  button:hover{color:var(--ui-color-ink)}
  button[aria-pressed="true"]{background:var(--ui-color-surface);color:var(--ui-color-ink);box-shadow:0 0 0 1px var(--ui-color-border)}
</style>
