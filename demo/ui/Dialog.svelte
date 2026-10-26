<script>
  // Dialogs are modal by default. Settings sit beside their trigger on desktop; mobile uses a drawer.
  import Icon from './Icon.svelte'
  /** @type {{ open: boolean, title: string, closeLabel: string, wide?: boolean, popover?: boolean, anchor?: HTMLElement | null, children: import('svelte').Snippet }} */
  let { open = $bindable(false), title, closeLabel, wide = false, popover = false, anchor = null, children } = $props()
  /** @type {HTMLDialogElement | null} */ let dialog = $state(null)
  /** @type {HTMLElement | null} */ let returnFocus = null
  let mobile = $state(matchMedia('(max-width: 640px)').matches)
  let top = $state(52), right = $state(16)
  let modal = false
  let restoreFocus = true
  const uid = $props.id()
  function position() {
    mobile = matchMedia('(max-width: 640px)').matches
    const rect = anchor?.getBoundingClientRect()
    top = rect ? rect.bottom + 8 : 52
    right = rect ? Math.max(8, innerWidth - rect.right) : 16
  }
  $effect(() => {
    if (!dialog) return
    const nextModal = !popover || mobile
    if (open) {
      if (!dialog.open) { returnFocus = /** @type {HTMLElement} */ (document.activeElement); restoreFocus = true }
      if (dialog.open && modal !== nextModal) dialog.close()
      if (!dialog.open) {
        modal = nextModal
        if (modal) dialog.showModal(); else dialog.show()
        position()
        dialog.querySelector('button')?.focus()
      }
    } else if (dialog.open) {
      dialog.close()
      if (restoreFocus) [returnFocus, anchor].find(el => el?.isConnected && el.getClientRects().length)?.focus()
    }
  })
  /** @param {PointerEvent} event */
  function outside(event) {
    const target = /** @type {Node} */ (event.target)
    if (open && popover && !mobile && !dialog?.contains(target) && !anchor?.contains(target)) { restoreFocus = false; open = false }
  }
  /** @param {KeyboardEvent} event */
  function key(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); open = false; return }
    if (event.key !== 'Tab' || !popover || mobile || !dialog) return
    const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
    const inside = /** @type {HTMLElement[]} */ ([...dialog.querySelectorAll(selector)])
    if (document.activeElement !== inside.at(event.shiftKey ? 0 : -1)) return
    // Continue beside the toolbar trigger when leaving the popover, which sits at the end of the DOM.
    const outside = /** @type {HTMLElement[]} */ ([...document.querySelectorAll(selector)])
      .filter(el => !dialog?.contains(el) && el.getClientRects().length > 0 && el.tabIndex >= 0)
    const at = anchor ? outside.indexOf(anchor) : -1
    const next = event.shiftKey ? anchor : outside[at + 1]
    event.preventDefault()
    restoreFocus = false
    open = false
    next?.focus()
  }
</script>

<svelte:window onresize={position} onpointerdown={outside}
  onfocusin={event => { if (open && popover && !mobile && !dialog?.contains(/** @type {Node} */ (event.target)) && event.target !== anchor) { restoreFocus = false; open = false } }} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} class:wide class:drawer={popover} class:popover style:--top="{top}px" style:--right="{right}px"
  aria-labelledby="{uid}-title" aria-modal={!popover || mobile ? 'true' : undefined}
  onclose={() => { if (!dialog?.open) open = false }} oncancel={event => { event.preventDefault(); open = false }}
  onkeydown={key}
  onclick={event => { if (event.target === dialog) open = false }}>
  <header>
    <h2 id="{uid}-title">{title}</h2>
    <button type="button" class="close" aria-label={closeLabel} title={closeLabel} onclick={() => open = false}><Icon name="close" /></button>
  </header>
  <div class="body">{@render children()}</div>
</dialog>

<style>
  dialog{width:min(480px,calc(100vw - 32px));max-height:min(86vh,760px);padding:0;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink);box-shadow:var(--shadow-pop)}
  dialog.wide{width:min(680px,calc(100vw - 32px))}
  dialog.popover{position:fixed;inset:var(--top) var(--right) auto auto;margin:0;width:min(380px,calc(100vw - 16px));max-height:calc(100dvh - var(--top) - 12px);z-index:60;border-radius:12px}
  dialog::backdrop{background:rgb(10 10 20 / .35);backdrop-filter:blur(2px)}
  header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 10px 20px;background:var(--surface);border-bottom:1px solid var(--line)}
  h2{margin:0;font-size:16px;font-weight:650}
  .close{display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:8px;background:none;color:var(--muted);cursor:pointer}
  .close:hover{background:var(--hover);color:var(--ink)}
  .close:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .body{padding:16px 20px 20px;overflow:auto}
  @media (max-width:640px){
    dialog.drawer{position:fixed;inset:auto 0 0;margin:0;width:100%;max-width:none;max-height:85dvh;border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom)}
  }
</style>
