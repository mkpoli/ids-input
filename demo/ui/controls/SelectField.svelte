<script>
  // A labelled native select. For two to four compact choices in a toolbar or panel, use a
  // segmented control instead; a select is for a longer list.
  /** @type {{ label: string, value?: string, options: { value: string | number, label: string, disabled?: boolean }[], hint?: string, error?: string,
   * name?: string, disabled?: boolean, onchange?: (event: Event) => void }} */
  let { label, value = $bindable(), options, hint, error, name, disabled = false, onchange } = $props()
  const uid = $props.id()
  const id = `${uid}-select`
  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`
  const describedby = $derived([hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined)
</script>

<div class="ui-field">
  <label class="ui-label" for={id}>{label}</label>
  <span class="ui-select-wrap">
    <select {id} class="ui-select" bind:value {name} {disabled} aria-invalid={error ? 'true' : undefined} aria-describedby={describedby} {onchange}>
      {#each options as option (option.value)}
        <option value={option.value} disabled={option.disabled}>{option.label}</option>
      {/each}
    </select>
  </span>
  {#if hint}<span class="ui-hint" id={hintId}>{hint}</span>{/if}
  {#if error}<span class="ui-error" id={errorId}>{error}</span>{/if}
</div>
