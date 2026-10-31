<script>
  /** @type {{ label: string, value?: string, hint?: string, error?: string, name?: string, disabled?: boolean,
   * onchange?: (event: Event) => void, oninput?: (event: Event) => void, onkeydown?: (event: KeyboardEvent) => void }} */
  let { label, value = $bindable('#000000'), hint, error, name, disabled = false, onchange, oninput, onkeydown } = $props()
  const uid = $props.id()
  const id = `${uid}-color`
  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`
  const describedby = $derived([hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined)
</script>

<div class="ui-field">
  <label class="ui-label" for={id}>{label}</label>
  <input {id} class="ui-color" type="color" bind:value {name} {disabled}
    aria-invalid={error ? 'true' : undefined} aria-describedby={describedby} {onchange} {oninput} {onkeydown} />
  {#if hint}<span class="ui-hint" id={hintId}>{hint}</span>{/if}
  {#if error}<span class="ui-error" id={errorId}>{error}</span>{/if}
</div>
