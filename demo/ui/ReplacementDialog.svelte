<script>
  import { replacementQuery, resolveReplacement, write } from '../../src/core/index.js'
  import Dialog from './Dialog.svelte'
  import TextField from './controls/TextField.svelte'

  /** @type {{ open: boolean, adapter: import('../../src/adapter/types.js').IdsAdapter,
   * t: (key: string) => string, onopen: (sequence: string) => void }} */
  let { open = $bindable(false), adapter, t, onopen } = $props()
  let source = $state(''), target = $state(''), replacement = $state('')
  let status = $state(/** @type {'' | 'loading' | 'notFound' | 'failed'} */ (''))
  /** @type {AbortController | null} */ let controller = null
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
    <div class="operands">
      <TextField label={t('app.replacement.source')} bind:value={source} placeholder="林" disabled={status === 'loading'} autocomplete="off" spellcheck={false} oninput={() => status = ''} />
      <TextField label={t('app.replacement.target')} bind:value={target} placeholder="木" disabled={status === 'loading'} autocomplete="off" spellcheck={false} oninput={() => status = ''} />
      <TextField label={t('app.replacement.replacement')} bind:value={replacement} placeholder="火" disabled={status === 'loading'} autocomplete="off" spellcheck={false} oninput={() => status = ''} />
    </div>
    {#if operandsValid && !query}<p role="status">{t('app.replacement.tooLong')}</p>{/if}
    {#if status}<p role="status">{t(`app.replacement.${status}`)}</p>{/if}
    <button type="submit" class="ui-button" data-variant="primary" data-size="lg" disabled={!valid || status === 'loading'} aria-busy={status === 'loading' || undefined}>{t('app.replacement.submit')}</button>
  </form>
</Dialog>

<style>
  .replacement{display:flex;flex-direction:column;gap:var(--ui-space-lg)}
  p{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm);line-height:var(--ui-leading-normal)}
  .operands{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ui-space-sm)}
  button{align-self:flex-start}
  @media (max-width:640px){.operands{grid-template-columns:minmax(0,1fr)}}
</style>
