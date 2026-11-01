<script>
  /** @type {{ label: string, value?: string, hint?: string, error?: string, placeholder?: string,
   * name?: string, disabled?: boolean, readonly?: boolean, mono?: boolean, autocomplete?: string, spellcheck?: boolean, required?: boolean,
   * rows?: number, cols?: number, minlength?: number, maxlength?: number, wrap?: 'soft' | 'hard' | 'off',
   * onchange?: (event: Event) => void, oninput?: (event: Event) => void, onkeydown?: (event: KeyboardEvent) => void }} */
  let { label, value = $bindable(''), hint, error, placeholder, name, disabled = false, readonly = false,
    mono = false, autocomplete, spellcheck, required = false, rows, cols, minlength, maxlength, wrap,
    onchange, oninput, onkeydown } = $props()
  const uid = $props.id()
  const id = `${uid}-textarea`
  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`
  const describedby = $derived([hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined)
</script>

<div class="ui-field">
  <label class="ui-label" for={id}>{label}</label>
  <textarea {id} class="ui-textarea" bind:value {name} {placeholder} {disabled} {readonly} {required}
    data-mono={mono ? '' : undefined} aria-invalid={error ? 'true' : undefined} aria-describedby={describedby}
    {autocomplete} {spellcheck} {rows} {cols} {minlength} {maxlength} {wrap} {onchange} {oninput} {onkeydown}></textarea>
  {#if hint}<span class="ui-hint" id={hintId}>{hint}</span>{/if}
  {#if error}<span class="ui-error" id={errorId}>{error}</span>{/if}
</div>
