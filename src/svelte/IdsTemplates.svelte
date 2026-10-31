<script>
  import { EMPTY, isDescription, nextEmpty, parse, place, write } from '../core/ids.js'
  import { pyramidSequence } from '../core/pyramid.js'
  import { enclosedRepeatSequence, parseRepeatRows, repeatSequence } from '../core/repeat.js'
  import { STRUCTURE_TEMPLATES } from '../core/templates.js'
  import { pyramidDiagram, templateDiagram } from './template-diagram.js'

  /** @type {{ editor: import('./editor.svelte.js').Editor }} */
  let { editor } = $props()
  const t = $derived(editor.t)
  const uid = $props.id()
  const groups = [2, 3, 4].map(slots => ({ slots, templates: STRUCTURE_TEMPLATES.filter(item => item.slots === slots)
    .map(item => ({ ...item, shapes: templateDiagram(item.sequence) })) }))
  const MIN_PYRAMID = 2, MAX_PYRAMID = 24
  // Sizes offered as one-click buttons; the Rows field takes any other count.
  const PYRAMID_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 24]
  let reverse = $state(false)
  let typedComponent = $state(/** @type {string | null} */ (null))
  // The part every generator repeats: a typed part, or the chosen part of the tree.
  const generatorPart = $derived(typedComponent ?? (editor.picked === undefined ? '口' : write(editor.picked)))
  /** What a label or title shows for a part: ⬚ for the empty slot an empty field describes. @param {string} part */
  const partName = part => part.trim() || EMPTY
  /** Whether `part` can stand as one repeated part: a component, a description, ⬚ or nothing. @param {string} part */
  const partSupported = part => {
    try { pyramidSequence(part, 2); return true } catch { return false }
  }
  // Where a generated layout goes: the chosen part, or the first empty slot.
  const target = $derived(editor.chosen ?? (editor.tree === null ? [] : nextEmpty(editor.tree)))
  /** Whether `tree` fits where `target` is: a whole description once every slot is filled, else a draft. @param {import('../core/ids.js').Part} tree */
  const fits = tree => {
    if (target === null) return false
    const next = place(editor.tree, target, tree).tree
    if (next === null) return false
    const text = write(next), draft = parse(text, { open: true })
    // A whole description must read as one, its length limit and pyramid allowance included; a
    // draft of empty slots stays editable up to `PYRAMID_LONGEST`.
    return !draft.problem && (nextEmpty(next) !== null || isDescription(text))
  }

  const pyramidTemplates = $derived(PYRAMID_SIZES.map(layers => ({ layers, shapes: pyramidDiagram(layers, { reverse }) })))
  /** @param {number} layers */
  const pyramidLabel = layers => reverse
    ? t('ids.templates.pyramidInsertReverse', { layers, part: partName(generatorPart) })
    : t('ids.templates.pyramidInsert', { layers, part: partName(generatorPart) })
  const pyramidPartSupported = $derived(partSupported(generatorPart))
  let customLayers = $state(5)
  const customNumber = $derived(Math.trunc(Number(customLayers)))
  const availablePyramids = $derived.by(() => {
    const available = new Set()
    if (target === null || !pyramidPartSupported) return available
    // The preset sizes, and whichever count Custom asks for.
    const sizes = new Set([...PYRAMID_SIZES, Number.isSafeInteger(customNumber) ? customNumber : 0])
    for (const layers of sizes) {
      if (layers < MIN_PYRAMID || layers > MAX_PYRAMID) continue
      try {
        const found = parse(pyramidSequence(generatorPart, layers, { reverse }), { open: true })
        if (found.tree !== undefined && fits(found.tree)) available.add(layers)
      } catch { /* too long for the slot, or unreadable */ }
    }
    return available
  })
  const customValid = $derived(Number.isInteger(Number(customLayers)) && customNumber >= MIN_PYRAMID && customNumber <= MAX_PYRAMID && availablePyramids.has(customNumber))
  /** What a size button says when it cannot insert, as its tooltip. @param {number} layers */
  const pyramidTitle = layers => availablePyramids.has(layers) ? pyramidLabel(layers)
    : !pyramidPartSupported ? t('ids.templates.pyramidUnsupported')
    : target === null ? t('ids.templates.pyramidTarget')
    : t('ids.templates.pyramidTooLong')
  /** @param {number} layers */
  function addPyramid(layers) {
    if (editor.disabled || !availablePyramids.has(layers)) return
    const found = parse(pyramidSequence(generatorPart, layers, { reverse }), { open: true })
    if (!found.tree) return
    editor.put(found.tree, target, pyramidLabel(layers))
  }

  const REPEATS = /** @type {[number, number][]} */ ([[2, 3], [3, 3], [2, 4], [4, 4]])
  const repeatTemplates = REPEATS.map(rows => ({ rows, key: rows.join('+'), shapes: templateDiagram(repeatSequence('口', rows)) }))
  let repeatBottomTyped = $state('')
  const repeatBottom = $derived(repeatBottomTyped.trim() || generatorPart)
  const repeatPartsSupported = $derived(partSupported(generatorPart) && partSupported(repeatBottom))
  const availableRepeats = $derived.by(() => {
    const available = new Set()
    if (target === null || !repeatPartsSupported) return available
    try {
      for (const rows of REPEATS) {
        const found = parse(repeatSequence(generatorPart, rows, { bottom: repeatBottom }), { open: true })
        if (found.tree && fits(found.tree)) available.add(rows.join('+'))
      }
    } catch { /* this part cannot fill a row */ }
    return available
  })
  /** @param {number[]} rows */
  const repeatLabel = rows => {
    const text = rows.join(' + ')
    return repeatBottom === generatorPart
      ? t('ids.templates.repeatInsert', { rows: text, part: partName(generatorPart) })
      : t('ids.templates.repeatInsertTwo', { rows: text, top: partName(generatorPart), bottom: partName(repeatBottom) })
  }
  /** @param {[number, number]} rows */
  const repeatTitle = rows => !repeatPartsSupported
    ? t('ids.templates.repeatUnsupported')
    : target === null ? t('ids.templates.repeatTarget')
    : availableRepeats.has(rows.join('+')) ? repeatLabel(rows) : t('ids.templates.repeatTooLong')
  /** @param {[number, number]} rows */
  function addRepeat(rows) {
    if (editor.disabled || !availableRepeats.has(rows.join('+'))) return
    const found = parse(repeatSequence(generatorPart, rows, { bottom: repeatBottom }), { open: true })
    if (!found.tree) return
    editor.put(found.tree, target, repeatLabel(rows))
  }
  let customRowsTyped = $state('')
  const customRows = $derived(parseRepeatRows(customRowsTyped))
  const customRepeatAvailable = $derived.by(() => {
    if (!customRows || target === null || !repeatPartsSupported) return false
    try {
      const found = parse(repeatSequence(generatorPart, customRows, { bottom: repeatBottom }), { open: true })
      return found.tree !== undefined && fits(found.tree)
    } catch { return false }
  })
  const customRepeatTitle = $derived(!repeatPartsSupported
    ? t('ids.templates.repeatUnsupported')
    : !customRows ? (customRowsTyped.trim() ? t('ids.templates.repeatRowsInvalid') : t('ids.templates.repeatRowsHint'))
    : target === null ? t('ids.templates.repeatTarget')
    : customRepeatAvailable ? repeatLabel(customRows) : t('ids.templates.repeatTooLong'))
  function addCustomRepeat() {
    if (editor.disabled || !customRows || !customRepeatAvailable) return
    const found = parse(repeatSequence(generatorPart, customRows, { bottom: repeatBottom }), { open: true })
    if (!found.tree) return
    editor.put(found.tree, target, repeatLabel(customRows))
  }

  const FIVE_ROWS = [2, 1, 2]
  const fiveTemplates = /** @type {{ key: '212' | 'enclosed', shapes: ReturnType<typeof templateDiagram> }[]} */ ([
    { key: '212', shapes: templateDiagram(repeatSequence('口', FIVE_ROWS)) },
    { key: 'enclosed', shapes: templateDiagram(enclosedRepeatSequence('囗', '口')) },
  ])
  let fiveHostTyped = $state('')
  const fiveHost = $derived(fiveHostTyped.trim() || '囗')
  const fivePartSupported = $derived(partSupported(generatorPart))
  const fiveHostSupported = $derived.by(() => {
    try { enclosedRepeatSequence(fiveHost, generatorPart); return true } catch { return false }
  })
  const availableFive = $derived.by(() => {
    const available = new Set()
    if (target === null || !fivePartSupported) return available
    try {
      const inner = parse(repeatSequence(generatorPart, FIVE_ROWS)).tree
      if (inner !== undefined && fits(inner)) available.add('212')
      const enclosed = parse(enclosedRepeatSequence(fiveHost, generatorPart)).tree
      if (fiveHostSupported && enclosed !== undefined && fits(enclosed)) available.add('enclosed')
    } catch { /* this part cannot fill a five-copy layout */ }
    return available
  })
  /** @param {'212' | 'enclosed'} key */
  const fiveTitle = key => !fivePartSupported
    ? t('ids.templates.fiveUnsupported')
    : target === null ? t('ids.templates.fiveTarget')
    : key === 'enclosed' && !fiveHostSupported ? t('ids.templates.fiveHostUnsupported')
    : availableFive.has(key) ? fiveLabel(key) : t('ids.templates.fiveTooLong')
  /** @param {'212' | 'enclosed'} key */
  const fiveLabel = key => key === '212'
    ? t('ids.templates.fiveInsert', { part: partName(generatorPart) })
    : t('ids.templates.fiveInsertEnclosed', { part: partName(generatorPart), host: fiveHost })
  /** @param {'212' | 'enclosed'} key */
  function addFive(key) {
    if (editor.disabled || !availableFive.has(key)) return
    const sequence = key === '212' ? repeatSequence(generatorPart, FIVE_ROWS) : enclosedRepeatSequence(fiveHost, generatorPart)
    const found = parse(sequence, { open: true })
    if (!found.tree) return
    editor.put(found.tree, target, fiveLabel(key))
  }
</script>

<div class="ids-templates">
  {#each groups as group (group.slots)}
    <div class="ids-template-group" role="group" aria-labelledby={`${uid}-${group.slots}`}>
      <span class="ids-template-label" id={`${uid}-${group.slots}`}>{t(`ids.group.${group.slots}`)}</span>
      <div class="ids-template-grid">
        {#each group.templates as template (template.id)}
          <button type="button" disabled={editor.disabled} data-template={template.id}
            aria-label={t('ids.templates.insert', { sequence: template.sequence })} title={`${template.sequence} · ${template.label ? t(`ids.templates.${template.label}`) : t('ids.templates.usage', { count: template.count })}`}
            draggable={!editor.disabled} ondragstart={event => event.dataTransfer?.setData('text/plain', template.sequence)}
            onclick={() => editor.take(template.sequence)}>
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
              {#each template.shapes as shape, i (i)}
                {#if shape.kind === 'slot'}
                  <rect class:accent={shape.accent} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx=".7" />
                {:else}<path class:accent={shape.accent} class:decorative={shape.decorative} d={shape.d} />{/if}
              {/each}
            </svg>
          </button>
        {/each}
      </div>
    </div>
  {/each}
  <div class="ids-pyramid-custom ids-generator-part">
    <label class="ids-pyramid-custom-label" for={`${uid}-generator-part`}>{t('ids.templates.generatorPart')}</label>
    <input id={`${uid}-generator-part`} class="ids-pyramid-part" type="text" value={generatorPart} form={`${uid}-pyramid-form`}
      oninput={event => typedComponent = event.currentTarget.value} disabled={editor.disabled}
      placeholder={EMPTY} aria-invalid={!partSupported(generatorPart)}
      spellcheck="false" autocomplete="off" />
  </div>
  <div class="ids-pyramid" role="group" aria-labelledby={`${uid}-pyramids`}>
    <div class="ids-pyramid-head">
      <span class="ids-template-label" id={`${uid}-pyramids`}>{t('ids.templates.pyramids')}</span>
      <label class="ids-pyramid-reverse"><input type="checkbox" bind:checked={reverse} disabled={editor.disabled} />{t('ids.templates.pyramidReverse')}</label>
    </div>
    <div class="ids-pyramid-sizes">
      {#each pyramidTemplates as template (template.layers)}
        <button type="button" disabled={editor.disabled || !availablePyramids.has(template.layers)} data-pyramid={template.layers}
          aria-label={pyramidTitle(template.layers)} title={pyramidTitle(template.layers)}
          onclick={() => addPyramid(template.layers)}>
          <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
            {#each template.shapes as shape, i (i)}
              {#if shape.kind === 'slot'}
                <rect class:accent={shape.accent} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx=".7" />
              {:else}<path class:accent={shape.accent} class:decorative={shape.decorative} d={shape.d} />{/if}
            {/each}
          </svg>
          <span class="ids-pyramid-size">{template.layers}</span>
        </button>
      {/each}
    </div>
    <form id={`${uid}-pyramid-form`} class="ids-pyramid-custom" onsubmit={event => { event.preventDefault(); if (customValid) addPyramid(customNumber) }}>
      <label class="ids-pyramid-custom-label" for={`${uid}-pyramid-rows`}>{t('ids.templates.pyramidCustom')}</label>
      <input id={`${uid}-pyramid-rows`} type="number" min={MIN_PYRAMID} max={MAX_PYRAMID} step="1" bind:value={customLayers} disabled={editor.disabled}
        aria-invalid={!customValid} placeholder={`${MIN_PYRAMID}–${MAX_PYRAMID}`} />
      <button type="submit" disabled={editor.disabled || !customValid}>{t('ids.templates.pyramidAdd')}</button>
    </form>
  </div>
  <div class="ids-pyramid ids-repeat" role="group" aria-labelledby={`${uid}-repeats`}>
    <div class="ids-pyramid-head">
      <span class="ids-template-label" id={`${uid}-repeats`}>{t('ids.templates.repeats')}</span>
    </div>
    <div class="ids-pyramid-grid ids-repeat-grid">
      {#each repeatTemplates as template (template.key)}
        <button type="button" disabled={editor.disabled || !availableRepeats.has(template.key)} data-repeat={template.key}
          aria-label={repeatTitle(template.rows)} title={repeatTitle(template.rows)}
          onclick={() => addRepeat(template.rows)}>
          <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
            {#each template.shapes as shape, i (i)}
              {#if shape.kind === 'slot'}
                <rect class:accent={shape.accent} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx=".7" />
              {:else}<path class:accent={shape.accent} class:decorative={shape.decorative} d={shape.d} />{/if}
            {/each}
          </svg>
          <span class="ids-pyramid-size">{template.key.replace('+', ' + ')}</span>
        </button>
      {/each}
    </div>
    <div class="ids-pyramid-custom">
      <label class="ids-pyramid-custom-label" for={`${uid}-repeat-bottom`}>{t('ids.templates.repeatBottom')}</label>
      <input id={`${uid}-repeat-bottom`} class="ids-pyramid-part" type="text" value={repeatBottomTyped}
        oninput={event => repeatBottomTyped = event.currentTarget.value} disabled={editor.disabled}
        title={t('ids.templates.repeatBottomHint')} placeholder={partName(generatorPart)} aria-invalid={repeatBottomTyped.trim() !== '' && !partSupported(repeatBottom)}
        spellcheck="false" autocomplete="off" />
    </div>
    <form class="ids-pyramid-custom ids-repeat-custom" onsubmit={event => { event.preventDefault(); addCustomRepeat() }}>
      <label class="ids-pyramid-custom-label" for={`${uid}-repeat-rows`}>{t('ids.templates.repeatCustom')}</label>
      <input id={`${uid}-repeat-rows`} type="text" value={customRowsTyped} placeholder="2 3"
        oninput={event => customRowsTyped = event.currentTarget.value} disabled={editor.disabled}
        aria-invalid={customRowsTyped.trim() !== '' && !customRows}
        spellcheck="false" autocomplete="off" />
      <button type="submit" data-repeat-custom disabled={editor.disabled || !customRepeatAvailable}
        title={customRepeatTitle} aria-label={customRepeatTitle}>{t('ids.templates.repeatAdd')}</button>
    </form>
  </div>
  <div class="ids-pyramid ids-five" role="group" aria-labelledby={`${uid}-five`}>
    <div class="ids-pyramid-head">
      <span class="ids-template-label" id={`${uid}-five`}>{t('ids.templates.five')}</span>
    </div>
    <div class="ids-pyramid-grid ids-five-grid">
      {#each fiveTemplates as template (template.key)}
        <button type="button" disabled={editor.disabled || !availableFive.has(template.key)} data-five={template.key}
          aria-label={fiveTitle(template.key)} title={fiveTitle(template.key)} onclick={() => addFive(template.key)}>
          <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
            {#each template.shapes as shape, i (i)}
              {#if shape.kind === 'slot'}
                <rect class:accent={shape.accent} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx=".7" />
              {:else}<path class:accent={shape.accent} class:decorative={shape.decorative} d={shape.d} />{/if}
            {/each}
          </svg>
          <span class="ids-pyramid-size">{template.key === '212' ? '2 · 1 · 2' : '1 + 2 × 2'}</span>
        </button>
      {/each}
    </div>
    <div class="ids-pyramid-custom">
      <label class="ids-pyramid-custom-label" for={`${uid}-five-host`}>{t('ids.templates.fiveHost')}</label>
      <input id={`${uid}-five-host`} class="ids-pyramid-part" type="text" value={fiveHostTyped} placeholder="囗"
        oninput={event => fiveHostTyped = event.currentTarget.value} disabled={editor.disabled}
        title={t('ids.templates.fiveHostHint')}
        aria-invalid={fiveHostTyped.trim() !== '' && fivePartSupported && !fiveHostSupported}
        spellcheck="false" autocomplete="off" />
    </div>
  </div>
</div>

<style>
  .ids-templates{display:flex;flex-direction:column;gap:12px;padding:4px 0;color:var(--ids-ink,light-dark(#1d1d21,#ececf1))}
  .ids-generator-part{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-top:2px;padding-top:10px;border-top:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43))}
  .ids-pyramid{display:flex;flex-direction:column;gap:6px;margin-top:2px;padding-top:10px;border-top:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43))}
  .ids-pyramid-head{display:flex;align-items:center;flex-wrap:wrap;gap:4px 7px}
  .ids-pyramid-reverse{display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer}
  .ids-pyramid-reverse input{margin:0;accent-color:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff))}
  .ids-pyramid-reverse input:focus-visible{outline:2px solid var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));outline-offset:2px}
  .ids-pyramid-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
  .ids-pyramid-sizes{display:flex;gap:5px;padding-bottom:3px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:var(--ids-line-strong,#b8b8c0) transparent}
  .ids-repeat-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
  .ids-repeat-custom input{width:84px;text-align:center;font-variant-numeric:tabular-nums}
  .ids-five-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ids-pyramid-grid button,.ids-pyramid-sizes button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;height:56px;padding:0;font-size:12px;font-variant-numeric:tabular-nums}
  .ids-pyramid-sizes button{flex:0 0 54px;scroll-snap-align:start}
  .ids-pyramid-size{font-size:10px;line-height:1;color:var(--ids-muted,light-dark(#696973,#9c9ca8));font-variant-numeric:tabular-nums}
  .ids-pyramid-custom{display:flex;align-items:center;flex-wrap:wrap;gap:5px;min-width:0}
  .ids-pyramid-custom input.ids-pyramid-part{flex:1 1 140px;width:auto;min-width:0;font-family:var(--ids-font,serif);font-size:16px;text-align:start}
  .ids-pyramid-custom-label{font-size:11px;color:var(--ids-muted,light-dark(#696973,#9c9ca8))}
  .ids-pyramid-custom input{width:64px;height:30px;padding:0 6px;border:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43));border-radius:8px;background:var(--ids-surface,light-dark(#fff,#202026));font:inherit;font-size:12px;color:inherit;font-variant-numeric:tabular-nums}
  .ids-pyramid-custom input:focus-visible{outline:2px solid var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));outline-offset:1px}
  .ids-pyramid-custom button{height:30px;padding:0 9px;font-size:12px}
  .ids-template-group{display:flex;flex-direction:column;gap:5px;min-width:0}
  .ids-template-label{font-size:11px;color:var(--ids-muted,light-dark(#696973,#9c9ca8))}
  .ids-template-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:5px}
  button{display:grid;place-items:center;height:48px;padding:0;border:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43));
    border-radius:8px;background:var(--ids-surface,light-dark(#fff,#202026));color:inherit;cursor:pointer}
  button:not(:disabled):hover{border-color:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));background:var(--ids-accent-light,light-dark(#e7edfc,#24304f))}
  button:focus-visible{outline:2px solid var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));outline-offset:2px}
  button:disabled{opacity:.55;cursor:default}
  path{fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
  .accent{color:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff))}
  .decorative{stroke-dasharray:1 1;stroke-width:1}
  rect{fill:color-mix(in srgb,currentColor 10%,transparent);stroke:currentColor;stroke-width:1;stroke-dasharray:1.5 1.2}
</style>
