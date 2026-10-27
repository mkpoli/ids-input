<script>
  import { tint } from './tokens.js'
  // The description as an indented list of its operators and parts, for choosing by row rather than by
  // box. A click on a row chooses that part, a click on its arrow opens or closes its parts, and a
  // part dragged from a palette or a search drops onto the row. Arrow keys move, ArrowRight opens a
  // row or steps into it, ArrowLeft closes it or steps out, and Enter chooses the row.
  import { isNode, write } from '../core/ids.js'
  import OperatorIcon from './OperatorIcon.svelte'

  /** @typedef {import('../core/ids.js').Part} Part */
  /** @typedef {import('../core/ids.js').Path} Path */
  /** @typedef {{ key: string, path: Path, level: number, node: boolean, op?: string, part?: string | null, seq: string, name: string }} Row */
  /** @type {{ editor: import('./editor.svelte.js').Editor }} */
  let { editor } = $props()
  const t = $derived(editor.t)
  /** @param {Path} path */
  const key = path => path.join('.')
  /** @type {Set<string>} */
  let collapsed = $state(new Set())
  /** @type {string | null} */
  let focusKey = $state(null)
  /** @type {string | null} */
  let over = $state(null)
  /** @type {HTMLElement | null} */
  let listEl = $state(null)

  /** @type {Row[]} */
  const rows = $derived.by(() => {
    /** @type {Row[]} */
    const out = []
    /** @param {Part} part @param {Path} path @param {number} level @param {{ op: string, n: number } | null} parent */
    const walk = (part, path, level, parent) => {
      if (isNode(part)) {
        out.push({ key: key(path), path, level, node: true, op: part.op, seq: write(part), name: editor.name(part.op) })
        if (collapsed.has(key(path))) return
        part.parts.forEach((inner, i) => walk(inner, [...path, i], level + 1, { op: part.op, n: i + 1 }))
        return
      }
      const name = parent ? t('ids.part', { part: part ?? t('ids.empty'), n: parent.n, name: editor.name(parent.op) }) : part === null ? t('ids.empty') : part
      out.push({ key: key(path), path, level, node: false, part, seq: part ?? '⬚', name })
    }
    if (editor.tree) walk(editor.tree, [], 0, null)
    return out
  })
  const tabStop = $derived(rows.some(row => row.key === focusKey) ? focusKey : rows[0]?.key)
  /** @param {Row} row */
  const selected = row => editor.chosen !== null && key(editor.chosen) === row.key
  /** @param {Row} row */
  const rowLabel = row => row.node
    ? t('ids.node', { name: row.name, sequence: row.seq })
    : t('ids.choose', { part: row.name })

  /** @param {string} key */
  function focusRow(key) {
    focusKey = key
    queueMicrotask(() => /** @type {HTMLElement | null | undefined} */ (listEl?.querySelector(`[data-path="${CSS.escape(key)}"]`))?.focus())
  }
  /** @param {Row} row */
  function toggle(row) {
    const next = new Set(collapsed)
    if (next.has(row.key)) next.delete(row.key); else next.add(row.key)
    collapsed = next
  }
  /** @param {MouseEvent} event @param {Row} row */
  function clickRow(event, row) {
    if (editor.disabled) return
    focusRow(row.key)
    const target = /** @type {HTMLElement} */ (event.target)
    if (row.node && target.closest('[data-toggle]')) { toggle(row); return }
    editor.choose(row.path)
  }
  /** @param {KeyboardEvent} event @param {number} index */
  function keyRow(event, index) {
    if (event.target !== event.currentTarget) return
    const row = rows[index]
    if (!row) return
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!editor.disabled) editor.choose(row.path); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = rows[index + (event.key === 'ArrowDown' ? 1 : -1)]
      if (next) focusRow(next.key)
      return
    }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); const next = event.key === 'Home' ? rows[0] : rows[rows.length - 1]; if (next) focusRow(next.key); return }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (row.node && collapsed.has(row.key)) { toggle(row); return }
      const next = rows[index + 1]
      if (next && next.level > row.level) focusRow(next.key)
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (row.node && !collapsed.has(row.key)) { toggle(row); return }
      for (let i = index - 1; i >= 0; i--) if (rows[i].level < row.level) { focusRow(rows[i].key); return }
    }
  }
  /** @param {DragEvent} event @param {Row} row */
  function dragOver(event, row) {
    if (editor.disabled || !event.dataTransfer?.types.includes('text/plain')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    over = row.key
  }
  /** @param {DragEvent} event @param {Row} row */
  function drop(event, row) {
    over = null
    const given = event.dataTransfer?.getData('text/plain')?.trim()
    if (!given || editor.disabled) return
    event.preventDefault()
    editor.take(given, row.path)
  }
</script>

<div class="ids-treelist" bind:this={listEl}>
  <ul role="tree" aria-label={t('ids.structure')}>
    {#each rows as row, index (row.key)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
      <li role="treeitem" class:node={row.node} class:chosen={selected(row)} class:hovered={editor.isHovered(row.path)} class:over={over === row.key} data-path={row.key}
        aria-level={row.level + 1} aria-selected={selected(row)} aria-expanded={row.node ? !collapsed.has(row.key) : undefined}
        aria-label={rowLabel(row)} title={rowLabel(row)} tabindex={row.key === tabStop ? 0 : -1}
        style:--level={row.level} style:--tint={tint(row.path)}
        onpointerenter={() => editor.hover(row.path)} onpointerleave={() => editor.hover(null)} onfocus={() => focusKey = row.key} onclick={event => clickRow(event, row)} onkeydown={event => keyRow(event, index)}
        ondragover={event => dragOver(event, row)} ondragleave={() => over = null} ondrop={event => drop(event, row)}>
        <span class="toggle" data-toggle aria-hidden="true">{row.node ? collapsed.has(row.key) ? '▸' : '▾' : ''}</span>
        {#if row.node}
          {@const op = row.op ?? ''}
          <OperatorIcon {op} size={16} />
          <span class="name">{row.name}</span>
        {:else}
          <span class="part" class:empty={row.part === null} lang="ja">{row.part ?? '⬚'}</span>
          <span class="name">{row.part === null ? t('ids.empty') : ''}</span>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .ids-treelist{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));
    --_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));
    --_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));--_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));
    --_font:var(--ids-font,"IDS Strokes","IDS Seal","IDS Parts","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",sans-serif);
    height:100%;min-height:0;overflow:auto;padding:4px;color:var(--_ink)}
  ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
  li{display:flex;align-items:center;gap:8px;min-height:32px;padding:3px 8px 3px calc(4px + var(--level) * 16px);border:1px solid transparent;border-radius:8px;cursor:pointer}
  li:hover{background:var(--_surface-subtle)}
  li.chosen{border-color:var(--_accent);background:var(--_accent-light)}
  li.over{border-color:var(--_accent)}
  li:focus-visible{outline:2px solid var(--_focus);outline-offset:-2px}
  .toggle{display:grid;place-items:center;width:14px;flex:none;color:var(--_muted);font-size:11px}
  .part{display:grid;place-items:center;min-width:22px;font-family:var(--_font);font-size:20px;line-height:1.1}
  .part.empty{font-size:15px;color:var(--_muted)}
  .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--_muted)}
  li{background:color-mix(in oklab,var(--tint) 9%,var(--_surface));color:color-mix(in oklab,var(--_ink) 80%,var(--tint))}
  li.hovered{background:color-mix(in oklab,var(--tint) 28%,var(--_surface));box-shadow:inset 0 0 0 2px var(--_accent)}
</style>
