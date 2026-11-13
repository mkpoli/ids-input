<script>
  // A select with a button trigger and a listbox popup. The trigger can carry a leading mark, which
  // a native select cannot show, so a compact choice keeps its shape. The native select stays the
  // control for long forms; this one is for a styled trigger with a short list.
  import { tick } from 'svelte'
  /** @typedef {{ value: string, label: string, disabled?: boolean }} Option */
  /** @type {{ label: string, value?: string, options: Option[], hint?: string, error?: string, name?: string,
   * disabled?: boolean, align?: 'start' | 'end', leading?: import('svelte').Snippet, onchange?: (value: string) => void }} */
  let { label, value = $bindable(), options, hint, error, name, disabled = false, align = 'start', leading, onchange } = $props()
  const uid = $props.id()
  const labelId = `${uid}-label`
  const listId = `${uid}-list`
  const valueId = `${uid}-value`
  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`
  const describedby = $derived([hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined)
  const selected = $derived(options.find(option => option.value === value) ?? options[0])
  let open = $state(false)
  /** @type {HTMLElement | null} */ let root = $state(null)
  /** @type {HTMLButtonElement | null} */ let trigger = $state(null)
  const enabled = () => /** @type {HTMLElement[]} */ ([...(root?.querySelectorAll('[role="option"]:not([aria-disabled="true"])') ?? [])])
  const current = () => enabled().find(option => option.getAttribute('aria-selected') === 'true')

  async function show() {
    if (disabled) return
    open = true
    await tick()
    ;(current() ?? enabled()[0])?.focus()
  }

  /** @param {boolean} [refocus] */
  function hide(refocus = false) {
    open = false
    if (refocus) trigger?.focus()
  }

  /** @param {Option} option */
  function choose(option) {
    if (option.disabled) return
    value = option.value
    onchange?.(option.value)
    hide(true)
  }

  /** @param {KeyboardEvent} event */
  function triggerKey(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      void show()
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      hide(true)
    }
  }

  /** @param {KeyboardEvent} event */
  function listKey(event) {
    const items = enabled()
    const at = items.indexOf(/** @type {HTMLElement} */ (document.activeElement))
    if (event.key === 'Escape') {
      event.preventDefault()
      hide(true)
    } else if (event.key === 'Tab') {
      hide(true)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      items[(at + step + items.length) % items.length]?.focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const active = /** @type {HTMLElement | null} */ (document.activeElement)
      active?.click()
    }
  }

  $effect(() => {
    if (!open) return
    /** @param {Event} event */
    const away = event => { if (root && !event.composedPath().includes(root)) hide() }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  })
</script>

<div class="ui-field">
  <span class="ui-label" id={labelId}>{label}</span>
  <div class="ui-select-menu" bind:this={root}>
    <button bind:this={trigger} type="button" class="ui-button ui-select-menu-trigger"
      aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
      aria-labelledby={`${labelId} ${valueId}`} aria-describedby={describedby} {disabled}
      onclick={() => open ? hide() : void show()} onkeydown={triggerKey}>
      {#if leading}<span class="ui-select-menu-leading" aria-hidden="true">{@render leading()}</span>{/if}
      <span class="ui-select-menu-value" id={valueId}>{selected?.label ?? ''}</span>
      <svg class="ui-select-menu-chevron" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
        <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/>
      </svg>
    </button>
    {#if open}
      <ul id={listId} class="ui-menu ui-select-menu-list" data-align={align} role="listbox" aria-labelledby={labelId}
        onkeydown={listKey}>
        {#each options as option (option.value)}
          <li class="ui-menu-item" role="option" tabindex="-1" aria-selected={option.value === value}
            aria-disabled={option.disabled ? 'true' : undefined}
            onclick={() => choose(option)}>
            <span class="ui-list-row-label">{option.label}</span>
          </li>
        {/each}
      </ul>
    {/if}
    {#if name}<input type="hidden" {name} {value} />{/if}
  </div>
  {#if hint}<span class="ui-hint" id={hintId}>{hint}</span>{/if}
  {#if error}<span class="ui-error" id={errorId}>{error}</span>{/if}
</div>
