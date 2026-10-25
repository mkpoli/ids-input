<script>
  // The tree of `editor`'s description as boxes laid out as the operators place their parts: a row, a
  // column, the second part inside the first, or one over the other. A click chooses a part; a part
  // dragged from a palette, a tree or a search is put where it is dropped; the context menu (right
  // click, the Menu key or Shift+F10) splits or swaps with any operator, clears, removes a level or
  // copies that part's sequence. An empty slot shows as ⬚.
  import { OPERATOR_GROUPS, isNode, partAt, samePath, write } from '../core/ids.js'
  import OperatorIcon from './OperatorIcon.svelte'
  import { shortcut } from './shortcut.js'

  /** @typedef {import('../core/ids.js').Part} Part @typedef {import('../core/ids.js').Path} Path */
  /** @type {{ editor: import('./editor.svelte.js').Editor, keyHints?: boolean }} */
  let { editor, keyHints = true } = $props()
  const t = $derived(editor.t)

  /** @type {Record<string, string>} */
  const LAYOUT = { '⿰': 'row', '⿲': 'row', '⿱': 'column', '⿳': 'column', '⿻': 'stack', '㇯': 'stack', '⿾': 'stack', '⿿': 'stack', '〾': 'stack' }
  /** @param {string} op */
  const layout = op => LAYOUT[op] ?? 'enclosure'
  /** @param {Path} path */
  const key = path => path.join('.')

  // Dropping a part on a box.
  let over = $state(/** @type {string | null} */ (null))
  /** @param {DragEvent} event @param {Path} path */
  function dragover(event, path) {
    if (editor.disabled || !event.dataTransfer?.types.includes('text/plain')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    over = key(path)
  }
  /** @param {DragEvent} event @param {Path} path */
  function drop(event, path) {
    over = null
    const given = event.dataTransfer?.getData('text/plain')?.trim()
    if (!given) return
    event.preventDefault()
    editor.take(given, path)
  }

  // The context menu of a part: where it opened, and for which part.
  let menu = $state(/** @type {{ path: Path, x: number, y: number } | null} */ (null))
  /** @type {HTMLElement | null} */ let menuEl = $state(null)
  /** @type {HTMLElement | null} */ let rootEl = $state(null)
  /** @param {Path} path @param {number} x @param {number} y */
  function openMenu(path, x, y) {
    if (editor.disabled) return
    // Placed where it opened, over everything (so no scrolled or clipped box moves or cuts it), kept inside the window.
    const W = 230, H = 280
    menu = { path, x: Math.max(8, Math.min(x, innerWidth - W - 8)), y: Math.max(8, Math.min(y, innerHeight - H - 8)) }
    editor.choose(path, { toggle: false })
    queueMicrotask(() => /** @type {HTMLElement | null | undefined} */ (menuEl?.querySelector('[role="menuitem"]'))?.focus())
  }
  /** @param {MouseEvent} event @param {Path} path */
  function contextmenu(event, path) { event.preventDefault(); openMenu(path, event.clientX, event.clientY) }
  /** @param {KeyboardEvent} event @param {Path} path */
  function partKey(event, path) {
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      const r = /** @type {HTMLElement} */ (event.currentTarget).getBoundingClientRect()
      openMenu(path, r.left + 8, r.bottom)
    }
  }
  function closeMenu({ refocus = true } = {}) {
    menu = null
    if (refocus) editor.focusChosen(rootEl)
  }
  /** @param {() => void} act */
  function run(act) { act(); closeMenu() }
  /** @param {KeyboardEvent} event */
  function menuKey(event) {
    const items = /** @type {HTMLElement[]} */ ([...(menuEl?.querySelectorAll('[role="menuitem"]:not([disabled])') ?? [])])
    const at = items.indexOf(/** @type {HTMLElement} */ (document.activeElement))
    const step = /** @type {Record<string, number>} */ ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 })[event.key]
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu() }
    else if (event.key === 'Tab') closeMenu({ refocus: false })
    else if (step) { event.preventDefault(); items[(at + step + items.length) % items.length]?.focus() }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); items[event.key === 'Home' ? 0 : items.length - 1]?.focus() }
  }
  const menuPart = $derived(menu ? partAt(editor.tree, menu.path) : undefined)
</script>

<svelte:window onpointerdown={event => { if (menu && !menuEl?.contains(/** @type {Node} */ (event.target))) closeMenu({ refocus: false }) }} />

{#snippet box(/** @type {Part} */ part, /** @type {Path} */ path, /** @type {{ op: string, n: number } | null} */ parent)}
  {@const selected = samePath(editor.chosen, path)}
  {#if isNode(part)}
    {@const what = parent ? t('ids.part', { part: editor.name(part.op), n: parent.n, name: editor.name(parent.op) }) : editor.name(part.op)}
    <div class="ids-node {layout(part.op)}" class:chosen={selected} class:over={over === key(path)} data-op={part.op}>
      <div class="ids-head">
        <button type="button" class="ids-op" data-path={key(path)} aria-pressed={selected} disabled={editor.disabled}
          aria-label={t('ids.node', { name: editor.name(part.op), sequence: write(part) })} title={`${part.op} ${editor.name(part.op)}`}
          onclick={() => editor.choose(path)} oncontextmenu={event => contextmenu(event, path)} onkeydown={event => partKey(event, path)}
          ondragover={event => dragover(event, path)} ondragleave={() => over = null} ondrop={event => drop(event, path)}><OperatorIcon op={part.op} size={16} /></button>
        <button type="button" class="ids-unwrap" tabindex="-1" disabled={editor.disabled} aria-label={t('ids.unwrapNode', { what })} title={t('ids.unwrap')}
          onclick={() => editor.remove(path)}>×</button>
      </div>
      <div class="ids-parts">
        {#each part.parts as inner, i (key([...path, i]))}
          <div class="ids-cell" data-index={i}>{@render box(inner, [...path, i], { op: part.op, n: i + 1 })}</div>
        {/each}
      </div>
    </div>
  {:else}
    {@const label = part === null ? t('ids.empty') : part}
    <button type="button" class="ids-part" class:empty={part === null} class:chosen={selected} class:over={over === key(path)} aria-pressed={selected}
      data-path={key(path)} disabled={editor.disabled} title={part === null ? label : t('ids.choose', { part })}
      aria-label={parent ? t('ids.part', { part: label, n: parent.n, name: editor.name(parent.op) }) : label}
      onclick={() => editor.choose(path)} oncontextmenu={event => contextmenu(event, path)} onkeydown={event => partKey(event, path)}
      ondragover={event => dragover(event, path)} ondragleave={() => over = null} ondrop={event => drop(event, path)}>{part ?? '⬚'}</button>
  {/if}
{/snippet}

<div class="ids-tree" role="group" aria-label={t('ids.structure')} bind:this={rootEl}>
  <div class="ids-tree-root">{@render box(editor.tree, [], null)}</div>
  {#if menu}
    {@const filled = menuPart !== null && menuPart !== undefined}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="ids-menu" role="menu" tabindex="-1" aria-label={t('ids.menu.label', { part: editor.sequenceAt(menu.path) })} bind:this={menuEl}
      style:left="{menu.x}px" style:top="{menu.y}px" onkeydown={menuKey}>
      <p class="ids-menu-title">{isNode(menuPart) ? t('ids.menu.swap') : t('ids.menu.split')}</p>
      <div class="ids-menu-ops">
        {#each OPERATOR_GROUPS.flatMap(group => group.ops) as op (op)}
          <button type="button" role="menuitem" class="ids-menu-op" title={editor.name(op)} aria-label={editor.name(op)}
            onclick={() => run(() => editor.operator(op, /** @type {Path} */ (menu?.path)))}><OperatorIcon {op} size={18} /></button>
        {/each}
      </div>
      <div class="ids-menu-sep" role="separator"></div>
      <button type="button" role="menuitem" class="ids-menu-item" disabled={!filled} onclick={() => run(() => editor.empty(menu?.path ?? null))}>
        <span>{t('ids.clear')}</span>{#if keyHints}<kbd>{shortcut('backspace')}</kbd>{/if}</button>
      <button type="button" role="menuitem" class="ids-menu-item" disabled={!isNode(menuPart)} onclick={() => run(() => editor.remove(menu?.path ?? null))}>
        <span>{t('ids.unwrap')}</span></button>
      <button type="button" role="menuitem" class="ids-menu-item" disabled={!filled}
        onclick={() => { const text = editor.sequenceAt(/** @type {Path} */ (menu?.path)); run(() => { navigator.clipboard?.writeText(text).catch(() => {}) }) }}>
        <span>{t('ids.menu.copy')}</span><span class="ids-menu-seq" lang="ja">{editor.sequenceAt(menu.path)}</span></button>
    </div>
  {/if}
</div>

<style>
  .ids-tree{
    --_ink:var(--ids-ink,light-dark(#1d1d21,#ececf1));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#696973,#9c9ca8));--_line:var(--ids-line,light-dark(#d8d8de,#3a3a43));
    --_line-strong:var(--ids-line-strong,light-dark(#b0b0ba,#5c5c67));--_surface:var(--ids-surface,light-dark(#fff,#202026));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f5f5f7,#18181d));--_surface-selected:var(--ids-surface-selected,light-dark(#e8e8ee,#30303a));
    --_accent:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));--_accent-light:var(--ids-accent-light,light-dark(#e7edfc,#24304f));
    --_focus:var(--ids-focus,light-dark(#2f5fd0,#8fb0ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Parts","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",sans-serif);
    position:relative;display:grid;place-items:center;min-width:0;min-height:0;padding:16px;color:var(--_ink)}
  .ids-tree-root{display:grid;width:min(100%,420px);max-height:100%}
  :where(.ids-tree) button{font:inherit;color:inherit;border:1px solid var(--_line);border-radius:6px;background:var(--_surface);cursor:pointer}
  :where(.ids-tree) button:disabled{cursor:default;opacity:.55}
  :where(.ids-tree) button:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-node{position:relative;display:flex;flex-direction:column;min-width:0;padding:24px 6px 6px;border:1.5px dashed var(--_line-strong);border-radius:10px;
    transition:border-color .12s,background-color .12s}
  .ids-node.chosen{border-style:solid;border-color:var(--_accent);background:var(--_accent-light)}
  .ids-node.over{border-style:solid;border-color:var(--_accent)}
  .ids-head{position:absolute;top:3px;left:4px;right:4px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}
  .ids-head button{pointer-events:auto}
  .ids-op{display:grid;place-items:center;padding:1px 3px;border-color:transparent;background:none}
  .ids-op:hover,.ids-op[aria-pressed="true"]{border-color:var(--_accent)}
  .ids-unwrap{padding:0 5px;font-size:13px;line-height:1.2;color:var(--_muted);border-color:transparent;background:none}
  .ids-unwrap:not(:disabled):hover{color:var(--_fault);border-color:var(--_fault)}
  .ids-parts{flex:1;display:flex;gap:6px;min-width:0}
  .ids-cell{flex:1;display:grid;min-width:0}
  .row > .ids-parts{flex-direction:row}
  .column > .ids-parts,.stack > .ids-parts{flex-direction:column}
  /* An enclosure: the first part fills the box, its glyph on the closed side, and the second sits
     inside it where the operator puts it, leaving a band of the first open around it. */
  .enclosure > .ids-parts{display:grid;gap:0;grid-template-columns:44px minmax(min-content,1fr) 44px;grid-template-rows:44px minmax(min-content,1fr) 44px}
  .enclosure > .ids-parts > .ids-cell[data-index="0"]{grid-area:1/1/4/4}
  .enclosure > .ids-parts > .ids-cell[data-index="1"]{z-index:1;margin:4px}
  .enclosure > .ids-parts > .ids-cell[data-index="1"] > .ids-part{background:var(--_surface)}
  .enclosure > .ids-parts > .ids-cell[data-index="0"] > .ids-part{font-size:26px;padding:2px 8px}
  [data-op="⿴"] > .ids-parts > [data-index="1"]{grid-area:2/2/3/3}
  [data-op="⿵"] > .ids-parts > [data-index="1"]{grid-area:2/2/4/3}
  [data-op="⿶"] > .ids-parts > [data-index="1"]{grid-area:1/2/3/3}
  [data-op="⿷"] > .ids-parts > [data-index="1"]{grid-area:2/2/3/4}
  [data-op="⿸"] > .ids-parts > [data-index="1"]{grid-area:2/2/4/4}
  [data-op="⿹"] > .ids-parts > [data-index="1"]{grid-area:2/1/4/3}
  [data-op="⿺"] > .ids-parts > [data-index="1"]{grid-area:1/2/3/4}
  [data-op="⿼"] > .ids-parts > [data-index="1"]{grid-area:2/1/3/3}
  [data-op="⿽"] > .ids-parts > [data-index="1"]{grid-area:1/1/3/3}
  [data-op="⿴"] > .ids-parts > [data-index="0"] > .ids-part,
  [data-op="⿸"] > .ids-parts > [data-index="0"] > .ids-part{place-items:start start}
  [data-op="⿵"] > .ids-parts > [data-index="0"] > .ids-part{place-items:start center}
  [data-op="⿶"] > .ids-parts > [data-index="0"] > .ids-part{place-items:end center}
  [data-op="⿷"] > .ids-parts > [data-index="0"] > .ids-part{place-items:center start}
  [data-op="⿼"] > .ids-parts > [data-index="0"] > .ids-part{place-items:center end}
  [data-op="⿹"] > .ids-parts > [data-index="0"] > .ids-part{place-items:start end}
  [data-op="⿺"] > .ids-parts > [data-index="0"] > .ids-part{place-items:end start}
  [data-op="⿽"] > .ids-parts > [data-index="0"] > .ids-part{place-items:end end}
  .ids-part{display:grid;place-items:center;min-width:44px;min-height:var(--ids-part-height,52px);padding:2px 6px;font-size:var(--ids-part-size,32px);line-height:1.1;
    font-family:var(--_font);color:var(--_ink);background:var(--_surface);border:1px solid var(--_line);border-radius:8px}
  .ids-part:not(:disabled):hover{border-color:var(--_line-strong)}
  .ids-part.empty{font-size:20px;color:var(--_muted);border-style:dashed;border-color:var(--_line-strong);background:transparent}
  .ids-tree-root > .ids-part{aspect-ratio:1;font-size:min(30vw,140px);min-height:120px}
  .ids-tree-root > .ids-part.empty{font-size:48px}
  .ids-part.chosen{border:2px solid var(--_accent);padding:1px 5px;background:var(--_accent-light)}
  .ids-part.over{border:2px solid var(--_accent);border-style:solid}

  .ids-menu{position:fixed;z-index:50;display:flex;flex-direction:column;gap:2px;width:max-content;max-width:260px;padding:6px;
    border:1px solid var(--_line);border-radius:10px;background:var(--_surface);box-shadow:0 10px 30px rgb(0 0 0 / .18)}
  .ids-menu-title{margin:2px 6px 4px;font-size:11px;color:var(--_muted)}
  .ids-menu-ops{display:grid;grid-template-columns:repeat(6,32px);gap:2px}
  .ids-menu-op{display:grid;place-items:center;height:30px;padding:0;border-color:transparent !important;background:none !important}
  .ids-menu-op:hover,.ids-menu-op:focus-visible{background:var(--_accent-light) !important}
  .ids-menu-sep{height:1px;margin:4px 2px;background:var(--_line)}
  .ids-menu-item{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:6px 8px;font-size:13px;text-align:left;
    border-color:transparent !important;background:none !important}
  .ids-menu-item:not(:disabled):hover,.ids-menu-item:focus-visible{background:var(--_surface-selected) !important}
  .ids-menu-item kbd,.ids-menu-seq{font:12px ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--_muted)}
  .ids-menu-seq{font-family:var(--_font);font-size:14px}
</style>
