<script>
  import { tick } from 'svelte'
  import Dialog from './Dialog.svelte'

  /** @type {{ open: boolean, title: string, t: (key: string, params?: Record<string, string | number>) => string, onsave: (title: string) => void }} */
  let { open = $bindable(false), title = '', t, onsave } = $props()
  let value = $state(title)
  /** @type {HTMLInputElement | null} */ let field = $state(null)
  const uid = $props.id()
  $effect(() => { if (open) { value = title; tick().then(() => field?.select()) } })
  /** @param {SubmitEvent} event */
  function submit(event) {
    event.preventDefault()
    onsave(value)
    open = false
  }
</script>

<Dialog bind:open title={t('app.file.title')} closeLabel={t('app.close')}>
  <form class="title-form" onsubmit={submit}>
    <div class="ui-field">
      <label class="ui-label" for="{uid}-title">{t('app.titleDialog.label')}</label>
      <input id="{uid}-title" class="ui-input" bind:this={field} bind:value placeholder={t('app.titleDialog.placeholder')} aria-describedby="{uid}-hint" />
      <span class="ui-hint" id="{uid}-hint">{t('app.titleDialog.hint')}</span>
    </div>
    <div class="actions">
      <button type="button" class="ui-button" onclick={() => open = false}>{t('app.cancel')}</button>
      <button type="submit" class="ui-button" data-variant="primary">{t('app.save')}</button>
    </div>
  </form>
</Dialog>

<style>
  .title-form{display:grid;gap:var(--ui-space-lg)}
  .actions{display:flex;justify-content:flex-end;gap:var(--ui-space-sm);margin-top:var(--ui-space-2xs)}
</style>
