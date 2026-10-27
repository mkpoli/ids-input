<script>
  import { parse, arity } from '../core/ids.js'
  import { unalias } from '../core/aliases.js'
  import { untrack } from 'svelte'
  import { tokens, tint } from './tokens.js'
  let scroll = $state(0)
  let composing = $state(false)
  let metrics = $state('')
  // The sequence field of `editor`: the description as text, read as it is typed, ASCII operator
  // names (LR, ud) becoming operators. Enter calls `onenter`; a problem marks the field invalid.
  /** @type {{ editor: import('./editor.svelte.js').Editor, label?: boolean, placeholder?: string, onenter?: () => void }} */
  let { editor, label = true, placeholder = '⿰⿱匕失⿱コ疋', onenter } = $props()
  const spans = $derived(tokens(editor.draft))
  const t = $derived(editor.t)
  /** @type {HTMLInputElement | null} */ let field = $state(null)
  $effect(() => {
    if (!field) return
    const element = field
    const measure = () => {
      const css = getComputedStyle(element)
      metrics = `padding:${css.padding};font:${css.font};letter-spacing:${css.letterSpacing};line-height:${css.lineHeight}`
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  })
  /** @type {HTMLDivElement | null} */ let paint = $state(null)
  $effect(() => {
    editor.selectionVersion
    untrack(() => {
      const range = editor.selectionRange
      if (field && range) field.setSelectionRange(range.start, range.end)
    })
  })
  function select() {
    if (!composing && field && document.activeElement === field) editor.selectText(field.selectionStart ?? 0, field.selectionEnd ?? 0)
  }
  // Expand a partial token or crossing range before the browser replaces it.
  function expandSelection() {
    if (field) editor.selectText(field.selectionStart ?? 0, field.selectionEnd ?? 0)
    const range = editor.selectionRange
    if (field && field.selectionStart !== field.selectionEnd && range) field.setSelectionRange(range.start, range.end)
  }
  /** @param {string} text */
  function replaceText(text) {
    if (!field || !text || parse(unalias(text), { open: true }).problem) return false
    if (field.selectionStart === field.selectionEnd) {
      const offset = field.selectionStart ?? 0
      const inserted = unalias(text)
      const candidate = unalias(editor.draft.slice(0, offset) + text + editor.draft.slice(offset))
      if (parse(editor.draft, {open:true}).problem || (!arity(inserted) && !parse(candidate, {open:true}).problem)) return false
      editor.selectText(offset, offset)
      if (arity(inserted)) editor.operator(inserted)
      else editor.take(text)
      field.value = editor.draft
      const range = editor.selectionRange
      if (range) field.setSelectionRange(range.start, range.end)
      return true
    }
    expandSelection()
    if (editor.chosen === null) return false
    const start = field.selectionStart ?? 0
    editor.take(text)
    field.value = editor.draft
    const end = Math.min(field.value.length, start + unalias(text).length)
    editor.selectText(end, end)
    field.setSelectionRange(end, end)
    return true
  }
  /** @param {ClipboardEvent} event */
  function paste(event) {
    if (replaceText(event.clipboardData?.getData('text/plain') ?? '')) event.preventDefault()
    else expandSelection()
  }
  /** @type {{start: number, end: number} | null} */ let compositionRange = null
  function startComposition() {
    expandSelection()
    compositionRange = field ? {start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0} : null
    composing = true
  }
  /** @param {CompositionEvent} event */
  function endComposition(event) {
    composing = false
    if (field && compositionRange && event.data) {
      const composed = field.value
      field.value = editor.draft
      field.setSelectionRange(compositionRange.start, compositionRange.end)
      if (!replaceText(event.data)) { field.value = composed; edit() }
    } else edit()
    compositionRange = null
  }
  /** @param {InputEvent} event */
  function beforeInput(event) {
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault()
      if (event.inputType === 'historyUndo') editor.undo(); else editor.redo()
      return
    }
    if (event.isComposing) return
    if (event.data && event.inputType.startsWith('insert') && replaceText(event.data)) { event.preventDefault(); return }
    expandSelection()
    if (!event.isComposing && event.inputType.startsWith('delete') && field && field.selectionStart !== field.selectionEnd && editor.chosen !== null) {
      event.preventDefault()
      editor.empty(editor.chosen)
    }
  }
  /** @param {PointerEvent} event */
  function hover(event) {
    const elements = paint?.querySelectorAll('span') ?? []
    const index = [...elements].findIndex(element => {
      const box = element.getBoundingClientRect()
      return event.clientX >= box.left && event.clientX < box.right && event.clientY >= box.top && event.clientY < box.bottom
    })
    editor.hover(spans[index]?.path ?? null)
  }
  /** @param {Event} [event] */
  const edit = event => { if (!/** @type {InputEvent | undefined} */ (event)?.isComposing && field) { editor.edit(field); select() } }
</script>

<label class="ids-field">
  {#if label}<span class="ids-title">{t('ids.label')}</span>{/if}
  <div class="sequence-wrap" class:composing>
    <div class="sequence-paint" bind:this={paint} style={metrics} aria-hidden="true"><div class="sequence-viewport"><div style:transform={`translateX(${-scroll}px)`}>{#if spans.length}{#each spans as token}<span class:tinted={editor.isTinted(token.path)} class:hovered={editor.isHovered(token.path)} class:selected={editor.isSelected(token.path)} style:--tint={tint(token.path)}>{token.text}</span>{/each}{:else}{editor.draft}{/if}</div></div></div>
  <input bind:this={field} value={editor.draft} disabled={editor.disabled} lang="ja" spellcheck="false" autocomplete="off"
    aria-label={label ? undefined : t('ids.label')} {placeholder} aria-invalid={Boolean(editor.problem)}
    onselect={select} onkeyup={select} onclick={select} onbeforeinput={beforeInput} onpaste={paste} onpointermove={hover} onpointerleave={() => editor.hover(null)} onscroll={() => scroll = field?.scrollLeft ?? 0} oninput={edit} oncompositionstart={startComposition} oncompositionend={endComposition} onblur={() => editor.settle()}
    onkeydown={event => { if (!event.isComposing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) editor.redo(); else editor.undo(); return } if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); onenter?.() } }} />
  </div>
</label>

<style>
  .ids-field{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));--_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));
    --_line-strong:var(--ids-line-strong,light-dark(#b0b0ba,#5c5c67));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_surface-selected:var(--ids-surface-selected,light-dark(#e8e8ee,#30303a));
    --_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));--_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));
    --_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",sans-serif);
    display:flex;flex-direction:column;gap:4px;min-width:0;color:var(--_ink)}
  .ids-title{font-size:11px;color:var(--_muted)}
  .sequence-wrap{position:relative;min-width:0}
  .sequence-paint{position:absolute;inset:1px;padding:6px 10px;overflow:hidden;pointer-events:none;border-radius:7px;font:22px var(--_font);white-space:pre}
  .sequence-paint span.tinted{color:color-mix(in oklab,var(--_ink) 76%,var(--tint));background:color-mix(in oklab,var(--tint) 12%,transparent)}
  input{position:relative;box-sizing:border-box;width:100%;caret-color:var(--_ink);-webkit-text-fill-color:transparent;min-width:0;font:inherit;font-size:22px;padding:6px 10px;font-family:var(--_font);color:inherit;
    border:1px solid var(--_line);border-radius:8px;background:transparent}
  input::placeholder{-webkit-text-fill-color:var(--_muted);color:color-mix(in srgb,var(--_muted) 70%,transparent)}
  input:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  input[aria-invalid="true"]{border-color:var(--_fault)}
  .sequence-viewport{overflow:hidden}
  .composing .sequence-paint{visibility:hidden}
  .composing input{-webkit-text-fill-color:var(--_ink)}
  @media (forced-colors: active){.sequence-paint{visibility:hidden} input{-webkit-text-fill-color:CanvasText}}
  .sequence-paint span.hovered{box-shadow:inset 0 -2px var(--_accent)}
  .sequence-paint span.selected{background:color-mix(in oklab,var(--_accent) 22%,transparent);box-shadow:inset 0 -2px var(--_accent)}
</style>
