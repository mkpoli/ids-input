<script>
  import { EMPTY, isDescription, nextEmpty, parse, place, write } from '../core/ids.js'
  import { pyramidSequence } from '../core/pyramid.js'
  import { enclosedRepeatSequence, parseRepeatRows, repeatSequence } from '../core/repeat.js'
  import { STRUCTURE_TEMPLATES } from '../core/templates.js'
  import { pyramidDiagram, templateDiagram } from './template-diagram.js'

  /** @type {{ editor: import('./editor.svelte.js').Editor, onpick?: ((sequence: string) => void) | null }} */
  let { editor, onpick = null } = $props()
  // A starter menu picks a sequence for a new tab instead of placing the template in the open document.
  const picking = $derived(onpick !== null)
  /** @param {string} sequence */
  const openLabel = sequence => t('ids.templates.open', { sequence })
  /** A complete layout picked for a new tab must still read as a whole description. @param {string} sequence */
  function usable(sequence) {
    const draft = parse(sequence, { open: true })
    return !draft.problem && draft.tree !== undefined && (nextEmpty(draft.tree) !== null || isDescription(sequence))
  }
  const t = $derived(editor.t)
  const uid = $props.id()
  /** @param {string} sequence */
  const insertLabel = sequence => picking ? openLabel(sequence) : t('ids.templates.insert', { sequence })
  const groups = [2, 3, 4].map(slots => ({ slots, templates: STRUCTURE_TEMPLATES.filter(item => item.slots === slots)
    .map(item => ({ ...item, shapes: templateDiagram(item.sequence) })) }))
  const MIN_PYRAMID = 2, MAX_PYRAMID = 24
  // Sizes offered as one-click buttons; the Layers field takes any other count.
  const PYRAMID_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 24]
  /** @type {('top' | 'bottom' | 'left' | 'right')[]} */
  const DIRECTIONS = ['top', 'bottom', 'left', 'right']
  /** @type {Record<string, string>} */
  const DIRECTION_NAMES = {
    top: 'ids.templates.pyramidTop', bottom: 'ids.templates.pyramidBottom',
    left: 'ids.templates.pyramidLeft', right: 'ids.templates.pyramidRight',
  }
  let direction = $state(/** @type {'top' | 'bottom' | 'left' | 'right'} */ ('top'))
  let typedComponent = $state(/** @type {string | null} */ (null))
  // The part every generator repeats: a typed part, or the chosen part of the tree.
  const generatorPart = $derived(typedComponent ?? (editor.picked === undefined ? '口' : write(editor.picked)))
  /** What a label or title shows for a part: ⬚ for the empty slot an empty field describes. @param {string} part */
  const partName = part => part.trim() || EMPTY
  /** Whether `part` can stand as one repeated part: a component, a description, ⬚ or nothing. @param {string} part */
  const partSupported = part => {
    try { pyramidSequence(part, 2); return true } catch { return false }
  }
  // Where a generated layout goes: the chosen part, else the first empty slot, else the whole
  // description, which an undo brings back.
  const layoutAt = $derived(editor.chosen ?? (editor.tree === null ? null : nextEmpty(editor.tree)) ?? [])
  /**
   * Whether a generated layout fits at `layoutAt`: the result keeps an empty slot to fill, or reads
   * as a whole description within its length limit and pyramid allowance.
   * @param {string} sequence
   */
  const readable = sequence => {
    const found = parse(sequence, { open: true })
    if (found.problem || found.tree === undefined) return false
    const next = place(editor.tree, layoutAt, found.tree).tree
    if (next === null) return false
    const text = write(next)
    return !parse(text, { open: true }).problem && (nextEmpty(next) !== null || isDescription(text))
  }
  /** @param {string} sequence @param {string} label */
  function putLayout(sequence, label) {
    const found = parse(sequence, { open: true })
    if (found.problem || found.tree === undefined) return
    editor.put(found.tree, layoutAt, label)
  }

  const pyramidTemplates = $derived(PYRAMID_SIZES.map(layers => ({ layers, shapes: pyramidDiagram(layers, { direction }) })))
  /** @param {number} layers */
  const pyramidLabel = layers => t(direction === 'bottom' ? 'ids.templates.pyramidInsertBottom'
    : direction === 'left' ? 'ids.templates.pyramidInsertLeft'
    : direction === 'right' ? 'ids.templates.pyramidInsertRight'
    : 'ids.templates.pyramidInsert', { layers, part: partName(generatorPart) })
  const pyramidPartSupported = $derived(partSupported(generatorPart))
  let customLayers = $state(5)
  const customNumber = $derived(Math.trunc(Number(customLayers)))
  const availablePyramids = $derived.by(() => {
    const available = new Set()
    if (!pyramidPartSupported) return available
    // The preset sizes, and whichever count Custom asks for.
    const sizes = new Set([...PYRAMID_SIZES, Number.isSafeInteger(customNumber) ? customNumber : 0])
    for (const layers of sizes) {
      if (layers < MIN_PYRAMID || layers > MAX_PYRAMID) continue
      try {
        const sequence = pyramidSequence(generatorPart, layers, { direction })
        if (picking ? usable(sequence) : readable(sequence)) available.add(layers)
      } catch { /* unreadable */ }
    }
    return available
  })
  const customValid = $derived(Number.isInteger(Number(customLayers)) && customNumber >= MIN_PYRAMID && customNumber <= MAX_PYRAMID && availablePyramids.has(customNumber))
  /** What a size button says when it cannot insert, as its tooltip. @param {number} layers */
  const pyramidTitle = layers => {
    if (picking) {
      if (!pyramidPartSupported) return t('ids.templates.pyramidUnsupported')
      if (!availablePyramids.has(layers)) return t('ids.templates.tooLong')
      try { return openLabel(pyramidSequence(generatorPart, layers, { direction })) }
      catch { return t('ids.templates.tooLong') }
    }
    return availablePyramids.has(layers) ? pyramidLabel(layers)
      : !pyramidPartSupported ? t('ids.templates.pyramidUnsupported')
      : t('ids.templates.tooLong')
  }
  /** @param {number} layers */
  function addPyramid(layers) {
    if (editor.disabled || !availablePyramids.has(layers)) return
    const sequence = pyramidSequence(generatorPart, layers, { direction })
    if (onpick) { onpick(sequence); return }
    putLayout(sequence, pyramidLabel(layers))
  }

  const REPEATS = /** @type {[number, number][]} */ ([[2, 3], [3, 3], [2, 4], [4, 4]])
  const repeatTemplates = REPEATS.map(rows => ({ rows, key: rows.join('+'), shapes: templateDiagram(repeatSequence('口', rows)) }))
  let repeatBottomTyped = $state('')
  const repeatBottom = $derived(repeatBottomTyped.trim() || generatorPart)
  const repeatPartsSupported = $derived(partSupported(generatorPart) && partSupported(repeatBottom))
  const availableRepeats = $derived.by(() => {
    const available = new Set()
    if (!repeatPartsSupported) return available
    try {
      for (const rows of REPEATS) {
        const sequence = repeatSequence(generatorPart, rows, { bottom: repeatBottom })
        if (picking ? usable(sequence) : readable(sequence)) available.add(rows.join('+'))
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
  const repeatTitle = rows => {
    if (!repeatPartsSupported) return t('ids.templates.repeatUnsupported')
    if (picking) {
      if (!availableRepeats.has(rows.join('+'))) return t('ids.templates.tooLong')
      try { return openLabel(repeatSequence(generatorPart, rows, { bottom: repeatBottom })) }
      catch { return t('ids.templates.tooLong') }
    }
    return availableRepeats.has(rows.join('+')) ? repeatLabel(rows) : t('ids.templates.tooLong')
  }
  /** @param {[number, number]} rows */
  function addRepeat(rows) {
    if (editor.disabled || !availableRepeats.has(rows.join('+'))) return
    const sequence = repeatSequence(generatorPart, rows, { bottom: repeatBottom })
    if (onpick) { onpick(sequence); return }
    putLayout(sequence, repeatLabel(rows))
  }
  let customRowsTyped = $state('')
  const customRows = $derived(parseRepeatRows(customRowsTyped))
  const customRepeatAvailable = $derived.by(() => {
    if (!customRows || !repeatPartsSupported) return false
    try {
      const sequence = repeatSequence(generatorPart, customRows, { bottom: repeatBottom })
      return picking ? usable(sequence) : readable(sequence)
    } catch { return false }
  })
  const customRepeatTitle = $derived(!repeatPartsSupported
    ? t('ids.templates.repeatUnsupported')
    : !customRows ? (customRowsTyped.trim() ? t('ids.templates.repeatRowsInvalid') : t('ids.templates.repeatRowsHint'))
    : picking ? (customRepeatAvailable ? openLabel(repeatSequence(generatorPart, customRows, { bottom: repeatBottom })) : t('ids.templates.tooLong'))
    : customRepeatAvailable ? repeatLabel(customRows) : t('ids.templates.tooLong'))
  function addCustomRepeat() {
    if (editor.disabled || !customRows || !customRepeatAvailable) return
    const sequence = repeatSequence(generatorPart, customRows, { bottom: repeatBottom })
    if (onpick) { onpick(sequence); return }
    putLayout(sequence, repeatLabel(customRows))
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
    if (!fivePartSupported) return available
    const fit = picking ? usable : readable
    try {
      if (fit(repeatSequence(generatorPart, FIVE_ROWS))) available.add('212')
      if (fiveHostSupported && fit(enclosedRepeatSequence(fiveHost, generatorPart))) available.add('enclosed')
    } catch { /* this part cannot fill a five-copy layout */ }
    return available
  })
  /** @param {'212' | 'enclosed'} key */
  const fiveTitle = key => {
    if (!fivePartSupported) return t('ids.templates.fiveUnsupported')
    if (key === 'enclosed' && !fiveHostSupported) return t('ids.templates.fiveHostUnsupported')
    if (picking) {
      if (!availableFive.has(key)) return t('ids.templates.tooLong')
      return openLabel(key === '212' ? repeatSequence(generatorPart, FIVE_ROWS) : enclosedRepeatSequence(fiveHost, generatorPart))
    }
    return availableFive.has(key) ? fiveLabel(key) : t('ids.templates.tooLong')
  }
  /** @param {'212' | 'enclosed'} key */
  const fiveLabel = key => key === '212'
    ? t('ids.templates.fiveInsert', { part: partName(generatorPart) })
    : t('ids.templates.fiveInsertEnclosed', { part: partName(generatorPart), host: fiveHost })
  /** @param {'212' | 'enclosed'} key */
  function addFive(key) {
    if (editor.disabled || !availableFive.has(key)) return
    const sequence = key === '212' ? repeatSequence(generatorPart, FIVE_ROWS) : enclosedRepeatSequence(fiveHost, generatorPart)
    if (onpick) { onpick(sequence); return }
    putLayout(sequence, fiveLabel(key))
  }
</script>

<div class="ids-templates">
  {#each groups as group (group.slots)}
    <div class="ids-template-group" role="group" aria-labelledby={`${uid}-${group.slots}`}>
      <span class="ids-template-label" id={`${uid}-${group.slots}`}>{t(`ids.group.${group.slots}`)}</span>
      <div class="ids-template-grid">
        {#each group.templates as template (template.id)}
          <button type="button" disabled={editor.disabled} data-template={template.id} data-sequence={template.sequence}
            aria-label={insertLabel(template.sequence)} title={picking ? openLabel(template.sequence) : `${template.sequence} · ${template.label ? t(`ids.templates.${template.label}`) : t('ids.templates.usage', { count: template.count })}`}
            draggable={!editor.disabled} ondragstart={event => event.dataTransfer?.setData('text/plain', template.sequence)}
            onclick={() => onpick ? onpick(template.sequence) : editor.take(template.sequence)}>
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
      <div class="ids-pyramid-direction" role="group" aria-label={t('ids.templates.pyramidDirection')}>
        {#each DIRECTIONS as option (option)}
          <button type="button" aria-pressed={direction === option} data-direction={option} disabled={editor.disabled}
            aria-label={t(DIRECTION_NAMES[option])} title={t(DIRECTION_NAMES[option])}
            onclick={() => direction = option}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              {#each pyramidDiagram(2, { direction: option }) as shape, i (i)}
                {#if shape.kind === 'slot'}
                  <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx=".7" />
                {/if}
              {/each}
            </svg>
          </button>
        {/each}
      </div>
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
      <button type="submit" disabled={editor.disabled || !customValid}
        title={picking && customValid ? openLabel(pyramidSequence(generatorPart, customNumber, { direction })) : undefined}
        aria-label={picking && customValid ? openLabel(pyramidSequence(generatorPart, customNumber, { direction })) : undefined}>{t('ids.templates.pyramidAdd')}</button>
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
  .ids-templates{display:flex;flex-direction:column;gap:12px;padding:4px 0;color:var(--ids-ink,light-dark(#1c1c22,#ececf2))}
  .ids-generator-part{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-top:2px;padding-top:10px;border-top:1px solid var(--ids-line,light-dark(#e1e1e8,#2e2e36))}
  .ids-pyramid{display:flex;flex-direction:column;gap:6px;margin-top:2px;padding-top:10px;border-top:1px solid var(--ids-line,light-dark(#e1e1e8,#2e2e36))}
  .ids-pyramid-head{display:flex;align-items:center;flex-wrap:wrap;gap:4px 7px}
  .ids-pyramid-direction{display:inline-flex;align-items:center;gap:1px;padding:2px;border:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43));border-radius:8px;background:var(--ids-surface,light-dark(#fff,#202026))}
  .ids-pyramid-direction button{width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:var(--ids-muted,light-dark(#686874,#9d9daa))}
  .ids-pyramid-direction button[aria-pressed="true"]{background:var(--ids-accent-light,light-dark(#e9edfd,#232c4c));color:var(--ids-accent,light-dark(#2944c7,#8ea8ff))}
  .ids-pyramid-direction button:focus-visible{outline:2px solid var(--ids-accent,light-dark(#2944c7,#8ea8ff));outline-offset:1px}
  .ids-pyramid-direction rect{fill:currentColor;stroke:none}
  .ids-pyramid-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
  .ids-pyramid-sizes{display:flex;gap:5px;padding-bottom:3px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:var(--ids-line-strong,light-dark(#c2c2cc,#4a4a55)) transparent}
  .ids-repeat-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
  .ids-repeat-custom input{width:84px;text-align:center;font-variant-numeric:tabular-nums}
  .ids-five-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ids-pyramid-grid button,.ids-pyramid-sizes button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;height:56px;padding:0;font-size:12px;font-variant-numeric:tabular-nums}
  .ids-pyramid-sizes button{flex:0 0 54px;scroll-snap-align:start}
  .ids-pyramid-size{font-size:10px;line-height:1;color:var(--ids-muted,light-dark(#686874,#9d9daa));font-variant-numeric:tabular-nums}
  .ids-pyramid-custom{display:flex;align-items:center;flex-wrap:wrap;gap:5px;min-width:0}
  .ids-pyramid-custom input.ids-pyramid-part{flex:1 1 140px;width:auto;min-width:0;font-family:var(--ids-font,serif);font-size:16px;text-align:start}
  .ids-pyramid-custom-label{font-size:11px;color:var(--ids-muted,light-dark(#686874,#9d9daa))}
  .ids-pyramid-custom input{width:64px;height:30px;padding:0 6px;border:1px solid var(--ids-control-border,light-dark(#8a8a96,#6f6f7e));border-radius:8px;background:var(--ids-surface,light-dark(#fff,#1b1b20));font:inherit;font-size:12px;color:inherit;font-variant-numeric:tabular-nums}
  .ids-pyramid-custom input:focus-visible{outline:2px solid var(--ids-accent,light-dark(#2944c7,#8ea8ff));outline-offset:1px}
  .ids-pyramid-custom button{height:30px;padding:0 9px;font-size:12px}
  .ids-template-group{display:flex;flex-direction:column;gap:5px;min-width:0}
  .ids-template-label{font-size:11px;color:var(--ids-muted,light-dark(#686874,#9d9daa))}
  .ids-template-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:5px}
  button{display:grid;place-items:center;height:48px;padding:0;border:1px solid var(--ids-line,light-dark(#e1e1e8,#2e2e36));
    border-radius:8px;background:var(--ids-surface,light-dark(#fff,#1b1b20));color:inherit;cursor:pointer}
  button:not(:disabled):hover{border-color:var(--ids-accent,light-dark(#2944c7,#8ea8ff));background:var(--ids-accent-light,light-dark(#e9edfd,#232c4c))}
  button:focus-visible{outline:2px solid var(--ids-accent,light-dark(#2944c7,#8ea8ff));outline-offset:2px}
  button:disabled{opacity:.55;cursor:default}
  path{fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
  .accent{color:var(--ids-accent,light-dark(#2944c7,#8ea8ff))}
  .decorative{stroke-dasharray:1 1;stroke-width:1}
  rect{fill:color-mix(in srgb,currentColor 10%,transparent);stroke:currentColor;stroke-width:1;stroke-dasharray:1.5 1.2}
</style>
