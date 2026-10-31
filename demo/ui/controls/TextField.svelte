<script>
  // A labelled text field with a hint and an error message, wired to native input attributes.
  /** @type {{ label: string, value?: string, type?: 'text' | 'url' | 'search' | 'email' | 'password', hint?: string, error?: string, placeholder?: string,
   * name?: string, disabled?: boolean, readonly?: boolean, mono?: boolean, autocomplete?: string, spellcheck?: boolean, required?: boolean,
   * onchange?: (event: Event) => void, oninput?: (event: Event) => void, onkeydown?: (event: KeyboardEvent) => void }} */
  let { label, value = $bindable(''), type = 'text', hint, error, placeholder, name, disabled = false, readonly = false,
    mono = false, autocomplete, spellcheck, required = false, onchange, oninput, onkeydown } = $props()
  const uid = $props.id()
  const id = `${uid}-input`
  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`
  const describedby = $derived([hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined)
</script>

<div class="ui-field">
  <label class="ui-label" for={id}>{label}</label>
  <input {id} class="ui-input" {type} bind:value {name} {placeholder} {disabled} {readonly} {required}
    data-mono={mono ? '' : undefined} aria-invalid={error ? 'true' : undefined} aria-describedby={describedby}
    {autocomplete} {spellcheck} {onchange} {oninput} {onkeydown} />
  {#if hint}<span class="ui-hint" id={hintId}>{hint}</span>{/if}
  {#if error}<span class="ui-error" id={errorId}>{error}</span>{/if}
</div>
