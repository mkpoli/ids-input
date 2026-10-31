<script>
  /** @type {{ label: string, value?: number, hint?: string, error?: string, name?: string, disabled?: boolean,
   * min?: number, max?: number, step?: number | 'any', valueLabel?: import('svelte').Snippet,
   * onchange?: (event: Event) => void, oninput?: (event: Event) => void, onkeydown?: (event: KeyboardEvent) => void }} */
  let { label, value = $bindable(), hint, error, name, disabled = false, min, max, step, valueLabel,
    onchange, oninput, onkeydown } = $props()
  const uid = $props.id()
  const id = `${uid}-range`
  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`
  const describedby = $derived([hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined)
</script>

<div class="ui-field">
  <label class="ui-label" for={id}>{label}{#if valueLabel} {@render valueLabel()}{/if}</label>
  <input {id} class="ui-range" type="range" bind:value {name} {disabled} {min} {max} {step}
    aria-invalid={error ? 'true' : undefined} aria-describedby={describedby} {onchange} {oninput} {onkeydown} />
  {#if hint}<span class="ui-hint" id={hintId}>{hint}</span>{/if}
  {#if error}<span class="ui-error" id={errorId}>{error}</span>{/if}
</div>
