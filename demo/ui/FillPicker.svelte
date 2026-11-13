<script>
  // A fill in the manner of a design tool's colour panel: a saturation/value field, hue and alpha
  // sliders, a hex field and an opacity field. Every move writes one fill; the panel owns no state
  // beyond the one it is showing.
  import { clamp, fillColourOf, hexOf, percentOf, readRgba, rgbOf, toHsva } from '../lib/fill-editor.js'

  /** @type {{ fill?: import('../../src/document/fill.js').Fill | null, ink?: string, t: (key: string, params?: Record<string, string | number>) => string, onchange: (fill: import('../../src/document/fill.js').Fill) => void, oninherit: () => void }} */
  let { fill = null, ink = '#000000', t, onchange, oninherit } = $props()

  const starting = fill?.type === 'solid' ? fill.colour : ink
  let hsva = $state(toHsva(readRgba(starting)))
  let hexDraft = $state(hexOf(hsva).toUpperCase())
  let alphaDraft = $state(String(percentOf(hsva)))
  let last = fill?.type === 'solid' ? fill.colour : ''
  /** @type {HTMLDivElement | null} */ let field = $state(null)
  let dragging = false

  // A fill changed from outside the panel, such as an undo, is read back into the fields.
  $effect(() => {
    const next = fill?.type === 'solid' ? fill.colour : ''
    if (next === last) return
    last = next
    hsva = toHsva(readRgba(next || ink))
    hexDraft = hexOf(hsva).toUpperCase()
    alphaDraft = String(percentOf(hsva))
  })

  /** @param {Partial<typeof hsva>} patch */
  function emit(patch) {
    const next = { ...hsva, ...patch }
    hsva = next
    last = fillColourOf(next)
    hexDraft = hexOf(next).toUpperCase()
    alphaDraft = String(percentOf(next))
    onchange({ type: 'solid', colour: last })
  }

  /** @param {PointerEvent} event */
  function moveTo(event) {
    if (!field) return
    const box = field.getBoundingClientRect()
    emit({ s: clamp((event.clientX - box.left) / box.width, 0, 1), v: clamp(1 - (event.clientY - box.top) / box.height, 0, 1) })
  }
  /** @param {PointerEvent} event */
  function start(event) {
    if (event.button !== 0) return
    dragging = true
    field?.setPointerCapture(event.pointerId)
    moveTo(event)
  }
  /** @param {PointerEvent} event */
  function move(event) {
    if (dragging) moveTo(event)
  }
  /** @param {PointerEvent} event */
  function end(event) {
    dragging = false
    if (field?.hasPointerCapture(event.pointerId)) field.releasePointerCapture(event.pointerId)
  }
  /** @param {KeyboardEvent} event */
  function key(event) {
    const step = event.shiftKey ? 0.1 : 0.02
    if (event.key === 'ArrowLeft') emit({ s: clamp(hsva.s - step, 0, 1) })
    else if (event.key === 'ArrowRight') emit({ s: clamp(hsva.s + step, 0, 1) })
    else if (event.key === 'ArrowUp') emit({ v: clamp(hsva.v + step, 0, 1) })
    else if (event.key === 'ArrowDown') emit({ v: clamp(hsva.v - step, 0, 1) })
    else return
    event.preventDefault()
  }

  const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
  /** @param {Event} event */
  function typeHex(event) {
    hexDraft = /** @type {HTMLInputElement} */ (event.currentTarget).value
  }
  /** @param {Event} event */
  function readHex(event) {
    const input = /** @type {HTMLInputElement} */ (event.currentTarget)
    if (!HEX.test(input.value.trim())) { hexDraft = hexOf(hsva).toUpperCase(); return }
    const next = toHsva(readRgba(input.value))
    emit({ h: next.h, s: next.s, v: next.v, a: next.a })
  }
  /** @param {Event} event */
  function typeAlpha(event) {
    alphaDraft = /** @type {HTMLInputElement} */ (event.currentTarget).value
  }
  /** @param {Event} event */
  function readAlpha(event) {
    const value = Number(/** @type {HTMLInputElement} */ (event.currentTarget).value)
    if (!Number.isFinite(value)) { alphaDraft = String(percentOf(hsva)); return }
    emit({ a: clamp(value, 0, 100) / 100 })
  }
</script>

<div class="fill-picker">
  <div class="field" bind:this={field} class:dragging role="application" tabindex="0"
    aria-label={t('app.fills.area')} onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={end} onkeydown={key}
    style:--hue={hsva.h}>
    <span class="field-thumb" style:left={`${hsva.s * 100}%`} style:top={`${(1 - hsva.v) * 100}%`} style:--swatch={rgbOf(hsva)}></span>
  </div>

  <div class="slider hue-slider">
    <input class="hue" type="range" min="0" max="360" step="1" value={hsva.h} aria-label={t('app.fills.hue')}
      oninput={event => emit({ h: Number(/** @type {HTMLInputElement} */ (event.currentTarget).value) })} />
  </div>
  <div class="slider alpha-slider" style:--swatch={rgbOf(hsva)}>
    <input class="alpha" type="range" min="0" max="100" step="1" value={percentOf(hsva)} aria-label={t('app.fills.alpha')}
      oninput={readAlpha} />
  </div>

  <div class="fields">
    <span class="chip checker" aria-hidden="true"><span style:--swatch={fillColourOf(hsva)}></span></span>
    <input class="ui-input hex" value={hexDraft} spellcheck="false" autocomplete="off" maxlength="9"
      aria-label={t('app.fills.hex')} oninput={typeHex} onchange={readHex} onblur={() => { hexDraft = hexOf(hsva).toUpperCase() }} />
    <label class="percent">
      <input class="ui-input" type="number" min="0" max="100" step="1" value={alphaDraft} aria-label={t('app.fills.alphaPercent')}
        oninput={typeAlpha} onchange={readAlpha} onblur={() => { alphaDraft = String(percentOf(hsva)) }} />
      <span aria-hidden="true">%</span>
    </label>
  </div>

  <button type="button" class="ui-button inherit" data-size="sm" onclick={oninherit}>{t('app.fills.inherit')}</button>
</div>

<style>
  .fill-picker{display:flex;flex-direction:column;gap:12px}
  .field{position:relative;height:148px;border-radius:var(--ui-radius-lg);cursor:crosshair;touch-action:none;outline:none;
    background:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(var(--hue) 100% 50%));
    box-shadow:inset 0 0 0 1px rgb(0 0 0 / .12)}
  .field:focus-visible{box-shadow:inset 0 0 0 1px rgb(0 0 0 / .12),0 0 0 2px var(--ui-color-focus)}
  .field.dragging{cursor:none}
  .field-thumb{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border:2px solid #fff;border-radius:50%;
    background:var(--swatch);box-shadow:0 0 0 1px rgb(0 0 0 / .45),0 1px 3px rgb(0 0 0 / .35);pointer-events:none}
  .slider{position:relative;height:16px;display:flex;align-items:center}
  .slider input{width:100%;height:12px;margin:0;padding:0;appearance:none;background:transparent;cursor:pointer}
  .slider input::-webkit-slider-runnable-track{height:12px;border-radius:var(--ui-radius-pill);background:var(--track)}
  .slider input::-moz-range-track{height:12px;border-radius:var(--ui-radius-pill);background:var(--track)}
  .slider input::-webkit-slider-thumb{appearance:none;width:16px;height:16px;margin-top:-2px;border:2px solid #fff;border-radius:50%;background:transparent;
    box-shadow:0 0 0 1px rgb(0 0 0 / .4),0 1px 3px rgb(0 0 0 / .35)}
  .slider input::-moz-range-thumb{width:12px;height:12px;border:2px solid #fff;border-radius:50%;background:transparent;
    box-shadow:0 0 0 1px rgb(0 0 0 / .4),0 1px 3px rgb(0 0 0 / .35)}
  .slider input:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:3px;border-radius:var(--ui-radius-pill)}
  .hue-slider{--track:linear-gradient(to right,#f00,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00)}
  .alpha-slider{--track:linear-gradient(to right,transparent,var(--swatch)),repeating-conic-gradient(#cfcfd6 0 25%,#fff 0 50%) 0 0/10px 10px}
  .fields{display:flex;align-items:center;gap:8px}
  .checker{width:32px;height:32px;flex:none;border-radius:var(--ui-radius-md);overflow:hidden;
    background:repeating-conic-gradient(#cfcfd6 0 25%,#fff 0 50%) 0 0/8px 8px;box-shadow:inset 0 0 0 1px rgb(0 0 0 / .16)}
  .checker span{display:block;width:100%;height:100%;background:var(--swatch)}
  .hex{width:96px;min-width:0;font-family:var(--ui-font-mono);font-size:var(--ui-text-xs);text-transform:uppercase}
  .percent{display:inline-flex;align-items:center;gap:3px;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  .percent input{width:56px;min-width:0;text-align:right;font-variant-numeric:tabular-nums;appearance:textfield}
  .percent input::-webkit-outer-spin-button,.percent input::-webkit-inner-spin-button{appearance:none;margin:0}
  .inherit{margin-top:2px;align-self:flex-start}
  @media (forced-colors: active){
    .field,.slider input,.checker{forced-color-adjust:none}
    .field{outline:1px solid CanvasText}
  }
</style>
