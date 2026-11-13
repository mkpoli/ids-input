<script>
  import { parse, arity, customLength, isCustom, unfinishedCustom } from '../core/ids.js'
  import { unalias } from '../core/aliases.js'
  import { replacementPrefix, replacementQuery } from '../core/replacement.js'
  import { replacementExpression, replacementInput } from '../core/replacement-expression.js'
  import { untrack } from 'svelte'
  import { tokens, tint } from './tokens.js'
  import { loadFallbackText } from './fallback-font.js'
  import { sequenceScopes } from './sequence-scopes.js'
  /** @type {HTMLDivElement | null} */ let textRun = $state(null)
  /** @type {{left:number, right:number, inkLeft:number}[]} */ let bounds = $state([])
  // The width of the slots drawn after the text, so the field can scroll far enough to show them.
  // The width of the slots drawn after the text, so the input can reserve room for them.
  let drawnSlots = $state(0)
  $effect(() => {
    void editor.draft
    const run = textRun
    if (!run) return
    let frame = 0, alive = true
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!alive) return
        const origin = run.getBoundingClientRect().left
        const style = getComputedStyle(run)
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (context) context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        const spans = [...run.querySelectorAll('span')]
        bounds = spans.map(span => {
          const box = span.getBoundingClientRect()
          const character = [...(span.dataset.character ?? '')][0] ?? ''
          const metrics = context && arity(character) > 0 ? context.measureText(character) : null
          const inkLeft = metrics && Number.isFinite(metrics.actualBoundingBoxLeft)
            ? Math.max(0, -metrics.actualBoundingBoxLeft)
            : 0
          return {left: box.left - origin, right: box.right - origin, inkLeft}
        })
        drawnSlots = spans.filter(span => span.classList.contains('missing')).reduce((sum, span) => {
          const style = getComputedStyle(span)
          return sum + span.getBoundingClientRect().width + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0)
        }, 0)
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(run)
    // A face switch changes the CSS font without necessarily changing the run's size.
    const fonts = new MutationObserver(measure)
    fonts.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-font'] })
    if (document.body && document.body !== document.documentElement) fonts.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-font'] })
    document.fonts.addEventListener('loadingdone', measure)
    void document.fonts.ready.then(() => { if (alive) measure() })
    measure()
    return () => {
      alive = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      fonts.disconnect()
      document.fonts.removeEventListener('loadingdone', measure)
    }
  })
  let scroll = $state(0)
  let composing = $state(false)
  let metrics = $state('')
  // The sequence field of `editor`: the description as text, read as it is typed, ASCII operator
  // names (LR, ud) becoming operators. Enter calls `onenter`; a problem marks the field invalid.
  /** @type {{ editor: import('./editor.svelte.js').Editor, label?: boolean, placeholder?: string, onenter?: () => void }} */
  let { editor, label = true, placeholder = '⿰⿱匕失⿱コ疋', onenter } = $props()
  const spans = $derived(tokens(editor.draft))
  /** @param {import('./tokens.js').Token} token */
  const operatorToken = token => { const char = Array.from(token.text)[0]; return Boolean(char && arity(char)) }
  const scopes = $derived(sequenceScopes(spans, bounds))
  const paintedScopes = $derived(scopes.map(scope => {
    const segments = scope.segments.map(segment => ({
      ...segment,
      tinted: editor.isTinted(segment.path),
      hovered: editor.isHovered(segment.path),
      selected: editor.isSelected(segment.path)
    }))
    return {
      ...scope,
      tinted: editor.isTinted(scope.path),
      hovered: editor.isHovered(scope.path) || segments.some(segment => segment.hovered),
      selected: editor.isSelected(scope.path) || segments.some(segment => segment.selected),
      segments
    }
  }))
  const scopeHeight = $derived(scopes.length ? 12 + Math.max(...scopes.map(scope => scope.lane)) * 6 : 0)
  const t = $derived(editor.t)
  $effect(() => {
    const input = editor.draft, adapter = editor.adapter, disabled = editor.disabled
    if (!adapter || disabled) return
    const replacement = Boolean(replacementQuery(input) || replacementExpression(input))
    // A description with a stroke chain the parser cannot read may still name its character.
    const chain = !replacement && input.includes('#(') && Boolean(parse(input, { open: true }).problem)
    if (!replacement && !chain) return
    untrack(() => { if (replacement) editor.resolveInput(input); else editor.resolveChain(input) })
    return () => editor.cancelResolution()
  })
  /** @type {HTMLInputElement | null} */ let field = $state(null)
  // The field draws what is typed into it, including characters only the shards have.
  $effect(() => { loadFallbackText(editor.draft, field ? getComputedStyle(field).fontFamily : undefined) })
  $effect(() => {
    if (!field) return
    const element = field
    const measure = () => {
      const css = getComputedStyle(element)
      // The font stays on the stylesheet: copying the computed stack here would freeze the fallback
      // family the field had before its shards registered, and the painted text would keep boxes.
      metrics = `padding:${css.padding};letter-spacing:${css.letterSpacing};line-height:${css.lineHeight}`
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  })
  /** @type {HTMLDivElement | null} */ let paint = $state(null)
  $effect(() => {
    void editor.selectionVersion
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
    if (field && (replacementInput(field.value) || replacementExpression(field.value))) return false
    if (!field || !text || parse(unalias(text), { open: true }).problem) return false
    if (field.selectionStart === field.selectionEnd) {
      const offset = field.selectionStart ?? 0
      // A custom component is typed as text until its closing mark: &, C, D, P are no parts of
      // their own. Once closed it goes in as one part, as if pasted whole.
      const opened = unfinishedCustom(editor.draft.slice(0, offset))
      if (opened >= 0 && [...text].length === 1) {
        const written = editor.draft.slice(opened, offset) + text
        if (customLength(written) !== written.length) return false
        field.value = editor.draft.slice(0, opened) + editor.draft.slice(offset)
        field.setSelectionRange(opened, opened)
        editor.edit(field)
        if (replaceText(written)) return true
        field.value = editor.draft.slice(0, opened) + written + editor.draft.slice(opened)
        field.setSelectionRange(opened + written.length, opened + written.length)
        editor.edit(field)
        return true
      }
      if (text === '&' || text === '{' || (text === '(' && editor.draft[offset - 1] === '#')) return false
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
    if (!editor.take(text)) return false
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
    // Replacement expressions are entered as ordinary text until all three operands are present.
    if (field && (replacementInput(field.value) || replacementExpression(field.value)
      || (event.inputType.startsWith('insert') && replacementInput(field.value.slice(0, field.selectionStart ?? 0) + (event.data ?? '') + field.value.slice(field.selectionEnd ?? 0)))
      || (/^\s*r$/i.test(field.value) && /^p$/i.test(event.data ?? '')))) return
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
  <div class="sequence-wrap" class:composing style:--scope-height={`${scopeHeight}px`}>
    <div class="sequence-paint" bind:this={paint} style={metrics} aria-hidden="true"><div class="sequence-viewport"><div class="sequence-run" bind:this={textRun} style:transform={`translateX(${-scroll}px)`}>{#if spans.length}{#each spans as token}<span data-character={token.text || '◌'} data-path={token.path.join('.')} class:missing={!token.text} class:custom={isCustom(token.text)} class:tinted={editor.isTinted(token.path)} class:hovered={editor.isHovered(token.path)} class:selected={editor.isSelected(token.path)} style:--tint={tint(token.path, operatorToken(token))}>{token.text || '◌'}</span>{/each}{:else}{editor.draft}{/if}{#if paintedScopes.length}<svg class="sequence-scopes" width="100%" height={scopeHeight} aria-hidden="true">{#each paintedScopes as scope}<g data-path={scope.path.join('.')}><path class="scope-lead" class:scope-tinted={scope.tinted} class:scope-hovered={scope.hovered} class:scope-selected={scope.selected} style:--tint={tint(scope.path, true)} data-path={scope.path.join('.')} d={scope.lead}/>{#each scope.segments as segment}<path class="scope-segment" class:scope-missing={segment.missing} class:scope-tinted={segment.tinted} class:scope-hovered={segment.hovered} class:scope-selected={segment.selected} style:--tint={tint(segment.path)} data-path={segment.path.join('.')} d={segment.d}/>{/each}</g>{/each}</svg>{/if}</div></div></div>
  <input bind:this={field} value={editor.draft} style:padding-right={`calc(10px + ${drawnSlots + 8}px)`} disabled={editor.disabled} lang="ja" spellcheck="false" autocomplete="off"
    aria-label={label ? undefined : t('ids.label')} {placeholder} aria-invalid={Boolean(editor.problem)}
    onselect={select} onkeyup={select} onclick={select} onbeforeinput={beforeInput} onpaste={paste} onpointermove={hover} onpointerleave={() => editor.hover(null)} onscroll={() => scroll = field?.scrollLeft ?? 0} oninput={edit} oncompositionstart={startComposition} oncompositionend={endComposition} onblur={() => editor.settle()}
    onkeydown={event => { if (!event.isComposing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) editor.redo(); else editor.undo(); return } if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); onenter?.() } }} />
  </div>
</label>

<style>
  .ids-field{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#686874,#9d9daa));--_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));
    --_control-border:var(--ids-control-border,light-dark(#8a8a96,#6f6f7e));
    --_line-strong:var(--ids-line-strong,light-dark(#c2c2cc,#4a4a55));--_surface:var(--ids-surface,light-dark(#fff,#1b1b20));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));--_surface-selected:var(--ids-surface-selected,light-dark(#eeeef3,#26262d));
    --_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));--_accent-light:var(--ids-accent-light,light-dark(#e9edfd,#232c4c));
    --_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Numbered","IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Jurchen","IDS Operators","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif);
    display:flex;flex-direction:column;gap:4px;min-width:0;color:var(--_ink)}
  .ids-title{font-size:11px;color:var(--_muted)}
  .sequence-wrap{position:relative;min-width:0}
  .sequence-paint{position:absolute;inset:1px;padding:6px 10px;overflow:hidden;pointer-events:none;border-radius:7px;font:22px var(--_font);white-space:pre}
  .sequence-paint span.tinted{color:color-mix(in oklab,var(--_ink) 76%,var(--tint));background:color-mix(in oklab,var(--tint) 12%,transparent)}
  /* A part no code point names is written by its code: marked, so it does not read as loose punctuation. */
  .sequence-paint span.custom{text-decoration:underline dotted color-mix(in oklab,var(--_accent) 70%,transparent);text-decoration-thickness:2px;text-underline-offset:5px}
  .sequence-paint span:first-child{border-radius:3px 0 0 3px}
  .sequence-paint span:last-of-type{border-radius:0 3px 3px 0}
  .sequence-paint span:only-of-type{border-radius:3px}
  input{position:relative;box-sizing:border-box;width:100%;caret-color:var(--_ink);-webkit-text-fill-color:transparent;min-width:0;font:inherit;font-size:22px;line-height:1.5;padding:6px 10px calc(6px + var(--scope-height,0px)) 10px;font-family:var(--_font);color:inherit;
    border:1px solid var(--_control-border);border-radius:8px;background:transparent}
  input::placeholder{-webkit-text-fill-color:var(--_muted);color:color-mix(in srgb,var(--_muted) 70%,transparent)}
  input:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  input[aria-invalid="true"]{border-color:var(--_fault)}
  .sequence-viewport{overflow:hidden;padding-bottom:var(--scope-height,0px);margin-bottom:calc(-1 * var(--scope-height,0px))}
  .sequence-run{position:relative;width:max-content;min-width:0}
  .sequence-scopes{position:absolute;top:100%;left:0;overflow:visible;fill:none}
  .sequence-scopes path{stroke:var(--_muted);stroke-width:1;stroke-linecap:round;stroke-linejoin:round}
  .sequence-scopes path.scope-tinted{stroke:color-mix(in oklab,var(--tint) 55%,var(--_ink-soft))}
  .sequence-scopes path.scope-hovered,.sequence-scopes path.scope-selected{stroke:var(--_accent);stroke-width:1.6}
  .sequence-scopes path.scope-segment.scope-hovered,.sequence-scopes path.scope-segment.scope-selected{stroke-width:2}
  /* A missing operand keeps the warning colour whatever is chosen or hovered around it. */
  .sequence-scopes path.scope-missing{stroke:var(--_fault)}
  .sequence-scopes path.scope-missing.scope-hovered,.sequence-scopes path.scope-missing.scope-selected{stroke:var(--_fault);stroke-width:2}
  .composing .sequence-paint{visibility:hidden}
  .composing input{-webkit-text-fill-color:var(--_ink)}
  @media (forced-colors: active){
    .sequence-paint{visibility:hidden}
    .sequence-scopes{visibility:visible}
    .sequence-scopes path,.sequence-scopes path.scope-tinted{stroke:CanvasText;stroke-width:1.5}
    .sequence-scopes path.scope-hovered,.sequence-scopes path.scope-selected{stroke:Highlight;stroke-width:2}
    input{-webkit-text-fill-color:CanvasText}
  }
  .sequence-paint span.missing{color:var(--_fault);font-size:.95em;margin-inline:.08em}
  .sequence-paint span.selected.missing{background:color-mix(in oklab,var(--_fault) 16%,transparent)}
  .sequence-paint span.hovered{box-shadow:inset 0 -3px var(--_accent);border-radius:3px}
  .sequence-paint span.hovered.tinted{background:color-mix(in oklab,var(--tint) 40%,transparent)}
  .sequence-paint span.hovered + span.hovered{border-start-start-radius:0;border-end-start-radius:0}
  .sequence-paint span.hovered:has(+ span.hovered){border-start-end-radius:0;border-end-end-radius:0}
  .sequence-paint span.selected{background:color-mix(in oklab,var(--_accent) 22%,transparent);box-shadow:inset 0 -2px var(--_accent)}
  .sequence-paint span.selected + span.selected{border-start-start-radius:0;border-end-start-radius:0}
  .sequence-paint span.selected:has(+ span.selected){border-start-end-radius:0;border-end-end-radius:0}
</style>
