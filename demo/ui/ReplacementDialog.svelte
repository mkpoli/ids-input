<script>
  import { replacementQuery, resolveReplacement, write } from '../../src/core/index.js'
  import Dialog from './Dialog.svelte'

  /** @type {{ open: boolean, adapter: import('../../src/adapter/types.js').IdsAdapter,
   * t: (key: string) => string, onopen: (sequence: string) => void }} */
  let { open = $bindable(false), adapter, t, onopen } = $props()
  let source = $state(''), target = $state(''), replacement = $state('')
  let status = $state(/** @type {'' | 'loading' | 'notFound' | 'failed'} */ (''))
  /** @type {AbortController | null} */ let controller = null
  const uid = $props.id()
  const operandsValid = $derived([source, target, replacement].every(value => {
    const query = replacementQuery(`🔄${value.trim()}木火`)
    return query !== null && query.source === value.trim()
  }))
  const query = $derived(replacementQuery(`🔄${source.trim()}${target.trim()}${replacement.trim()}`))
  const valid = $derived(operandsValid && query !== null)
  $effect(() => {
    if (!open) { controller?.abort(); controller = null; status = '' }
  })
  async function submit() {
    if (!valid || !query || status === 'loading') return
    const request = new AbortController()
    controller = request
    status = 'loading'
    try {
      const tree = await resolveReplacement(query, char => adapter.structure(char, { signal: request.signal }), { signal: request.signal })
      if (request.signal.aborted) return
      if (tree === null) { status = 'notFound'; return }
      onopen(write(tree))
      open = false
    } catch { if (!request.signal.aborted) status = 'failed' }
    finally { if (controller === request) controller = null }
  }
</script>

<Dialog bind:open title={t('app.replacement.title')} closeLabel={t('app.close')}>
  <form class="replacement" onsubmit={event => { event.preventDefault(); submit() }}>
    <p>{t('app.replacement.help')}</p>
    <p>{t('app.replacement.nestedHint')}</p>
    <div class="ui-field">
      <label class="ui-label" for="{uid}-source">{t('app.replacement.source')}</label>
      <input id="{uid}-source" class="ui-input glyph" bind:value={source} oninput={() => status = ''} placeholder="林" disabled={status === 'loading'} autocomplete="off" spellcheck="false" />
    </div>
    <div class="ui-field">
      <label class="ui-label" for="{uid}-target">{t('app.replacement.target')}</label>
      <input id="{uid}-target" class="ui-input glyph" bind:value={target} oninput={() => status = ''} placeholder="木" disabled={status === 'loading'} autocomplete="off" spellcheck="false" />
    </div>
    <div class="ui-field">
      <label class="ui-label" for="{uid}-replacement">{t('app.replacement.replacement')}</label>
      <input id="{uid}-replacement" class="ui-input glyph" bind:value={replacement} oninput={() => status = ''} placeholder="火" disabled={status === 'loading'} autocomplete="off" spellcheck="false" />
    </div>
    {#if operandsValid && !query}<p role="status">{t('app.replacement.tooLong')}</p>{/if}
    {#if status}<p role="status">{t(`app.replacement.${status}`)}</p>{/if}
    <button type="submit" class="ui-button" data-size="lg" data-variant="primary" disabled={!valid || status === 'loading'} aria-busy={status === 'loading' || undefined}>{t('app.replacement.submit')}</button>
  </form>
</Dialog>

<style>
  .replacement{display:flex;flex-direction:column;gap:var(--ui-space-lg)}
  p{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm);line-height:var(--ui-leading-normal)}
  /* A component is one character, so the field draws it at a size to read its strokes. */
  .glyph{padding-block:var(--ui-space-xs);font-family:var(--cjk);font-size:var(--ui-text-xl)}
  .ui-button{align-self:flex-start}
</style>
