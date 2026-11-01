<script>
  // An on/off setting that applies at once, as a native checkbox with role="switch". Use it
  // for a preference such as key hints; use Checkbox for an option that is one of several.
  /** @type {{ checked?: boolean, label: string, hint?: string, disabled?: boolean, name?: string, value?: string, ariaLabel?: string }} */
  let { checked = $bindable(false), label, hint, disabled = false, name, value, ariaLabel } = $props()
  const uid = $props.id()
</script>

<div class="ui-switch-field">
  <label class="ui-switch-row">
    {#if label}<span class="ui-check-text"><span>{label}</span></span>{/if}
    <input class="ui-switch" type="checkbox" role="switch" bind:checked {disabled} {name} {value}
      aria-label={label ? undefined : ariaLabel} aria-describedby={hint ? `${uid}-hint` : undefined} />
  </label>
  {#if hint}<span class="ui-hint ui-switch-hint" id={`${uid}-hint`}>{hint}</span>{/if}
</div>
