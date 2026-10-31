<script>
  // "Take parts from": the characters or the description typed or pasted here, each opened into its
  // descriptions (with the source regions of each) and those into their parts, level by level, each
  // character's own opened when it is. Every part and every node of a description can be taken whole
  // by a click or by Enter (`ontake(text)`); the arrow keys step through the tree, and ArrowRight on a
  // part steps through the components that can stand in its place, shown beside it. Below the tree are
  // the characters built from the parts typed, from the adapter's `containing`, each opened here on a
  // click. A sequence naming an unencoded component ({n}) shows as text, not taken, its encoded parts
  // still open.
  //
  // The tree's rows are its only controls: the toggle and the swaps beside a part are drawn inside
  // its row and reached by the row's keys; failures and loaded parts are said in one live region.
  //
  // `lookup` is shared with an editor so each character is asked once; one is made when none is given.
  import { untrack } from 'svelte'
  import { isNode, leaves, write } from '../core/ids.js'
  import { DEPTH, ROOTS, decomposable, lookupChar, namedParts, roots, searchParts, tokens, treeKey, unencoded, variants } from '../core/decompose.js'
  import { createLookup } from './lookup.svelte.js'
  import { translator } from './i18n.js'

  /**
   * @typedef {import('../adapter/types.js').IdsAdapter} IdsAdapter
   * @typedef {import('../adapter/types.js').Swap} Swap
   * @typedef {import('./lookup.svelte.js').Lookup} Lookup
   * @typedef {{ key: string, level: number, kind: 'char' | 'node' | 'sequence' | 'status', part?: string, text?: string, regions?: string,
   *   take: string | null, openable: boolean, open: boolean, note?: string | null, status?: 'loading' | 'failed', swaps: Swap[] }} Row
   */
  /** @type {{ adapter: IdsAdapter, lookup?: Lookup, disabled?: boolean, messages?: Record<string, string>, locale?: string, ontake?: (part: string) => void, text?: string }} */
  let { adapter, lookup: given, disabled = false, messages, locale = 'en', ontake, text = $bindable('') } = $props()
  const t = $derived(translator(messages, locale))
  const own = createLookup(() => adapter)
  const lookup = $derived(given ?? own)
  const known = $derived(lookup.known)
  const swaps = $derived(lookup.swaps)

  const FOUND_MAX = 24
  const SWAPS_SHOWN = 8
  // The IRG source letters BabelStone tags a regional shape with, each with the region its
  // kIRG_*Source field of UAX #38, Unicode Han Database (Unihan), names
  // (https://www.unicode.org/reports/tr38/): G China, H Hong Kong, M Macao, T Taiwan, J Japan, K the
  // Republic of Korea, P the Democratic People's Republic of Korea, V Vietnam, B the United Kingdom,
  // named in the reader's language by the browser's region names. U (the UTC) and S (the SAT
  // Daizōkyō Text Database) are no regions and keep their own names.
  /** @type {Record<string, string>} */
  const REGIONS = { G: 'CN', H: 'HK', M: 'MO', T: 'TW', J: 'JP', K: 'KR', P: 'KP', V: 'VN', B: 'GB', U: 'UTC', S: 'SAT' }
  const displayNames = $derived.by(() => { try { return new Intl.DisplayNames([locale], { type: 'region' }) } catch { return null } })

  let dropping = $state(false)
  /** @type {string[]} */
  let extra = $state([])
  let toggled = $state(new Set(/** @type {string[]} */ ([])))
  /** @type {string | null} */ let focusKey = $state(null)
  /** @type {number | null} */ let swapAt = $state(null)
  let live = $state('')
  /** @type {HTMLElement | null} */ let tree = $state(null)
  /** @type {HTMLInputElement | null} */ let input = $state(null)

  const typed = $derived(roots(text))
  // The characters opened from the search's list come first, the last opened at the top, keyed apart
  // from those typed so opening one leaves the typed trees as they are.
  const all = $derived([...extra.map(char => ({ kind: /** @type {const} */ ('char'), char, key: `x${char}` })), ...typed.map((root, i) => ({ ...root, key: `t${i}` }))])
  /** @param {string} part */
  const swapsOf = part => (swaps[lookupChar(part)] ?? []).filter(item => decomposable(item.char) || item.char === '？').slice(0, SWAPS_SHOWN)

  // The tree as rows in reading order, each with its level, whether it opens and is open, what taking
  // it gives and the swaps beside it. Typed characters start open, as do descriptions and their
  // nodes; a part's own character starts closed. `toggled` holds the rows opened or closed against that.
  /** @type {Row[]} */
  const rows = $derived.by(() => {
    /** @type {Row[]} */
    const out = []
    /** @param {string} key @param {boolean} byDefault */
    const isOpen = (key, byDefault) => byDefault !== toggled.has(key)
    /** @param {string} part @param {string} key @param {number} level @param {string[]} ancestors */
    const char = (part, key, level, ancestors, root = false) => {
      const c = lookupChar(part), entry = decomposable(part) ? known[c] : undefined
      const repeats = ancestors.includes(c), deep = !repeats && ancestors.length >= DEPTH
      const atomic = entry?.status === 'ready' && !variants(entry).length
      const openable = decomposable(part) && !repeats && !deep && !atomic
      const open = openable && isOpen(key, root)
      const note = repeats ? 'cycle' : deep ? 'deep' : atomic ? 'atomic' : null
      out.push({ key, level, kind: 'char', part, take: part, openable, open, note, swaps: swapsOf(part) })
      if (!open) return
      if (!entry || entry.status === 'loading') out.push({ key: `${key}/loading`, level: level + 1, kind: 'status', status: 'loading', part: c, take: null, openable: false, open: false, swaps: [] })
      else if (entry.status === 'failed') out.push({ key: `${key}/failed`, level: level + 1, kind: 'status', status: 'failed', part: c, take: null, openable: false, open: false, swaps: [] })
      else {
        variants(entry).forEach((variant, i) => sequence(variant, `${key}/${i}`, level + 1, [...ancestors, c]))
      }
    }
    /** @param {import('../core/ids.js').Node} node @param {string} key @param {number} level @param {string[]} ancestors */
    const parts = (node, key, level, ancestors) => node.parts.forEach((inner, i) => isNode(inner)
      ? nodeRow(inner, `${key}.${i}`, level, ancestors) : inner !== null && char(inner, `${key}.${i}`, level, ancestors))
    /** @param {import('../core/ids.js').Node} part @param {string} key @param {number} level @param {string[]} ancestors */
    const nodeRow = (part, key, level, ancestors) => {
      const open = isOpen(key, true)
      out.push({ key, level, kind: 'node', text: write(part), take: write(part), openable: true, open, swaps: [] })
      if (open) parts(part, key, level + 1, ancestors)
    }
    /** @param {{ text: string, regions: string, tree: import('../core/ids.js').Part, derived?: boolean }} found @param {string} key @param {number} level @param {string[]} ancestors */
    const sequence = ({ text: written, regions, tree: read, derived }, key, level, ancestors) => {
      if (typeof read === 'string') { char(read, key, level, ancestors); return }
      if (isNode(read)) {
        const open = isOpen(key, true)
        out.push({ key, level, kind: 'sequence', text: written, regions, take: written, openable: true, open, note: derived ? 'layered' : null, swaps: [] })
        if (open) parts(read, key, level + 1, ancestors)
        return
      }
      const named = namedParts(written), open = named.length > 0 && isOpen(key, true)
      out.push({ key, level, kind: 'sequence', text: written, regions, take: null, openable: named.length > 0, open, note: 'unreadable', swaps: [] })
      if (open) named.forEach((part, i) => char(part, `${key}~${i}`, level + 1, ancestors))
    }
    for (const root of all) root.kind === 'sequence'
      ? sequence({ text: root.text, regions: '', tree: root.tree }, root.key, 1, [])
      : char(root.char, root.key, 1, [], true)
    return out
  })

  // A character's descriptions are asked for once it is open.
  $effect(() => {
    for (const row of rows) if (row.kind === 'char' && row.open && row.part && !known[lookupChar(row.part)]) untrack(() => lookup.read(lookupChar(/** @type {string} */ (row.part))))
  })
  // A loading or failed row that has the focus when its answer comes hands the focus on: to the first
  // row that took its place, else to its character's row. Whether it had the focus is read before the
  // rows are redrawn; focus anywhere else is left where it is.
  /** @type {string | null} */
  let handOn = null
  $effect.pre(() => {
    rows
    untrack(() => {
      const active = /** @type {HTMLElement | null} */ (document.activeElement)
      const key = active?.dataset?.key
      handOn = key && tree?.contains(active) && /\/(loading|failed)$/.test(key) ? key : null
    })
  })
  $effect(() => {
    const key = handOn
    if (!key || rows.some(row => row.key === key)) return
    handOn = null
    const base = key.replace(/\/(loading|failed)$/, '')
    const next = rows.find(row => row.key.startsWith(`${base}/`)) ?? rows.find(row => row.key === base)
    if (next) focusRow(next.key)
  })
  // The live region says when a character's descriptions fail, each time, and how many parts a row
  // the reader opened came to once they load. Loading itself is not said.
  /** @type {Map<string, string | undefined>} */
  const seen = new Map()
  /** @param {string} message */
  function announce(message) {
    if (live !== message) { live = message; return }
    live = ''
    queueMicrotask(() => { live = message })
  }
  $effect(() => {
    for (const row of rows) {
      if (row.kind !== 'char' || !(row.open || row.note === 'atomic')) continue
      const c = lookupChar(row.part), status = known[c]?.status, was = seen.get(row.key)
      if (status === was) continue
      seen.set(row.key, status)
      untrack(() => {
        if (status === 'failed') announce(statusText({ status, part: c }))
        else if (status === 'ready' && was === 'loading' && (toggled.has(row.key) || row.key.startsWith('x'))) {
          const first = variants(known[c]).find(found => found.tree)?.tree
          announce(row.note === 'atomic' || !first ? `${c}: ${t('ids.from.atomic')}` : t('ids.from.partsLoaded', { char: c, count: leaves(first).length }))
        }
      })
    }
  })

  /** Characters dropped on the panel, read as if typed. @param {DragEvent} event */
  function dropped(event) {
    dropping = false
    const given = event.dataTransfer?.getData('text/plain')?.trim()
    if (disabled || !given) return
    event.preventDefault()
    text = given
    extra = []; toggled = new Set(); focusKey = null; swapAt = null; seen.clear()
  }
  /** @param {Event} [event] */
  function typing(event) {
    if (/** @type {InputEvent | undefined} */ (event)?.isComposing || !input) return
    text = input.value
    extra = []; toggled = new Set(); focusKey = null; swapAt = null; seen.clear()
  }

  /** @param {Row} row */
  function toggle(row) {
    if (!row.openable) return
    const next = new Set(toggled)
    if (next.has(row.key)) next.delete(row.key); else next.add(row.key)
    toggled = next
  }
  /** @param {Row} row @param {number | null} [swap] */
  function take(row, swap = null) {
    if (disabled) return
    if (row.kind === 'status') { if (row.status === 'failed' && row.part) lookup.read(row.part, { again: true }); return }
    const part = swap === null ? row.take : row.swaps[swap]?.char
    if (part) ontake?.(part)
  }
  /** @param {string} key */
  function focusRow(key) {
    if (key !== focusKey) swapAt = null
    focusKey = key
    queueMicrotask(() => /** @type {HTMLElement | null | undefined} */ (tree?.querySelector(`[data-key="${CSS.escape(key)}"]`))?.focus())
  }
  /** @param {KeyboardEvent} event @param {number} index */
  function rowKey(event, index) {
    if (event.isComposing || event.target !== event.currentTarget) return
    const row = rows[index]
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); take(row, swapAt); return }
    const move = treeKey(rows, index, event.key, swapAt)
    if (!move) return
    event.preventDefault()
    if ('toggle' in move) toggle(rows[move.toggle])
    else if ('swap' in move) {
      swapAt = move.swap
      if (swapAt !== null) live = `${row.swaps[swapAt].char}, ${t('ids.swaps.label', { part: row.part ?? '' })}`
    } else if (move.focus !== index) focusRow(rows[move.focus].key)
  }
  // A click on the row takes it; on its toggle, opens or closes it; on a swap beside it, takes that.
  /** @param {MouseEvent} event @param {Row} row */
  function rowClick(event, row) {
    focusKey = row.key
    const target = /** @type {HTMLElement} */ (event.target)
    const swap = /** @type {HTMLElement | null} */ (target.closest?.('[data-swap]'))
    if (swap) { swapAt = Number(swap.dataset.swap); take(row, swapAt); return }
    swapAt = null
    if (target.closest?.('.from-toggle')) toggle(row)
    else take(row)
  }
  // The row that takes the Tab stop: the one last focused while it is shown, else the first.
  const tabStop = $derived(rows.some(row => row.key === focusKey) ? focusKey : rows[0]?.key)

  /** @param {string} letter */
  const regionName = letter => REGIONS[letter].length === 2 ? displayNames?.of(REGIONS[letter]) ?? REGIONS[letter] : REGIONS[letter]
  /** @param {string} regions */
  const regionNames = regions => [...regions].filter(r => r in REGIONS).map(r => `${r} ${regionName(r)}`).join(' · ')
  /** @param {string} regions */
  const regionsTitle = regions => t('ids.from.regions', { regions: regionNames(regions) })
  // What a row is read out as: what taking it gives, its regions, and its note.
  /** @param {Row} row */
  const rowLabel = row => [
    row.kind === 'status' ? statusText(row)
      : row.take ? t('ids.from.take', { part: row.take }) : row.text,
    row.regions ? regionsTitle(row.regions) : null,
    row.note ? t(`ids.from.${row.note}`) : null,
    row.status === 'failed' ? t('ids.from.retry') : null,
    row.swaps?.length ? t('ids.from.swapsHint') : null,
  ].filter(Boolean).join('. ')
  /** @param {Row} row */
  const label = row => (row.kind === 'char' ? row.part : row.text) ?? ''
  /** @param {{ status?: string, part?: string }} row */
  function statusText(row) {
    const key = row.status === 'failed' ? 'ids.from.failed' : 'ids.from.loading'
    return t(key, { char: row.part ?? '' })
  }

  // The characters built from the parts typed, from the adapter's `containing`, once the typing settles.
  const asked = $derived(adapter.containing ? searchParts(typed, known) : '')
  /** @type {{ status: 'idle' | 'loading' | 'ready' | 'failed', items: string[], more?: boolean }} */
  let found = $state({ status: 'idle', items: [] })
  $effect(() => {
    const query = asked, containing = adapter.containing
    if (!query || !containing) { found = { status: 'idle', items: [] }; return }
    const controller = new AbortController()
    found = { status: 'loading', items: [] }
    const timer = setTimeout(() => containing(query, { signal: controller.signal, limit: FOUND_MAX }).then(result => {
      if (!controller.signal.aborted) found = { status: 'ready', items: result?.items ?? [], more: Boolean(result?.more) }
    }, () => { if (!controller.signal.aborted) found = { status: 'failed', items: [] } }), 250)
    return () => { clearTimeout(timer); controller.abort() }
  })
  /** @param {string} char */
  function browse(char) {
    extra = [char, ...extra.filter(other => other !== char)].slice(0, ROOTS)
    focusRow(`x${char}`)
  }
</script>

{#snippet written(/** @type {string} */ sequence)}
  {#each tokens(sequence) as token, i (i)}
    {@const n = unencoded(token)}
    {#if n !== null}<abbr class="from-unencoded" title={t('ids.from.unencoded', { n })}>{token}</abbr>{:else}{token}{/if}
  {/each}
{/snippet}

<!-- Characters dropped anywhere here are read as if typed. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ids-from" class:over={dropping} ondragover={event => { if (!disabled && event.dataTransfer?.types.includes('text/plain')) { event.preventDefault(); dropping = true } }}
  ondragleave={() => dropping = false} ondrop={dropped}>
  <label class="from-field">
    <input bind:this={input} aria-label={t('ids.pick.from')} value={text} {disabled} lang="ja" spellcheck="false" autocomplete="off"
      placeholder={t('ids.from.placeholder')} oninput={typing} oncompositionend={() => typing()}
      onkeydown={event => { if ((event.key === 'ArrowDown' || event.key === 'Enter') && !event.isComposing && rows.length) { event.preventDefault(); focusRow(rows[0].key) } }} />
  </label>
  <p class="from-live" aria-live="polite">{live}</p>
  {#if rows.length}
    <ul class="from-tree" role="tree" aria-label={t('ids.from.tree')} title={t('ids.from.hint')} bind:this={tree}>
      {#each rows as row, index (row.key)}
        {@const current = row.key === focusKey ? swapAt : null}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li role="treeitem" data-character={row.kind === 'char' ? row.part : undefined} class="from-row {row.kind}" class:off={!row.take && row.kind !== 'status'} data-key={row.key}
          aria-level={row.level} aria-selected="false" aria-expanded={row.openable ? row.open : undefined}
          aria-disabled={disabled || (!row.take && row.status !== 'failed') ? 'true' : undefined} aria-label={rowLabel(row)}
          tabindex={row.key === tabStop ? 0 : -1} style:--level={row.level - 1}
          onfocus={() => { if (focusKey !== row.key) swapAt = null; focusKey = row.key }}
          draggable={Boolean(row.take) && !disabled} ondragstart={event => { if (row.take) event.dataTransfer?.setData('text/plain', row.take) }}
          onkeydown={event => rowKey(event, index)} onclick={event => rowClick(event, row)}>
          <span class="from-toggle" aria-hidden="true" title={row.openable ? t(row.open ? 'ids.from.collapse' : 'ids.from.expand', { part: label(row) }) : undefined}>{row.openable ? row.open ? '▾' : '▸' : ''}</span>
          {#if row.kind === 'status'}
            <span class="from-note" class:fault={row.status === 'failed'} aria-hidden="true">{statusText(row)}</span>
            {#if row.status === 'failed'}<span class="from-retry" aria-hidden="true">{t('ids.from.retry')}</span>{/if}
          {:else}
            <span class="from-take" lang="ja" aria-hidden="true">{#if row.kind === 'char'}{row.part}{:else}{@render written(row.text ?? '')}{/if}</span>
            {#if row.regions}<span class="from-regions" aria-hidden="true" title={regionsTitle(row.regions)}>{row.regions}</span>{/if}
            {#if row.note && (row.note !== 'atomic' || row.level === 1)}<span class="from-note" aria-hidden="true">{t(`ids.from.${row.note}`)}</span>{/if}
            {#if row.swaps.length}
              <span class="from-swaps" aria-hidden="true" title={t('ids.swaps.label', { part: row.part ?? '' })}>
                <span class="from-approx">≈</span>
                {#each row.swaps as item, k (item.char)}
                  <span class="from-swap" class:active={current === k} data-swap={k} lang="ja" title={item.count ? `${row.part} → ${item.char} · ${item.count}` : `${row.part} → ${item.char}`}>{item.char}</span>
                {/each}
              </span>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if text.trim() && adapter.containing}
    <div class="from-containing">
      {#if asked}
        <span class="from-title">{t('ids.from.containing', { parts: [...asked].join(' ') })}</span>
        {#if found.status === 'loading'}<p class="from-note">{t('ids.from.searching')}</p>
        {:else if found.status === 'failed'}<p class="from-note fault">{t('ids.from.searchFailed')}</p>
        {:else if found.status === 'ready' && !found.items.length}<p class="from-note">{t('ids.from.noneContaining')}</p>
        {:else if found.status === 'ready'}
          <div class="from-found">
            {#each found.items as item (item)}
              <button type="button" class="from-hit" data-character={item} {disabled} lang="ja" title={t('ids.from.expand', { part: item })}
                onclick={() => browse(item)}>{item}</button>
            {/each}
          </div>
          {#if found.more}<p class="from-note">{t('ids.from.more')}</p>{/if}
        {/if}
      {:else}<p class="from-note">{t('ids.from.containingHint')}</p>{/if}
    </div>
  {/if}
</div>

<style>
  .ids-from{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_ink-soft:var(--ids-ink-soft,light-dark(#44444c,#c6c6ce));
    --_muted:var(--ids-muted,light-dark(#686874,#9d9daa));--_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));
    --_control-border:var(--ids-control-border,light-dark(#8a8a96,#6f6f7e));
    --_surface:var(--ids-surface,light-dark(#fff,#1b1b20));--_surface-subtle:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));
    --_surface-selected:var(--ids-surface-selected,light-dark(#eeeef3,#26262d));--_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));
    --_accent-light:var(--ids-accent-light,light-dark(#e9edfd,#232c4c));--_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));
    --_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback,"IDS Fallback"),sans-serif);
    position:relative;display:flex;flex-direction:column;gap:6px;min-width:0;color:var(--_ink)}
  :where(.ids-from) :is(button,input){font:inherit;color:inherit;border:1px solid var(--_line);border-radius:6px;background:var(--_surface)}
  :where(.ids-from) input{border-color:var(--_control-border)}
  :where(.ids-from) button{cursor:pointer}
  :where(.ids-from) :is(button,input):focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .from-field{display:flex;flex-direction:column}
  .from-field input{font-size:18px;padding:5px 8px;font-family:var(--_font)}
  .from-field input:placeholder-shown{font-size:14px;font-family:inherit;padding:7px 8px}
  .from-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;margin:0}
  .from-title{font-size:11px;color:var(--_muted)}
  .ids-from.over{outline:2px dashed var(--_accent);outline-offset:4px;border-radius:8px}
  .from-tree{list-style:none;margin:0;padding:4px;display:flex;flex-direction:column;max-height:320px;overflow:auto;
    border:1px solid var(--_line);border-radius:8px;background:var(--_surface-subtle)}
  .from-row{display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:1px 4px 1px calc(var(--level) * 18px + 4px);border-radius:5px;min-height:34px;cursor:pointer}
  .from-row.off{cursor:default}
  .from-row:focus-visible{outline:2px solid var(--_focus);outline-offset:-2px;background:var(--_accent-light)}
  .from-row:hover{background:var(--_surface)}
  .from-toggle{flex:none;width:20px;text-align:center;color:var(--_muted);font-size:12px;line-height:1}
  .from-take{padding:1px 8px;border:1px solid transparent;border-radius:5px;font-family:var(--_font);font-size:22px;line-height:1.2;color:var(--_ink)}
  .sequence .from-take,.node .from-take{font-size:17px;color:var(--_ink-soft)}
  .from-row:not(.off):hover .from-take{border-color:var(--_accent);background:var(--_surface)}
  .off .from-take{color:var(--_muted)}
  .from-unencoded{text-decoration:underline dotted;font-family:ui-monospace,monospace;font-size:12px;color:var(--_muted);cursor:help}
  .from-regions{font-size:10px;letter-spacing:.08em;padding:1px 4px;border-radius:4px;background:var(--_surface-selected);color:var(--_muted);font-variant-numeric:tabular-nums;cursor:help}
  .from-note{margin:0;font-size:11px;color:var(--_muted)}
  .from-note.fault{color:var(--_fault)}
  .from-retry{padding:1px 8px;font-size:12px;border:1px solid var(--_line);border-radius:5px;background:var(--_surface)}
  .from-swaps{display:inline-flex;flex-wrap:wrap;align-items:center;gap:2px;margin-left:6px;color:var(--_muted);font-size:12px}
  .from-approx{margin-right:2px}
  .from-swap{min-width:28px;padding:0 4px;text-align:center;font-size:16px;line-height:1.4;font-family:var(--_font);border:1px solid transparent;border-radius:5px;background:var(--_surface);color:var(--_ink-soft)}
  .from-swap:hover,.from-swap.active,.from-hit:not(:disabled):hover{border-color:var(--_accent)}
  .from-swap.active{background:var(--_accent-light);color:var(--_ink)}
  .from-containing{display:flex;flex-direction:column;gap:4px}
  .from-found{display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:3px;max-height:160px;overflow:auto}
  .from-hit{aspect-ratio:1;padding:0;font-size:22px;line-height:1;font-family:var(--_font);border-color:transparent;background:var(--_surface-subtle)}
</style>
