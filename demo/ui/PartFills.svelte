<script>
  // The components of the output and the fill each one carries. A component without a fill takes
  // the drawing's ink; opening one writes the document through the session, so a fill is undoable
  // and travels with its layer.
  import Dialog from './Dialog.svelte'
  import FillPicker from './FillPicker.svelte'
  import Icon from './Icon.svelte'

  /** @type {{ session: import('../../src/document/index.js').DocumentSession | null, version?: number, chosen?: number[] | null, disabled?: boolean, t: (key: string, params?: Record<string, string | number>) => string, onchoose?: ((path: number[]) => void) | null, onchange?: () => void }} */
  let { session, version = 0, chosen = null, disabled = false, t, onchoose = null, onchange = () => {} } = $props()

  const uid = $props.id()
  let open = $state(false)
  let openId = $state(/** @type {string | null} */ (null))
  let anchor = $state(/** @type {HTMLElement | null} */ (null))
  let ink = $state('#000000')
  let editKey = ''
  let picks = 0

  const parts = $derived.by(() => {
    void version
    const document = session?.document
    if (!document) return []
    /** @type {{ id: string, char: string, fill: import('../../src/document/fill.js').Fill | null, path: number[] }[]} */
    const out = []
    /** @param {import('../../src/document/model.js').Node} node @param {number[]} path */
    const walk = (node, path) => {
      if (node.kind === 'component') {
        out.push({ id: node.id, char: node.char, fill: node.fill ?? null, path })
        return
      }
      if (node.kind === 'operator') node.children.forEach((child, index) => walk(child, [...path, index]))
      else if (node.kind === 'group') walk(node.child, path)
    }
    walk(document.root, [])
    return out
  })

  const current = $derived(openId ? parts.find(part => part.id === openId) ?? null : null)

  $effect(() => {
    if (!open) openId = null
  })

  /** @param {number[]} path */
  const isChosen = path => Boolean(chosen && chosen.length === path.length && chosen.every((step, index) => step === path[index]))

  /** @param {HTMLElement} element */
  function inkOf(element) {
    const colour = getComputedStyle(element).color
    return colour || '#000000'
  }

  /** @param {{ id: string, path: number[] }} part @param {HTMLElement} element */
  function pick(part, element) {
    if (!session || disabled) return
    if (session.choose(part.id)) {
      onchoose?.(part.path)
      onchange()
    }
    openId = part.id
    anchor = element
    ink = inkOf(element)
    editKey = `fill-${++picks}`
    open = true
  }

  /** @param {import('../../src/document/fill.js').Fill} fill */
  function apply(fill) {
    if (!session || !current) return
    try {
      session.setFill(fill, current.id, { coalesce: editKey })
      onchange()
    } catch { /* the layer may have left the document while the panel was open */ }
  }

  function inherit() {
    if (!session || !current) return
    try {
      session.setFill(null, current.id)
      onchange()
    } catch { /* as above */ }
  }
</script>

{#if parts.length}
  <section class="part-fills" aria-labelledby="{uid}-title">
    <h3 id="{uid}-title">{t('app.fills.title')}</h3>
    <ul>
      {#each parts as part (part.id)}
        <li class:chosen={isChosen(part.path)}>
          <button type="button" class="row" aria-haspopup="dialog" aria-expanded={open && openId === part.id} disabled={disabled}
            aria-label={`${t('app.fills.pick', { part: part.char })}${part.path.length ? ` · ${part.path.join('.')}` : ''}`} aria-describedby="{uid}-value-{part.id}"
            title={disabled ? t('app.fills.unavailable') : t('app.fills.pick', { part: part.char })}
            onclick={event => pick(part, event.currentTarget)}>
            <span class="glyph" aria-hidden="true">{part.char}</span>
            {#if part.path.length}<span class="path" aria-hidden="true">{part.path.join('.')}</span>{/if}
            <span class="swatch" class:inherit={!part.fill} style:--fill={part.fill?.colour ?? 'var(--ui-color-ink)'} aria-hidden="true"></span>
            <span class="value" id="{uid}-value-{part.id}">{part.fill ? part.fill.colour.toUpperCase() : t('app.fills.textColour')}</span>
          </button>
          {#if part.fill}
            <button type="button" class="clear" disabled={disabled} title={disabled ? t('app.fills.unavailable') : t('app.fills.clear', { part: part.char })} aria-label={t('app.fills.clear', { part: part.char })}
              onclick={() => { if (session) try { session.setFill(null, part.id); onchange() } catch { /* gone */ } }}><Icon name="close" size={12} /></button>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<Dialog bind:open title={t('app.fills.fill')} closeLabel={t('app.close')} popover narrow {anchor}>
  {#if current}
    {#key current.id}
      <FillPicker fill={current.fill} {ink} {t} onchange={apply} oninherit={inherit} />
    {/key}
  {/if}
</Dialog>

<style>
  .part-fills{display:flex;flex-direction:column;gap:6px;min-width:0}
  h3{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-semibold);letter-spacing:.03em}
  ul{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none;max-height:164px;overflow:auto;scrollbar-width:thin}
  li{display:flex;align-items:center;gap:2px;min-width:0;border-radius:var(--ui-radius-md)}
  li.chosen{background:var(--ui-color-accent-soft)}
  .row{display:flex;align-items:center;gap:9px;flex:1;min-width:0;height:34px;padding:0 8px;border:0;border-radius:var(--ui-radius-md);background:none;color:var(--ui-color-ink);font:inherit;text-align:left;cursor:pointer}
  .row:hover:not(:disabled){background:var(--ui-color-surface-hover)}
  .row:disabled{cursor:default;opacity:.55}
  li.chosen .row:hover{background:transparent}
  .row:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-2px}
  .glyph{flex:none;width:1.4em;font-family:var(--cjk);font-size:19px;line-height:1;text-align:center}
  .path{flex:none;font-family:var(--ui-font-mono);font-size:9.5px;color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  .swatch{flex:none;width:20px;height:20px;border-radius:50%;box-shadow:inset 0 0 0 1px rgb(0 0 0 / .18);
    background-image:linear-gradient(var(--fill),var(--fill)),repeating-conic-gradient(#cfcfd6 0 25%,#fff 0 50%);background-size:auto,7px 7px}
  .swatch.inherit{background-image:none;background-color:transparent;box-shadow:inset 0 0 0 1.5px var(--ui-color-ink)}
  .value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ui-font-mono);font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  li.chosen .value{color:var(--ui-color-ink)}
  .clear{flex:none;display:grid;place-items:center;width:26px;height:26px;margin-right:4px;padding:0;border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink-muted);cursor:pointer}
  .clear:hover:not(:disabled){background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  .clear:disabled{cursor:default;opacity:.45}
  .clear:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-1px}
</style>
