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
  label{display:grid;gap:5px;font-size:12px;color:var(--muted)}
  input{height:36px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface-2);color:var(--ink);font:inherit;font-size:14px}
  p{margin:0;font-size:12px;color:var(--muted);line-height:1.4}
  .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
  button{height:34px;padding:0 12px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font:inherit;font-size:13px;cursor:pointer}
  button:hover{background:var(--hover)}
  .primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
  .primary:hover{background:color-mix(in srgb,var(--accent) 88%,#000)}
  :is(button,input):focus-visible{outline:2px solid var(--focus);outline-offset:1px}
</style>
