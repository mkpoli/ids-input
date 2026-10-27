<script>
  // Saving the drawing as a file: SVG, or PNG at a pixel size; a background of none, white, black
  // or any colour; the ink black or white to suit it, or any colour; a margin; empty slots left out
  // unless asked for. The settings are kept for the next visit.
  import { SIZES, backgroundOf, inkOf, keepSettings, pngOf, storedSettings, svgOf } from '../lib/exporting.js'
  import { download, fileName } from '../lib/files.js'
  import Icon from './Icon.svelte'

  /** @type {{ drawing: import('../../src/adapter/types.js').Drawing | null, sequence: string, t: (key: string, params?: Record<string, string | number>) => string, onnote: (text: string) => void }} */
  let { drawing, sequence, t, onnote } = $props()
  let s = $state(storedSettings())
  $effect(() => keepSettings($state.snapshot(s)))
  const thumb = $derived(drawing ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgOf(drawing, s, 96))}` : '')

  /** @param {'svg' | 'png'} [format] */
  export async function save(format) {
    if (!drawing) return
    // The click's drawing, name and settings: the export runs on after the page has moved on.
    const drawn = drawing, name = sequence, settings = { ...$state.snapshot(s), format: format ?? s.format }
    try {
      if (settings.format === 'svg') download(new Blob([svgOf(drawn, settings)], { type: 'image/svg+xml' }), fileName(name, 'svg'))
      else download(await pngOf(drawn, settings), fileName(name, 'png'))
    } catch { onnote(t('app.export.failed')) }
  }
  async function copy() {
    if (!drawing) return
    const drawn = drawing, settings = $state.snapshot(s), format = settings.format.toUpperCase()
    try {
      if (settings.format === 'svg') await navigator.clipboard.writeText(svgOf(drawn, settings))
      else await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngOf(drawn, settings) })])
      onnote(t('app.export.copied', { format }))
    } catch { onnote(t('app.copyFailed')) }
  }
  const BACKGROUNDS = /** @type {const} */ (['none', 'white', 'black', 'custom'])
</script>

<section class="export" aria-labelledby="export-title">
  <h3 id="export-title">{t('app.export.title')}</h3>
  <div class="rows">
    <div class="row">
      <span class="name">{t('app.export.format')}</span>
      <div class="seg" role="radiogroup" aria-label={t('app.export.format')}>
        {#each /** @type {const} */ (['svg', 'png']) as f (f)}
          <button type="button" role="radio" aria-checked={s.format === f} onclick={() => s.format = f}>{f.toUpperCase()}</button>
        {/each}
      </div>
      {#if s.format === 'png'}
        <select aria-label={t('app.export.size')} bind:value={s.size}>
          {#each SIZES as size (size)}<option value={size}>{size} px</option>{/each}
        </select>
      {/if}
    </div>
    <div class="row">
      <span class="name">{t('app.export.background')}</span>
      <div class="swatches" role="radiogroup" aria-label={t('app.export.background')}>
        {#each BACKGROUNDS as b (b)}
          <button type="button" role="radio" class="swatch {b}" aria-checked={s.background === b} title={t(`app.export.bg.${b}`)} aria-label={t(`app.export.bg.${b}`)}
            style:--swatch={b === 'custom' ? s.custom : undefined} onclick={() => s.background = b}></button>
        {/each}
        {#if s.background === 'custom'}<input type="color" aria-label={t('app.export.bg.custom')} bind:value={s.custom} />{/if}
      </div>
    </div>
    <div class="row">
      <span class="name">{t('app.export.ink')}</span>
      <div class="seg" role="radiogroup" aria-label={t('app.export.ink')}>
        <button type="button" role="radio" aria-checked={s.ink === 'auto'} title={t('app.export.inkAutoHint')} onclick={() => s.ink = 'auto'}>
          <span class="dot" style:--swatch={s.ink === 'auto' ? inkOf(s) : inkOf({ ...s, ink: 'auto' })}></span>{t('app.export.inkAuto')}</button>
        <button type="button" role="radio" aria-checked={s.ink === 'custom'} onclick={() => s.ink = 'custom'}>{t('app.export.inkCustom')}</button>
      </div>
      {#if s.ink === 'custom'}<input type="color" aria-label={t('app.export.inkCustom')} bind:value={s.inkColour} />{/if}
    </div>
    <label class="row">
      <span class="name">{t('app.export.padding')}</span>
      <input type="range" min="0" max="0.25" step="0.01" bind:value={s.padding} />
      <output class="num">{Math.round(s.padding * 100)}%</output>
    </label>
    <label class="row check">
      <input type="checkbox" bind:checked={s.placeholders} />
      <span>{t('app.export.placeholders')}</span>
    </label>
  </div>
  <div class="actions">
    <span class="thumb" class:none={!backgroundOf(s)} aria-hidden="true">{#if thumb}<img src={thumb} alt="" />{/if}</span>
    <button type="button" class="primary" disabled={!drawing} title={drawing ? undefined : t('app.export.nothing')} onclick={() => save()}><Icon name="download" size={16} />{t('app.export.save', { format: s.format.toUpperCase() })}</button>
    <button type="button" disabled={!drawing} onclick={copy}><Icon name="copy" size={16} />{t('app.export.copy', { format: s.format.toUpperCase() })}</button>
  </div>
</section>

<style>
  .export{display:flex;flex-direction:column;gap:10px}
  h3{margin:0;font-size:12px;font-weight:600;letter-spacing:.03em;color:var(--muted)}
  .rows{display:flex;flex-direction:column;gap:4px}
  .row{display:flex;align-items:center;gap:10px;min-height:30px;font-size:13px}
  .name{width:76px;flex:none;color:var(--muted)}
  .check{gap:8px}
  .check input{margin:0 0 0 86px;accent-color:var(--accent)}
  .seg{display:flex;gap:2px;padding:2px;border-radius:9px;background:var(--surface-2);border:1px solid var(--line)}
  .seg button{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:0;border-radius:7px;background:none;color:var(--muted);font:inherit;font-size:12.5px;cursor:pointer}
  .seg button[aria-checked="true"]{background:var(--surface);color:var(--ink);box-shadow:0 1px 2px rgb(0 0 0 / .14)}
  .swatches{display:flex;align-items:center;gap:6px}
  .swatch{width:26px;height:26px;padding:0;border:1px solid var(--line-strong);border-radius:7px;cursor:pointer;background:var(--swatch)}
  .swatch.none{background:repeating-conic-gradient(#c9c9d0 0 25%,#fff 0 50%) 0 0/10px 10px}
  .swatch.white{--swatch:#fff}.swatch.black{--swatch:#000}
  .swatch.custom{background:conic-gradient(from 90deg,#f43,#fc3,#3c6,#39f,#a3f,#f43)}
  .swatch[aria-checked="true"]{outline:2px solid var(--accent);outline-offset:2px}
  .dot{width:10px;height:10px;border-radius:50%;background:var(--swatch);border:1px solid var(--line-strong)}
  input[type="color"]{width:32px;height:28px;padding:0 2px;border:1px solid var(--line);border-radius:7px;background:var(--surface)}
  input[type="range"]{flex:1;min-width:0;accent-color:var(--accent)}
  select{height:30px;padding:0 6px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:12.5px}
  .num{width:3em;text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
  .actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
  .thumb{display:grid;place-items:center;width:40px;height:40px;border-radius:8px;border:1px solid var(--line);overflow:hidden}
  .thumb.none{background:repeating-conic-gradient(#d4d4da 0 25%,#fff 0 50%) 0 0/8px 8px}
  .thumb img{width:100%;height:100%}
  .actions button{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font:inherit;font-size:13px;cursor:pointer}
  .actions button:not(:disabled):hover{background:var(--hover)}
  .actions .primary{border-color:var(--accent);background:var(--accent);color:var(--on-accent)}
  .actions .primary:not(:disabled):hover{background:color-mix(in srgb,var(--accent) 88%,#000)}
  .actions button:disabled{opacity:.45;cursor:default}
  :is(button,select,input):focus-visible{outline:2px solid var(--focus);outline-offset:1px}
</style>
