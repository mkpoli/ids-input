<script>
  import { tick } from 'svelte'
  import { characterScript } from '../adapter/character-info.js'
  import { componentIdentity } from '../core/component-identity.js'
  import { strokeClassName, translator } from './i18n.js'
  import { loadStrokeRecords } from './strokes.js'
  import { watchFallback } from './fallback-font.js'

  /** @type {{ root: HTMLElement | null, adapter: import('../adapter/types.js').IdsAdapter, messages?: Record<string, string>, locale?: string, disabled?: boolean, onpick?: (part: string, path?: number[]) => void }} */
  let { root, adapter, messages, locale = 'en', disabled = false, onpick } = $props()
  const t = $derived(translator(messages, locale))
  /** A reading system's name for the card's locale; the CJK names are the ones readers know it by.
   *  @param {import('../adapter/character-info.js').InfoReading} reading */
  const readingName = reading => /^(ja|zh|ko)/.test(locale) ? reading.zh : reading.name
  const uid = $props.id()
  /** @type {HTMLElement | null} */ let panel = $state(null)
  $effect(() => { if (panel) return watchFallback(panel) })
  /** @type {import('../adapter/character-info.js').CharacterInfo | null} */ let info = $state.raw(null)
  let char = $state(''), status = $state('idle'), open = $state(false), x = $state(0), y = $state(0)
  /** @type {HTMLElement | null} */ let anchor = null
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let showTimer
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let hideTimer
  /** @type {AbortController | null} */ let controller = null
  let restoringFocus = false
  let pointerX = NaN, pointerY = NaN
  // A card opened by a click stays while the pointer goes elsewhere, so its buttons can be reached.
  let pinned = $state(false)
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
  // The stroke count and first stroke the card adds to the code point; the table loads on first use.
  let strokeRecords = $state.raw(/** @type {Map<string, import('./strokes.js').StrokeRecord> | null} */ (null))
  $effect(() => {
    if (strokeRecords) return
    loadStrokeRecords().then(records => { strokeRecords = records }).catch(() => { strokeRecords = new Map() })
  })
  const strokes = $derived(char ? strokeRecords?.get(char) ?? null : null)

  // One list of every source the card drew on: the data it is built from, then the records that name
  // the character itself. A data record is named by its site; each course record keeps its own title.
  /** What a course's title still says once the course's name is said. @param {string} label @param {string} course */
  const left = (label, course) => label.startsWith(course) ? label.slice(course.length).replace(/^ ?· ?/, '').trim() : label
  /** @type {{ key: string, site: string, what: string, url: string }[]} */
  const sources = $derived.by(() => {
    /** @type {{ key: string, site: string, what: string, url: string }[]} */
    const list = []
    for (const source of info?.sources ?? []) if (source.note) list.push({ key: source.note, site: t(`info.site.${source.note}`), what: source.label, url: source.url })
    // A course's records share its name. The one record that carries the whole title leads and takes
    // the name on the row; the others follow with what is left once the name is said.
    const course = t('info.site.course')
    const records = (identity?.sources ?? []).map(source => ({ site: source.note === 'editorial' ? t('info.site.editorial') : course, what: source.note === 'editorial' ? source.label : left(source.label, 'Unicode'), url: source.url }))
    const lead = records.findIndex(record => record.site === course && left(record.what, course).length > 0)
    if (lead > 0) records.unshift(...records.splice(lead, 1))
    for (const [index, record] of records.entries()) {
      const what = record.what
      list.push({ key: `${record.site}:${record.what}:${record.url}`, site: record.site, what, url: record.url })
    }
    // Two records can share a site — UnicodeData.txt and EquivalentUnifiedIdeograph.txt are both
    // Unicode — and a bare site would read twice; those rows say what each one adds.
    const shared = new Map()
    for (const entry of list) shared.set(entry.site, (shared.get(entry.site) ?? 0) + 1)
    for (const entry of list) if (shared.get(entry.site) > 1 && entry.what) entry.site = `${entry.site} · ${entry.what}`
    return list
  })
  // A class message writes the stroke glyph first, then its name (㇐ Horizontal, ㇒ Falling left), so
  // the glyph is the first character and the name is what follows it.
  const strokeLabel = $derived(strokeClassName(t, strokes?.first))
  const strokeGlyph = $derived(Array.from(strokeLabel)[0] ?? '')
  const strokeName = $derived(strokeLabel.slice(strokeGlyph.length).trim())

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
  // which must not take the card over until the pointer leaves the band. The card may sit on any
  // side of the anchor, so the band runs along whichever sides face each other. A card placed far
  // off to keep a surface clear has no such path, so only a short gap counts as on the way.
  function between() {
    if (!anchor || !panel) return false
    const box = anchor.getBoundingClientRect(), card = panel.getBoundingClientRect(), band = 16
    if (card.bottom <= box.top) {
      if (box.top - card.bottom > 48) return false
      return pointerX >= Math.min(box.left, card.left) - band && pointerX <= Math.max(box.right, card.right) + band
        && pointerY >= card.bottom - band && pointerY <= box.top + band
    }
    if (card.top >= box.bottom) {
      if (card.top - box.bottom > 48) return false
      return pointerX >= Math.min(box.left, card.left) - band && pointerX <= Math.max(box.right, card.right) + band
        && pointerY >= box.bottom - band && pointerY <= card.top + band
    }
    if (card.right <= box.left) {
      if (box.left - card.right > 48) return false
      return pointerY >= Math.min(box.top, card.top) - band && pointerY <= Math.max(box.bottom, card.bottom) + band
        && pointerX >= card.right - band && pointerX <= box.left + band
    }
    if (card.left >= box.right) {
      if (card.left - box.right > 48) return false
      return pointerY >= Math.min(box.top, card.top) - band && pointerY <= Math.max(box.bottom, card.bottom) + band
        && pointerX >= box.right - band && pointerX <= card.left + band
    }
    return false
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
      // A source link keeps focus when it opens a new tab, with the pointer gone from the card.
      if (document.activeElement instanceof HTMLAnchorElement && panel?.contains(document.activeElement)) return
      if (nearAnchor()) { hideTimer = setTimeout(look, 200); return }
      close()
    }, 220)
  }
  function keep() { clearTimeout(hideTimer) }
  // A focusout caused by the card emptying is not focus leaving it.
  function cardFocusOut() { if (open) leave() }
  /** The area two boxes share. @param {{ left: number, top: number, right: number, bottom: number }} a @param {{ left: number, top: number, right: number, bottom: number }} b */
  const shared = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  /** The surfaces the card keeps clear of, which the host marks inside `root`. */
  function keptClear() {
    if (!root) return []
    return [...root.querySelectorAll('[data-character-info-avoid]')].map(element => element.getBoundingClientRect())
      .filter(box => box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth)
  }
  function position() {
    if (!anchor || !panel) return
    const box = anchor.getBoundingClientRect(), card = panel.getBoundingClientRect()
    const margin = 8, gap = 4, width = card.width, height = card.height
    // A spot is a place the card's top-left corner can take, clamped into the window; the last
    // number marks one the window pushed in from where it would naturally sit.
    /** @param {number} rawX @param {number} rawY @returns {number[]} */
    const spot = (rawX, rawY) => [
      Math.max(margin, Math.min(rawX, innerWidth - width - margin)),
      Math.max(margin, Math.min(rawY, innerHeight - height - margin)),
      rawX < margin || rawX > innerWidth - width - margin || rawY < margin || rawY > innerHeight - height - margin ? 1 : 0,
    ]
    // Below the anchor, then above it, then beside it; and around a surface the card must keep
    // clear of when those spots land on it — beside it, or under the anchor shifted past its edge.
    // Of the spots that cover neither the anchor nor a surface, one the window leaves where it sits
    // beats one it pushes in, and the nearest wins; with none clear, the least covered one does.
    /** @type {number[][]} */
    const spots = [
      spot(box.left, box.bottom + gap),
      spot(box.left, box.top - gap - height),
      spot(box.right + gap, box.top),
      spot(box.left - gap - width, box.top),
    ]
    const clear = keptClear()
    for (const block of clear) {
      spots.push(
        spot(block.left - gap - width, box.top),
        spot(block.right + gap, box.top),
        spot(box.left, block.top - gap - height),
        spot(box.left, block.bottom + gap),
        spot(Math.min(box.left, block.left - gap - width), box.bottom + gap),
        spot(Math.max(box.left, block.right + gap), box.bottom + gap),
        spot(Math.min(box.left, block.left - gap - width), box.top - gap - height),
        spot(Math.max(box.left, block.right + gap), box.top - gap - height),
      )
    }
    let best = spots[0], bestCover = Infinity, bestPushed = 1, bestDistance = Infinity
    for (const [spotX, spotY, pushed] of spots) {
      const place = { left: spotX, top: spotY, right: spotX + width, bottom: spotY + height }
      const cover = clear.reduce((sum, block) => sum + shared(place, block), 0) + shared(place, box)
      const distance = Math.hypot(spotX + width / 2 - box.left - box.width / 2, spotY + height / 2 - box.top - box.height / 2)
      if (cover < bestCover - 0.5 || (Math.abs(cover - bestCover) <= 0.5
        && (pushed < bestPushed || (pushed === bestPushed && distance < bestDistance)))) {
        best = [spotX, spotY]; bestCover = cover; bestPushed = pushed; bestDistance = distance
      }
    }
    x = best[0]; y = best[1]
  }
  // While a part is dragged the card stays shut: as a popover it would sit over the part the pointer aims at.
  let dragging = false
  /** @param {HTMLElement} element @param {string} value @param {number} delay */
  function schedule(element, value, delay) {
    if (dragging) return
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
    if (dragging || event.pointerType === 'touch') return
    pointerX = event.clientX; pointerY = event.clientY
    const element = target(event) ?? spanUnder(event, event.clientX, event.clientY)
    if (!(element instanceof HTMLElement) || !root?.contains(element)) { if (nearAnchor()) keep(); else leave(); return }
    // On the way to the card the pointer passes over other parts; a pinned card stays until it
    // leaves, while a hover card gives way to the part the pointer is on. The card can sit far from
    // its anchor now, so the band between them must not hold a part the pointer is over.
    if (open && nearAnchor() && (pinned || element === anchor)) keep()
    else schedule(element, element.dataset.character ?? '', 350)
  }
  /** The pointer leaving the window leaves no position behind. @param {PointerEvent} event */
  function gone(event) {
    if (event.relatedTarget === null) { pointerX = NaN; pointerY = NaN }
  }
  /** A click keeps the card open while the pointer travels to its buttons, opening it at once.
   * @param {MouseEvent} event */
  function pin(event) {
    if (dragging) return
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
   * A new press means any drag of an earlier gesture has ended, even if no dragend reached us.
   * @param {PointerEvent} event */
  function pressed(event) { press = /** @type {Element} */ (event.target); dragging = false }
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
    const resized = new ResizeObserver(position)
    if (panel) resized.observe(panel)
    // A pane the host resizes moves the surfaces the card keeps clear of, even when the card itself
    // keeps its size; watch them as well, and follow the markers as views come and go.
    /** @type {Set<Element>} */
    const watched = new Set()
    function watchClear() {
      const clear = new Set(node?.querySelectorAll('[data-character-info-avoid]') ?? [])
      for (const element of watched) if (!clear.has(element)) { resized.unobserve(element); watched.delete(element) }
      for (const element of clear) if (!watched.has(element)) { resized.observe(element); watched.add(element) }
    }
    watchClear()
    const changed = new MutationObserver(() => {
      watchClear()
      if (!anchor) return
      if (!node.contains(anchor) || anchor.dataset.character !== char) close()
      else position()
    })
    changed.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-character', 'data-character-info-avoid'] })
    // The card sits outside `root`, so the pointer position is read from the window.
    window.addEventListener('pointermove', pointer)
    window.addEventListener('pointerout', gone)
    node.addEventListener('click', pin, true)
    node.addEventListener('pointerleave', leave)
    node.addEventListener('focusin', focus)
    node.addEventListener('focusout', leave)
    /** A drag that starts on the card itself, on a source link or selected text, leaves the card
     * alone: close() would take the dragged source out of the page and no dragend would follow.
     * @param {DragEvent} event */
    const dragStart = event => { if (panel?.contains(/** @type {Node} */ (event.target))) return; dragging = true; close() }
    const dragStop = () => { dragging = false }
    window.addEventListener('dragstart', dragStart, true)
    window.addEventListener('dragend', dragStop, true)
    window.addEventListener('drop', dragStop, true)
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
      window.removeEventListener('dragstart', dragStart, true); window.removeEventListener('dragend', dragStop, true)
      window.removeEventListener('drop', dragStop, true); window.removeEventListener('keydown', key, true)
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
        {#if strokes?.strokes != null || strokeGlyph}
          <!-- Both halves are strokes: the count carries its unit ("4 strokes", "{count}画"), and
               the glyph after the separator is marked as the first of them. The class the glyph draws
               (Vertical) is its title, not another word on the line. -->
          <p class="stroke-facts">
            {#if strokes?.strokes != null}<span class="stroke-count">{t('parts.strokeCount', { count: strokes.strokes })}</span>{/if}
            {#if strokes?.strokes != null && strokeGlyph}<span class="stroke-sep" aria-hidden="true"></span>{/if}
            {#if strokeGlyph}<span class="stroke-first">{t('info.firstStrokeShort')}</span><span class="stroke-glyph" lang="ja" title={strokeName}>{strokeGlyph}</span>{/if}
          </p>
        {/if}
      </div>
      {#if pinned}<button class="close" type="button" aria-label={t('info.close')} onclick={() => { const el = anchor; close(); restoreFocus(el) }}>×</button>{/if}
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
    {/if}
    {#if status === 'loading'}<p class="muted" role="status">{t('info.loading')}</p>
    {:else if status === 'failed'}<p class="muted" role="status">{t('info.failed')}</p>
    {:else if info}
      {@const hasMeaning = info.glosses.length > 0 || Boolean(info.meanings?.ja?.length) || Boolean(info.meanings?.zh?.length)}
      {#if info.association}<p lang="en">{info.association}</p>{/if}
      {#if info.script === 'tangut' && hasMeaning}
        <dl class="meanings">
          {#if info.glosses.length}<dt>{t('info.language.en')}</dt><dd><ul class="glosses" lang="en">{#each info.glosses as gloss}<li>{gloss}</li>{/each}</ul></dd>{/if}
          {#if info.meanings?.ja?.length}<dt>{t('info.language.ja')}</dt><dd lang="ja">{info.meanings.ja.join(' ')}</dd>{/if}
          {#if info.meanings?.zh?.length}<dt>{t('info.language.zh')}</dt><dd lang="zh">{info.meanings.zh.join('；')}</dd>{/if}
        </dl>
      {:else if info.glosses.length}
        <ul class="glosses" lang="en">{#each info.glosses as gloss}<li>{gloss}</li>{/each}</ul>
      {:else if !info.association}<p class="muted">{t('info.missing')}</p>{/if}
      {#if info.readings?.length || info.soundGlosses?.length}
        <section class="readings">
          <p class="label">{t('info.readings')}</p>
          <dl>
            {#each info.readings ?? [] as reading (reading.name)}<dt>{readingName(reading)}</dt><dd>{reading.value}</dd>{/each}
            {#each info.soundGlosses ?? [] as sound (sound.name)}<dt>{t('info.soundGloss', { name: readingName(sound) })}</dt><dd lang="zh">{sound.value}</dd>{/each}
          </dl>
        </section>
      {/if}
      {#if info.emoji.length}<div class="mnemonics">{#each info.emoji as emoji}<button type="button" class="relation emoji" disabled={disabled || !onpick} title={emoji.meaning} aria-label={`${t('info.insert', { part: emoji.text })} · ${emoji.meaning}`} onclick={() => pick(emoji.text)}>{emoji.text}</button>{/each}</div>{/if}
      {#each kinds as kind}
        {@const related = info.relations.filter(r => r.kind === kind)}
        {#if related.length}<section><p class="label">{t(`info.relation.${kind}`)}</p><div class:examples={kind === 'usage'} class="relations">
          {#each related as row}<button type="button" class="relation" disabled={disabled || !onpick} aria-label={`${t('info.insert', { part: row.char })}${row.meaning ? ` · ${row.meaning}` : ''}`} onclick={() => pick(row.char)}><span class="related-glyph" lang={kind === 'tangut' || kind === 'usage' ? 'txg' : 'zh'}>{row.char}</span>{#if row.meaning && kind !== 'han'}<span class="meaning" lang="en">{row.meaning}</span>{/if}</button>{/each}
        </div></section>{/if}
      {/each}
    {/if}
    {#if sources.length}
      <p class="sources" id={`${uid}-sources`}><span class="label">{t('info.source.sections')}</span>{#each sources as source, index (source.key)}{#if index > 0}<span class="sep" aria-hidden="true">·</span>{/if}<a href={source.url} target="_blank" rel="noopener noreferrer" title={source.what}>{source.site}</a>{/each}</p>
    {/if}
  {/if}
</div>

<style>
  .ids-character-info{position:fixed;inset:auto;margin:0;box-sizing:border-box;width:320px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);overflow:auto;padding:16px;border:1px solid var(--ids-line,light-dark(#e1e1e8,#484850));border-radius:12px;background:var(--ids-surface,light-dark(#fff,#24242b));color:var(--ids-ink,light-dark(#24242b,#f0f0f5));box-shadow:0 8px 30px #0003;font:13px/1.5 system-ui,sans-serif;--info-muted:var(--ids-muted,light-dark(#686874,#b4b4c0));--info-font:"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Operators","Noto Sans CJK JP",var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif}
  header{display:flex;align-items:center;gap:14px;margin-bottom:12px}header>div{display:flex;flex-direction:column;gap:3px}.glyph{font:56px/1.15 var(--info-font)}.script{font-size:12px;color:var(--info-muted)}code{font-size:11px;letter-spacing:.02em}
  .code{display:flex;align-items:center;gap:4px;min-height:24px}.stroke-glyph{font-family:var(--info-font);font-size:16px;line-height:1;color:var(--ids-ink,light-dark(#24242b,#f0f0f5))}.stroke-facts{display:flex;align-items:center;gap:5px;margin:2px 0 0;font-size:12px;white-space:nowrap}.stroke-count{color:var(--ids-ink,light-dark(#24242b,#f0f0f5));font-weight:600;font-variant-numeric:tabular-nums}.stroke-first{color:var(--info-muted)}.stroke-sep{align-self:stretch;width:1px;background:var(--ids-line,light-dark(#e1e1e8,#3a3a43))}.copy{display:grid;place-items:center;flex:none;width:24px;height:24px;padding:0;border:0;border-radius:5px;background:none;color:var(--info-muted);cursor:pointer}.copy:hover{background:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));color:inherit}.copy svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.copy-note{font-size:11px;color:var(--ids-accent,light-dark(#2944c7,#8ea8ff))}.copy-note.failed{color:var(--ids-fault,light-dark(#b42318,#ff8a80))}
  .close{align-self:flex-start;margin-left:auto;padding:0 4px;background:none;border:0;font:22px/1 system-ui;color:var(--info-muted);cursor:pointer}button:focus-visible{outline:2px solid var(--ids-focus,light-dark(#2944c7,#8ea8ff));outline-offset:3px}
  p{margin:0 0 6px}.label{color:var(--info-muted);font-size:11px;margin:0 0 3px}.glosses{padding-left:17px;margin:0 0 10px}.glosses li+li{margin-top:3px}.meanings{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;margin:0 0 10px}.meanings dt{color:var(--info-muted);font-size:11px;line-height:1.6}.meanings dd{min-width:0;margin:0}.meanings .glosses{margin:0}.meanings dd[lang=ja],.meanings dd[lang=zh]{overflow-wrap:anywhere}.readings{margin-top:12px}.readings dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0}.readings dt{color:var(--info-muted);font-size:11.5px;line-height:1.45}.readings dd{margin:0;font-variant-numeric:tabular-nums;line-height:1.45;overflow-wrap:anywhere}.muted{color:var(--info-muted)}.mnemonics{display:flex;align-items:center;gap:8px;margin:10px 0}.mnemonics .emoji{font:23px/1.3 system-ui,sans-serif}section{margin-top:12px}.relations{display:flex;gap:8px;flex-wrap:wrap}.relation{border:1px solid transparent;color:inherit;font:inherit;cursor:pointer;display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;background:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a))}.related-glyph{font:28px/1.4 var(--info-font)}.meaning{font-size:12px;overflow-wrap:anywhere}.examples{flex-direction:column}.examples .relation{align-items:flex-start}
  .relation:not(:disabled):hover{border-color:var(--ids-accent,light-dark(#2944c7,#8ea8ff))}.relation:disabled{cursor:default}
  .unicode-name{font:11px/1.5 ui-monospace,monospace;overflow-wrap:anywhere;color:var(--info-muted)}
  .unicode-forms{margin:12px 0}.unicode-form{text-align:start}.unicode-form>span:last-child{display:flex;flex-direction:column;gap:2px}.unicode-form .label{margin:0}
  .sources{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:4px;row-gap:2px;margin:10px 0 0;font-size:11.5px;line-height:1.6;color:var(--info-muted)}
  .sources .label{margin:0 4px 0 0;font-size:11px}
  .sources a{color:var(--info-muted);text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--info-muted) 55%,transparent);text-underline-offset:2px}
  .sources a:hover{color:var(--ids-accent,light-dark(#2944c7,#8ea8ff));text-decoration-color:currentColor}
  .sources a:focus-visible{outline:2px solid var(--ids-focus,light-dark(#2944c7,#8ea8ff));outline-offset:2px;border-radius:2px}
  .sep{color:var(--ids-line,#d6d6de)}
</style>
