<script>
  import { tick } from 'svelte'
  import { characterScript } from '../adapter/character-info.js'
  import { translator } from './i18n.js'

  /** @type {{ root: HTMLElement | null, adapter: import('../adapter/types.js').IdsAdapter, messages?: Record<string, string>, locale?: string }} */
  let { root, adapter, messages, locale = 'en' } = $props()
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
  let generation = 0
  /** @type {string | null} */ let savedTitle = null
  /** @type {string | null} */ let savedDetails = null
  const kinds = /** @type {const} */ (['han', 'tangut', 'seal', 'modern', 'usage'])
  const code = $derived(char ? `U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}` : '')

  function close() {
    clearTimeout(showTimer); showTimer = undefined; clearTimeout(hideTimer); controller?.abort(); generation++
    if (anchor) {
      if (savedTitle !== null && anchor.dataset.character === char && !anchor.hasAttribute('title')) anchor.setAttribute('title', savedTitle)
      if (savedDetails !== null) anchor.setAttribute('aria-details', savedDetails)
      else anchor.removeAttribute('aria-details')
    }
    anchor = null; savedTitle = null; savedDetails = null
    open = false; char = ''; info = null; status = 'idle'
    panel?.hidePopover()
  }
  function leave() {
    clearTimeout(showTimer); showTimer = undefined; clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      if (panel?.matches(':hover') || panel?.contains(document.activeElement) || anchor === document.activeElement) return
      close()
    }, 220)
  }
  function keep() { clearTimeout(hideTimer) }
  function position() {
    if (!anchor || !panel) return
    const box = anchor.getBoundingClientRect(), card = panel.getBoundingClientRect()
    x = Math.max(8, Math.min(box.left, innerWidth - card.width - 8))
    y = box.bottom + 8 + card.height <= innerHeight ? box.bottom + 8 : Math.max(8, box.top - card.height - 8)
  }
  /** @param {HTMLElement} element @param {string} value @param {number} delay */
  function schedule(element, value, delay) {
    if (!adapter.characterInfo || !characterScript(value)) { leave(); return }
    keep()
    if (anchor === element && char === value && (open || showTimer !== undefined)) return
    close(); anchor = element; char = value
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
  /** @param {PointerEvent} event */
  function pointer(event) {
    if (event.pointerType === 'touch') return
    let element = target(event)
    // The input's transparent text sits over individually measured paint spans.
    if (!element && event.target instanceof HTMLInputElement) {
      element = [...(event.target.closest('.sequence-wrap')?.querySelectorAll('[data-character]') ?? [])].find(node => {
        const box = node.getBoundingClientRect()
        return event.clientX >= box.left && event.clientX < box.right && event.clientY >= box.top && event.clientY < box.bottom
      }) ?? null
    }
    if (element instanceof HTMLElement && root?.contains(element)) schedule(element, element.dataset.character ?? '', 350)
    else leave()
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
  /** @param {Event} event */
  function scrolled(event) {
    if (panel?.contains(/** @type {Node} */ (event.target))) return
    if (anchor === document.activeElement) position()
    else close()
  }
  /** @param {PointerEvent} event */
  function outside(event) {
    if (!panel?.contains(/** @type {Node} */ (event.target))) close()
  }
  $effect(() => {
    const node = root, read = adapter.characterInfo
    if (!node || !read) return
    const changed = new MutationObserver(() => {
      if (anchor && (!node.contains(anchor) || anchor.dataset.character !== char)) close()
    })
    changed.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-character'] })
    const resized = new ResizeObserver(position)
    if (panel) resized.observe(panel)
    node.addEventListener('pointermove', pointer)
    node.addEventListener('pointerleave', leave)
    node.addEventListener('focusin', focus)
    node.addEventListener('focusout', leave)
    node.addEventListener('dragstart', close)
    window.addEventListener('keydown', key, true)
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', scrolled, true)
    return () => {
      changed.disconnect(); resized.disconnect(); close()
      node.removeEventListener('pointermove', pointer); node.removeEventListener('pointerleave', leave)
      node.removeEventListener('focusin', focus); node.removeEventListener('focusout', leave)
      node.removeEventListener('dragstart', close); window.removeEventListener('keydown', key, true)
      window.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', close)
      window.removeEventListener('scroll', scrolled, true)
    }
  })
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="ids-character-info" id={uid} popover="manual" role="dialog" tabindex="-1" aria-label={t('info.title')} bind:this={panel}
  style:left={`${x}px`} style:top={`${y}px`} onpointerenter={keep} onpointerleave={leave} onfocusin={keep} onfocusout={leave}>
  {#if open}
    <header>
      <span class="glyph" lang={info?.script === 'tangut' || info?.script === 'component' ? 'txg' : 'zh'}>{char}</span>
      <div><span class="script">{t(`info.script.${info?.script ?? characterScript(char)}`)}</span><code>{code}</code></div>
      <button class="close" type="button" aria-label={t('info.close')} onclick={() => { const el = anchor; close(); restoreFocus(el) }}>×</button>
    </header>
    {#if status === 'loading'}<p class="muted" role="status">{t('info.loading')}</p>
    {:else if status === 'failed'}<p class="muted" role="status">{t('info.failed')}</p>
    {:else if info}
      {#if info.association}<p class="label">{t('info.association')}</p><p lang="en">{info.association}</p>{/if}
      {#if info.glosses.length}<p class="label">{t('info.english')}</p><ul class="glosses" lang="en">{#each info.glosses as gloss}<li>{gloss}</li>{/each}</ul>
      {:else if !info.association}<p class="muted">{t('info.missing')}</p>{/if}
      {#if info.emoji.length}<div class="mnemonics"><span class="label">{t('info.mnemonic')}</span>{#each info.emoji as emoji}<span title={emoji.meaning} aria-label={emoji.meaning}>{emoji.text}</span>{/each}</div>{/if}
      {#each kinds as kind}
        {@const related = info.relations.filter(r => r.kind === kind)}
        {#if related.length}<section><p class="label">{t(`info.relation.${kind}`)}</p><div class:examples={kind === 'usage'} class="relations">
          {#each related as row}<span class="relation"><span class="related-glyph" lang={kind === 'tangut' || kind === 'usage' ? 'txg' : 'zh'}>{row.char}</span>{#if row.meaning && kind !== 'han'}<span class="meaning" lang="en">{row.meaning}</span>{/if}</span>{/each}
        </div></section>{/if}
      {/each}
      {#if info.sources.length}<details><summary>{t('info.sources')}</summary><ul class="sources">{#each info.sources as source}<li><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>{#if source.license}<small>{source.license}</small>{/if}</li>{/each}</ul></details>{/if}
    {/if}
    <footer>{t('info.keyboard')}</footer>
  {/if}
</div>

<style>
  .ids-character-info{position:fixed;inset:auto;margin:0;box-sizing:border-box;width:320px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);overflow:auto;padding:16px;border:1px solid var(--ids-line,light-dark(#d8d8de,#484850));border-radius:12px;background:var(--ids-surface,light-dark(#fff,#24242b));color:var(--ids-ink,light-dark(#24242b,#f0f0f5));box-shadow:0 8px 30px #0003;font:13px/1.5 system-ui,sans-serif;--info-muted:var(--ids-muted,light-dark(#696973,#b4b4c0));--info-font:"IDS Seal","IDS Parts","IDS Tangut","Noto Sans CJK JP",sans-serif}
  header{display:flex;align-items:center;gap:14px;margin-bottom:12px}header>div{display:flex;flex-direction:column;gap:3px}.glyph{font:56px/1.15 var(--info-font)}.script{font-size:12px;color:var(--info-muted)}code{font-size:11px;letter-spacing:.02em}
  .close{align-self:flex-start;margin-left:auto;padding:0 4px;background:none;border:0;font:22px/1 system-ui;color:var(--info-muted);cursor:pointer}.close:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--ids-focus,#608cf0);outline-offset:3px}
  p{margin:0 0 6px}.label{color:var(--info-muted);font-size:11px;margin:0 0 3px}.glosses{padding-left:17px;margin:0 0 10px}.glosses li+li{margin-top:3px}.muted{color:var(--info-muted)}.mnemonics{display:flex;align-items:center;gap:8px;margin:10px 0}.mnemonics>span:not(.label){font-size:23px}.mnemonics>.label{margin:0}section{margin-top:12px}.relations{display:flex;gap:8px;flex-wrap:wrap}.relation{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;background:var(--ids-surface-subtle,light-dark(#f4f4f7,#303038))}.related-glyph{font:28px/1.4 var(--info-font)}.meaning{font-size:12px;overflow-wrap:anywhere}.examples{flex-direction:column}.examples .relation{align-items:flex-start}
  details{margin-top:14px;padding-top:10px;border-top:1px solid var(--ids-line,light-dark(#e4e4e8,#484850));font-size:11px}summary{cursor:pointer;color:var(--info-muted)}.sources{padding-left:16px;margin:8px 0}.sources li{margin:6px 0}.sources a{color:var(--ids-accent,light-dark(#2f5fd0,#a5c2ff));overflow-wrap:anywhere}.sources small{display:block;color:var(--info-muted)}footer{font-size:10px;color:var(--info-muted);margin-top:12px}
</style>
