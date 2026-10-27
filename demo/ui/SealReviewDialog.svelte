<script>
  import { onMount } from 'svelte'
  import SealCandidateDiagram from './SealCandidateDiagram.svelte'
  import Dialog from './Dialog.svelte'
  import { SEAL_REVIEW_KEY, reviewKey, validReviewIds, makeReview, readReviews, mergeReviews, exportReviews, persistReview } from '../lib/seal-reviews.js'
  let { open = $bindable(false), adapter, t, onuse } = $props()
  let query = $state('祖'), results = $state([]), total = $state(0), loading = $state(false), failed = $state(false)
  let head = $state(0), choice = $state(0), reviews = $state([]), drafts = $state({}), storageError = $state(false)
  const comparison = $derived(results[head])
  const candidate = $derived(comparison?.candidates[choice])
  const key = $derived(candidate ? reviewKey(comparison, candidate) : '')
  const saved = $derived(reviews.find(r => r.id === key))
  const draft = $derived(drafts[key] ?? { text: saved?.text ?? candidate?.text ?? '', note: saved?.note ?? '' })
  const valid = $derived(Boolean(candidate && validReviewIds(draft.text, comparison.char)))
  const changed = $derived(saved && (saved.text !== draft.text || saved.note !== draft.note))
  onMount(() => {
    const read = () => { try { reviews = mergeReviews(readReviews(localStorage.getItem(SEAL_REVIEW_KEY)), reviews) } catch { storageError = true } }
    read()
    const update = event => { if (event.key === SEAL_REVIEW_KEY) read() }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
  })
  $effect(() => {
    if (!open) return
    const text = query.trim(), controller = new AbortController()
    results = []; head = 0; choice = 0; total = 0; failed = false; loading = Boolean(text)
    if (!text) return
    const timer = setTimeout(() => adapter.sealReview(text, { signal: controller.signal }).then(found => {
      if (controller.signal.aborted) return
      results = found.items; total = found.total; loading = false
    }).catch(() => { if (!controller.signal.aborted) { failed = true; loading = false } }), 180)
    return () => { clearTimeout(timer); controller.abort() }
  })
  function edit(field, value) { drafts = { ...drafts, [key]: { ...draft, [field]: value } } }
  function decide(decision) {
    const now = new Date(Math.max(Date.now(), ...reviews.map(r => Date.parse(r.reviewedAt) + 1))).toISOString()
    const review = makeReview(comparison, candidate, draft.text, draft.note, decision, now)
    try { reviews = persistReview(localStorage, reviews, review); storageError = false }
    catch { reviews = mergeReviews(reviews, [review]); storageError = true }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([exportReviews(reviews)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'small-seal-reviews.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
</script>

<Dialog bind:open title={t('app.sealReview.title')} closeLabel={t('app.close')} wide width={960}>
  <div class="seal-review">
    <p class="intro">{t('app.sealReview.intro')}</p>
    <div class="tools">
      <label>{t('app.sealReview.lookup')}<input type="search" bind:value={query} spellcheck="false" /></label>
      <button type="button" disabled={!reviews.length} onclick={download}>{t('app.sealReview.export', { count: reviews.length })}</button>
    </div>
    {#if storageError}<p role="alert">{t('app.sealReview.storageError')}</p>{/if}
    {#if loading}<p role="status">{t('app.sealReview.loading')}</p>
    {:else if failed}<p role="alert">{t('app.sealReview.failed')}</p>
    {:else if !results.length}<p role="status">{t('app.sealReview.none')}</p>
    {:else}
      {#if results.length > 1}
        <label>{t('app.sealReview.form')}<select value={head} onchange={event => { head = Number(event.currentTarget.value); choice = 0 }}>
          {#each results as item, index}<option value={index}>{item.char} · {item.modern.join(' / ')} · U+{item.char.codePointAt(0).toString(16).toUpperCase()}</option>{/each}
        </select></label>
      {/if}
      {#if total > results.length}<p>{t('app.sealReview.headLimit', { count: results.length, total })}</p>{/if}
      <div class="review-layout">
      <div class="comparison">
        <section class="glyph-panel">
          <h3>{t('app.sealReview.glyph')}</h3>
          <div class="seal-glyph">{comparison.glyphAvailable ? comparison.char : '—'}</div>
          <code>U+{comparison.char.codePointAt(0).toString(16).toUpperCase()}</code>
          <p class="modern">{comparison.modern.join(' / ')}</p>
          <p class="muted">{t(comparison.glyphAvailable ? 'app.sealReview.edition' : 'app.sealReview.noGlyph')}</p>
        </section>
        <section>
          <h3>{t('app.sealReview.source')}</h3>
          {#if comparison.attested.length}
            {#each comparison.attested as text}<p class="ids">{text}</p>{/each}
          {:else}<p class="muted">{t('app.sealReview.noSource')}</p>{/if}
          <details><summary>{t('app.sealReview.original')}</summary>
            {#each comparison.records as record}<div class="source-record"><code>{record.id}</code>
              {#each record.descriptions ?? [] as description}<p class="raw">{description.original || '—'} <small>({description.kind}; {description.status})</small></p>{/each}
            </div>{/each}
            {#if !comparison.records.length}<p>{t('app.sealReview.noSource')}</p>{/if}
          </details>
          <h3>{t('app.sealReview.modern')}</h3>
          {#each comparison.modernDescriptions as item}<p class="ids">{item.char} · {item.text} <small>{item.regions}</small></p>{/each}
        </section>
      </div>
      <section class="inference">
        <h3>{t('app.sealReview.inferred')}</h3>
        {#if !comparison.candidates.length}<p>{t('app.sealReview.noCandidates')}</p>
        {:else}
          <label>{t('app.sealReview.candidate')}<select value={choice} onchange={event => choice = Number(event.currentTarget.value)}>
            {#each comparison.candidates as item, index}<option value={index}>{index + 1}. {item.text} ← {item.modernChar} {item.modernIds}</option>{/each}
          </select></label>
          {#if comparison.truncated}<p class="muted">{t('app.sealReview.limit')}</p>{/if}
          {#if candidate.missingGlyphs.length}<p class="muted">{t('app.sealReview.missingGlyphs', { points: candidate.missingGlyphs.map(c => `U+${c.codePointAt(0).toString(16).toUpperCase()}`).join(' ') })}</p>{/if}
          <div class="candidate-view"><SealCandidateDiagram text={draft.text} label={t('app.sealReview.diagram')} /><div class="candidate-ids ids">{candidate.text}</div></div>
          <div class="mappings">
            {#each candidate.mappings as mapping}<span class="mapping">{mapping.component} → <b>{mapping.selected ?? '⬚'}</b>
              {#if mapping.via === 'radical-form'}<small>{t('app.sealReview.radical')}</small>{/if}
              {#if mapping.options.length > 1}<details><summary>{t('app.sealReview.alternatives', { count: mapping.options.length })}</summary><span class="ids">{mapping.options.join(' · ')}</span></details>{/if}
            </span>{/each}
          </div>
          {#if candidate.unmapped.length}<p>{t('app.sealReview.unmapped', { parts: candidate.unmapped.join(' ') })}</p>{/if}
          <label>{t('app.sealReview.edit')}<input class="ids correction" value={draft.text} oninput={event => edit('text', event.currentTarget.value)} spellcheck="false" /></label>
          {#if !valid}<p class="muted">{t('app.sealReview.invalid')}</p>{/if}
          <label>{t('app.sealReview.note')}<textarea value={draft.note} oninput={event => edit('note', event.currentTarget.value)} rows="2"></textarea></label>
          <div class="actions">
            <button type="button" disabled={!valid} onclick={() => decide('accepted')}>{t('app.sealReview.accept')}</button>
            <button type="button" onclick={() => decide('rejected')}>{t('app.sealReview.reject')}</button>
            <button type="button" disabled={!valid} onclick={() => { onuse(draft.text); open = false }}>{t('app.sealReview.use')}</button>
          </div>
          {#if saved}<p role="status">{t(`app.sealReview.${saved.decision}`)}{changed ? ` · ${t('app.sealReview.unsaved')}` : ''}</p>{/if}
        {/if}
      </section>
      </div>
      <details class="provenance"><summary>{t('app.sealReview.provenance')}</summary><pre>{JSON.stringify({ generator: comparison.generator, modernSource: comparison.modernSource, sources: comparison.sources }, null, 2)}</pre></details>
    {/if}
  </div>
</Dialog>

<style>
  @font-face{font-family:"IDS Review Operators";src:url('../../fonts/NotoSerifTangut-Regular.woff2') format('woff2');unicode-range:U+2FF0-2FFB,U+303E;font-display:swap}
  .seal-review{display:grid;gap:16px;color:var(--ink)}
  p{margin:4px 0 10px;line-height:1.5}.intro,.muted,small{color:var(--muted);font-size:12px}
  .tools,.actions{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.tools label{flex:1}
  label{display:grid;gap:6px;font-size:12px;min-width:0}input,select,textarea{box-sizing:border-box;width:100%;min-width:0;padding:8px;border:1px solid var(--line);border-radius:6px;color:var(--ink);background:var(--surface);font:inherit}
  select{font-family:"IDS Review Operators","IDS Seal","IDS Parts",var(--ids-font),sans-serif}button{border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);padding:8px 10px;cursor:pointer}button:disabled{opacity:.45;cursor:default}
  :is(button,input,select,textarea,summary):focus-visible{outline:2px solid var(--focus);outline-offset:2px}
  .review-layout{display:grid;grid-template-columns:minmax(0, .85fr) minmax(0, 1.15fr);gap:24px;align-items:start}
  .comparison{display:grid;gap:16px}.glyph-panel{text-align:center;background:var(--hover);border-radius:10px;padding:12px}
  .seal-glyph{font:88px/1.15 "IDS Seal",serif}.modern{font-size:24px}.ids{font-family:"IDS Review Operators","IDS Seal","IDS Strokes","IDS Parts",var(--ids-font),serif;overflow-wrap:anywhere}.candidate-ids{font-size:36px;padding:14px 0}.correction{font-size:24px}
  h3{font-size:13px;margin:0 0 10px}section h3:not(:first-child){margin-top:16px}.inference{border-left:1px solid var(--line);padding-left:20px;display:grid;gap:10px}
  .candidate-view{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
  .mappings{display:flex;flex-wrap:wrap;gap:10px}.mapping{border:1px solid var(--line);border-radius:6px;padding:8px;font-family:"IDS Seal","IDS Parts",var(--ids-font),serif}.mapping small{display:block}
  .raw,pre{overflow-wrap:anywhere;white-space:pre-wrap;font-size:12px}summary{cursor:pointer;font-size:12px}.source-record{margin-top:8px}.provenance pre{max-height:200px;overflow:auto}
  @media(max-width:700px){.review-layout{grid-template-columns:1fr}.tools label{flex-basis:100%}.inference{border-left:0;padding-left:0;border-top:1px solid var(--line);padding-top:16px}.comparison{grid-template-columns:1fr}.glyph-panel{display:grid;grid-template-columns:1fr 1fr;align-items:center}.glyph-panel .muted{grid-column:1/-1}.seal-glyph{font-size:76px}.candidate-ids{font-size:28px}}
</style>
