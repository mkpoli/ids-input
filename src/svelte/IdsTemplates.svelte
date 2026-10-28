<script>
  import { LONGEST, isDescription, nextEmpty, parse, place, sameTree, write } from '../core/ids.js'
  import { normalizeMarks } from '../core/marks.js'
  import { pyramidSequence } from '../core/pyramid.js'
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
  const pyramidTemplates = COMMON_PYRAMIDS.map(layers => ({ layers, shapes: templateDiagram(pyramidSequence('口', layers)) }))
  const pyramidPart = $derived(typeof editor.picked === 'string' ? editor.picked : '口')
  const pyramidPartSupported = $derived.by(() => {
    try {
      const tree = parse(pyramidSequence(pyramidPart, 3), { open: true }).tree
      return tree !== undefined && sameTree(normalizeMarks(tree), tree)
    } catch { return false }
  })
  const pyramidTarget = $derived(editor.chosen ?? (editor.tree === null ? [] : nextEmpty(editor.tree)))
  const availablePyramids = $derived.by(() => {
    const available = new Set()
    if (pyramidTarget === null || !pyramidPartSupported) return available
    try {
      for (const layers of PYRAMID_ROWS) {
        const found = parse(pyramidSequence(pyramidPart, layers), { open: true })
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
    if (!availablePyramids.has(layers)) return
    const found = parse(pyramidSequence(pyramidPart, layers), { open: true })
    if (!found.tree) return
    editor.put(found.tree, pyramidTarget, t('ids.templates.pyramidInsert', { layers, part: pyramidPart }))
  }
</script>

<div class="ids-templates">
  {#each groups as group (group.slots)}
    <div class="ids-template-group" role="group" aria-labelledby={`${uid}-${group.slots}`}>
      <span class="ids-template-label" id={`${uid}-${group.slots}`}>{t(`ids.group.${group.slots}`)}</span>
      <div class="ids-template-grid">
        {#each group.templates as template (template.id)}
          <button type="button" disabled={editor.disabled} data-template={template.id}
            aria-label={t('ids.templates.insert', { sequence: template.sequence })} title={`${template.sequence} · ${template.curated ? t('ids.templates.hangul') : t('ids.templates.usage', { count: template.count })}`}
            draggable={!editor.disabled} ondragstart={event => event.dataTransfer?.setData('text/plain', template.sequence)}
            onclick={() => editor.take(template.sequence)}>
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
              {#each template.shapes as shape, i (i)}
                {#if shape.kind === 'slot'}
                  <rect class:accent={shape.accent} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx=".7" />
                {:else}<path class:accent={shape.accent} d={shape.d} />{/if}
              {/each}
            </svg>
          </button>
        {/each}
      </div>
    </div>
  {/each}
  <div class="ids-pyramid" role="group" aria-labelledby={`${uid}-pyramids`}>
    <div class="ids-pyramid-head">
      <span class="ids-template-label" id={`${uid}-pyramids`}>{t('ids.templates.pyramids')}</span>
      <span class="ids-pyramid-part" lang="ja">{pyramidPart}</span>
      <span class="ids-pyramid-hint">{!pyramidPartSupported ? t('ids.templates.pyramidUnsupported') : pyramidTarget === null ? t('ids.templates.pyramidTarget') : availablePyramids.size ? t('ids.templates.pyramidHint') : t('ids.templates.pyramidTooLong')}</span>
    </div>
    <div class="ids-pyramid-grid">
      {#each pyramidTemplates as template (template.layers)}
        <button type="button" disabled={editor.disabled || !availablePyramids.has(template.layers)} data-pyramid={template.layers}
          aria-label={availablePyramids.has(template.layers) ? t('ids.templates.pyramidInsert', { layers: template.layers, part: pyramidPart }) : t('ids.templates.pyramidTooLong')}
          title={availablePyramids.has(template.layers) ? t('ids.templates.pyramidInsert', { layers: template.layers, part: pyramidPart }) : t('ids.templates.pyramidTooLong')}
          onclick={() => addPyramid(template.layers)}>
          <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
            {#each template.shapes as shape, i (i)}
              {#if shape.kind === 'slot'}
                <rect class:accent={shape.accent} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx=".7" />
              {:else}<path class:accent={shape.accent} d={shape.d} />{/if}
            {/each}
          </svg>
          <span class="ids-pyramid-size">{template.layers}</span>
        </button>
      {/each}
    </div>
    <form class="ids-pyramid-custom" onsubmit={event => { event.preventDefault(); if (customValid) addPyramid(customNumber) }}>
      <label class="ids-pyramid-custom-label" for={`${uid}-pyramid-rows`}>{t('ids.templates.pyramidCustom')}</label>
      <input id={`${uid}-pyramid-rows`} type="number" min={MIN_PYRAMID} max={MAX_PYRAMID} step="1" bind:value={customLayers}
        aria-invalid={!customValid} placeholder={`${MIN_PYRAMID}–${MAX_PYRAMID}`} />
      <button type="submit" disabled={editor.disabled || !customValid}>{t('ids.templates.pyramidAdd')}</button>
    </form>
  </div>
</div>

<style>
  .ids-templates{display:flex;flex-direction:column;gap:12px;padding:4px 0;color:var(--ids-ink,light-dark(#1d1d21,#ececf1))}
  .ids-pyramid{display:flex;flex-direction:column;gap:6px;margin-top:2px;padding-top:10px;border-top:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43))}
  .ids-pyramid-head{display:flex;align-items:center;flex-wrap:wrap;gap:4px 7px}
  .ids-pyramid-part{display:grid;place-items:center;min-width:22px;height:22px;padding:0 4px;border:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43));border-radius:6px;font-family:var(--ids-font,serif);font-size:15px;line-height:1}
  .ids-pyramid-hint{font-size:11px;color:var(--ids-muted,light-dark(#696973,#9c9ca8))}
  .ids-pyramid-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
  .ids-pyramid-grid button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;height:56px;padding:0;font-size:12px;font-variant-numeric:tabular-nums}
  .ids-pyramid-size{font-size:10px;line-height:1;color:var(--ids-muted,light-dark(#696973,#9c9ca8));font-variant-numeric:tabular-nums}
  .ids-pyramid-custom{display:flex;align-items:center;gap:5px;min-width:0}
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
  rect{fill:color-mix(in srgb,currentColor 10%,transparent);stroke:currentColor;stroke-width:1;stroke-dasharray:1.5 1.2}
</style>
