<script>
  // A small editor beside the part, shared by the shape and tree views.
  import { tick, untrack } from 'svelte'
  import { parse, place, samePath, write } from '../core/ids.js'
  import { unalias } from '../core/aliases.js'
  /** @type {{ editor: import('./editor.svelte.js').Editor, path: import('../core/ids.js').Path, anchor: HTMLElement, onclose: () => void }} */
  let { editor, path, anchor, onclose } = $props()
  const targetPath = untrack(() => path)
  const targetAnchor = untrack(() => anchor)
  const initialValue = untrack(() => editor.sequenceAt(targetPath))
  let value = $state(initialValue)
  let error = $state('')
  let composing = $state(false)
  const revision = untrack(() => editor.revision)
  /** @type {HTMLInputElement | null} */ let input = $state(null)
  const owner = targetAnchor.closest('.ids-tree,.ids-treelist')
  let left = $state(8), top = $state(8)
  function position() {
    const rect = targetAnchor.getBoundingClientRect()
    left = Math.max(8, Math.min(rect.left, window.innerWidth - 288))
    const preferred = rect.bottom + 104 <= window.innerHeight ? rect.bottom + 4 : rect.top - 104
    top = Math.max(8, Math.min(preferred, window.innerHeight - 104))
  }
  $effect(() => {
    position()
    window.addEventListener('scroll', position, true)
    window.addEventListener('resize', position)
    const observer = new ResizeObserver(position)
    observer.observe(targetAnchor)
    return () => { window.removeEventListener('scroll', position, true); window.removeEventListener('resize', position); observer.disconnect() }
  })
  $effect(() => { if (input) tick().then(() => { input?.focus(); input?.select() }) })
  $effect(() => { if (editor.revision !== revision || !samePath(editor.chosen, targetPath)) onclose() })
  /** @param {boolean} [followSelection] */
  function close(followSelection = false) {
    const focusPath = followSelection ? editor.chosen ?? targetPath : targetPath
    onclose()
    tick().then(() => requestAnimationFrame(() => {
      const target = samePath(focusPath, targetPath) && targetAnchor.isConnected && targetAnchor.matches('button,[tabindex]')
        ? targetAnchor : owner?.querySelector(`[data-path="${CSS.escape(focusPath.join('.'))}"]`)
      if (target instanceof HTMLElement) target.focus()
    }))
  }
  /** @param {KeyboardEvent} event */
  function key(event) { if (event.isComposing) return; if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } else if (event.key === 'Enter' && event.target === input) { event.preventDefault(); apply() } }
  function apply() {
    const text = value.trim()
    if (text === initialValue) { close(); return }
    if (!text || text === '⬚' || text === '＋') { editor.empty(targetPath); close(true); return }
    const literal = parse(text, { open: true })
    const found = literal.problem ? parse(unalias(text), { open: true }) : literal
    if (found.problem) { error = editor.t(`ids.problem.${found.problem}`); return }
    if (found.tree === null) { editor.empty(targetPath); close(true); return }
    const problem = parse(write(place(editor.tree, targetPath, found.tree).tree), { open: true }).problem
    if (problem) { error = editor.t(`ids.problem.${problem}`); return }
    editor.put(found.tree, targetPath); close(true)
  }
</script>

<div class="inline-edit" role="group" aria-label={editor.t('ids.inline.label')} style:left="{left}px" style:top="{top}px">
  <input bind:this={input} bind:value disabled={editor.disabled} aria-label={editor.t('ids.inline.label')} lang="ja" spellcheck="false" autocomplete="off" onkeydown={key} oncompositionstart={() => composing = true} oncompositionend={() => composing = false} />
  <button type="button" onkeydown={key} onclick={() => { if (!composing) apply() }} disabled={editor.disabled}>{editor.t('ids.inline.apply')}</button>
  <button type="button" onkeydown={key} onclick={() => close()}>{editor.t('ids.inline.cancel')}</button>
  {#if error}<span class="error" role="status">{error}</span>{/if}
</div>

<style>
  .inline-edit{position:fixed;z-index:60;display:flex;flex-wrap:wrap;gap:4px;width:280px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:6px;border:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43));border-radius:9px;background:var(--ids-surface,light-dark(#fff,#202026));box-shadow:0 6px 22px rgb(0 0 0 / .22);color:var(--ids-ink,light-dark(#1d1d21,#ececf1));font:14px system-ui,sans-serif}
  input{flex:1 1 100%;min-width:0;box-sizing:border-box;padding:6px 8px;border:1px solid var(--ids-line-strong,light-dark(#b0b0ba,#5c5c67));border-radius:5px;background:transparent;color:inherit;font:18px var(--_font,var(--ids-font,sans-serif))}
  button{padding:4px 10px;border:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43));border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}
  :is(input,button):focus-visible{outline:2px solid var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));outline-offset:1px}
  .error{flex-basis:100%;color:var(--ids-fault,light-dark(#b42318,#ff8a80));font-size:12px}
</style>
