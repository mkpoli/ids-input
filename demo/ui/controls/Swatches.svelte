<script>
  // A colour choice shown as tiles. Native radios sit under the tiles, so arrow keys move the
  // choice and the group is one Tab stop. The selected tile keeps an accent ring, so the state
  // is more than a colour difference.
  /** @typedef {{ value: string, swatch: string, ariaLabel: string, title?: string }} Option */
  /** @type {{ label: string, name?: string, value?: string, options: Option[], disabled?: boolean, onchange?: (value: string) => void }} */
  let { label, name, value = $bindable(), options, disabled = false, onchange } = $props()
  const uid = $props.id()
  const group = $derived(name ?? uid)
  const KINDS = new Set(['none', 'white', 'black', 'custom'])
  /** @param {string} value */
  const isKind = value => KINDS.has(value)
</script>

<div class="ui-swatches" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <label class="ui-swatch-option" title={option.title}>
      <input type="radio" bind:group={value} value={option.value} name={group} {disabled}
        aria-label={option.ariaLabel}
        onchange={event => { if (event.currentTarget.checked) onchange?.(option.value) }} />
      <span class="ui-swatch-tile" data-kind={isKind(option.swatch) ? option.swatch : undefined}
        style:--ui-swatch={isKind(option.swatch) ? undefined : option.swatch}></span>
    </label>
  {/each}
</div>
