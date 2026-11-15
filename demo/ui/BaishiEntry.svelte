<script>
  // One description read by the parser: the text with each token in its place's colour and the
  // workshop's scope lines under it, the glyph with its parts in the same colours, what each token
  // is, and the grammar's tree, folded rule by rule.
  import { SvelteSet } from 'svelte/reactivity'
  import { tint } from '../../src/svelte/tokens.js'
  import { sequenceScopes } from '../../src/svelte/sequence-scopes.js'
  import { textOf } from '../lib/baishi-parser.js'
  import { charKind, places, readChain, readIndex, readOverlap, readPrefix, readVariant, variantIds } from '../lib/baishi-reading.js'
  import { drawingOf } from '../lib/baishi-drawing.js'
  import { CELLS, OPERATORS, QUOTES, SOURCES, STROKE_LETTERS, STYLE_LETTERS } from '../lib/baishi.js'
  import { ruleId } from '../lib/baishi-sections.js'

  /** @typedef {import('../lib/baishi-reading.js').Entry} Entry */
  /** @typedef {import('../lib/baishi-reading.js').Token} Token */
  /** @typedef {import('../lib/baishi-parser.js').ParseNode} ParseNode */
  /**
   * @type {{ entry: Entry, chars: string[], t: (key: string, values?: Record<string, unknown>) => string,
   *   gloss: (id: string) => string, zh: boolean, hasRow: (char: string) => boolean | null, onread: (char: string) => void,
   *   draw: (sequence: string) => Promise<any> }}
   */
  let { entry, chars, t, gloss, zh, hasRow, onread, draw } = $props()

  const key = (/** @type {number[]} */ path) => path.join('.')
  /** The colour of a place: the workshop's hue for the layer a place opens, so every component and
   * operator takes its own, and a component's pieces of the glyph take the same. @param {number[]} path */
  const hue = path => tint(path, true)
  /** The place the pointer or the focus is on. */
  let hovered = $state(/** @type {string | null} */ (null))

  // The text, cut at the tokens.
  const pieces = $derived.by(() => {
    /** @type {{ text: string, token: number | null }[]} */
    const out = []
    let at = entry.start
    entry.tokens.forEach((token, index) => {
      if (token.start > at) out.push({ text: chars.slice(at, token.start).join(''), token: null })
      out.push({ text: token.text, token: index })
      at = token.end
    })
    if (at < entry.end) out.push({ text: chars.slice(at, entry.end).join(''), token: null })
    return out
  })

  // The scope lines: each place's box is the union of its tokens' boxes, measured once drawn.
  /** @type {HTMLElement | undefined} */
  let run = $state()
  let boxes = $state(/** @type {{ left: number, right: number }[]} */ ([]))
  $effect(() => {
    void pieces
    const node = run
    if (!node) return
    const measure = () => {
      const origin = node.getBoundingClientRect().left
      const spans = [...node.querySelectorAll('[data-token]')]
      /** @type {{ left: number, right: number }[]} */
      const out = []
      for (const span of spans) {
        const box = span.getBoundingClientRect()
        out[Number(/** @type {HTMLElement} */ (span).dataset.token)] = { left: box.left - origin, right: box.right - origin }
      }
      boxes = out
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    void document.fonts.ready.then(measure)
    measure()
    return () => observer.disconnect()
  })
  const scopeOf = $derived.by(() => {
    if (!boxes.length) return { scopes: [], height: 0 }
    const list = places(entry.tokens)
    const bounds = list.map(place => {
      const members = place.members.map(index => boxes[index]).filter(Boolean)
      return members.length ? { left: Math.min(...members.map(box => box.left)), right: Math.max(...members.map(box => box.right)) } : { left: 0, right: 0 }
    })
    const scopes = sequenceScopes(/** @type {any} */ (list.map(place => ({ text: place.text, path: place.path }))), bounds)
    return { scopes, height: scopes.length ? 12 + Math.max(...scopes.map(scope => scope.lane)) * 6 : 0 }
  })

  // The glyph: the workshop's preview of the description, each part in its component's colour.
  const body = $derived(chars.slice(entry.start, entry.tags ? entry.tags.start : entry.end).join(''))
  const plan = $derived(drawingOf(body))
  let drawing = $state(/** @type {any} */ (null))
  $effect(() => {
    const wanted = plan
    drawing = null
    if (wanted?.kind !== 'composed') return
    let alive = true
    // Asked once the text has settled, so typing does not queue a drawing for every keystroke.
    const timer = setTimeout(() => { void draw(wanted.sequence).then(got => { if (alive) drawing = got }, () => {}) }, 500)
    return () => { alive = false; clearTimeout(timer) }
  })
  /**
   * The path of the component a drawn part stands for: the leaf the composer names, or, where it
   * names none and draws one part per component, the component in the same place in reading order.
   * @param {{ leaf?: number }} part @param {number} index @param {number} count
   */
  const partPath = (part, index, count) => {
    const leaf = part.leaf ?? (count === entry.leaves.length ? index : undefined)
    return leaf === undefined ? null : entry.leaves[leaf]?.path ?? null
  }

  const operatorRow = (/** @type {string} */ op) => OPERATORS.find(([char]) => char === op)
  /** A short meaning: the Chinese of the documents for a Chinese reader, else its rendering. @param {string} zhText @param {string} id */
  const meaning = (zhText, id) => zh ? zhText : (gloss(id) || zhText)
  /** @param {string} letter */
  const styleMeaning = letter => {
    const row = STYLE_LETTERS.find(([one]) => one.split(' ').includes(letter))
    return row ? meaning(row[1], `style.${row[0]}`) : ''
  }
  /** @param {string} cell */
  const cellMeaning = cell => {
    const row = CELLS.find(([one]) => one.split(' ').includes(cell) || (one.startsWith('a b c') && /[a-d]/u.test(cell)))
    if (!row) return ''
    const [, said] = row
    return said.startsWith('@') ? meaning(QUOTES[said.slice(1)], said.slice(1)) : t(`baishi.${said}`)
  }

  // The tree, folded where asked: a rule with a single rule under it over the same text shows as one line.
  const closed = new SvelteSet()
  /** @param {ParseNode} node */
  function fold(node) {
    const names = [/** @type {string} */ (node.rule)]
    let at = node
    while (at.children.length === 1 && at.children[0].rule && at.children[0].start === at.start && at.children[0].end === at.end) {
      at = at.children[0]
      names.push(/** @type {string} */ (at.rule))
    }
    return { names, node: at }
  }
  /** @param {ParseNode} node */
  const nodeKey = node => `${node.start}:${node.end}:${node.rule}`
  /** @param {ParseNode} node @returns {string[]} */
  const allKeys = node => node.rule && node.children.some(one => one.rule) ? [nodeKey(fold(node).node), ...fold(node).node.children.flatMap(allKeys)] : node.children.flatMap(allKeys)
  const tokenId = $props.id()
</script>

{#snippet chip(/** @type {Token} */ token)}
  <span class="chip" class:hovered={hovered === key(token.path)} style:--tint={hue(token.path)} lang="zh-Hans">{token.text}</span>
{/snippet}

{#snippet rule(/** @type {string} */ name)}
  <a class="rule" href={`#${ruleId(name)}`}>{name}</a>
{/snippet}

{#snippet variantLine(/** @type {string} */ id)}
  {@const read = readVariant(id)}
  {@const region = read.kind === 'source' || read.kind === 'wildcard' ? SOURCES.find(([letter]) => letter === id)?.[2] ?? '' : ''}
  <span class="variant" title={region.startsWith('@') ? meaning(QUOTES[region.slice(1)], region.slice(1)) : undefined}><code>{id}</code> <span class="muted">{t(`baishi.kind.${read.kind}`)}</span>
    {#if read.kind === 'source'}
      <span>{read.source}</span>{#if region}<span class="muted" lang="zh-Hans">{region.startsWith('@') ? '' : region}</span>{/if}
    {:else if read.kind === 'ucv'}
      <span title={meaning(QUOTES.ucv, 'ucv')}><code>{read.lead}</code> {t('baishi.parser.ucv', { rule: read.rule, glyph: read.glyph })}{#if read.suffix} <code>{read.suffix}</code>{/if}</span>
      {#if read.lead !== 'q' || read.suffix}<a class="open" href="#unsettled">{t('baishi.open')}</a>{/if}
    {:else if read.kind === 'imaginary'}
      <span>{t('baishi.parser.ucvRules', { rules: (read.rules ?? []).join(' · ') })}</span>
    {:else if read.kind === 'style'}
      {#each read.letters ?? [] as letter, i (i)}<span class="letter"><code>{letter}</code> {styleMeaning(letter) || t('baishi.parser.unknown')}</span>{/each}
    {/if}
  </span>
{/snippet}

{#snippet reading(/** @type {Token} */ token)}
  {#if token.kind === 'operator'}
    {@const row = operatorRow(token.text)}
    {#if row}<span class="code">U+{row[1]} · {row[2]}</span> <span lang={zh ? 'zh-Hans' : undefined}>{meaning(row[3], `idc.${row[0]}`)}</span>{/if}
  {:else if token.kind === 'overlap'}
    {#each readOverlap(token.node, chars) as spec, s (s)}
      <div class="spec">
        {#if s}<span class="muted">{t('baishi.heading.reverseMatrix')}</span>{/if}
        {#if spec.kind === 'slice'}
          <span>{t('baishi.parser.sliceTop', { n: spec.top ?? '0' })}</span>
          <span>{t('baishi.parser.sliceBottom', { n: spec.bottom ?? '-0' })}</span>
        {:else}
          <table class="matrix" aria-label={t('baishi.heading.matrix')}>
            <tbody>
              {#each spec.rows as cells, r (r)}
                <tr><th scope="row">{r + 1}</th>
                  {#if cells.length}{#each cells as cell, c (c)}<td title={cellMeaning(cell)}><code>{cell}</code></td>{/each}{:else}<td class="empty" title={t('baishi.matrix.simplify')}>—</td>{/if}
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/each}
  {:else if token.kind === 'index'}
    {@const op = entry.tokens.find(one => one.kind === 'operator' && key(one.path) === key(token.path))?.text}
    <span>{t(op === '㇯' ? 'baishi.parser.removes' : 'baishi.parser.space', { n: readIndex(token.node, chars) })}</span>
  {:else if token.kind === 'char'}
    {@const kind = charKind(token.node)}
    {@const curve = STROKE_LETTERS.find(([, stroke]) => stroke === token.text)}
    <span class="code">U+{token.text.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}</span>
    {#if kind !== 'hanzi'}<span class="muted">{kind === 'curve' && curve ? `${t('baishi.parser.kind.curve')} ${curve[0]}` : t(`baishi.parser.kind.${kind}`)}</span>{/if}
    {#if hasRow(token.text)}<button type="button" class="read" onclick={() => onread(token.text)}>{t('baishi.parser.read', { char: token.text })}</button>
    {:else if hasRow(token.text) === false}<span class="muted">{t('baishi.parser.noOwnRow')}</span>{/if}
  {:else if token.kind === 'chain'}
    {@const chain = readChain(token.node, chars)}
    <ol class="strokes">
      {#each chain.parts as part, i (i)}
        <li><span class="index">{i}</span>
          {#if part.reversed}<code>-</code> <span class="muted">{t('baishi.parser.reversed')}</span>{/if}
          {#if part.letter}
            {@const row = STROKE_LETTERS.find(([one]) => one === part.letter?.base)}
            <code>{part.letter.text}</code> <span lang="zh-Hans">{part.letter.stroke}</span>
            {#if row?.[2]}<span>{meaning(row[2], `stroke.${row[0]}`)}</span>{/if}
            {#if part.letter.rounded}<span class="muted"><code>Hw</code> {t('baishi.parser.rounded')}</span>{/if}
            {#if part.letter.hook}<span class="muted"><code>g</code> {t('baishi.parser.hook')}</span>{/if}
          {:else}
            <span class="stroke" lang="zh-Hans">{part.stroke}</span>
            {#if hasRow(part.stroke)}<button type="button" class="read" onclick={() => onread(part.stroke)}>{t('baishi.parser.read', { char: part.stroke })}</button>{/if}
          {/if}
          {#if part.crosses !== null}<code>x{part.crosses}</code> <span class="muted">{t('baishi.parser.crosses', { n: part.crosses })}</span>{/if}
          {#if part.broken}<code>b</code> <span class="muted">{t('baishi.parser.break')}</span>{/if}
        </li>
      {/each}
      {#if chain.closed}<li><code>z</code> <span class="muted">{t('baishi.parser.closed')}</span></li>{/if}
    </ol>
  {:else if token.kind === 'variant' || token.kind === 'tags'}
    {#each variantIds(token.node, chars) as id, i (i)}{@render variantLine(id)}{/each}
  {:else if token.kind === 'prefix'}
    {@const prefix = readPrefix(token.node, chars)}
    <span>{t('baishi.parser.only', { char: prefix.char })}</span>
    {#if prefix.far}<span class="muted"><code>?{prefix.digit}</code> {t('baishi.parser.far')}</span>{/if}
    {#if prefix.source}<span class="muted"><code>{prefix.source}</code> {SOURCES.find(([letter]) => letter === prefix.source)?.[1]}</span>{/if}
  {/if}
{/snippet}

{#snippet tree(/** @type {ParseNode} */ node, /** @type {number} */ depth)}
  {@const folded = fold(node)}
  {@const inner = folded.node.children}
  {@const text = textOf(folded.node, chars)}
  {#if inner.some(one => one.rule)}
    <li><details open={!closed.has(nodeKey(folded.node))} ontoggle={event => { const open = /** @type {HTMLDetailsElement} */ (event.currentTarget).open; if (open) closed.delete(nodeKey(folded.node)); else closed.add(nodeKey(folded.node)) }}>
      <summary>{#each folded.names as name, i (i)}{#if i}<span class="sep">›</span>{/if}{@render rule(name)}{/each} <code class="span" lang="zh-Hans">{text}</code></summary>
      <ul>{#each inner as one, i (i)}{#if one.rule}{@render tree(one, depth + 1)}{:else}<li class="terminal"><code lang="zh-Hans">"{textOf(one, chars)}"</code></li>{/if}{/each}</ul>
    </details></li>
  {:else}
    <li class="leaf">{#each folded.names as name, i (i)}{#if i}<span class="sep">›</span>{/if}{@render rule(name)}{/each} <code class="span" lang="zh-Hans">{text}</code></li>
  {/if}
{/snippet}

<div class="entry">
  <div class="top">
    <div class="glyph" class:none={plan?.kind !== 'chain' && !drawing} aria-hidden="true">
      {#if plan?.kind === 'chain'}
        <svg viewBox="0 0 1000 1000"><path d={plan.d} fill="none" stroke={`color-mix(in oklab, ${hue(entry.leaves[0]?.path ?? [])} 70%, var(--ui-color-ink))`} stroke-width="64" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {:else if drawing}
        <svg viewBox="0 0 1000 1000">
          {#if drawing.parts?.length}
            {#each drawing.parts as part, i (i)}
              {@const path = partPath(part, i, drawing.parts.length)}
              <path d={part.d} class:hovered={path !== null && hovered === key(path)} fill={path ? `color-mix(in oklab, ${hue(path)} 72%, var(--ui-color-ink))` : 'currentColor'} />
            {/each}
          {:else}<path d={drawing.d} fill="currentColor" />{/if}
        </svg>
      {/if}
    </div>
    <div class="sequence" style:--scope-height={`${scopeOf.height}px`}>
      <div class="run" bind:this={run} lang="zh-Hans">{#each pieces as piece, i (i)}{#if piece.token === null}<span>{piece.text}</span>{:else}{@const token = entry.tokens[piece.token]}<span data-token={piece.token} class="token" data-kind={token.kind} class:hovered={hovered === key(token.path)} style:--tint={hue(token.path)} role="presentation" onpointerenter={() => { hovered = key(token.path) }} onpointerleave={() => { hovered = null }}>{piece.text}</span>{/if}{/each}</div>
      {#if scopeOf.scopes.length}
        <svg class="scopes" width="100%" height={scopeOf.height} aria-hidden="true">
          {#each scopeOf.scopes as scope (key(scope.path))}
            <path d={scope.lead} style:--tint={hue(scope.path)} />
            {#each scope.segments as segment (key(segment.path))}<path d={segment.d} class:hovered={hovered === key(segment.path)} style:--tint={hue(segment.path)} />{/each}
          {/each}
        </svg>
      {/if}
    </div>
  </div>

  <table class="tokens">
    <tbody>
      {#each entry.tokens as token, i (i)}
        <tr class:hovered={hovered === key(token.path)} onpointerenter={() => { hovered = key(token.path) }} onpointerleave={() => { hovered = null }} onfocusin={() => { hovered = key(token.path) }} onfocusout={() => { hovered = null }}>
          <td class="what">{@render chip(token)}</td>
          <td class="kind">{@render rule(token.node.rule ?? 'component')}</td>
          <td class="reading">{@render reading(token)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <details class="tree-box">
    <summary>{t('baishi.parser.tree')}</summary>
    <div class="tree-tools">
      <button type="button" onclick={() => closed.clear()}>{t('baishi.grand.all')}</button>
      <button type="button" onclick={() => { for (const one of allKeys(entry.node)) closed.add(one) }}>{t('baishi.grand.none')}</button>
    </div>
    <ul class="tree" id={`${tokenId}-tree`}>{@render tree(entry.node, 0)}</ul>
  </details>
</div>

<style>
  .entry{display:flex;flex-direction:column;gap:10px;min-width:0;padding:10px 12px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface)}
  .top{display:flex;align-items:flex-start;gap:14px;min-width:0}
  .glyph{flex:none;width:64px;height:64px;color:var(--ui-color-ink)}
  .glyph.none{display:none}
  .glyph svg{display:block;width:100%;height:100%}
  .glyph path.hovered{fill:var(--ui-color-accent)}
  .sequence{position:relative;min-width:0;flex:1;padding-bottom:var(--scope-height)}
  .run{font-family:var(--ids-font);font-size:24px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--ui-color-ink)}
  .token{color:color-mix(in oklab,var(--ui-color-ink) 62%,var(--tint));background:color-mix(in oklab,var(--tint) 16%,transparent);border-radius:3px}
  .token.hovered{background:color-mix(in oklab,var(--tint) 42%,transparent)}
  .token[data-kind="variant"],.token[data-kind="tags"],.token[data-kind="overlap"],.token[data-kind="index"],.token[data-kind="prefix"]{font-family:var(--ui-font-mono),var(--ids-font);font-size:17px}
  .scopes{position:absolute;left:0;bottom:0;overflow:visible;fill:none}
  .scopes path{stroke:color-mix(in oklab,var(--tint) 55%,var(--ui-color-ink-soft));stroke-width:1.2;stroke-linecap:round}
  .scopes path.hovered{stroke:var(--ui-color-accent);stroke-width:2}
  .chip{display:inline-block;min-width:1.4em;padding:0 5px;border-radius:var(--ui-radius-xs);text-align:center;font-family:var(--ids-font);font-size:17px;line-height:1.5;color:color-mix(in oklab,var(--ui-color-ink) 62%,var(--tint));background:color-mix(in oklab,var(--tint) 18%,transparent);white-space:nowrap}
  .chip.hovered{background:color-mix(in oklab,var(--tint) 42%,transparent)}
  .tokens{border-collapse:collapse;width:100%;font-size:13px;line-height:1.5}
  .tokens td{padding:4px 8px;border-top:1px solid var(--ui-color-border);vertical-align:top}
  .tokens tr.hovered td{background:var(--ui-color-surface-sunken)}
  .tokens .what{width:1%;white-space:nowrap}
  .tokens .kind{width:1%;white-space:nowrap}
  .reading{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
  .rule{font-family:var(--ui-font-mono);font-size:12px;color:var(--ui-color-accent);text-decoration:none}
  .rule:hover{text-decoration:underline}
  .code,code{font-family:var(--ui-font-mono),var(--ids-font);font-size:12px}
  .muted{color:var(--ui-color-ink-muted)}
  .read{font:inherit;font-size:12px;padding:0 6px;border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-xs);background:var(--ui-color-surface);color:var(--ui-color-accent);cursor:pointer}
  .read:hover{border-color:var(--ui-color-accent)}
  .read:focus-visible,.tree-tools button:focus-visible,summary:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:1px}
  .variant{display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
  .letter{white-space:nowrap}
  .open{font-size:11px;padding:0 6px;border:1px dashed var(--ui-color-border-strong);border-radius:var(--ui-radius-xs);color:var(--ui-color-ink-soft);text-decoration:none}
  .strokes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;width:100%}
  .strokes li{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
  .strokes .index{font-family:var(--ui-font-mono);font-size:11px;color:var(--ui-color-ink-muted);min-width:1.5em}
  .stroke{font-family:var(--ids-font);font-size:16px}
  .spec{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;width:100%}
  .matrix{border-collapse:collapse}
  .matrix th{font-family:var(--ui-font-mono);font-size:11px;font-weight:400;color:var(--ui-color-ink-muted);padding:1px 6px 1px 0;text-align:right}
  .matrix td{min-width:22px;padding:1px 6px;text-align:center;border:1px solid var(--ui-color-border);cursor:help}
  .matrix td.empty{color:var(--ui-color-ink-muted)}
  .tree-box > summary{cursor:pointer;font-size:13px;color:var(--ui-color-accent);width:max-content}
  .tree-tools{display:flex;gap:6px;margin:8px 0 4px}
  .tree-tools button{font:inherit;font-size:12px;padding:2px 8px;border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-xs);background:var(--ui-color-surface);color:var(--ui-color-ink-soft);cursor:pointer}
  .tree-tools button:hover{color:var(--ui-color-ink);border-color:var(--ui-color-ink-muted)}
  .tree,.tree ul{list-style:none;margin:0;padding:0 0 0 14px;font-size:12.5px;line-height:1.6}
  .tree{padding:0;overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--ui-color-border-strong) transparent}
  .tree ul{border-left:1px solid var(--ui-color-border);margin-left:5px}
  .tree summary{cursor:pointer;white-space:nowrap}
  .tree .leaf,.tree .terminal{padding-left:14px;white-space:nowrap}
  .sep{margin:0 4px;color:var(--ui-color-ink-muted)}
  .span{color:var(--ui-color-ink-soft);font-size:13px}
  .terminal code{color:var(--ui-color-ink-muted)}
  @media (max-width:520px) {
    .top{flex-direction:column;gap:8px}
    .tokens .kind{display:none}
  }
</style>
