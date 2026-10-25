<script>
  // A modal dialog with a title and a close button; Escape and a click outside it close it too.
  import Icon from './Icon.svelte'
  /** @type {{ open: boolean, title: string, closeLabel: string, wide?: boolean, children: import('svelte').Snippet }} */
  let { open = $bindable(false), title, closeLabel, wide = false, children } = $props()
  /** @type {HTMLDialogElement | null} */ let dialog = $state(null)
  const uid = $props.id()
  $effect(() => { if (open && dialog && !dialog.open) dialog.showModal(); else if (!open && dialog?.open) dialog.close() })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} class:wide aria-labelledby="{uid}-title" onclose={() => open = false} onclick={event => { if (event.target === dialog) open = false }}>
  <header>
    <h2 id="{uid}-title">{title}</h2>
    <button type="button" class="close" aria-label={closeLabel} title={closeLabel} onclick={() => open = false}><Icon name="close" /></button>
  </header>
  <div class="body">{@render children()}</div>
</dialog>

<style>
  dialog{width:min(480px,calc(100vw - 32px));max-height:min(86vh,760px);padding:0;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink);box-shadow:var(--shadow-pop)}
  dialog.wide{width:min(680px,calc(100vw - 32px))}
  dialog::backdrop{background:rgb(10 10 20 / .35);backdrop-filter:blur(2px)}
  header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 10px 20px;background:var(--surface);border-bottom:1px solid var(--line)}
  h2{margin:0;font-size:16px;font-weight:650}
  .close{display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:8px;background:none;color:var(--muted);cursor:pointer}
  .close:hover{background:var(--hover);color:var(--ink)}
  .close:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .body{padding:16px 20px 20px;overflow:auto}
</style>
