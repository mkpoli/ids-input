<script>
  import { tick } from 'svelte'
  import { characterScript } from '../adapter/character-info.js'
  import { componentIdentity } from '../core/component-identity.js'
  import { translator } from './i18n.js'

  /** @type {{ root: HTMLElement | null, adapter: import('../adapter/types.js').IdsAdapter, messages?: Record<string, string>, locale?: string, disabled?: boolean, onpick?: (part: string, path?: number[]) => void }} */
  let { root, adapter, messages, locale = 'en', disabled = false, onpick } = $props()
  const t = $derived(translator(messages, locale))
  const uid = $props.id()
  /** @type {HTMLElement | null} */ let panel = $state(null)
  /** @type {import('../adapter/character-info.js').CharacterInfo | null} */ let info = $state.raw(null)
  let char = $state(''), status = $state('idle'), open = $state(false), x = $state(0), y = $state(0)
  /** @type {HTMLElement | null} */ let anchor = null
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let showTimer
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let hideTimer
  /** @type {AbortController | null} */ let controller = null
  let restoringFocus = false
  let pointerX = NaN, pointerY = NaN
  // A card opened by a click stays while the pointer goes elsewhere, so its buttons can be reached.
  let pinned = false
  /** @type {Element | null} */
  let press = null
  let generation = 0
  let copied = $state(false), copyFailed = $state(false)
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let copyTimer
  let copyToken = 0
  /** @type {string | null} */ let savedTitle = null
  /** @type {string | null} */ let savedDetails = null
  const kinds = /** @type {const} */ (['han', 'tangut', 'seal', 'modern', 'usage'])
  /** @param {string} value */
  const codePoint = value => `U+${value.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`
  const code = $derived(char ? codePoint(char) : '')
  const identity = $derived(componentIdentity(char))
  /** @type {number | null} */ let uses = $state(null)

  function close() {
    clearTimeout(showTimer); showTimer = undefined; clearTimeout(hideTimer); clearTimeout(copyTimer); copyTimer = undefined
    copied = false; copyFailed = false; controller?.abort(); generation++
    if (anchor) {
      if (savedTitle !== null && anchor.dataset.character === char && !anchor.hasAttribute('title')) anchor.setAttribute('title', savedTitle)
      if (savedDetails !== null) anchor.setAttribute('aria-details', savedDetails)
      else anchor.removeAttribute('aria-details')
    }
    anchor = null; savedTitle = null; savedDetails = null; pinned = false
    open = false; char = ''; info = null; status = 'idle'
    panel?.hidePopover()
  }
  // The band between the anchor and the card: crossing the gap goes through neighbouring tiles,
  // which must not take the card over until the pointer leaves the band.
  function between() {
    if (!anchor || !panel) return false
    const box = anchor.getBoundingClientRect(), card = panel.getBoundingClientRect()
    if (pointerX < Math.min(box.left, card.left) - 16 || pointerX > Math.max(box.right, card.right) + 16) return false
    return card.bottom <= box.top
      ? pointerY >= card.bottom - 16 && pointerY <= box.top + 16
      : pointerY >= box.bottom - 16 && pointerY <= card.top + 16
  }
  // The pointer on the anchor, on the card, or on the way between them.
  function nearAnchor() {
    if (!open || !anchor || !panel) return false
    const boxes = [anchor.getBoundingClientRect(), panel.getBoundingClientRect()]
    return between() || boxes.some(box => pointerX >= box.left - 16 && pointerX <= box.right + 16
      && pointerY >= box.top - 16 && pointerY <= box.bottom + 16)
  }
  async function copy() {
    clearTimeout(copyTimer); copyTimer = undefined
    const id = generation, token = ++copyToken
    let done = false
    try {
      if (navigator.clipboard) { await navigator.clipboard.writeText(char); done = true }
    } catch { done = false }
    if (id !== generation || token !== copyToken) return
    copied = done; copyFailed = !done
    copyTimer = setTimeout(() => { copied = false; copyFailed = false }, 1600)
  }
  function leave() {
    if (pinned || anchor === document.activeElement || panel?.contains(document.activeElement)) { keep(); return }
    clearTimeout(showTimer); showTimer = undefined; clearTimeout(hideTimer)
    // Keep waiting while the pointer is still on its way to the card, and give up once it is gone.
    hideTimer = setTimeout(function look() {
      if (pinned || panel?.matches(':hover') || panel?.contains(document.activeElement) || anchor === document.activeElement) return
      if (nearAnchor()) { hideTimer = setTimeout(look, 200); return }
      close()
    }, 220)
  }
  function keep() { clearTimeout(hideTimer) }
  // A focusout caused by the card emptying is not focus leaving it.
  function cardFocusOut() { if (open) leave() }
  function position() {
    if (!anchor || !panel) return
    const box = anchor.getBoundingClientRect(), card = panel.getBoundingClientRect()
    x = Math.max(8, Math.min(box.left, innerWidth - card.width - 8))
    y = box.bottom + 4 + card.height <= innerHeight ? box.bottom + 4 : Math.max(8, box.top - card.height - 4)
  }
  /** @param {HTMLElement} element @param {string} value @param {number} delay */
  function schedule(element, value, delay) {
    if (!componentIdentity(value) && (!adapter.characterInfo || !characterScript(value))) { leave(); return }
    keep()
    if (anchor === element && char === value && (open || showTimer !== undefined)) return
    close(); anchor = element; char = value
    const count = element.dataset.partUses
    uses = count !== undefined && Number.isFinite(Number(count)) ? Number(count) : null
    savedTitle = element.getAttribute('title'); savedDetails = element.getAttribute('aria-details')
    element.removeAttribute('title')
    const id = ++generation
    showTimer = setTimeout(async () => {
      showTimer = undefined
      if (id !== generation || !anchor?.isConnected) return
      open = true; status = 'loading'; controller = new AbortController()
      anchor.setAttribute('aria-details', uid)
      await tick(); panel?.showPopover(); position()
      try {
        const found = await adapter.characterInfo?.(value, { signal: controller.signal })
        if (id !== generation) return
        if (!anchor?.isConnected || anchor.dataset.character !== value) { close(); return }
        info = found ?? null; status = 'ready'
      } catch { if (id === generation) status = 'failed' }
      await tick(); if (id === generation) position()
    }, delay)
  }
  /** @param {Event} event */
  function target(event) {
    const element = /** @type {HTMLElement} */ (event.target)
    return element.closest('[data-character]')
  }
  /** The input's transparent text sits over individually measured paint spans.
   * @param {Event} event @param {number} pointX @param {number} pointY */
  function spanUnder(event, pointX, pointY) {
    if (target(event) || !(event.target instanceof HTMLInputElement)) return null
    return [...(event.target.closest('.sequence-wrap')?.querySelectorAll('[data-character]') ?? [])].find(node => {
      const box = node.getBoundingClientRect()
      return pointX >= box.left && pointX < box.right && pointY >= box.top && pointY < box.bottom
    }) ?? null
  }
  /** @param {PointerEvent} event */
  function pointer(event) {
    if (event.pointerType === 'touch') return
    pointerX = event.clientX; pointerY = event.clientY
    const element = target(event) ?? spanUnder(event, event.clientX, event.clientY)
    if (!(element instanceof HTMLElement) || !root?.contains(element)) { if (nearAnchor()) keep(); else leave(); return }
    // On the way to the card the pointer passes over other parts; the open card stays until it leaves.
    if (open && nearAnchor()) keep()
    else schedule(element, element.dataset.character ?? '', 350)
  }
  /** The pointer leaving the window leaves no position behind. @param {PointerEvent} event */
  function gone(event) {
    if (event.relatedTarget === null) { pointerX = NaN; pointerY = NaN }
  }
  /** A click keeps the card open while the pointer travels to its buttons, opening it at once.
   * @param {MouseEvent} event */
  function pin(event) {
    const element = target(event) ?? spanUnder(event, event.clientX || pointerX, event.clientY || pointerY)
    if (!(element instanceof HTMLElement) || !root?.contains(element)) return
    const value = element.dataset.character ?? ''
    if (!value || pinned && anchor === element && open) return
    if (!open || anchor !== element) {
      // Drop a hover's pending delay so the card is up before the pointer leaves.
      clearTimeout(showTimer); showTimer = undefined
      schedule(element, value, 0)
    }
    pinned = anchor === element
    keep()
  }
  /** @param {FocusEvent} event */
  function focus(event) {
    if (restoringFocus) return
    const element = target(event)
    if (element instanceof HTMLElement && root?.contains(element)) schedule(element, element.dataset.character ?? '', 0)
    else leave()
  }
  /** @param {KeyboardEvent} event */
  function key(event) {
    if (!open) return
    if (event.key === 'Escape') {
      const restore = panel?.contains(document.activeElement)
      const element = anchor
      close(); event.preventDefault(); event.stopImmediatePropagation()
      if (restore) restoreFocus(element)
    } else if (event.key === 'F1' && root?.contains(document.activeElement)) {
      event.preventDefault(); event.stopImmediatePropagation(); panel?.querySelector('button')?.focus()
    }
  }
  /** @param {HTMLElement | null} element */
  function restoreFocus(element) {
    restoringFocus = true
    // Paint spans describe input text but cannot receive focus themselves.
    const control = element?.closest('.sequence-wrap')?.querySelector('input') ?? element
    control?.focus()
    restoringFocus = false
  }
  /** @param {string} part */
  async function pick(part) {
    if (disabled || !onpick) return
    const element = anchor?.closest('.sequence-wrap')?.querySelector('input') ?? anchor
    const writtenPath = anchor?.getAttribute('data-path')
    const path = writtenPath == null ? undefined : writtenPath === '' ? [] : writtenPath.split('.').map(Number)
    close()
    onpick(part, path)
    await tick()
    restoreFocus(element?.isConnected ? element : root?.querySelector('input') ?? null)
  }
  /** @param {Event} event */
  function scrolled(event) {
    if (panel?.contains(/** @type {Node} */ (event.target))) return
    if (!anchor) return
    // A scroll that clips the anchor out of its own box takes the card with it.
    const box = anchor.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    if (hit && anchor.contains(hit) || panel?.matches(':hover')) position()
    else close()
  }
  /** Controls inside the card that keep their own press. @constant {string} */
  const CONTROL = 'button, a, input, select, textarea, summary, label, [role="button"]'
  /** The element the press started on, so a control's press is not mistaken for a surface click.
   * @param {PointerEvent} event */
  function pressed(event) { press = /** @type {Element} */ (event.target) }
  /** A right or middle click dismisses the card it lands outside of. @param {MouseEvent} event */
  function context(event) {
    if (!panel?.contains(/** @type {Node} */ (event.target))) close()
  }
  /** @param {MouseEvent} event */
  function outside(event) {
    const node = /** @type {HTMLElement} */ (event.target)
    if (anchor?.contains(node)) return
    if (panel?.contains(node)) {
      // The card's own controls, its scrollbar and a text selection are all about the card.
      if (node.closest(CONTROL)) return
      if (panel === node && (event.offsetX >= panel.clientWidth || event.offsetY >= panel.clientHeight)) return
      const selection = getSelection()
      if (selection && !selection.isCollapsed && selection.anchorNode && panel.contains(selection.anchorNode)) return
      // Otherwise the press was meant for whatever the card covers: dismiss it and hand the click
      // over, so nothing behind the card costs a second click.
      const { clientX: pointX, clientY: pointY, detail, pointerType } = /** @type {PointerEvent} */ (event)
      // A press that started on a control and ended on the surface is that control's press, not a
      // click meant for anything below the card.
      const fromSurface = !(press instanceof Element) || !press.closest(CONTROL)
      press = null; close()
      if (!fromSurface) return
      const under = document.elementFromPoint(pointX, pointY)
      if (!under || !root?.contains(under)) return
      under.dispatchEvent(new PointerEvent('click', {
        view: window, bubbles: true, cancelable: true, detail, button: 0, buttons: 0,
        pointerType: pointerType ?? 'mouse', isPrimary: true, clientX: pointX, clientY: pointY,
      }))
      return
    }
    // The caret sits in the input over the painted glyph the card describes.
    if (anchor && node instanceof HTMLInputElement && spanUnder(event, event.clientX, event.clientY) === anchor) return
    close()
  }
  $effect(() => {
    const node = root
    adapter.characterInfo
    if (!node) return
    const changed = new MutationObserver(() => {
      if (anchor && (!node.contains(anchor) || anchor.dataset.character !== char)) close()
    })
    changed.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-character'] })
    const resized = new ResizeObserver(position)
    if (panel) resized.observe(panel)
    // The card sits outside `root`, so the pointer position is read from the window.
    window.addEventListener('pointermove', pointer)
    window.addEventListener('pointerout', gone)
    node.addEventListener('click', pin, true)
    node.addEventListener('pointerleave', leave)
    node.addEventListener('focusin', focus)
    node.addEventListener('focusout', leave)
    node.addEventListener('dragstart', close)
    window.addEventListener('keydown', key, true)
    window.addEventListener('pointerdown', pressed, true)
    window.addEventListener('click', outside, true)
    window.addEventListener('contextmenu', context, true)
    window.addEventListener('auxclick', context, true)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', scrolled, true)
    return () => {
      changed.disconnect(); resized.disconnect(); close()
      window.removeEventListener('pointermove', pointer); window.removeEventListener('pointerout', gone)
      node.removeEventListener('click', pin, true); node.removeEventListener('pointerleave', leave)
      node.removeEventListener('focusin', focus); node.removeEventListener('focusout', leave)
      node.removeEventListener('dragstart', close); window.removeEventListener('keydown', key, true)
      window.removeEventListener('pointerdown', pressed, true); window.removeEventListener('click', outside, true)
      window.removeEventListener('contextmenu', context, true); window.removeEventListener('auxclick', context, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', scrolled, true)
    }
  })
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="ids-character-info" id={uid} popover="manual" role="dialog" tabindex="-1" aria-label={t('info.title')} bind:this={panel}
  style:left={`${x}px`} style:top={`${y}px`} onpointerenter={keep} onpointerleave={leave} onfocusin={keep} onfocusout={cardFocusOut}>
  {#if open}
    <header>
      <span class="glyph" lang={info?.script === 'tangut' || info?.script === 'component' ? 'txg' : 'zh'}>{char}</span>
      <div>
        <span class="script">{identity ? t(`parts.identity.${identity.type}`) : t(`info.script.${info?.script ?? characterScript(char)}`)}</span>
        <div class="code"><code>{code}</code><button class="copy" type="button" title={t('info.copy', { char })} aria-label={t('info.copy', { char })} onclick={copy}><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={copied ? 'm5 12 5 5 9-10' : 'M9 9h11v11H9zM5 15H4V4h11v1'} /></svg></button><span class="copy-note" class:failed={copyFailed} role="status">{copied ? t('info.copied') : copyFailed ? t('info.copyFailed') : ''}</span></div>
      </div>
      <button class="close" type="button" aria-label={t('info.close')} onclick={() => { const el = anchor; close(); restoreFocus(el) }}>×</button>
    </header>
    {#if identity}
      <p class="unicode-name" lang="en">{identity.name}</p>
      {#if identity.strokeName}<p lang="en">{identity.strokeName}</p>{/if}
      {#if uses !== null}<p class="muted">{t('parts.idsUses', { count: uses })}</p>{/if}
      {#if identity.equivalents.length}
        <section class="unicode-forms">
          <p class="label">{t('parts.relatedForms')}</p>
          <div class="relations">
            {#each identity.equivalents as form (form)}
              {@const type = componentIdentity(form)?.type}
              <button type="button" class="relation unicode-form" disabled={disabled || !onpick}
                aria-label={`${t('info.insert', { part: form })} · ${type ? t(`parts.identity.${type}`) : ''} · ${codePoint(form)}`} onclick={() => pick(form)}>
                <span class="related-glyph" lang="zh">{form}</span>
                <span><span class="label">{type ? t(`parts.identity.${type}`) : ''}</span><code>{codePoint(form)}</code></span>
              </button>
            {/each}
          </div>
        </section>
      {/if}
      <details class="identity-sources"><summary>{t('info.unicodeReference')}</summary>{#each identity.sources as source}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>{/each}</details>
    {/if}
    {#if status === 'loading'}<p class="muted" role="status">{t('info.loading')}</p>
    {:else if status === 'failed'}<p class="muted" role="status">{t('info.failed')}</p>
    {:else if info}
      {#if info.association}<p lang="en">{info.association}</p>{/if}
      {#if info.glosses.length}<ul class="glosses" lang="en">{#each info.glosses as gloss}<li>{gloss}</li>{/each}</ul>
      {:else if !info.association}<p class="muted">{t('info.missing')}</p>{/if}
      {#if info.emoji.length}<div class="mnemonics">{#each info.emoji as emoji}<button type="button" class="relation emoji" disabled={disabled || !onpick} title={emoji.meaning} aria-label={`${t('info.insert', { part: emoji.text })} · ${emoji.meaning}`} onclick={() => pick(emoji.text)}>{emoji.text}</button>{/each}</div>{/if}
      {#each kinds as kind}
        {@const related = info.relations.filter(r => r.kind === kind)}
        {#if related.length}<section><p class="label">{t(`info.relation.${kind}`)}</p><div class:examples={kind === 'usage'} class="relations">
          {#each related as row}<button type="button" class="relation" disabled={disabled || !onpick} aria-label={`${t('info.insert', { part: row.char })}${row.meaning ? ` · ${row.meaning}` : ''}`} onclick={() => pick(row.char)}><span class="related-glyph" lang={kind === 'tangut' || kind === 'usage' ? 'txg' : 'zh'}>{row.char}</span>{#if row.meaning && kind !== 'han'}<span class="meaning" lang="en">{row.meaning}</span>{/if}</button>{/each}
        </div></section>{/if}
      {/each}
    {/if}
  {/if}
</div>

<style>
  .ids-character-info{position:fixed;inset:auto;margin:0;box-sizing:border-box;width:320px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);overflow:auto;padding:16px;border:1px solid var(--ids-line,light-dark(#e1e1e8,#484850));border-radius:12px;background:var(--ids-surface,light-dark(#fff,#24242b));color:var(--ids-ink,light-dark(#24242b,#f0f0f5));box-shadow:0 8px 30px #0003;font:13px/1.5 system-ui,sans-serif;--info-muted:var(--ids-muted,light-dark(#686874,#b4b4c0));--info-font:"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","Noto Sans CJK JP",var(--ids-glyph-fallback,"IDS Fallback"),sans-serif}
  header{display:flex;align-items:center;gap:14px;margin-bottom:12px}header>div{display:flex;flex-direction:column;gap:3px}.glyph{font:56px/1.15 var(--info-font)}.script{font-size:12px;color:var(--info-muted)}code{font-size:11px;letter-spacing:.02em}
  .code{display:flex;align-items:center;gap:4px;min-height:24px}.copy{display:grid;place-items:center;flex:none;width:24px;height:24px;padding:0;border:0;border-radius:5px;background:none;color:var(--info-muted);cursor:pointer}.copy:hover{background:var(--ids-surface-subtle,light-dark(#f4f4f7,#303038));color:inherit}.copy svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.copy-note{font-size:11px;color:var(--ids-accent,light-dark(#2944c7,#8ea8ff))}.copy-note.failed{color:var(--ids-fault,light-dark(#b42318,#ff8a80))}
  .close{align-self:flex-start;margin-left:auto;padding:0 4px;background:none;border:0;font:22px/1 system-ui;color:var(--info-muted);cursor:pointer}button:focus-visible{outline:2px solid var(--ids-focus,#608cf0);outline-offset:3px}
  p{margin:0 0 6px}.label{color:var(--info-muted);font-size:11px;margin:0 0 3px}.glosses{padding-left:17px;margin:0 0 10px}.glosses li+li{margin-top:3px}.muted{color:var(--info-muted)}.mnemonics{display:flex;align-items:center;gap:8px;margin:10px 0}.mnemonics .emoji{font:23px/1.3 system-ui,sans-serif}section{margin-top:12px}.relations{display:flex;gap:8px;flex-wrap:wrap}.relation{border:1px solid transparent;color:inherit;font:inherit;cursor:pointer;display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;background:var(--ids-surface-subtle,light-dark(#f4f4f7,#303038))}.related-glyph{font:28px/1.4 var(--info-font)}.meaning{font-size:12px;overflow-wrap:anywhere}.examples{flex-direction:column}.examples .relation{align-items:flex-start}
  .relation:not(:disabled):hover{border-color:var(--ids-accent,#608cf0)}.relation:disabled{cursor:default}
  .unicode-name{font:11px/1.5 ui-monospace,monospace;overflow-wrap:anywhere;color:var(--info-muted)}
  .unicode-forms{margin:12px 0}.unicode-form{text-align:start}.unicode-form>span:last-child{display:flex;flex-direction:column;gap:2px}.unicode-form .label{margin:0}
  .identity-sources{margin:8px 0 12px;font-size:11px;color:var(--info-muted)}.identity-sources summary{cursor:pointer}.identity-sources a{display:block;margin-top:4px;color:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff))}
</style>
