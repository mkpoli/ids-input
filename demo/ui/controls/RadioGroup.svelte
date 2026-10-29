<script>
  // One choice out of a few, as native radios in a fieldset: arrow keys move the choice, the
  // browser keeps the group and its name, and a screen reader hears the legend.
  /** @type {{ label: string, name?: string, value?: string, options: { value: string, label: string, hint?: string, disabled?: boolean }[], disabled?: boolean }} */
  let { label, name, value = $bindable(), options, disabled = false } = $props()
  const uid = $props.id()
  const group = $derived(name ?? uid)
</script>

<fieldset class="ui-radio-group" {disabled}>
  <legend class="ui-label">{label}</legend>
  {#each options as option, index (option.value)}
    {@const hintId = `${uid}-${index}-hint`}
    <div class="ui-check-field">
      <label class="ui-check-row">
        <input class="ui-radio" type="radio" bind:group={value} value={option.value} name={group} disabled={disabled || option.disabled}
          aria-describedby={option.hint ? hintId : undefined} />
        <span class="ui-check-text"><span>{option.label}</span></span>
      </label>
      {#if option.hint}<span class="ui-hint ui-check-hint" id={hintId}>{option.hint}</span>{/if}
    </div>
  {/each}
</fieldset>
