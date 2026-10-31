<script>
  import Dialog from './Dialog.svelte'
  import Menu from './Menu.svelte'
  import Toast from './Toast.svelte'

  let dialogOpen = $state(false)
  let reviewed = $state(false)
  let removed = $state(false)
  let nextToastId = 0
  /** @type {{ id: number, text: string, action?: string, run?: () => void, duration?: number } | null} */
  let toast = $state(null)

  function removeItem() {
    removed = true
    toast = {
      id: ++nextToastId,
      text: 'Example item removed.',
      action: 'Undo removal',
      run: () => { removed = false },
      duration: 15000,
    }
  }
</script>

<section id="interactions" aria-labelledby="interactions-title">
  <header>
    <h2 id="interactions-title">Dialogs, menus and feedback</h2>
    <p>Tab to a control and press Enter or Space to try it.</p>
  </header>
  <div class="grid">
    <div class="ui-card">
      <h3>Dialog</h3>
      <p>Focus stays inside the dialog. Escape closes it and returns to the button.</p>
      <div class="row">
        <button type="button" class="ui-button" aria-haspopup="dialog" onclick={() => dialogOpen = true}>Open example dialog</button>
      </div>
    </div>
    <div class="ui-card">
      <h3>Menu</h3>
      <p>Arrow keys move through actions. Escape returns to the button.</p>
      <div class="row">
        <Menu label="Example actions" items={[
          { label: 'Mark as reviewed', run: () => reviewed = true },
          { label: 'Reset review', run: () => reviewed = false },
          { separator: true },
          { label: 'Publish example', disabled: true },
        ]} />
      </div>
      <p role="status" aria-label="Example review status">{reviewed ? 'Reviewed.' : 'Awaiting review.'}</p>
    </div>
    <div class="ui-card">
      <h3>Toast</h3>
      <p>Remove the item, then undo the change from the notification.</p>
      <div class="row">
        <button type="button" class="ui-button" disabled={removed} onclick={removeItem}>Remove example item</button>
      </div>
      <p aria-label="Example item status">{removed ? 'Example item removed.' : 'Example item is present.'}</p>
    </div>
  </div>
</section>

<Dialog bind:open={dialogOpen} title="Example dialog" closeLabel="Close example dialog">
  <div class="dialog-content">
    <p>Use Tab to move between the close and done buttons.</p>
    <div class="row">
      <button type="button" class="ui-button" data-variant="primary" onclick={() => dialogOpen = false}>Done with example dialog</button>
    </div>
  </div>
</Dialog>
<Toast {toast} ondone={() => toast = null} />

<style>
  section{display:flex;flex-direction:column;gap:var(--ui-space-xl);scroll-margin-top:88px}
  header{display:flex;flex-direction:column;gap:var(--ui-space-xs)}
  h2{margin:0;font-size:var(--ui-text-xl);font-weight:var(--ui-weight-bold);letter-spacing:-.01em}
  h3{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-semibold);letter-spacing:var(--ui-tracking-caps);text-transform:uppercase}
  p{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm);line-height:1.5}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:var(--ui-space-xl);align-items:start}
  .row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-sm)}
  .dialog-content{display:flex;flex-direction:column;gap:var(--ui-space-xl)}
</style>
