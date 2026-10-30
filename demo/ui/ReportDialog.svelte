<script>
  // Report a problem without an account anywhere: an account of what happened, a way to reach the
  // reporter if they want one, the drawing as it will be attached, and a list of what else goes
  // along. One snapshot is read at submit, so nothing re-renders while the report is in flight.
  import { tick, untrack } from 'svelte'
  import { DEFAULTS, scopedSvgOf, svgOf } from '../lib/exporting.js'
  import { LIMITS, ReportError, reportSnapshot, sendReport } from '../lib/report.js'
  import Dialog from './Dialog.svelte'

  /** @type {{ open: boolean, endpoint: string, sequence: string, link: string,
   *   drawing: import('../../src/adapter/types.js').Drawing | null,
   *   scopes?: import('../../src/document/index.js').ScopeTree | null, slots?: number[][],
   *   preview: () => Element | null, workspace: () => unknown, version?: number,
   *   locale: string, theme: string, face: string, composer: string,
   *   t: (key: string, params?: Record<string, string | number>) => string }} */
  let { open = $bindable(false), endpoint, sequence, link, drawing, scopes = null, slots = [], preview, workspace, version = 0, locale, theme, face, composer, t } = $props()
  // The output panel draws either the composed drawing or the scoped document; the report attaches
  // whichever it has, as the export does. Where a composition failed there is still the preview's
  // own picture, which is the one a maintainer most wants to see.
  const drawn = $derived(Boolean(scopes ?? drawing))
  // Whether there is a picture right now. A composition that fails after the dialog opened leaves
  // this stale, so the checkbox keeps the reporter's intent and the shot is tried at submit anyway.
  const shootable = $derived.by(() => {
    void open; void version
    return drawn || Boolean(preview()?.querySelector('svg'))
  })

  let symptom = $state(''), busy = $state(false), failure = $state('')
  let contact = $state('')
  // The drawing goes along while there is one, until the reporter says otherwise; a deep link opens
  // the dialog before the preview has drawn anything.
  let chosenImage = $state(/** @type {boolean | null} */ (null))
  const withImage = $derived(chosenImage ?? true)
  /** @type {import('../lib/report.js').ReportAnswer | null} */
  let answer = $state(null)
  /** @type {HTMLTextAreaElement | null} */ let account = $state(null)
  /** @type {HTMLAnchorElement | null} */ let saved = $state(null)
  const build = `${__APP_VERSION__} · ${String(__BUILD_COMMIT__).slice(0, 8)}`
  // The drawing as the report attaches it, at a size that fits the dialog.
  const thumbnail = $derived.by(() => {
    if (!open || !drawn) return ''
    const settings = { ...DEFAULTS, size: 256, background: /** @type {const} */ ('white'), placeholders: true }
    try { return scopes ? scopedSvgOf(scopes, settings, 256, slots) : svgOf(/** @type {NonNullable<typeof drawing>} */ (drawing), settings) } catch { return '' }
  })
  const along = $derived([
    t('app.report.version', { version: build }),
    t('app.report.browser', { browser: navigator.userAgent }),
    t('app.report.language', { language: locale }),
    t('app.report.viewport', { viewport: `${innerWidth}×${innerHeight}` }),
    t('app.report.workspace'),
    t('app.report.console'),
  ])
  // Opening again after a report was sent starts a fresh form; an unsent account is kept.
  let shown = false
  $effect(() => {
    if (!open) { shown = false; return }
    if (shown) return
    shown = true
    untrack(() => {
      if (answer) { answer = null; symptom = ''; contact = '' }
      failure = ''
      chosenImage = null
    })
    // The dialog itself focuses its close button; the account of the problem is what to type into.
    tick().then(() => requestAnimationFrame(() => account?.focus()))
  })

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault()
    if (busy || !symptom.trim()) return
    busy = true
    failure = ''
    // Everything the report says is read before the first await, so what is sent is what was on
    // screen when Send was pressed.
    const said = symptom, reach = contact, image = withImage
    try {
      const snapshot = await reportSnapshot({ sequence, link, workspace: workspace(), drawing, scopes, slots, preview: preview(), locale, theme, face, composer })
      answer = await sendReport(endpoint, { symptom: said, contact: reach, image, snapshot })
      // The form is gone with the focused Send button; the issue is what to look at now.
      tick().then(() => requestAnimationFrame(() => saved?.focus()))
    } catch (error) {
      failure = error instanceof ReportError && error.message ? error.message : t('app.report.failed')
    } finally { busy = false }
  }
</script>

<Dialog bind:open title={t('app.report.title')} closeLabel={t('app.close')} wide>
  {#if answer}
    <div class="sent" role="status">
      <p class="thanks">{t('app.report.thanks')}</p>
      {#if answer.duplicate}<p class="duplicate">{t('app.report.duplicate')}</p>{/if}
      <p class="issue">{#if answer.url}<a bind:this={saved} href={answer.url} target="_blank" rel="noreferrer" aria-label={t('app.report.issue', { number: answer.number })}>#{answer.number}</a>{:else}#{answer.number}{/if}</p>
    </div>
  {:else}
    <form class="report" onsubmit={submit}>
      <p class="lead">{t('app.report.lead')}</p>
      <label class="field">
        <span>{t('app.report.symptom')}</span>
        <textarea bind:this={account} bind:value={symptom} rows="5" required maxlength={LIMITS.symptom} placeholder={t('app.report.symptomHint')}></textarea>
      </label>
      <label class="field">
        <span>{t('app.report.contact')}</span>
        <input bind:value={contact} maxlength={LIMITS.contact} placeholder={t('app.report.contactHint')} />
      </label>
      <div class="shot">
        <!-- The thumbnail is the exporter's own SVG for this drawing. -->
        {#if thumbnail}<div class="thumb" aria-hidden="true">{@html thumbnail}</div>{/if}
        <div class="shot-text">
          <label class="check"><input type="checkbox" checked={withImage} onchange={event => { chosenImage = event.currentTarget.checked }} />{t('app.report.image')}</label>
          {#if !shootable}<p class="none">{t('app.report.imageNone')}</p>{/if}
        </div>
      </div>
      <h3>{t('app.report.along')}</h3>
      <ul class="along">
        {#if sequence}<li class="glyph">{t('app.report.sequence', { sequence })}</li>{/if}
        {#each along as item (item)}<li>{item}</li>{/each}
      </ul>
      {#if failure}<p class="fault" role="alert">{failure}</p>{/if}
      <button type="submit" class="send" disabled={busy || !symptom.trim()}>{busy ? t('app.report.sending') : failure ? t('app.report.retry') : t('app.report.send')}</button>
    </form>
  {/if}
</Dialog>

<style>
  .report{display:flex;flex-direction:column;gap:12px;font-size:13.5px}
  .lead{margin:0;color:var(--muted);font-size:12.5px;line-height:1.5}
  .field{display:flex;flex-direction:column;gap:4px}
  .field span{font-size:11px;font-weight:600;letter-spacing:.03em;color:var(--muted)}
  textarea,input:not([type]){width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface-2);color:var(--ink);font:inherit;font-size:13px}
  textarea{resize:vertical;line-height:1.5}
  :is(textarea,input,button,a):focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .shot{display:flex;align-items:center;gap:12px}
  .thumb{flex:none;width:72px;height:72px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
  .thumb :global(svg){display:block;width:100%;height:100%}
  .shot-text{display:flex;flex-direction:column;gap:2px;min-width:0}
  .check{display:flex;align-items:center;gap:7px;font-size:13px}
  .check input{width:16px;height:16px;accent-color:var(--accent)}
  .none{margin:0;color:var(--muted);font-size:12px}
  h3{margin:4px 0 0;font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
  .along{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px;color:var(--muted);font-size:12px;line-height:1.45;overflow-wrap:anywhere}
  .along .glyph{font-family:var(--ids-font,"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","Noto Sans CJK JP",var(--ids-glyph-fallback,"IDS Fallback"),sans-serif)}
  .fault{margin:0;color:var(--fault);font-size:12.5px}
  .send{align-self:flex-start;height:36px;padding:0 16px;border:1px solid transparent;border-radius:9px;background:var(--accent);color:var(--on-accent);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
  .send:hover:not(:disabled){filter:brightness(1.05)}
  .send:disabled{background:var(--surface-2);color:var(--muted);border-color:var(--line);cursor:default}
  .sent{display:flex;flex-direction:column;gap:8px;font-size:13.5px}
  .thanks{margin:0}
  .duplicate{margin:0;color:var(--muted);font-size:12.5px;line-height:1.5}
  .issue{margin:0}
  .issue a{color:var(--accent);font-size:20px;font-weight:650;text-underline-offset:3px}
</style>
