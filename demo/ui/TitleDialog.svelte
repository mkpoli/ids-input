<script>
  import { tick } from 'svelte'
  import Dialog from './Dialog.svelte'

  /** @type {{ open: boolean, title: string, t: (key: string, params?: Record<string, string | number>) => string, onsave: (title: string) => void }} */
  let { open = $bindable(false), title = '', t, onsave } = $props()
  let value = $state(title)
  /** @type {HTMLInputElement | null} */ let field = $state(null)
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
    <label>{t('app.titleDialog.label')}<input bind:this={field} bind:value placeholder={t('app.titleDialog.placeholder')} /></label>
    <p>{t('app.titleDialog.hint')}</p>
    <div class="actions">
      <button type="button" onclick={() => open = false}>{t('app.cancel')}</button>
      <button type="submit" class="primary">{t('app.save')}</button>
    </div>
  </form>
</Dialog>

<style>
  .title-form{display:grid;gap:10px}
  label{display:grid;gap:5px;font-size:12px;color:var(--ui-color-ink-muted)}
  input{height:36px;padding:0 10px;border:1px solid var(--ui-color-control-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken);color:var(--ui-color-ink);font:inherit;font-size:14px}
  p{margin:0;font-size:12px;color:var(--ui-color-ink-muted);line-height:1.4}
  .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
  button{height:34px;padding:0 12px;border:1px solid var(--ui-color-control-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface);color:var(--ui-color-ink);font:inherit;font-size:13px;cursor:pointer}
  button:hover{background:var(--ui-color-surface-hover)}
  .primary{background:var(--ui-color-accent);border-color:var(--ui-color-accent);color:var(--ui-color-on-accent)}
  .primary:hover{background:color-mix(in srgb,var(--ui-color-accent) 88%,#000)}
  :is(button,input):focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:1px}
</style>
