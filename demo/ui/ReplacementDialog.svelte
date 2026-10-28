<script>
  import { replacementQuery, resolveReplacement, write } from '../../src/core/index.js'
  import Dialog from './Dialog.svelte'

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
    <label>{t('app.replacement.source')}<input bind:value={source} oninput={() => status = ''} placeholder="林" disabled={status === 'loading'} autocomplete="off" spellcheck="false" /></label>
    <label>{t('app.replacement.target')}<input bind:value={target} oninput={() => status = ''} placeholder="木" disabled={status === 'loading'} autocomplete="off" spellcheck="false" /></label>
    <label>{t('app.replacement.replacement')}<input bind:value={replacement} oninput={() => status = ''} placeholder="火" disabled={status === 'loading'} autocomplete="off" spellcheck="false" /></label>
    {#if operandsValid && !query}<p role="status">{t('app.replacement.tooLong')}</p>{/if}
    {#if status}<p role="status">{t(`app.replacement.${status}`)}</p>{/if}
    <button type="submit" disabled={!valid || status === 'loading'}>{t('app.replacement.submit')}</button>
  </form>
</Dialog>

<style>
  .replacement{display:flex;flex-direction:column;gap:12px}
  p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}
  label{display:flex;flex-direction:column;gap:4px;font-size:13px}
  input{min-width:0;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--ink);font:inherit;font-size:18px}
  button{align-self:flex-start;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;cursor:pointer}
  button:disabled{opacity:.5;cursor:default}
  :is(button,input):focus-visible{outline:2px solid var(--focus);outline-offset:2px}
</style>
