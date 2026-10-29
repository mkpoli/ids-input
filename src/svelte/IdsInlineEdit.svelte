<script>
  // Edit the selected part in place in either structure view.
  import { tick, untrack } from 'svelte'
  import { parse, place, samePath, write } from '../core/ids.js'
  import { unalias } from '../core/aliases.js'
  /** @type {{ editor: import('./editor.svelte.js').Editor, path: import('../core/ids.js').Path, owner: HTMLElement | null, variant?: 'label' | 'leaf', onclose: () => void, onreveal?: (path: import('../core/ids.js').Path) => void }} */
  let { editor, path, owner, variant = 'label', onclose, onreveal } = $props()
  const targetPath = untrack(() => path)
  const initialValue = untrack(() => editor.sequenceAt(targetPath))
  const revision = untrack(() => editor.revision)
  const uid = $props.id()
  let value = $state(initialValue), error = $state(''), composing = $state(false)
  let closing = false
  /** @type {HTMLInputElement | null} */ let input = $state(null)
  $effect(() => { if (input) tick().then(() => { input?.focus(); input?.select() }) })
  $effect(() => { if (editor.revision !== revision || !samePath(editor.chosen, targetPath)) { closing = true; onclose() } })
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
  function key(event) {
    event.stopPropagation()
    if (event.isComposing || composing) return
    if (event.key === 'Escape') { event.preventDefault(); close() }
    else if (event.key === 'Enter') { event.preventDefault(); apply() }
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
</script>

<span class="inline-edit" class:leaf={variant === 'leaf'}>
  <input bind:this={input} bind:value disabled={editor.disabled} aria-label={editor.t('ids.inline.label')} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${uid}-error` : undefined}
    lang="ja" spellcheck="false" autocomplete="off" onkeydown={key} oninput={() => error = ''} onblur={() => apply(false)} oncompositionstart={() => composing = true}
    oncompositionend={() => { composing = false; if (document.activeElement !== input) apply(false) }}
    onclick={event => event.stopPropagation()} ondblclick={event => event.stopPropagation()}
    ondragstart={event => event.stopPropagation()} ondragover={event => event.stopPropagation()} ondrop={event => event.stopPropagation()} />
  {#if error}<span id={`${uid}-error`} class="error" role="status">{error}</span>{/if}
</span>

<style>
  .inline-edit{display:inline-flex;position:relative;flex:1;min-width:0;pointer-events:auto}
  .inline-edit.leaf{width:100%;height:100%}
  input{width:100%;min-width:0;box-sizing:border-box;padding:3px 5px;border:1px solid var(--ids-focus,light-dark(#2944c7,#8ea8ff));border-radius:5px;background:var(--ids-surface,light-dark(#fff,#1b1b20));color:var(--ids-ink,light-dark(#1c1c22,#ececf2));font:16px var(--_font,var(--ids-font,var(--ids-glyph-fallback,"IDS Fallback"),sans-serif))}
  .leaf input{text-align:center;font-size:min(var(--ids-part-size,32px),max(0px,calc(66cqh - 3px)),max(0px,calc(66cqw - 3px)))}
  input:focus-visible{outline:2px solid var(--ids-focus,light-dark(#2944c7,#8ea8ff));outline-offset:0}
  .error{position:absolute;z-index:2;top:100%;left:0;min-width:max-content;max-width:240px;padding:3px 5px;border-radius:4px;background:var(--ids-surface,light-dark(#fff,#1b1b20));color:var(--ids-fault,light-dark(#b42318,#ff8a80));font:12px system-ui,sans-serif;white-space:normal}
</style>
