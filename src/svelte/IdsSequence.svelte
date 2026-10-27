<script>
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
  const edit = event => { if (!/** @type {InputEvent | undefined} */ (event)?.isComposing && field) editor.edit(field) }
</script>

<label class="ids-field">
  {#if label}<span class="ids-title">{t('ids.label')}</span>{/if}
  <div class="sequence-wrap" class:composing>
    <div class="sequence-paint" bind:this={paint} style={metrics} aria-hidden="true"><div class="sequence-viewport"><div style:transform={`translateX(${-scroll}px)`}>{#if spans.length}{#each spans as token}<span class:hovered={editor.isHovered(token.path)} style:--tint={tint(token.path)}>{token.text}</span>{/each}{:else}{editor.draft}{/if}</div></div></div>
  <input bind:this={field} value={editor.draft} disabled={editor.disabled} lang="ja" spellcheck="false" autocomplete="off"
    aria-label={label ? undefined : t('ids.label')} {placeholder} aria-invalid={Boolean(editor.problem)}
    onpointermove={hover} onpointerleave={() => editor.hover(null)} onscroll={() => scroll = field?.scrollLeft ?? 0} oninput={edit} oncompositionstart={() => composing = true} oncompositionend={() => { composing = false; edit() }} onblur={() => editor.settle()}
    onkeydown={event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); onenter?.() } }} />
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
  .sequence-paint span{color:color-mix(in oklab,var(--_ink) 76%,var(--tint));background:color-mix(in oklab,var(--tint) 12%,transparent)}
  .sequence-paint span:first-child{border-radius:3px 0 0 3px}
  .sequence-paint span:last-child{border-radius:0 3px 3px 0}
  .sequence-paint span:only-child{border-radius:3px}
  input{position:relative;box-sizing:border-box;width:100%;caret-color:var(--_ink);-webkit-text-fill-color:transparent;min-width:0;font:inherit;font-size:22px;padding:6px 10px;font-family:var(--_font);color:inherit;
    border:1px solid var(--_line);border-radius:8px;background:transparent}
  input::placeholder{-webkit-text-fill-color:var(--_muted);color:color-mix(in srgb,var(--_muted) 70%,transparent)}
  input:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  input[aria-invalid="true"]{border-color:var(--_fault)}
  .sequence-viewport{overflow:hidden}
  .composing .sequence-paint{visibility:hidden}
  .composing input{-webkit-text-fill-color:var(--_ink)}
  @media (forced-colors: active){.sequence-paint{visibility:hidden} input{-webkit-text-fill-color:CanvasText}}
  .sequence-paint span.hovered{background:color-mix(in oklab,var(--tint) 40%,transparent);box-shadow:inset 0 -3px var(--_accent);border-radius:3px}
  .sequence-paint span.hovered + span.hovered{border-start-start-radius:0;border-end-start-radius:0}
  .sequence-paint span.hovered:has(+ span.hovered){border-start-end-radius:0;border-end-end-radius:0}
</style>
