<script>
  import { LONGEST, isDescription, nextEmpty, parse, place, sameTree, write } from '../core/ids.js'
  import { normalizeMarks } from '../core/marks.js'
  import { pyramidSequence } from '../core/pyramid.js'
  import { enclosedRepeatSequence, parseRepeatRows, repeatSequence } from '../core/repeat.js'
  import { STRUCTURE_TEMPLATES } from '../core/templates.js'
  import { templateDiagram } from './template-diagram.js'

  /** @type {{ editor: import('./editor.svelte.js').Editor }} */
  let { editor } = $props()
  const t = $derived(editor.t)
  const uid = $props.id()
  const groups = [2, 3, 4].map(slots => ({ slots, templates: STRUCTURE_TEMPLATES.filter(item => item.slots === slots)
    .map(item => ({ ...item, shapes: templateDiagram(item.sequence) })) }))
  const MIN_PYRAMID = 3, MAX_PYRAMID = 24
  const COMMON_PYRAMIDS = [3, 4, 5, 6, 8]
  const PYRAMID_ROWS = Array.from({ length: MAX_PYRAMID - MIN_PYRAMID + 1 }, (_, i) => i + MIN_PYRAMID)
  let reverse = $state(false)
  const pyramidTemplates = $derived(COMMON_PYRAMIDS.map(layers => ({ layers, shapes: templateDiagram(pyramidSequence('口', layers, { reverse })) })))
  /** @param {number} layers */
  const pyramidLabel = layers => reverse
    ? t('ids.templates.pyramidInsertReverse', { layers, part: generatorPart })
    : t('ids.templates.pyramidInsert', { layers, part: generatorPart })
  let typedComponent = $state(/** @type {string | null} */ (null))
  const generatorPart = $derived(typedComponent ?? (typeof editor.picked === 'string' ? editor.picked : '口'))
  /** @param {string} part */
  const componentSupported = part => {
    try { repeatSequence(part, [2, 3]); return true } catch { return false }
  }
  const pyramidPartSupported = $derived.by(() => {
    try {
      const tree = parse(pyramidSequence(generatorPart, 3), { open: true }).tree
      return tree !== undefined && sameTree(normalizeMarks(tree), tree)
    } catch { return false }
  })
  const pyramidTarget = $derived(editor.chosen ?? (editor.tree === null ? [] : nextEmpty(editor.tree)))
  const availablePyramids = $derived.by(() => {
    const available = new Set()
    if (pyramidTarget === null || !pyramidPartSupported) return available
    try {
      for (const layers of PYRAMID_ROWS) {
        const found = parse(pyramidSequence(generatorPart, layers, { reverse }), { open: true })
        if (!found.tree) continue
        const next = place(editor.tree, pyramidTarget, found.tree).tree
        if (next === null) continue
        const text = write(next), draft = parse(text, { open: true })
        const fits = !draft.problem && (nextEmpty(next) === null ? isDescription(text) : [...text].length <= LONGEST)
        if (fits) available.add(layers)
      }
    } catch { /* the selected component cannot be a pyramid cell */ }
    return available
  })
  let customLayers = $state(5)
  const customNumber = $derived(Math.trunc(Number(customLayers)))
  const customValid = $derived(Number.isInteger(Number(customLayers)) && customNumber >= MIN_PYRAMID && customNumber <= MAX_PYRAMID && availablePyramids.has(customNumber))
  /** @param {number} layers */
  function addPyramid(layers) {
    if (editor.disabled || !availablePyramids.has(layers)) return
    const found = parse(pyramidSequence(generatorPart, layers, { reverse }), { open: true })
    if (!found.tree) return
    editor.put(found.tree, pyramidTarget, pyramidLabel(layers))
  }

  const REPEATS = /** @type {[number, number][]} */ ([[2, 3], [3, 3], [2, 4], [4, 4]])
  const repeatTemplates = REPEATS.map(rows => ({ rows, key: rows.join('+'), shapes: templateDiagram(repeatSequence('口', rows)) }))
  let repeatBottomTyped = $state('')
  const repeatBottom = $derived(repeatBottomTyped.trim() || generatorPart)
  const repeatPartsSupported = $derived(componentSupported(generatorPart) && componentSupported(repeatBottom))
  const repeatTarget = $derived(editor.chosen ?? (editor.tree === null ? [] : nextEmpty(editor.tree)))
  /** @param {import('../core/ids.js').Part} tree */
  const fits = tree => {
    if (repeatTarget === null) return false
    const next = place(editor.tree, repeatTarget, tree).tree
    if (next === null) return false
    const text = write(next), draft = parse(text, { open: true })
    return !draft.problem && (nextEmpty(next) === null ? isDescription(text) : [...text].length <= LONGEST)
  }
  const availableRepeats = $derived.by(() => {
    const available = new Set()
    if (repeatTarget === null || !repeatPartsSupported) return available
    try {
      for (const rows of REPEATS) {
        const found = parse(repeatSequence(generatorPart, rows, { bottom: repeatBottom }), { open: true })
        if (found.tree && fits(found.tree)) available.add(rows.join('+'))
      }
    } catch { /* the selected component cannot fill a repeat cell */ }
    return available
  })
  /** @param {number[]} rows */
  const repeatLabel = rows => {
    const text = rows.join(' + ')
    return repeatBottom === generatorPart
      ? t('ids.templates.repeatInsert', { rows: text, part: generatorPart })
      : t('ids.templates.repeatInsertTwo', { rows: text, top: generatorPart, bottom: repeatBottom })
  }
  /** @param {[number, number]} rows */
  const repeatTitle = rows => !repeatPartsSupported
    ? t('ids.templates.repeatUnsupported')
    : repeatTarget === null ? t('ids.templates.repeatTarget')
    : availableRepeats.has(rows.join('+')) ? repeatLabel(rows) : t('ids.templates.repeatTooLong')
  /** @param {[number, number]} rows */
  function addRepeat(rows) {
    if (editor.disabled || !availableRepeats.has(rows.join('+'))) return
    const found = parse(repeatSequence(generatorPart, rows, { bottom: repeatBottom }), { open: true })
    if (!found.tree) return
    editor.put(found.tree, repeatTarget, repeatLabel(rows))
  }
  let customRowsTyped = $state('')
  const customRows = $derived(parseRepeatRows(customRowsTyped))
  const customRepeatAvailable = $derived.by(() => {
    if (!customRows || repeatTarget === null || !repeatPartsSupported) return false
    try {
      const found = parse(repeatSequence(generatorPart, customRows, { bottom: repeatBottom }), { open: true })
      return found.tree !== undefined && fits(found.tree)
    } catch { return false }
  })
  const customRepeatTitle = $derived(!repeatPartsSupported
    ? t('ids.templates.repeatUnsupported')
    : !customRows ? (customRowsTyped.trim() ? t('ids.templates.repeatRowsInvalid') : t('ids.templates.repeatRowsHint'))
    : repeatTarget === null ? t('ids.templates.repeatTarget')
    : customRepeatAvailable ? repeatLabel(customRows) : t('ids.templates.repeatTooLong'))
  function addCustomRepeat() {
    if (editor.disabled || !customRows || !customRepeatAvailable) return
    const found = parse(repeatSequence(generatorPart, customRows, { bottom: repeatBottom }), { open: true })
    if (!found.tree) return
    editor.put(found.tree, repeatTarget, repeatLabel(customRows))
  }

  const FIVE_ROWS = [2, 1, 2]
  const fiveTemplates = /** @type {{ key: '212' | 'enclosed', shapes: ReturnType<typeof templateDiagram> }[]} */ ([
    { key: '212', shapes: templateDiagram(repeatSequence('口', FIVE_ROWS)) },
    { key: 'enclosed', shapes: templateDiagram(enclosedRepeatSequence('囗', '口')) },
  ])
  let fiveHostTyped = $state('')
  const fiveHost = $derived(fiveHostTyped.trim() || '囗')
  const fivePartSupported = $derived(componentSupported(generatorPart))
  const fiveHostSupported = $derived.by(() => {
    try { enclosedRepeatSequence(fiveHost, generatorPart); return true } catch { return false }
  })
  const availableFive = $derived.by(() => {
    const available = new Set()
    if (repeatTarget === null || !fivePartSupported) return available
    try {
      const inner = parse(repeatSequence(generatorPart, FIVE_ROWS)).tree
      if (inner !== undefined && fits(inner)) available.add('212')
      const enclosed = parse(enclosedRepeatSequence(fiveHost, generatorPart)).tree
      if (fiveHostSupported && enclosed !== undefined && fits(enclosed)) available.add('enclosed')
    } catch { /* the selected component cannot fill a five-copy layout */ }
    return available
  })
  /** @param {'212' | 'enclosed'} key */
  const fiveTitle = key => !fivePartSupported
    ? t('ids.templates.fiveUnsupported')
    : repeatTarget === null ? t('ids.templates.fiveTarget')
    : key === 'enclosed' && !fiveHostSupported ? t('ids.templates.fiveHostUnsupported')
    : availableFive.has(key) ? fiveLabel(key) : t('ids.templates.fiveTooLong')
  /** @param {'212' | 'enclosed'} key */
  const fiveLabel = key => key === '212'
    ? t('ids.templates.fiveInsert', { part: generatorPart })
    : t('ids.templates.fiveInsertEnclosed', { part: generatorPart, host: fiveHost })
  /** @param {'212' | 'enclosed'} key */
  function addFive(key) {
    if (editor.disabled || !availableFive.has(key)) return
    const sequence = key === '212' ? repeatSequence(generatorPart, FIVE_ROWS) : enclosedRepeatSequence(fiveHost, generatorPart)
    const found = parse(sequence, { open: true })
    if (!found.tree) return
    editor.put(found.tree, repeatTarget, fiveLabel(key))
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
      aria-invalid={!componentSupported(generatorPart)} aria-describedby={`${uid}-generator-hint ${uid}-pyramid-hint ${uid}-repeat-hint ${uid}-five-hint`}
      spellcheck="false" autocomplete="off" />
    <span class="ids-pyramid-hint" id={`${uid}-generator-hint`}>{t('ids.templates.generatorPartHint')}</span>
  </div>
  <div class="ids-pyramid" role="group" aria-labelledby={`${uid}-pyramids`}>
    <div class="ids-pyramid-head">
      <span class="ids-template-label" id={`${uid}-pyramids`}>{t('ids.templates.pyramids')}</span>
      <label class="ids-pyramid-reverse"><input type="checkbox" bind:checked={reverse} disabled={editor.disabled} />{t('ids.templates.pyramidReverse')}</label>
      <span class="ids-pyramid-hint" id={`${uid}-pyramid-hint`} role="status">{!pyramidPartSupported ? t('ids.templates.pyramidUnsupported') : pyramidTarget === null ? t('ids.templates.pyramidTarget') : availablePyramids.size ? t('ids.templates.pyramidHint') : t('ids.templates.pyramidTooLong')}</span>
    </div>
    <div class="ids-pyramid-grid">
      {#each pyramidTemplates as template (template.layers)}
        <button type="button" disabled={editor.disabled || !availablePyramids.has(template.layers)} data-pyramid={template.layers}
          aria-label={availablePyramids.has(template.layers) ? pyramidLabel(template.layers) : t('ids.templates.pyramidTooLong')}
          title={availablePyramids.has(template.layers) ? pyramidLabel(template.layers) : t('ids.templates.pyramidTooLong')}
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
      <span class="ids-pyramid-hint" id={`${uid}-repeat-hint`} role="status">{!repeatPartsSupported ? t('ids.templates.repeatUnsupported') : repeatTarget === null ? t('ids.templates.repeatTarget') : availableRepeats.size ? t('ids.templates.repeatHint') : t('ids.templates.repeatTooLong')}</span>
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
      <input id={`${uid}-repeat-bottom`} class="ids-pyramid-part" type="text" value={repeatBottomTyped} placeholder={generatorPart}
        oninput={event => repeatBottomTyped = event.currentTarget.value} disabled={editor.disabled}
        title={t('ids.templates.repeatBottomHint')} aria-invalid={repeatBottomTyped.trim() !== '' && !componentSupported(repeatBottom)}
        aria-describedby={`${uid}-repeat-hint`} spellcheck="false" autocomplete="off" />
    </div>
    <form class="ids-pyramid-custom ids-repeat-custom" onsubmit={event => { event.preventDefault(); addCustomRepeat() }}>
      <label class="ids-pyramid-custom-label" for={`${uid}-repeat-rows`}>{t('ids.templates.repeatCustom')}</label>
      <input id={`${uid}-repeat-rows`} type="text" value={customRowsTyped} placeholder="2 3"
        oninput={event => customRowsTyped = event.currentTarget.value} disabled={editor.disabled}
        aria-invalid={customRowsTyped.trim() !== '' && !customRows}
        aria-describedby={`${uid}-repeat-rows-hint`} spellcheck="false" autocomplete="off" />
      <button type="submit" data-repeat-custom disabled={editor.disabled || !customRepeatAvailable}
        title={customRepeatTitle} aria-label={customRepeatTitle}>{t('ids.templates.repeatAdd')}</button>
      <span class="ids-pyramid-hint ids-repeat-rows-hint" id={`${uid}-repeat-rows-hint`}>{customRowsTyped.trim() && !customRows ? t('ids.templates.repeatRowsInvalid') : t('ids.templates.repeatRowsHint')}</span>
    </form>
  </div>
  <div class="ids-pyramid ids-five" role="group" aria-labelledby={`${uid}-five`}>
    <div class="ids-pyramid-head">
      <span class="ids-template-label" id={`${uid}-five`}>{t('ids.templates.five')}</span>
      <span class="ids-pyramid-hint" id={`${uid}-five-hint`} role="status">{!fivePartSupported ? t('ids.templates.fiveUnsupported') : repeatTarget === null ? t('ids.templates.fiveTarget') : fiveHostTyped.trim() !== '' && !fiveHostSupported ? t('ids.templates.fiveHostUnsupported') : availableFive.size ? t('ids.templates.fiveHint') : t('ids.templates.fiveTooLong')}</span>
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
        aria-describedby={`${uid}-five-hint`} spellcheck="false" autocomplete="off" />
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
  .ids-pyramid-hint{font-size:11px;color:var(--ids-muted,light-dark(#696973,#9c9ca8))}
  .ids-pyramid-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
  .ids-repeat-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
  .ids-repeat-custom input{width:84px;text-align:center;font-variant-numeric:tabular-nums}
  .ids-repeat-rows-hint{flex-basis:100%}
  .ids-five-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ids-pyramid-grid button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;height:56px;padding:0;font-size:12px;font-variant-numeric:tabular-nums}
  .ids-pyramid-size{font-size:10px;line-height:1;color:var(--ids-muted,light-dark(#696973,#9c9ca8));font-variant-numeric:tabular-nums}
  .ids-pyramid-custom{display:flex;align-items:center;flex-wrap:wrap;gap:5px;min-width:0}
  .ids-pyramid-custom input.ids-pyramid-part{font-family:var(--ids-font,serif);font-size:18px;text-align:center}
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
