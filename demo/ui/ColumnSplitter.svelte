<script>
  /** @type {{ value: number, min: number, max: number, label: string, controls: string,
   * reverse?: boolean, onchange: (value: number) => void, onreset: () => void }} */
  let { value, min, max, label, controls, reverse = false, onchange, onreset } = $props()
  /** @type {{ pointer: number, x: number, value: number } | null} */
  let drag = $state(null)
  /** @param {number} next */
  const change = next => onchange(Math.round(Math.min(max, Math.max(min, next))))
  /** @param {PointerEvent} event */
  function start(event) {
    if (event.button !== 0 || !event.isPrimary) return
    const target = /** @type {HTMLElement} */ (event.currentTarget)
    drag = { pointer: event.pointerId, x: event.clientX, value }
    target.setPointerCapture(event.pointerId)
    target.focus()
    event.preventDefault()
  }
  /** @param {PointerEvent} event */
  function move(event) {
    if (drag?.pointer === event.pointerId) change(drag.value + (event.clientX - drag.x) * (reverse ? -1 : 1))
  }
  /** @param {PointerEvent} event */
  function end(event) {
    if (drag?.pointer !== event.pointerId) return
    drag = null
    const target = /** @type {HTMLElement} */ (event.currentTarget)
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  }
  /** @param {KeyboardEvent} event */
  function key(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Home') change(min)
    else if (event.key === 'End') change(max)
    else change(value + (event.key === 'ArrowRight' ? 1 : -1) * (reverse ? -1 : 1) * (event.shiftKey ? 50 : 10))
  }
</script>

<!-- A focusable separator implements the ARIA window splitter keyboard pattern. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div class="divider" class:dragging={drag !== null} role="separator" aria-orientation="vertical"
  aria-label={label} aria-controls={controls} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
  aria-valuetext={`${value}px`} title={`${label} (${value}px)`} tabindex="0"
  onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={end} onlostpointercapture={() => drag = null}
  onkeydown={key} ondblclick={onreset}>
  <span class="grip" aria-hidden="true"></span>
</div>

<style>
  .divider{height:100%;min-height:56px;cursor:col-resize;touch-action:none;user-select:none;border-radius:var(--ui-radius-md)}
  .grip{display:block;position:sticky;top:50dvh;transform:translateY(-50%);margin:0 auto;width:5px;height:56px;border-radius:var(--ui-radius-pill);background:var(--ui-color-border-strong);transition:background-color .12s,height .12s}
  .divider:is(:hover,:focus-visible,.dragging) .grip{background:var(--ui-color-accent);height:72px}
  .divider:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-2px}
</style>
