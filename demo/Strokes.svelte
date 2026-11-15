<script>
  // Entering the stroke orders no source records. The queue is `data/open-strokes/wanted.tsv`: the
  // characters left without an order and the components that keep others from being written; a row saved here is a row of
  // `data/stroke-orders-entered.tsv`, which the dev server serving this page reads and writes. The
  // page is a maintainer's tool: no build publishes it.
  import { onMount, untrack } from 'svelte'
  import PageHeader from './ui/PageHeader.svelte'
  import Segmented from './ui/controls/Segmented.svelte'
  import TextField from './ui/controls/TextField.svelte'
  import { translator } from '../src/svelte/index.js'
  import { watchFallback } from '../src/svelte/fallback-font.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { STROKE_KEYS } from '../src/core/stroke-order.js'
  import { entryProblem, parseEntries } from '../src/core/stroke-entry.js'
  import { unpack } from '@han-compose/composer'
  import wantedText from '../data/open-strokes/wanted.tsv?raw'
  import formsText from '../data/component-forms.tsv?raw'

  /** @typedef {import('../src/core/stroke-entry.js').StrokeEntry} StrokeEntry */

  const params = new URLSearchParams(location.search)
  const asked = String(params.get('lang') ?? load('locale', null) ?? navigator.language ?? '')
  const traditional = /^zh-(?:Hant|TW|HK|MO)\b/i
  let locale = $state(LOCALES.find(([code]) => code === asked)?.[0]
    ?? (traditional.test(asked) ? 'zh-Hant' : undefined)
    ?? LOCALES.find(([code]) => asked.startsWith(code.split('-')[0]))?.[0] ?? 'en')
  $effect(() => save('locale', locale))
  $effect(() => { document.documentElement.lang = locale })
  const messages = $derived(LOCALES.find(([code]) => code === locale)?.[2])
  const t = $derived(translator({ ...appMessages('en'), ...messages, ...appMessages(locale) }, locale))

  /** The sources an order is entered for, and the files that record what they do have. */
  const SOURCES = /** @type {const} */ (['cns11643', 'kanjivg'])
  // The message naming each source.
  /** @type {Record<string, string>} */
  const SOURCE_NAMES = { cns11643: 'strokes.source.cns11643', kanjivg: 'strokes.source.kanjivg', 'rime-stroke': 'strokes.source.rime-stroke' }
  /** Who enters the rows: the maintainer, by the handle the project is published under. */
  const BY = 'mkpoli'
  /** Each stroke key's name in the components' catalogue; the digit is what the sources write. */
  const KEYS = STROKE_KEYS.map((key, index) => ({ digit: String(index + 1), stroke: key.stroke, name: `parts.first.${key.letter === 'n' ? 'd' : key.letter}` }))
  const DIGIT = /** @type {Record<string, string>} */ ({ h: '1', s: '2', p: '3', n: '4', z: '5' })

  /** @type {{ char: string, source: string, blocks: number, alone: number, examples: string[] }[]} */
  const wanted = wantedText.replace(/\n$/, '').split('\n').slice(1).map(line => {
    const [char, , source, blocks, alone, examples] = line.split('\t')
    return { char, source, blocks: Number(blocks), alone: Number(alone), examples: [...examples] }
  })

  let source = $state(SOURCES.includes(load('strokes.source', '')) ? load('strokes.source', '') : 'cns11643')
  $effect(() => save('strokes.source', source))

  // The rows of the repository's file, as the dev server last gave them.
  /** @type {StrokeEntry[]} */
  let rows = $state.raw([])
  let loaded = $state(false), failed = $state('')
  /** @param {string} char @param {string} from */
  const entryOf = (char, from) => rows.find(entry => entry.char === char && entry.source === from)

  // What the other sources record for a character, to start from: each code in the digits 1–5.
  /** @type {Record<string, Map<string, string[]>>} */
  let recorded = $state.raw({})
  /** @param {URL} url @param {(code: string) => string} read */
  async function table(url, read) {
    const response = await fetch(url)
    if (!response.ok) throw Error(String(response.status))
    /** @type {Map<string, string[]>} */
    const found = new Map()
    for (const line of (await unpack(await response.arrayBuffer())).split('\n').slice(1)) {
      const [char, , orders] = line.split('\t')
      if (orders) found.set(char, orders.split(' ').map(read))
    }
    return found
  }
  /** @type {HTMLElement | null} */
  let root = $state(null)
  onMount(() => {
    fetch('/api/stroke-entries').then(async response => {
      if (!response.ok || !/tab-separated/.test(response.headers.get('content-type') ?? '')) throw Error(`/api/stroke-entries ${response.status}`)
      rows = parseEntries(await response.text())
      loaded = true
    }).catch(error => { failed = String(error) })
    const same = (/** @type {string} */ code) => code
    for (const [key, url, read] of /** @type {[string, URL, (code: string) => string][]} */ ([
      ['cns11643', new URL('../data/open-strokes/cns11643.tsv.gz', import.meta.url), same],
      ['kanjivg', new URL('../data/open-strokes/kanjivg.tsv.gz', import.meta.url), same],
      ['rime-stroke', new URL('../data/open-strokes/rime-stroke.tsv.gz', import.meta.url), code => [...code].map(letter => DIGIT[letter]).join('')],
    ])) table(url, read).then(found => { recorded = { ...recorded, [key]: found } }).catch(() => { /* The page works without the reference. */ })
    return watchFallback(root)
  })

  const queue = $derived(wanted.filter(item => item.source === source))
  /** The first component of the queue still without an order. */
  const firstOpen = () => queue.find(item => !entryOf(item.char, source))?.char ?? queue[0]?.char ?? ''
  let current = $state('')
  $effect(() => { if (loaded && !current) current = firstOpen() })
  const item = $derived(queue.find(entry => entry.char === current))
  const point = $derived(current ? `U+${(current.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}` : '')
  const elsewhere = $derived(current ? Object.entries(recorded).filter(([key]) => key !== source).flatMap(([key, found]) => found.get(current) ? [{ key, orders: /** @type {string[]} */ (found.get(current)) }] : []) : [])

  // Unicode pairs each radical form and stroke with a unified ideograph of the same or nearly the
  // same appearance. The sources record the ideograph, so its order is offered as a start; the two
  // are not always written alike, which is why it is not taken unseen.
  const PAIRS = new Map(formsText.split('\n').map(line => line.split('\t')).filter(row => row[2] === 'unicode-ucd' && row[3] === 'EquivalentUnifiedIdeograph').map(row => [row[0], row[1]]))
  const pair = $derived(PAIRS.get(current) ?? '')
  /** The paired ideograph's orders, the chosen source's first. */
  const paired = $derived(pair ? Object.entries(recorded).flatMap(([key, found]) => found.get(pair) ? [{ key, orders: /** @type {string[]} */ (found.get(pair)) }] : []).sort((a, b) => Number(b.key === source) - Number(a.key === source)) : [])

  let orders = $state(''), basis = $state('')
  /** @type {ReturnType<typeof entryProblem>} */
  let problem = $state(null)
  // Choosing a component shows what is entered for it, or an empty form. Only the choice resets the
  // form: rows arriving or leaving meanwhile do not touch what is being typed.
  $effect(() => {
    const char = current, from = source
    untrack(() => {
      const entry = entryOf(char, from)
      orders = entry?.orders ?? ''
      basis = entry?.basis ?? ''
      problem = null
    })
  })
  /** The strokes of a code, as the keys show them. @param {string} written */
  const strokes = written => [...written].map(digit => digit === ' ' ? ' ' : KEYS[Number(digit) - 1]?.stroke ?? '?').join('')

  let other = $state('')
  /** @param {string} char */
  function choose(char) { current = char; other = '' }
  /** @param {string} next */
  function setSource(next) { source = next; current = '' }
  function skip() {
    const at = queue.findIndex(entry => entry.char === current)
    current = (queue.slice(at + 1).find(entry => !entryOf(entry.char, source)) ?? queue.find(entry => !entryOf(entry.char, source)) ?? queue[(at + 1) % Math.max(1, queue.length)])?.char ?? current
  }
  /** @param {string} method @param {object} body */
  async function send(method, body) {
    const response = await fetch('/api/stroke-entries', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw Error(await response.text())
    rows = parseEntries(await response.text())
  }
  async function saveEntry() {
    const today = new Date()
    /** @type {StrokeEntry} */
    const entry = {
      char: current, source, orders: orders.trim().replace(/\s+/g, ' '), basis: basis.trim().replace(/\s+/g, ' '), by: BY,
      date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    }
    problem = entryProblem(entry)
    if (problem) return
    failed = ''
    try { await send('POST', entry); skip() } catch (error) { failed = String(error) }
  }
  /** @param {StrokeEntry} row */
  async function remove(row) {
    failed = ''
    try { await send('DELETE', { char: row.char, source: row.source }) } catch (error) { failed = String(error) }
  }
</script>

<div class="page" bind:this={root}>
  <PageHeader page="strokes" title={t('strokes.title')} {t} bind:locale links={[{ href: './open-data.html#strokes', label: t('app.openData') }]} />
  {#if failed && !current}<p class="ui-error lost" role="alert">{failed}</p>{/if}

  <div class="body">
    <nav class="queue" aria-label={t('strokes.queue')}>
      <Segmented label={t('strokes.sourceLabel')} value={source} options={SOURCES.map(key => ({ value: key, label: t(SOURCE_NAMES[key]) }))} onchange={setSource} />
      <label class="other">
        <span class="ui-visually-hidden">{t('strokes.another')}</span>
        <input class="ui-input" lang="ja" bind:value={other} placeholder={t('strokes.another')} autocomplete="off" spellcheck="false"
          oninput={() => { const char = [...other.trim()][0]; if (char) current = char }} />
      </label>
      <ol>
        {#each queue as entry (entry.char)}
          {@const done = Boolean(entryOf(entry.char, source))}
          <li>
            <button type="button" class="wanted" class:done aria-current={entry.char === current ? 'true' : undefined}
              aria-label={done ? `${entry.char}, ${t('strokes.entered')}` : entry.blocks ? `${entry.char}, ${t('strokes.blocks')} ${entry.blocks}` : entry.char} onclick={() => choose(entry.char)}>
              <span class="char" lang="ja">{entry.char}</span>
              <span class="n">{done ? '✓' : entry.blocks || ''}</span>
            </button>
          </li>
        {/each}
      </ol>
    </nav>

    <main>
      {#if current}
        <section class="entry" aria-label={current}>
          <div class="glyph" lang="ja">{current}</div>
          <dl class="facts">
            <div><dt>{t('strokes.codepoint')}</dt><dd class="mono">{point}</dd></div>
            {#if item?.blocks}
              <div><dt>{t('strokes.blocks')}</dt><dd>{item.blocks}</dd></div>
              <div><dt>{t('strokes.alone')}</dt><dd>{item.alone}</dd></div>
              <div class="wide"><dt>{t('strokes.examples')}</dt>
                <dd class="examples" lang="ja">{#each item.examples as example (example)}<a href={`./#${encodeURIComponent(example)}`}>{example}</a>{/each}</dd></div>
            {/if}
            {#each paired as known (known.key)}
              <div class="wide"><dt>{t(SOURCE_NAMES[known.key])} <span class="char" lang="ja">{pair}</span></dt>
                <dd class="known">
                  <span class="written">{strokes(known.orders.join(' '))}</span><span class="mono">{known.orders.join(' ')}</span>
                  <button type="button" class="ui-button" data-size="xs" aria-label={`${t('strokes.use')} ${pair}, ${t(SOURCE_NAMES[known.key])}`}
                    onclick={() => { orders = known.orders.join(' '); basis = `${pair} (Unicode EquivalentUnifiedIdeograph), ${known.key}` }}>{t('strokes.use')}</button>
                </dd></div>
            {/each}
            {#each elsewhere as known (known.key)}
              <div class="wide"><dt>{t(SOURCE_NAMES[known.key])}</dt>
                <dd class="known">
                  <span class="written">{strokes(known.orders.join(' '))}</span><span class="mono">{known.orders.join(' ')}</span>
                  <button type="button" class="ui-button" data-size="xs" onclick={() => { orders = known.orders.join(' ') }}>{t('strokes.use')}</button>
                </dd></div>
            {/each}
          </dl>

          <form class="form" onsubmit={event => { event.preventDefault(); saveEntry() }}>
            <div class="keys" role="group" aria-label={t('strokes.keys')}>
              {#each KEYS as key (key.digit)}
                <button type="button" class="ui-button key" title={`${t(key.name)} (${key.digit})`} aria-label={`${t(key.name)} (${key.digit})`}
                  onclick={() => { orders += key.digit }}><span class="stroke">{key.stroke}</span><span class="n">{key.digit}</span></button>
              {/each}
              <button type="button" class="ui-button" title={t('strokes.way')} aria-label={t('strokes.way')} disabled={!orders || orders.endsWith(' ')} onclick={() => { orders += ' ' }}>+</button>
              <button type="button" class="ui-button" title={t('parts.order.backspace')} aria-label={t('parts.order.backspace')} disabled={!orders} onclick={() => { orders = orders.slice(0, -1) }}>←</button>
              <span class="written" aria-hidden="true">{strokes(orders)}</span>
            </div>
            <TextField label={t('strokes.order')} bind:value={orders} mono placeholder="12345" autocomplete="off" spellcheck={false}
              error={problem === 'orders' ? t('strokes.error.orders') : problem === 'char' ? t('strokes.error.char') : undefined} />
            <TextField label={t('strokes.basis')} bind:value={basis} placeholder={t('strokes.basisPlaceholder')} autocomplete="off" />
            <div class="actions">
              <button type="submit" class="ui-button" data-variant="primary">{t('strokes.save')}</button>
              <button type="button" class="ui-button" data-variant="quiet" onclick={skip}>{t('strokes.skip')}</button>
              <span class="where mono">data/stroke-orders-entered.tsv</span>
            </div>
            {#if failed}<p class="ui-error" role="alert">{failed}</p>{/if}
          </form>
        </section>
      {/if}

      <section class="rows" aria-labelledby="rows-title">
        <h2 id="rows-title">{t('strokes.entered')} <span class="count">{rows.length}</span></h2>
        {#if rows.length}
          <div class="scroll">
            <table>
              <thead><tr><th scope="col">{t('strokes.character')}</th><th scope="col">{t('strokes.sourceLabel')}</th><th scope="col">{t('strokes.order')}</th><th scope="col">{t('strokes.basis')}</th><th scope="col"><span class="ui-visually-hidden">{t('strokes.remove')}</span></th></tr></thead>
              <tbody>
                {#each rows as row (row.char + row.source)}
                  <tr>
                    <td><button type="button" class="pick" lang="ja" onclick={() => { source = row.source === 'kanjivg' ? 'kanjivg' : 'cns11643'; current = row.char }}>{row.char}</button></td>
                    <td>{t(SOURCE_NAMES[row.source])}</td>
                    <td class="mono">{row.orders}</td>
                    <td class="basis">{row.basis}</td>
                    <td><button type="button" class="ui-button" data-variant="quiet" data-size="xs" aria-label={`${t('strokes.remove')} ${row.char}`} onclick={() => remove(row)}>{t('strokes.remove')}</button></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">{t('strokes.empty')}</p>
        {/if}
      </section>
    </main>
  </div>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  .body{display:grid;grid-template-columns:232px minmax(0,1fr);gap:28px;width:100%;max-width:1180px;margin:0 auto;padding:24px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  /* The rare components: the subset faces first, then the page's face and the fallback shards. */
  .char,.glyph,.examples,.pick{font-family:"IDS Numbered","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Jurchen","IDS Strokes",var(--ids-font,var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif)}
  .stroke,.written{font-family:"IDS Strokes",var(--ids-font,var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif)}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}

  .queue{position:sticky;top:74px;align-self:start;display:flex;flex-direction:column;gap:12px;min-width:0;max-height:calc(100dvh - 98px)}
  .other input{width:100%}
  .queue ol{list-style:none;margin:0;padding:0 4px 0 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:4px;overflow:auto;min-height:0}
  .wanted{display:flex;align-items:baseline;justify-content:space-between;gap:4px;width:100%;padding:4px 8px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);
    background:var(--ui-color-surface);color:var(--ui-color-ink);cursor:pointer;font:inherit}
  .wanted:hover{background:var(--ui-color-surface-hover)}
  .wanted[aria-current="true"]{border-color:var(--ui-color-accent);background:var(--ui-color-accent-soft, var(--ui-color-surface-sunken))}
  .wanted.done{color:var(--ui-color-ink-muted)}
  .wanted .char{font-size:20px;line-height:1.3}
  .n{font-size:11px;color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}

  .entry{display:grid;grid-template-columns:168px minmax(0,1fr);gap:20px 24px;align-items:start;margin:0 0 32px}
  .glyph{display:grid;place-items:center;aspect-ratio:1;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface);box-shadow:var(--ui-shadow-1);font-size:112px;line-height:1}
  .facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 20px;margin:0}
  .facts .wide{grid-column:1/-1}
  dt{font-size:11.5px;color:var(--ui-color-ink-muted)}
  dt .char{font-size:14px;color:var(--ui-color-ink)}
  dd{margin:2px 0 0;font-size:15px;font-variant-numeric:tabular-nums}
  .examples{display:flex;flex-wrap:wrap;gap:2px 8px;font-size:24px;line-height:1.3}
  .examples a{color:inherit;text-decoration:none;border-radius:var(--ui-radius-xs)}
  .examples a:hover{background:var(--ui-color-surface-hover)}
  .known{display:flex;align-items:center;flex-wrap:wrap;gap:4px 12px}
  .written{font-size:20px;letter-spacing:2px;white-space:pre-wrap;overflow-wrap:anywhere}

  .form{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px 20px;max-width:760px}
  .keys,.actions,.form .ui-error{grid-column:1/-1}
  .keys{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
  .key{display:inline-flex;align-items:center;gap:6px;min-width:56px;justify-content:center}
  .stroke{font-size:22px;line-height:1}
  .keys .written{min-width:0;flex:1 1 120px;padding-inline:8px}
  .actions{display:flex;align-items:center;gap:8px}
  .where{margin-left:auto;font-size:12px;color:var(--ui-color-ink-muted)}

  h2{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding-top:16px;border-top:1px solid var(--ui-color-border);font-size:14px}
  .count{padding:0 6px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xs);font-size:10px;font-weight:500;line-height:1.7;color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  /* Positioned, so the visually hidden heading inside is clipped with the table. */
  .scroll{position:relative;overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{padding:6px 8px;text-align:start;font-size:11.5px;font-weight:500;color:var(--ui-color-ink-muted);border-bottom:1px solid var(--ui-color-border);white-space:nowrap}
  td{padding:6px 8px;border-bottom:1px solid var(--ui-color-border);vertical-align:baseline}
  .basis{min-width:200px;overflow-wrap:anywhere}
  .pick{border:0;background:none;padding:0 4px;border-radius:var(--ui-radius-xs);color:inherit;font-size:20px;line-height:1.2;cursor:pointer}
  .pick:hover{background:var(--ui-color-surface-hover)}
  .lost{margin:16px max(18px,env(safe-area-inset-right)) 0 max(18px,env(safe-area-inset-left))}
  .empty{margin:0;font-size:12.5px;color:var(--ui-color-ink-muted)}

  @media (max-width:760px) {
    .body{grid-template-columns:minmax(0,1fr);gap:16px}
    .queue{position:static;max-height:none}
    .queue ol{grid-auto-flow:column;grid-auto-columns:64px;grid-template-columns:none;overflow-x:auto;min-width:0;padding:0 0 4px}
    main{min-width:0}
    .entry{grid-template-columns:112px minmax(0,1fr);gap:16px}
    .glyph{font-size:72px}
    .facts{grid-template-columns:repeat(2,minmax(0,1fr))}
    .form{grid-template-columns:minmax(0,1fr)}
  }
</style>
