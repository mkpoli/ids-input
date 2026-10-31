<script>
  // One choice out of two to four, drawn as segments of a single control. Native radios lie
  // under the faces, so arrow keys move the choice and the group stays one tab stop.
  // A segment may hold a label, an icon or a dot.
  import Icon from '../Icon.svelte'

  /** @typedef {{ value: string, label?: string, ariaLabel?: string, icon?: string, dot?: string, title?: string, hint?: string }} Option */
  /** @type {{ label: string, name?: string, value?: string, options: Option[], disabled?: boolean, onchange?: (value: string) => void }} */
  let { label, name, value = $bindable(), options, disabled = false, onchange } = $props()
  const uid = $props.id()
  const group = $derived(name ?? uid)
</script>

<div class="ui-segmented" role="radiogroup" aria-label={label}>
  {#each options as option, index (option.value)}
    {@const hintId = `${uid}-${index}-hint`}
    <label class="ui-segment" title={option.title}>
      <input type="radio" bind:group={value} value={option.value} name={group} {disabled}
        aria-label={option.ariaLabel ?? option.label}
        aria-describedby={option.hint ? hintId : undefined}
        onchange={event => { if (event.currentTarget.checked) onchange?.(option.value) }} />
      <span class="ui-segment-face">
        {#if option.icon}<Icon name={option.icon} size={16} />{/if}
        {#if option.dot}
          <span class="ui-dot" style:--ui-swatch={option.dot}></span>
        {/if}
        {#if option.label}<span>{option.label}</span>{/if}
      </span>
    </label>
  {/each}
</div>
{#if options.some(option => option.hint)}
  <div class="ui-visually-hidden">
    {#each options as option, index (option.value)}
      {#if option.hint}<span id={`${uid}-${index}-hint`}>{option.hint}</span>{/if}
    {/each}
  </div>
{/if}
