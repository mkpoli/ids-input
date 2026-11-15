<script>
  // The parser of the zi.tools IDS Extension appendix: a character's rows in yi-bai/ids, or a typed
  // description, read with the grammar of data/baishi-ids.ebnf. `?char=` names what it reads.
  import { onMount } from 'svelte'
  import BaishiEntry from './BaishiEntry.svelte'
  import { createParser } from '../lib/baishi-parser.js'
  import { readGroup, readRow } from '../lib/baishi-reading.js'
  import { REVISION, loadRows, rowSource } from '../lib/zi-tools-rows.js'
  import { ruleId } from '../lib/baishi-sections.js'
  import { composerPreview } from '@han-compose/composer'
  import engineOutlines from 'ids-engine-outlines'
  import { COMPOSER_BASE, readFrom } from '../lib/composer.js'
  import { createIconDrawings } from '../lib/icons.js'

  /**
   * @type {{ grammar: string, t: (key: string, values?: Record<string, unknown>) => string, gloss: (id: string) => string,
   *   zh: boolean }}
   */
  let { grammar, t, gloss, zh } = $props()

  // The composer draws each component as its own piece, so each piece takes its component's colour.
  /** @type {((sequence: string) => Promise<any>) | null} */
  let drawer = null
  /** @param {string} sequence */
  const draw = sequence => (drawer ??= createIconDrawings(composerPreview({ base: readFrom(COMPOSER_BASE), separate: true, fontStyle: 'sans', loaders: engineOutlines })))(sequence)

  const parser = $derived(createParser(grammar))
  /** Characters whose rows show each part of the notation. */
  const SAMPLES = ['令', '甲', '乌', '包', '曰', '毋']

  let input = $state(new URLSearchParams(location.search).get('char') ?? '')
  /** @type {Map<string, import('../lib/zi-tools-rows.js').Row[]> | null} */
  let rows = $state(null)
  let status = $state(/** @type {'idle' | 'loading' | 'failed'} */ ('idle'))
  function ask() {
    if (rows || status === 'loading') return
    status = 'loading'
    loadRows().then(got => { rows = got; status = 'idle' }, () => { status = 'failed' })
  }
  onMount(() => { if (input.trim()) ask() })
  $effect(() => {
    // The address names what is read, so a link can open the parser on it.
    const url = new URL(location.href)
    const text = input.trim()
    if (text) url.searchParams.set('char', text); else url.searchParams.delete('char')
    if (url.href !== location.href) history.replaceState(history.state, '', url)
  })

  /** @param {string} char */
  const hasRow = char => rows ? rows.has(char) : null
  /** @param {string} char */
  function read(char) {
    input = char
    document.getElementById('parser')?.scrollIntoView({ block: 'start' })
  }

  /** @param {string} text */
  function parsed(text) {
    const got = parser.parse('row', text)
    return got.ok ? { ok: /** @type {const} */ (true), row: readRow(got.tree, got.chars), chars: got.chars } : { ...got, ok: /** @type {const} */ (false) }
  }
  const result = $derived.by(() => {
    const text = input.replace(/^[\s\n]+|[ \n\r]+$/gu, '')
    if (!text) return null
    const chars = [...text]
    if (chars.length === 1 && !text.includes('\t')) {
      const found = rows?.get(text)
      return { kind: /** @type {const} */ ('char'), char: text, rows: found?.map(row => ({ row, read: parsed(row.text) })) ?? null }
    }
    if (text.includes('\t')) return { kind: /** @type {const} */ ('row'), read: parsed(text) }
    const got = parser.parse('primary group', text)
    return { kind: /** @type {const} */ ('text'), read: got.ok ? { ok: /** @type {const} */ (true), entries: readGroup(got.tree, got.chars), chars: got.chars } : got }
  })
  /** The levels after `level` that write the character as it does: those left out of the table.
   * @param {{ row: { level: number } }[]} list @param {number} level */
  const repeats = (list, level) => {
    const out = []
    for (let next = level + 1; next <= 2 && !list.some(one => one.row.level === next); next++) out.push(next)
    return out
  }
</script>

{#snippet failure(/** @type {{ at: number, expected: string[], chars: string[] }} */ got)}
  <div class="error" role="alert">
    <p class="where" lang="zh-Hans">{#each got.chars as char, i (i)}<span class:at={i === got.at}>{char === '\t' ? '⇥' : char}</span>{/each}{#if got.at >= got.chars.length}<span class="at end"> </span>{/if}</p>
    <p>{t('baishi.parser.error', { n: got.at + 1 })}
      {#each got.expected as one, i (i)}{#if i}{', '}{/if}{#if one === 'end'}{t('baishi.parser.end')}{:else if /^[a-z]/u.test(one)}<a class="rule" href={`#${ruleId(one)}`}>{one}</a>{:else}<code>{one}</code>{/if}{/each}</p>
  </div>
{/snippet}

{#snippet groups(/** @type {ReturnType<typeof readRow>} */ row, /** @type {string[]} */ chars)}
  {#each row.groups as group, g (g)}
    <div class="group">
      <h4>{t(group.alternative ? 'baishi.parser.alternative' : 'baishi.parser.default')} <a class="rule" href={`#${ruleId(group.alternative ? 'alternative group' : 'primary group')}`}>{group.alternative ? 'alternative group' : 'primary group'}</a></h4>
      {#each group.entries as entry, i (i)}<BaishiEntry {entry} {chars} {t} {gloss} {zh} {hasRow} onread={read} {draw} />{/each}
    </div>
  {/each}
{/snippet}

<div class="parser">
  <form class="ask" role="search" onsubmit={event => event.preventDefault()}>
    <label for="parser-input">{t('baishi.parser.input')}</label>
    <div class="field">
      <input id="parser-input" type="text" lang="zh-Hans" autocomplete="off" spellcheck="false" placeholder="⿰日月" bind:value={input} onfocus={ask} oninput={ask} />
      {#if input}<button type="button" class="clear" aria-label={t('baishi.parser.clear')} onclick={() => { input = '' }}>×</button>{/if}
    </div>
    <p class="credit"><a href={`https://github.com/yi-bai/ids/tree/${REVISION}`} target="_blank" rel="noreferrer">yi-bai/ids {REVISION.slice(0, 8)}</a> · MIT © 2021 Yi Bai</p>
    <div class="samples">{#each SAMPLES as char (char)}<button type="button" lang="zh-Hans" class:on={input === char} onclick={() => { input = char; ask() }}>{char}</button>{/each}</div>
  </form>

  <div aria-live="polite">
    {#if status === 'failed'}<p class="error" role="alert">{t('baishi.parser.loadFailed')}</p>{/if}
    {#if result?.kind === 'char'}
      {#if result.rows === null}
        {#if status === 'loading'}<p class="muted">{t('baishi.parser.loading')}</p>{/if}
      {:else if !result.rows.length}
        <p class="muted">{t('baishi.parser.noRow', { char: result.char, commit: REVISION.slice(0, 8) })}</p>
      {:else}
        {#each result.rows as { row, read: got } (row.level)}
          <section class="level" aria-label={`lv${row.level}`}>
            <h3><span class="char" lang="zh-Hans">{result.char}</span> <span class="lv">lv{row.level}</span>
              <a class="source" href={rowSource(row)} target="_blank" rel="noreferrer">ids_lv{row.level}.txt · {t('baishi.parser.line', { n: String(row.line) })}</a>
              {#if repeats(result.rows, row.level).length}<span class="muted">{t('baishi.parser.same', { levels: repeats(result.rows, row.level).map(level => `lv${level}`).join(' · '), level: `lv${row.level}` })}</span>{/if}</h3>
            {#if got.ok}{@render groups(got.row, got.chars)}{:else}{@render failure(got)}{/if}
          </section>
        {/each}
      {/if}
    {:else if result?.kind === 'row'}
      {#if result.read.ok}{@render groups(result.read.row, result.read.chars)}{:else}{@render failure(result.read)}{/if}
    {:else if result?.kind === 'text'}
      {#if result.read.ok}
        {#each result.read.entries as entry, i (i)}<BaishiEntry {entry} chars={result.read.chars} {t} {gloss} {zh} {hasRow} onread={read} {draw} />{/each}
      {:else}{@render failure(result.read)}{/if}
    {/if}
  </div>
</div>

<style>
  .parser{display:flex;flex-direction:column;gap:12px}
  .ask{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
  .ask label{font-size:13px;font-weight:600;color:var(--ui-color-ink-soft)}
  .field{position:relative;flex:1 1 260px;min-width:0}
  input{box-sizing:border-box;width:100%;padding:6px 34px 6px 10px;font-family:var(--ids-font);font-size:20px;line-height:1.4;color:var(--ui-color-ink);background:var(--ui-color-surface);border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-sm)}
  input:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:1px;border-color:var(--ui-color-accent)}
  .clear{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:28px;height:28px;border:none;border-radius:var(--ui-radius-xs);background:none;color:var(--ui-color-ink-muted);font-size:18px;cursor:pointer}
  .clear:hover{color:var(--ui-color-ink);background:var(--ui-color-surface-sunken)}
  .credit{order:3;flex-basis:100%;margin:0;font-size:12px;color:var(--ui-color-ink-muted)}
  .credit a{font-family:var(--ui-font-mono);color:var(--ui-color-accent);text-decoration:none}
  .credit a:hover{text-decoration:underline}
  .samples{display:flex;flex-wrap:wrap;gap:4px}
  .samples button{min-width:34px;height:34px;padding:0 6px;font-family:var(--ids-font);font-size:18px;color:var(--ui-color-ink);background:var(--ui-color-surface);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);cursor:pointer}
  .samples button:hover{border-color:var(--ui-color-ink-muted)}
  .samples button.on{border-color:var(--ui-color-accent);color:var(--ui-color-accent)}
  button:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:1px}
  .level{margin:0 0 14px}
  .level h3{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin:0 0 8px;font-size:14px}
  .char{font-family:var(--ids-font);font-size:26px;font-weight:400;line-height:1}
  .lv{font-family:var(--ui-font-mono);font-size:12px;padding:1px 6px;border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-xs)}
  .source{font-family:var(--ui-font-mono);font-size:12px;font-weight:400;color:var(--ui-color-accent);text-decoration:none}
  .source:hover{text-decoration:underline}
  .group{display:flex;flex-direction:column;gap:8px;margin:0 0 10px}
  .group h4{margin:0;font-size:12.5px;font-weight:600;color:var(--ui-color-ink-soft);display:flex;gap:8px;align-items:baseline}
  .rule{font-family:var(--ui-font-mono);font-size:12px;font-weight:400;color:var(--ui-color-accent);text-decoration:none}
  .rule:hover{text-decoration:underline}
  .muted{color:var(--ui-color-ink-muted);font-size:13px;font-weight:400}
  .error{margin:0;padding:8px 12px;border:1px solid var(--ui-color-danger);border-radius:var(--ui-radius-sm);font-size:13px}
  .error p{margin:0 0 4px}
  .where{font-family:var(--ids-font);font-size:20px;white-space:pre-wrap;overflow-wrap:anywhere}
  .where .at{background:color-mix(in oklab,var(--ui-color-danger) 30%,transparent);outline:1px solid var(--ui-color-danger);border-radius:2px}
  .where .end{display:inline-block;width:.6em}
  code{font-family:var(--ui-font-mono);font-size:12px}
</style>
