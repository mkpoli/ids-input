<script>
  // Edit the selected part in place in either structure view. While a single part is edited, a
  // panel offers the components its operator slot most often takes in the bundled IDS data.
  import { tick, untrack } from 'svelte'
  import { parse, place, samePath, write } from '../core/ids.js'
  import { unalias } from '../core/aliases.js'
  import { hintsAt } from '../core/hints.js'
  import { loadFallbackText } from './fallback-font.js'
  /** @type {{ editor: import('./editor.svelte.js').Editor, path: import('../core/ids.js').Path, owner: HTMLElement | null, variant?: 'label' | 'leaf', onclose: () => void, onreveal?: (path: import('../core/ids.js').Path) => void }} */
  let { editor, path, owner, variant = 'label', onclose, onreveal } = $props()
  const targetPath = untrack(() => path)
  const initialValue = untrack(() => editor.sequenceAt(targetPath))
  const hintSet = untrack(() => hintsAt(editor.tree, targetPath))
  const hintTitle = $derived(hintSet ? editor.t('ids.hints.title', { n: hintSet.slot + 1, name: editor.name(hintSet.op) }) : '')
  const revision = untrack(() => editor.revision)
  const uid = $props.id()
  const hintsId = `${uid}-hints`
  let value = $state(initialValue), error = $state(''), composing = $state(false)
  let closing = false
  /** @type {HTMLInputElement | null} */ let input = $state(null)
  /** @type {HTMLElement | null} */ let wrapper = $state(null)
  /** @type {HTMLElement | null} */ let panel = $state(null)
  /** @type {{ x: number, y: number } | null} */ let position = $state(null)
  $effect(() => { if (input) tick().then(() => { input?.focus(); input?.select() }) })
  $effect(() => { if (editor.revision !== revision || !samePath(editor.chosen, targetPath)) { closing = true; onclose() } })
  // The panel is fixed where it fits beside the field: below it, or above it near the window's
  // bottom, and never past either side.
  $effect(() => {
    if (!input || !panel) return
    const place = () => {
      const field = /** @type {HTMLElement} */ (input).getBoundingClientRect()
      const box = /** @type {HTMLElement} */ (panel).getBoundingClientRect()
      const margin = 8, gap = 6
      const x = Math.max(margin, Math.min(field.left, innerWidth - margin - box.width))
      const below = field.bottom + gap
      const y = below + box.height <= innerHeight - margin ? below : Math.max(margin, field.top - gap - box.height)
      position = { x, y }
    }
    place()
    addEventListener('scroll', place, true)
    addEventListener('resize', place)
    return () => { removeEventListener('scroll', place, true); removeEventListener('resize', place) }
  })
  /** @param {boolean} [followSelection] @param {boolean} [refocus] */
  function close(followSelection = false, refocus = true) {
    if (closing) return
    closing = true
    const focusPath = followSelection ? editor.chosen ?? targetPath : targetPath
    if (followSelection) onreveal?.(focusPath)
    onclose()
    if (refocus) tick().then(() => requestAnimationFrame(() => {
      const target = owner?.querySelector(`[data-path="${CSS.escape(focusPath.join('.'))}"]`)
      if (target instanceof HTMLElement) target.focus()
    }))
  }
  /** @param {KeyboardEvent} event */
  function hintKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
  }
  /** @param {KeyboardEvent} event */
  function key(event) {
    event.stopPropagation()
    if (event.isComposing || composing) return
    if (event.key === 'Escape') { event.preventDefault(); close() }
    else if (event.key === 'Enter') { event.preventDefault(); apply() }
  }
  /** @param {FocusEvent} event */
  function focusOut(event) {
    const next = event.relatedTarget
    if (next instanceof Node && wrapper?.contains(next)) return
    apply(false)
  }
  /** @param {boolean} [refocus] */
  function apply(refocus = true) {
    if (closing || composing) return
    const text = value.trim()
    if (text === initialValue) { close(false, refocus); return }
    if (!text || text === '⬚' || text === '＋') { editor.empty(targetPath); close(true, refocus); return }
    const literal = parse(text, { open: true })
    const found = literal.problem ? parse(unalias(text), { open: true }) : literal
    if (found.problem) { error = editor.t(`ids.problem.${found.problem}`); return }
    if (found.tree === null) { editor.empty(targetPath); close(true, refocus); return }
    const problem = parse(write(place(editor.tree, targetPath, found.tree).tree), { open: true }).problem
    if (problem) { error = editor.t(`ids.problem.${problem}`); return }
    editor.put(found.tree, targetPath); close(true, refocus)
  }
  /** @param {string} part */
  function pick(part) {
    if (closing || !editor.put(part, targetPath)) return
    close(true)
  }
</script>

<span class="inline-edit" class:leaf={variant === 'leaf'} bind:this={wrapper} onfocusout={focusOut}>
  <input bind:this={input} bind:value disabled={editor.disabled} oninput={event => { loadFallbackText(event.currentTarget.value, getComputedStyle(event.currentTarget).fontFamily); error = '' }} aria-label={editor.t('ids.inline.label')} aria-controls={hintSet ? hintsId : undefined} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${uid}-error` : undefined}
    lang="ja" spellcheck="false" autocomplete="off" onkeydown={key} oncompositionstart={() => composing = true}
    oncompositionend={() => { composing = false; if (document.activeElement !== input) apply(false) }}
    onclick={event => event.stopPropagation()} ondblclick={event => event.stopPropagation()}
    ondragstart={event => event.stopPropagation()} ondragover={event => event.stopPropagation()} ondrop={event => event.stopPropagation()} />
  {#if error}<span id={`${uid}-error`} class="error" role="status">{error}</span>{/if}
  {#if hintSet}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -- the panel only keeps the field focused; its buttons are the controls -->
    <div class="slot-hints" class:placed={position !== null} role="group" id={hintsId} onkeydown={hintKey} aria-labelledby={`${hintsId}-title`}
      style:left="{position?.x ?? 0}px" style:top="{position?.y ?? 0}px" style:--hint-cols={Math.min(6, hintSet.hints.length)}
      bind:this={panel} onpointerdown={event => event.preventDefault()}>
      <p id={`${hintsId}-title`}>{hintTitle}</p>
      <div class="hints-grid">
        {#each hintSet.hints as [part, count] (part)}
          <button type="button" class="hint" title={`${part} · ${editor.t('ids.hints.count', { count })}`} aria-label={`${part} · ${editor.t('ids.hints.count', { count })}`}
            onclick={() => pick(part)}>{part}</button>
        {/each}
      </div>
    </div>
  {/if}
</span>

<style>
  .inline-edit{display:inline-flex;position:relative;flex:1;min-width:0;pointer-events:auto}
  .inline-edit.leaf{width:100%;height:100%}
  input{width:100%;min-width:0;box-sizing:border-box;padding:3px 5px;border:1px solid var(--ids-focus,light-dark(#2944c7,#8ea8ff));border-radius:5px;background:var(--ids-surface,light-dark(#fff,#1b1b20));color:var(--ids-ink,light-dark(#1c1c22,#ececf2));font:16px var(--_font,var(--ids-font,"IDS Operators",var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif))}
  .leaf input{text-align:center;font-size:min(var(--ids-part-size,32px),max(0px,calc(66cqh - 3px)),max(0px,calc(66cqw - 3px)))}
  input:focus-visible{outline:2px solid var(--ids-focus,light-dark(#2944c7,#8ea8ff));outline-offset:0}
  .error{position:absolute;z-index:2;top:100%;left:0;min-width:max-content;max-width:240px;padding:3px 5px;border-radius:4px;background:var(--ids-surface,light-dark(#fff,#1b1b20));color:var(--ids-fault,light-dark(#b42318,#ff8a80));font:12px system-ui,sans-serif;white-space:normal}
  .slot-hints{position:fixed;z-index:55;display:flex;flex-direction:column;gap:5px;width:max-content;max-width:calc(100vw - 16px);padding:7px;border:1px solid var(--ids-line,light-dark(#e1e1e8,#2e2e36));border-radius:9px;background:var(--ids-surface,light-dark(#fff,#1b1b20));box-shadow:0 8px 24px rgb(0 0 0 / .18);visibility:hidden;font:12px system-ui,sans-serif}
  .slot-hints.placed{visibility:visible}
  .slot-hints p{margin:0 2px;font-size:11px;line-height:1.35;color:var(--ids-muted,light-dark(#686874,#9d9daa))}
  .hints-grid{display:grid;grid-template-columns:repeat(var(--hint-cols),30px);gap:3px}
  .hint{display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid var(--ids-line,light-dark(#e1e1e8,#2e2e36));border-radius:6px;background:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));color:var(--ids-ink,light-dark(#1c1c22,#ececf2));cursor:pointer;
    font:20px/1 var(--_font,var(--ids-font,"IDS Operators","IDS Numbered","IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Jurchen","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif))}
  .hint:hover,.hint:focus-visible{border-color:var(--ids-focus,light-dark(#2944c7,#8ea8ff));background:var(--ids-accent-light,light-dark(#e9edfd,#232c4c))}
  .hint:focus-visible{outline:2px solid var(--ids-focus,light-dark(#2944c7,#8ea8ff));outline-offset:0}
</style>
