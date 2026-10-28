<script>
  // Make a pyramid: one component in rows of 1, 2, 3, … . The editor opens the generated sequence,
  // and the composer draws its cells as equal squares.
  import { parse, pyramidCount, pyramidSequence } from '../../src/core/index.js'
  import Dialog from './Dialog.svelte'
  /** @type {{ open: boolean, t: (key: string, params?: Record<string, string | number>) => string, oncreate: (sequence: string) => void }} */
  let { open = $bindable(false), t, oncreate } = $props()
  const MAX = 24
  let part = $state('口')
  let layers = $state(5)
  const text = $derived(part.trim())
  const one = $derived(parse(text, { open: true }).tree)
  const validPart = $derived(typeof one === 'string')
  const n = $derived(Math.trunc(Number(layers)))
  const validLayers = $derived(Number.isInteger(Number(layers)) && n >= 1 && n <= MAX)
  const count = $derived(validPart && validLayers ? pyramidCount(n) : 0)
  function create() {
    if (!validPart || !validLayers) return
    const sequence = pyramidSequence(/** @type {string} */ (one), n)
    open = false
    oncreate(sequence)
  }
</script>

<Dialog bind:open title={t('app.pyramid.title')} closeLabel={t('app.close')}>
  <form class="pyramid" onsubmit={event => { event.preventDefault(); create() }}>
    <p class="lead">{t('app.pyramid.lead')}</p>
    <div class="fields">
      <label class="part"><span>{t('app.pyramid.part')}</span>
        <input bind:value={part} maxlength="8" autocomplete="off" autocapitalize="off" spellcheck="false"
          aria-invalid={!validPart} aria-describedby="pyramid-part-hint" />
        {#if !validPart}<span class="hint fault" id="pyramid-part-hint">{t('app.pyramid.invalidPart')}</span>
        {:else}<span class="hint" id="pyramid-part-hint">{t('app.pyramid.partHint')}</span>{/if}
      </label>
      <label><span>{t('app.pyramid.layers')}</span>
        <input type="number" bind:value={layers} min="1" max={MAX} step="1" inputmode="numeric"
          aria-invalid={!validLayers} aria-describedby="pyramid-layer-hint" />
        {#if !validLayers}<span class="hint fault" id="pyramid-layer-hint">{t('app.pyramid.range', { max: MAX })}</span>
        {:else}<span class="hint" id="pyramid-layer-hint">{t('app.pyramid.layerHint', { max: MAX })}</span>{/if}
      </label>
    </div>
    <p class="sum" aria-live="polite">
      {#if validPart && validLayers}{t('app.pyramid.count', { count })}{:else}&nbsp;{/if}
    </p>
    <div class="actions">
      <button type="button" class="secondary" onclick={() => open = false}>{t('app.close')}</button>
      <button type="submit" class="primary" disabled={!validPart || !validLayers}>{t('app.pyramid.create')}</button>
    </div>
  </form>
</Dialog>

<style>
  .pyramid{display:flex;flex-direction:column;gap:16px}
  .lead{margin:0;color:var(--muted);font-size:13px;line-height:1.55}
  .fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
  @media (max-width:420px){.fields{grid-template-columns:1fr}}
  label{display:flex;flex-direction:column;gap:5px;min-width:0;color:var(--muted);font-size:12px}
  input{height:40px;min-width:0;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface-2);color:var(--ink);font:inherit;font-size:14px}
  .part input{font-family:var(--cjk);font-size:22px;line-height:1}
  input:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  input[aria-invalid="true"]{border-color:var(--fault)}
  .hint{min-height:16px;font-size:11px;line-height:1.4;color:var(--muted)}
  .hint.fault{color:var(--fault)}
  .sum{min-height:18px;margin:0;color:var(--ink);font-size:13px;font-variant-numeric:tabular-nums}
  .actions{display:flex;justify-content:flex-end;gap:8px}
  button{height:36px;padding:0 14px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font:inherit;font-size:13px;cursor:pointer}
  button:hover:not(:disabled){background:var(--hover)}
  button.primary{border-color:var(--accent);background:var(--accent);color:var(--on-accent)}
  button.primary:hover:not(:disabled){filter:brightness(1.06);background:var(--accent)}
  button:disabled{opacity:.45;cursor:default}
  button:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
</style>
