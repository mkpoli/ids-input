<script>
  // Saving the drawing as a file: SVG, or PNG at a pixel size; a background of none, white, black
  // or any colour; the ink black or white to suit it, or any colour; a margin; empty slots left out
  // unless asked for. The settings are kept for the next visit.
  import { SIZES, backgroundOf, inkOf, keepSettings, pngOf, scopedPngOf, scopedSvgOf, storedSettings, svgOf } from '../lib/exporting.js'
  import { download, fileName } from '../lib/files.js'
  import Checkbox from './controls/Checkbox.svelte'
  import Segmented from './controls/Segmented.svelte'
  import Swatches from './controls/Swatches.svelte'
  import Icon from './Icon.svelte'

  /** @type {{ drawing?: import('../../src/adapter/types.js').Drawing | null, scopes?: import('../../src/document/index.js').ScopeTree | null, slots?: number[][], incomplete?: boolean, sequence: string, t: (key: string, params?: Record<string, string | number>) => string, onnote: (text: string) => void }} */
  let { drawing = null, scopes = null, slots = [], incomplete = false, sequence, t, onnote } = $props()
  let partial = $state(false)
  let s = $state(storedSettings())
  $effect(() => keepSettings($state.snapshot(s)))
  const ready = $derived(Boolean(scopes ?? drawing))
  const canExport = $derived(ready && (!incomplete || partial))
  const thumb = $derived(scopes ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scopedSvgOf(scopes, s, 96, slots))}` : drawing ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgOf(drawing, s, 96))}` : '')
  const uid = $props.id()

  /** @param {'svg' | 'png'} [format] */
  export async function save(format) {
    if (!canExport) return
    // The click's drawing, name and settings: the export runs on after the page has moved on.
    const drawn = drawing, drawnScopes = scopes, name = sequence, settings = { ...$state.snapshot(s), format: format ?? s.format }
    try {
      if (settings.format === 'svg') download(new Blob([drawnScopes ? scopedSvgOf(drawnScopes, settings, settings.size, slots) : svgOf(/** @type {NonNullable<typeof drawn>} */ (drawn), settings)], { type: 'image/svg+xml' }), fileName(name, 'svg'))
      else download(drawnScopes ? await scopedPngOf(drawnScopes, settings, slots) : await pngOf(/** @type {NonNullable<typeof drawn>} */ (drawn), settings), fileName(name, 'png'))
    } catch { onnote(t('app.export.failed')) }
  }
  async function copy() {
    if (!canExport) return
    const drawn = drawing, drawnScopes = scopes, settings = $state.snapshot(s), format = settings.format.toUpperCase()
    try {
      if (settings.format === 'svg') await navigator.clipboard.writeText(drawnScopes ? scopedSvgOf(drawnScopes, settings, settings.size, slots) : svgOf(/** @type {NonNullable<typeof drawn>} */ (drawn), settings))
      else await navigator.clipboard.write([new ClipboardItem({ 'image/png': drawnScopes ? scopedPngOf(drawnScopes, settings, slots) : pngOf(/** @type {NonNullable<typeof drawn>} */ (drawn), settings) })])
      onnote(t('app.export.copied', { format }))
    } catch { onnote(t('app.copyFailed')) }
  }
  const BACKGROUNDS = /** @type {const} */ (['none', 'white', 'black', 'custom'])
  const backgroundOptions = $derived(BACKGROUNDS.map(b => ({
    value: b,
    swatch: b,
    ariaLabel: t(`app.export.bg.${b}`),
    title: t(`app.export.bg.${b}`),
  })))
  const inkOptions = $derived([
    { value: 'auto', label: t('app.export.inkAuto'), hint: t('app.export.inkAutoHint'), dot: inkOf(s.ink === 'auto' ? s : { ...s, ink: 'auto' }), title: t('app.export.inkAutoHint') },
    { value: 'custom', label: t('app.export.inkCustom') },
  ])
</script>

<section class="export" aria-labelledby="{uid}-title">
  <h3 id="{uid}-title">{t('app.export.title')}</h3>
  <div class="rows">
    <div class="row">
      <span class="name" aria-hidden="true">{t('app.export.format')}</span>
      <Segmented label={t('app.export.format')} bind:value={s.format}
        options={[{ value: 'svg', label: 'SVG' }, { value: 'png', label: 'PNG' }]} />
      {#if s.format === 'png'}
        <span class="ui-select-wrap size">
          <select class="ui-select" aria-label={t('app.export.size')} bind:value={s.size}>
            {#each SIZES as size (size)}<option value={size}>{size} px</option>{/each}
          </select>
        </span>
      {/if}
    </div>
    <div class="row">
      <span class="name" aria-hidden="true">{t('app.export.background')}</span>
      <Swatches label={t('app.export.background')} bind:value={s.background} options={backgroundOptions} />
      {#if s.background === 'custom'}<input class="ui-color" type="color" aria-label={`${t('app.export.background')}: ${t('app.export.bg.custom')}`} bind:value={s.custom} />{/if}
    </div>
    <div class="row">
      <span class="name" aria-hidden="true">{t('app.export.ink')}</span>
      <Segmented label={t('app.export.ink')} bind:value={s.ink} options={inkOptions} />
      {#if s.ink === 'custom'}<input class="ui-color" type="color" aria-label={`${t('app.export.ink')}: ${t('app.export.inkCustom')}`} bind:value={s.inkColour} />{/if}
    </div>
    <div class="row">
      <label class="name" for="{uid}-padding">{t('app.export.padding')}</label>
      <input id="{uid}-padding" class="ui-range" type="range" min="0" max="0.25" step="0.01" bind:value={s.padding} />
      <output class="num" for="{uid}-padding">{Math.round(s.padding * 100)}%</output>
    </div>
    <div class="row check">
      <span class="name" aria-hidden="true"></span>
      <Checkbox bind:checked={s.placeholders} label={t('app.export.placeholders')} />
    </div>
  </div>
  {#if incomplete}
    <p class="ui-error incomplete" role="status">{t('app.export.incomplete')}</p>
    <div class="row check">
      <span class="name" aria-hidden="true"></span>
      <Checkbox bind:checked={partial} label={t('app.export.partial')} />
    </div>
  {/if}
  <div class="actions">
    <span class="thumb" class:none={!backgroundOf(s)} aria-hidden="true">{#if thumb}<img src={thumb} alt="" />{/if}</span>
    <button type="button" class="ui-button" data-size="lg" data-variant="primary" disabled={!canExport}
      title={canExport ? undefined : ready ? t('app.export.incomplete') : t('app.export.nothing')} onclick={() => save()}><Icon name="download" size={16} />{t('app.export.save', { format: s.format.toUpperCase() })}</button>
    <button type="button" class="ui-button" data-size="lg" disabled={!canExport} onclick={copy}><Icon name="copy" size={16} />{t('app.export.copy', { format: s.format.toUpperCase() })}</button>
  </div>
</section>

<style>
  .export{display:flex;flex-direction:column;gap:var(--ui-space-md)}
  h3{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-semibold);letter-spacing:.03em}
  .rows{display:flex;flex-direction:column;gap:var(--ui-space-2xs)}
  .row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-md);min-height:var(--ui-control-h-md);font-size:var(--ui-text-sm)}
  .name{flex:none;width:76px;color:var(--ui-color-ink-muted)}
  .check{gap:0;margin-block-start:var(--ui-space-3xs)}
  .check .name{width:76px}
  .check :global(.ui-check-row){min-height:var(--ui-control-h-md);padding-block:0}
  .size{inline-size:auto;min-width:82px;font-size:var(--ui-text-xs)}
  .size :global(.ui-select){font-size:var(--ui-text-xs)}
  .row :global(.ui-range){flex:1;inline-size:auto;min-inline-size:120px}
  .num{width:3em;text-align:right;font-variant-numeric:tabular-nums;color:var(--ui-color-ink-muted)}
  .actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-sm)}
  .thumb{display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);overflow:hidden}
  .thumb.none{background:repeating-conic-gradient(#d4d4da 0 25%,#fff 0 50%) 0 0/8px 8px}
  .thumb img{width:100%;height:100%}
  .incomplete{margin:0}
</style>
