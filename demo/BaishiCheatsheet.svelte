<script>
  // The zi.tools (白式) extended IDS on one sheet, laid out top down as its grammar nests: a row,
  // its entries, an IDS and its operators, components, variant identifiers, stroke chains and the
  // brackets after an operator. Each level gives its rules from data/baishi-ids.ebnf and links to the
  // same anchor of the specification page (demo/lib/baishi-sections.js); each card is a quoted
  // sequence beside the character it describes, a written part and the strokes it names in one
  // colour. The cards and their sources are demo/lib/baishi-cheatsheet.js; the outlines are prepared
  // by demo/scripts/build-baishi-cheatsheet.mjs.
  import PageHeader from './ui/PageHeader.svelte'
  import Dialog from './ui/Dialog.svelte'
  import Icon from './ui/Icon.svelte'
  import NotationSequence from './ui/NotationSequence.svelte'
  import { OP_NAMES, translator } from '../src/svelte/index.js'
  import { watchFallback } from '../src/svelte/fallback-font.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { SECTIONS, sectionHref } from './lib/baishi-sections.js'
  import { readGrammar } from './lib/railroad.js'
  import ebnf from '../data/baishi-ids.ebnf?raw'
  import { GLOSS, GRAMMAR, GROUP_LABELS, SHEET, SOURCE, NA_FORMS, ROOF_FORMS, TURN_GLYPHS, UNUSED, arityOf, bareOf, entriesOf, focusOf, idsOf, kindOf, tokenise, variantBody } from './lib/baishi-cheatsheet.js'
  import { chainPath } from '../src/core/chain-shape.js'
  import documentedForms from './lib/baishi-variant-glyphs.json'
  import exampleLicence from '../fonts/OFL-Baishi-example.txt?url'
  import outlines from './lib/baishi-cheatsheet-outlines.json'

  const params = new URLSearchParams(location.search)
  const wanted = String(params.get('lang') ?? load('locale', null) ?? navigator.language ?? '')
  const traditional = /^zh-(?:Hant|TW|HK|MO)\b/i
  let locale = $state(LOCALES.find(([code]) => code === wanted)?.[0]
    ?? (traditional.test(wanted) ? 'zh-Hant' : undefined)
    ?? LOCALES.find(([code]) => wanted.startsWith(code.split('-')[0]))?.[0] ?? 'en')
  $effect(() => save('locale', locale))
  $effect(() => { document.documentElement.lang = locale })
  const messages = $derived(LOCALES.find(([code]) => code === locale)?.[2])
  const t = $derived(translator({ ...appMessages('en'), ...messages, ...appMessages(locale) }, locale))

  const GLYPHS = /** @type {Record<string, string[]>} */ ({ ...outlines.components, ...outlines.glyphs })
  const COMPOSED = /** @type {Record<string, string[]>} */ (outlines.composed)
  const ROWS = /** @type {Record<string, string>} */ (outlines.rows)
  const FORMS = /** @type {Record<string, string>} */ (documentedForms)
  const grammar = readGrammar(ebnf)
  const anchors = new Map(SECTIONS.map(section => [section.id, section]))
  /** An anchor's name: the title the specification gives it, or its rule. @param {string} id */
  const nameOf = id => { const section = anchors.get(id); return section?.title ? t(section.title) : section?.rule ?? id }
  /** A group's heading: its own label where the sheet has one. @param {string} id */
  const groupName = id => {
    const [kind, name] = (GROUP_LABELS[id] ?? '').split('.')
    return kind === 'group' ? t(`cheatsheet.group.${name}`) : kind === 'section' ? t(`cheatsheet.section.${name}`) : kind === 'label' ? t(`cheatsheet.label.${name}`) : nameOf(id)
  }

  /** @typedef {import('./lib/baishi-cheatsheet.js').Card} Card */
  /** @typedef {import('./lib/baishi-cheatsheet.js').Quote} Quote */
  /** @typedef {import('./lib/baishi-cheatsheet.js').Piece} Piece */
  /** @typedef {import('./lib/baishi-cheatsheet.js').Glyph} Glyph */
  /** A piece of an outline as drawn: its path and the box it is cut to. @typedef {{ d: string, box: number[] | null }} Cut */

  /** Pieces of an outline, those cut to the same box drawn as one path so a ring keeps its hole.
   * @param {string[]} contours @param {Piece[]} pieces @returns {Cut[]} */
  function cuts(contours, pieces) {
    /** @type {Map<string, Cut>} */
    const byBox = new Map()
    for (const piece of pieces) {
      const box = typeof piece === 'number' ? null : piece.slice(1)
      const key = box ? box.join() : ''
      const cut = byBox.get(key) ?? { d: '', box }
      cut.d += contours[typeof piece === 'number' ? piece : piece[0]]
      byBox.set(key, cut)
    }
    return [...byBox.values()]
  }

  /**
   * A quotation ready to draw: its tokens with their colour slot and what the card is about, and
   * the drawing of each entry, an outline cut into its parts or the composer's drawing.
   * @param {Card} card @param {Quote} quote @param {number} at
   */
  function prepare(card, quote, at) {
    const ranges = focusOf(quote)
    const read = tokenise(quote.text, { strokes: quote.strokes })
    /** @param {number} entry */
    const coloured = entry => { const glyph = quote.glyphs[entry]; return glyph === 'composed' || Boolean(glyph?.parts) }
    /** @param {number} leaf */
    const slotOf = leaf => quote.slots?.[leaf] ?? leaf
    const tokens = read.map(token => ({
      ...token,
      slot: token.leaf !== undefined && coloured(token.entry) ? slotOf(token.leaf) : null,
      // What the token lights: its own part, or every part under an operator or in a chain.
      lights: !coloured(token.entry) ? null : token.leaf !== undefined ? [slotOf(token.leaf)] : token.leaves ? [...new Set(token.leaves.map(slotOf))] : null,
      subject: token.stretches.map(stretch => ranges.some(([from, to]) => stretch.at < to && stretch.at + [...stretch.text].length > from)),
    }))
    /** @param {number} entry @param {number} slot */
    const names = (entry, slot) => tokens.filter(token => token.entry === entry && token.slot === slot && token.leaf !== undefined).map(token => token.text).join(' ')
    const tiles = quote.glyphs.flatMap((glyph, entry) => {
      if (!glyph) return []
      if (glyph === 'composed') {
        const parts = COMPOSED[/** @type {string} */ (bareOf(read, entry))]
        /** @type {Map<number, string>} */
        const bySlot = new Map()
        parts.forEach((d, leaf) => bySlot.set(slotOf(leaf), (bySlot.get(slotOf(leaf)) ?? '') + d))
        return [{ entry, char: quote.char, composed: true, ink: '', rest: /** @type {Cut[]} */ ([]), layers: [...bySlot].map(([slot, d]) => ({ slot, cuts: [{ d, box: null }], names: names(entry, slot) })), marks: [], cross: null }]
      }
      const contours = glyph.contours ?? GLYPHS[glyph.char]
      const strokes = tokens.filter(token => token.entry === entry && token.kind === 'stroke')
      const closed = tokens.some(token => token.entry === entry && token.kind === 'close')
      // Where the chain takes up each stroke: a square after a break, a filled ring where it closes.
      const marks = (glyph.joins ?? []).map(([x, y], order) => ({ x, y, order, slot: strokes[order]?.slot ?? 0,
        broken: order > 0 && strokes[order - 1]?.stretches.some(stretch => stretch.role === 'mark' && stretch.text === 'b'), closed: closed && order === 0 }))
      return [{ entry, char: glyph.char, composed: Boolean(glyph.composed), ink: glyph.parts ? '' : contours.join(''), rest: cuts(contours, glyph.rest ?? []),
        layers: (glyph.parts ?? []).map((pieces, slot) => ({ slot, cuts: cuts(contours, pieces), names: names(entry, slot) })), marks, cross: glyph.cross ?? null }]
    })
    return { ...quote, key: `${card.id}/${at}`, tokens, tiles, numbered: Boolean(quote.strokes) && tokens.filter(token => token.kind === 'stroke').length > 1 }
  }
  /** @typedef {ReturnType<typeof prepare>} Shown */
  /** @param {Card} card */
  const shown = card => ({ ...card, quotes: card.quotes.map((quote, at) => prepare(card, quote, at)) })
  const sheet = SHEET.map(section => ({ ...section, cards: (section.cards ?? []).map(shown), groups: (section.groups ?? []).map(group => ({ ...group, cards: (group.cards ?? []).map(shown) })) }))
  /** @typedef {ReturnType<typeof shown>} ShownCard */

  // The token pointed at, focused or pressed: it inverts, its parts light in the drawing, and a tooltip
  // says what it is. A press, or a tap, pins the tooltip until another press, Escape or a press elsewhere.
  /** @type {{ key: string, index: number, card: ShownCard, quote: Shown } | null} */
  let pointed = $state(null)
  let pinned = $state(false)
  /** @type {{ left: number, top: number, bottom: number } | null} */
  let anchor = $state(null)
  /** @type {HTMLElement | null} */ let tipBox = $state(null)
  let place = $state({ left: 0, top: 0 })
  /** @type {HTMLElement | null} */ let pointedAt = null
  /** @param {ShownCard} card @param {Shown} quote @param {number} index @param {HTMLElement | null} element @param {'hover' | 'focus' | 'pin'} how */
  function point(card, quote, index, element, how) {
    const same = pointed?.key === quote.key && pointed.index === index
    if (!element) { if (same && (how === 'focus' || !pinned)) forget(); return }
    if (how === 'pin') { if (pinned && same) { forget(); return } pinned = true }
    else if (how === 'hover' && pinned) return
    else pinned = false
    pointed = { key: quote.key, index, card, quote }
    pointedAt = element
    follow()
  }
  const forget = () => { pointed = null; pinned = false; anchor = null; pointedAt = null }
  // The tooltip stays with its token while the page, a card's sequence or a dialog scrolls under it.
  $effect(() => {
    addEventListener('scroll', follow, { capture: true, passive: true })
    return () => removeEventListener('scroll', follow, { capture: true })
  })
  function follow() {
    if (!pointedAt) return
    const rect = pointedAt.getBoundingClientRect()
    anchor = { left: rect.left, top: rect.top, bottom: rect.bottom }
  }
  // The tooltip sits under its token, or over it near the foot of the window, and inside the window's width.
  $effect(() => {
    if (!tipBox || !anchor) return
    const { width, height } = tipBox.getBoundingClientRect()
    const below = anchor.bottom + 14
    place = { left: Math.max(8, Math.min(anchor.left - 8, innerWidth - width - 8)), top: below + height <= innerHeight - 8 ? below : Math.max(8, anchor.top - height - 10) }
  })
  /** @param {Shown} quote @param {number} entry */
  const lit = (quote, entry) => pointed?.key === quote.key && pointed.quote.tokens[pointed.index].entry === entry ? pointed.quote.tokens[pointed.index].lights : null

  /** The identifiers a list writes. @param {string} list */
  const listed = list => list.slice(1, -1).split(',')
  /** What a source letter stands for, as the grammar prints it. @param {string} letter */
  const sourceName = letter => GLOSS.source[letter] && GLOSS.source[letter] !== letter ? `${letter} (${GLOSS.source[letter]})` : letter
  /** The letters of a style identifier with the gloss the grammar prints for each. @param {string} id */
  const glossed = id => [...id].filter(letter => GLOSS.style[letter]).map(letter => `${letter} ${GLOSS.style[letter]}`).join(' · ')
  /**
   * What a token is, for its tooltip: its kind and what it does.
   * @param {Shown['tokens'][number]} token @returns {{ kind: string, lines: string[] }}
   */
  function describe(token) {
    const piece = token.stretches[0].text
    switch (token.kind) {
      case 'head': return { kind: t('cheatsheet.kind.head'), lines: [t('cheatsheet.tip.head')] }
      case 'tab': return { kind: 'TAB', lines: [t('cheatsheet.tip.tab')] }
      case 'sep': return { kind: t('cheatsheet.kind.sep'), lines: [t('cheatsheet.tip.sep')] }
      case 'prefix': return { kind: t('cheatsheet.section.prefix'), lines: [t('cheatsheet.tip.prefix'), ...(piece.startsWith('{?') ? [t('cheatsheet.hint.prefixDistant')] : []), ...(/[A-Z]\}$/.test(piece) ? [t('cheatsheet.hint.prefixSource')] : [])] }
      case 'op': {
        const mod = token.stretches[1]?.text
        const lines = [t(`cheatsheet.tip.operator.${arityOf(piece)}`)]
        if (mod && piece === '⿻') lines.push(...mod.slice(1, -1).split('|').map((spec, at) => at ? t('cheatsheet.hint.reverse2') : t(spec.includes(':') ? 'cheatsheet.hint.slice' : 'cheatsheet.hint.matrix')))
        else if (mod) lines.push(t('cheatsheet.hint.space'))
        return { kind: `${piece} ${t(`ids.op.${OP_NAMES[piece]}`)}`, lines }
      }
      case 'part': {
        const tag = token.stretches[1]?.text
        const lines = [t('コリユス'.includes(piece) ? 'cheatsheet.tip.katakana' : 'cheatsheet.tip.part')]
        if (tag) {
          const kind = kindOf(tag)
          lines.push(kind === 'default' ? t('cheatsheet.hint.tagDefault') : kind === 'source' ? t('cheatsheet.tip.tag.source', { source: sourceName(tag) })
            : kind === 'style' || kind === 'position' ? t('cheatsheet.tip.tag.style') : t('cheatsheet.tip.tag.other'))
          if ((kind === 'style' || kind === 'position') && glossed(tag)) lines.push(glossed(tag))
        }
        return { kind: t('cheatsheet.kind.part'), lines }
      }
      case 'open': case 'shut': return { kind: t('cheatsheet.kind.chain'), lines: [t('cheatsheet.hint.chain')] }
      case 'close': return { kind: t('cheatsheet.label.closed'), lines: [t('cheatsheet.hint.closed')] }
      case 'stroke': {
        const stroke = token.stretches.find(stretch => stretch.role === 'stroke')?.text ?? ''
        const mark = token.stretches.find(stretch => stretch.role === 'mark')?.text
        const lines = [/^[A-Za-z]+$/.test(stroke) ? t('cheatsheet.tip.letters') : '◝◞◟◜'.includes(stroke) ? t('cheatsheet.hint.curves') : t('cheatsheet.tip.stroke')]
        if (GLOSS.stroke[stroke]) lines.push(`${stroke} = ${GLOSS.stroke[stroke]}`)
        if (token.stretches.some(stretch => stretch.role === 'rev')) lines.push(t('cheatsheet.hint.reverse'))
        if (mark === 'b') lines.push(t('cheatsheet.tip.break'))
        else if (mark) lines.push(t('cheatsheet.hint.cross'))
        return { kind: t('cheatsheet.kind.stroke'), lines }
      }
      default: return { kind: t('cheatsheet.section.lists'), lines: listed(piece).map(id => {
        const kind = kindOf(id)
        const gloss = (kind === 'style' || kind === 'position') && glossed(id) ? ` (${glossed(id)})` : ''
        return `${id}  ${kind === 'default' ? t('cheatsheet.hint.listDefault') : kind === 'source' ? t('cheatsheet.tip.list.source', { source: sourceName(id) }) : kind === 'mirror' ? t('cheatsheet.tip.list.mirror') : t(`cheatsheet.tip.list.${kind}`)}${gloss}`
      }) }
    }
  }
  /** A component's own row: each entry with its identifiers, whether the tag written names it, and
   * whether it is the entry the font's outline is drawn for, the (J) entry or else the default.
   * @param {string} char @param {string | undefined} tag */
  function variantsOf(char, tag) {
    const row = ROWS[char]
    if (!row) return []
    const entries = entriesOf(`${char}\t${row}`).map(text => ({ text, ids: idsOf(text) }))
    // An entry without a list is the form a component without a tag, or with a dot, takes.
    const plain = entries.find(entry => entry.ids.includes('.')) ?? entries.find(entry => !entry.ids.length)
    // The bundled 𤽄 has the hooked stem of 小 in its V form.
    const font = entries.find(entry => entry.ids.includes(char === '𤽄' ? 'V' : 'J')) ?? plain
    // Alternative decompositions bearing the same identifier describe the same glyph.
    return entries.map(entry => ({ ...entry, font: entry === font,
      native: font && (entry === font || entry.ids.some(id => font.ids.includes(id)) || (!entry.ids.length && !font.ids.length)),
      named: tag ? entry.ids.includes(tag) || (tag === '.' && entry === plain) : false }))
  }
  /** The drawing of a component's variant inside a character that has it, where a card gives one.
   * @param {string} char @param {string[]} ids */
  const variantTile = (char, ids) => sheet.flatMap(section => [...section.cards, ...section.groups.flatMap(group => group.cards)]).flatMap(card => card.quotes)
    .find(quote => quote.char === char && quote.tiles.length === 1 && quote.tiles[0].rest.length && idsOf(quote.text).some(id => ids.includes(id)))?.tiles[0] ?? null
  const tip = $derived.by(() => {
    if (!pointed) return null
    const token = pointed.quote.tokens[pointed.index]
    const char = token.kind === 'part' ? token.stretches[0].text : ''
    const all = char ? variantsOf(char, token.stretches[1]?.text) : []
    const glyph = char && GLYPHS[char] ? GLYPHS[char].join('') : ''
    // Six entries at most, in the row's order: the one named and the one the font draws are always among them.
    /** @param {typeof all[number]} variant */
    const preferred = variant => variant.named || variant.font
    const kept = new Set([...all.filter(preferred), ...all.filter(variant => !preferred(variant))].slice(0, 6))
    const variants = all.filter(variant => kept.has(variant))
    return { token, ...describe(token), char, glyph: all.length ? '' : glyph,
      variants: variants.map(variant => {
        const tile = variantTile(char, variant.ids)
        const body = variantBody(variant.text).replace(/^\{[^}]*\}/u, '')
        const stroke = TURN_GLYPHS.get(body)
        const reference = char === '宀' ? ROOF_FORMS.get(body) : char === '八' || char === '乂' ? NA_FORMS.get(body) : undefined
        const documented = variant.ids.map(id => FORMS[char + id]).find(Boolean)
        const ink = reference || documented || (variant.native ? glyph : stroke ? GLYPHS[stroke].join('') : '')
        // The 㠯(x) walk collapses to a square. 弓(z)'s quoted final stroke and
        // the guide's 𤓷 example disagree. Neither diagram identifies the form.
        const omitChain = (char === '㠯' && variant.ids.includes('x')) || (char === '弓' && variant.ids.includes('z'))
        const line = !tile && !ink && !omitChain && body.startsWith('#(') ? chainPath(body) : null
        return { ...variant, ink, tile, line }
      }), more: all.length - variants.length,
      // The other quotations of the card stand beside an operator's bracket: with it and without.
      beside: token.kind === 'op' && pointed.card.quotes.length > 1 ? pointed.card.quotes : [] }
  })

  /** @type {{ card: ShownCard, quote: Shown } | null} */
  let zoomed = $state(null)
  let zoomOpen = $state(false)
  // The tooltip belongs to the sequence under the pointer: it goes when the enlarged glyph opens or closes.
  $effect(() => { if (!zoomOpen) zoomed = null; forget() })
  let helpOpen = $state(false)
  /** @type {HTMLElement | null} */ let page = $state(null)
  $effect(() => { if (page) return watchFallback(page) })
</script>

<svelte:head>
  <title>{t('cheatsheet.title')} — {t('app.title')}</title>
</svelte:head>
<svelte:window onresize={follow} onkeydown={event => { if (event.key === 'Escape' && pointed) forget() }}
  onpointerdown={event => { if (pinned && !(/** @type {Element} */ (event.target)).closest?.('[data-token]')) forget() }} />

{#snippet cut(/** @type {Cut} */ piece)}
  {#if piece.box}<svg x={piece.box[0]} y={piece.box[1]} width={piece.box[2] - piece.box[0]} height={piece.box[3] - piece.box[1]} viewBox={`${piece.box[0]} ${piece.box[1]} ${piece.box[2] - piece.box[0]} ${piece.box[3] - piece.box[1]}`}><path d={piece.d} /></svg>{:else}<path d={piece.d} />{/if}
{/snippet}

<!-- The marks of a chain are larger in a card's small tile than in the enlarged glyph, where they are numbered. -->
{#snippet drawing(/** @type {Shown['tiles'][number]} */ tile, /** @type {number[] | null} */ lights, /** @type {boolean} */ numbered)}
  {@const size = numbered ? 1 : 1.45}
  <svg class="glyph" class:small={!numbered} viewBox="0 0 1000 1000" role="img" aria-label={tile.layers.length ? `${tile.char}: ${tile.layers.map(layer => layer.names).join(' ')}` : tile.char}>
    {#if tile.ink}<path class="ink" d={tile.ink} />{/if}
    <g class="rest">{#each tile.rest as piece, at (at)}{@render cut(piece)}{/each}</g>
    {#each tile.layers as layer (layer.slot)}
      <g class={['part', `s${layer.slot}`]} class:dim={lights !== null && !lights.includes(layer.slot)} class:lit={lights !== null && lights.includes(layer.slot)}>
        <title>{layer.names}</title>{#each layer.cuts as piece, at (at)}{@render cut(piece)}{/each}
      </g>
    {/each}
    {#if tile.cross}{#each ['halo', ''] as halo (halo)}<path class={['cross', halo]} d={`M${tile.cross[0] - 38 * size} ${tile.cross[1] - 38 * size}l${76 * size} ${76 * size}m0 ${-76 * size}l${-76 * size} ${76 * size}`} />{/each}{/if}
    {#each tile.marks as mark (mark.order)}
      {#if mark.broken}<rect class={['join', `s${mark.slot}`]} x={mark.x - 30 * size} y={mark.y - 30 * size} width={60 * size} height={60 * size} />
      {:else}<circle class={['join', `s${mark.slot}`]} cx={mark.x} cy={mark.y} r={33 * size} />{/if}
      {#if mark.closed}<circle class={['closing', `s${mark.slot}`]} cx={mark.x} cy={mark.y} r={13 * size} />{/if}
      {#if numbered}<text class="order" x={mark.x} y={mark.y - 52}>{mark.order}</text>{/if}
    {/each}
  </svg>
{/snippet}

<!-- What the pointed token is. It is drawn in the page, or inside the enlarged glyph's dialog, which stands over the page. -->
{#snippet tooltip()}
  {#if tip && anchor}
    <div class="tip" id="cheatsheet-tip" role="tooltip" bind:this={tipBox} style:left={`${place.left}px`} style:top={`${place.top}px`}>
      <p class="kind"><code lang="ja">{tip.token.kind === 'tab' ? '⇥' : tip.token.text}</code>{tip.kind}</p>
      {#each tip.lines as line, at (at)}<p>{line}</p>{/each}
      {#if tip.variants.length}
        <ul class="variants" lang="ja">
          {#each tip.variants as variant (variant.text)}
            <li class:named={variant.named}>
              {#if variant.tile}<span class="mini">{@render drawing(variant.tile, null, false)}</span>
              {:else if variant.ink}<svg class="mini" viewBox="0 0 1000 1000" role="img" aria-label={tip.char}><path class="ink" d={variant.ink} /></svg>
              {:else if variant.line}<svg class="mini composed" viewBox="0 0 1000 1000" aria-hidden="true"><path class="line" d={variant.line} /></svg>{/if}
              <code>{variant.text}</code>
            </li>
          {/each}
          {#if tip.more}<li class="more">+{tip.more}</li>{/if}
        </ul>
      {:else if tip.glyph}
        <div class="variants"><svg class="mini" viewBox="0 0 1000 1000" role="img" aria-label={tip.char}><path class="ink" d={tip.glyph} /></svg></div>
      {/if}
      {#if tip.beside.length}
        <ul class="beside" lang="ja">
          {#each tip.beside as quote (quote.key)}<li>{#if quote.tiles[0]}<span class="mini">{@render drawing(quote.tiles[0], null, false)}</span>{/if}<code>{quote.text}</code></li>{/each}
        </ul>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet about(/** @type {string | undefined} */ label, /** @type {string | undefined} */ hint, /** @type {string} */ subject, /** @type {string | undefined} */ link, /** @type {string} */ lang)}
  <header class="about">
    <span class="what">
      {#if subject}<code class="subject" lang="ja">{subject}</code>{/if}
      {#if label}{#if link}<a class="label" href={sectionHref('spec', link)} {lang}>{label}</a>{:else}<span class="label" {lang}>{label}</span>{/if}{/if}
    </span>
    {#if hint}<p class="hint">{hint}</p>{/if}
  </header>
{/snippet}

{#snippet card(/** @type {ShownCard} */ item)}
  {@const first = item.quotes[0]}
  {@const subject = first.tokens.flatMap(token => token.stretches.filter((_, at) => token.subject[at]).map(stretch => stretch.text)).join('')}
  {@const operator = item.id.startsWith('op-') ? first.tokens.find(token => token.kind === 'op' && token.subject[0])?.stretches[0].text : undefined}
  <article class="card" id={item.anchors?.[0]}>
    {#each item.anchors?.slice(1) ?? [] as id (id)}<span {id} class="anchor"></span>{/each}
    {@render about(operator ? t(`ids.op.${OP_NAMES[operator]}`) : item.label ? t(`cheatsheet.label.${item.label}`) : item.id.startsWith('worked-') ? first.char : undefined,
      item.hint && t(`cheatsheet.hint.${item.hint}`), item.id.startsWith('worked-') || subject.length > 8 ? '' : subject === '\t' ? '⇥' : subject, item.anchors?.[0], item.label || operator ? '' : 'ja')}
    {#each item.quotes as quote (quote.key)}
      <div class="quote">
        <div class="tiles">
          {#each quote.tiles as tile (tile.entry)}
            <button type="button" class="tile" class:composed={tile.composed} title={tile.composed ? t('cheatsheet.composed') : t('cheatsheet.zoom')} aria-label={`${t('cheatsheet.zoom')}: ${quote.char}`}
              onclick={() => { zoomed = { card: item, quote }; zoomOpen = true }}>{@render drawing(tile, lit(quote, tile.entry), false)}</button>
          {/each}
        </div>
        <div class="text">
          <!-- A whole row opens with its character; an entry is named by the one it describes. -->
          {#if !quote.text.includes('\t')}<span class="char" lang="ja">{quote.char}</span>{/if}
          <NotationSequence tokens={quote.tokens} label={quote.text.replaceAll('\t', ' ')} numbered={quote.numbered} active={pointed?.key === quote.key ? pointed.index : null} lit={pointed?.key === quote.key ? pointed.quote.tokens[pointed.index].lights : null}
            tip="cheatsheet-tip" onpoint={(index, element, how) => point(item, quote, index, element, how)} />
        </div>
      </div>
    {/each}
  </article>
{/snippet}

{#snippet rules(/** @type {string[] | undefined} */ names)}
  {#if names?.length}<pre class="rules">{names.map(name => grammar.get(name)?.text ?? '').join('\n')}</pre>{/if}
{/snippet}

{#snippet legend(/** @type {import('./lib/baishi-cheatsheet.js').Legend} */ item)}
  <article class="card legend">
    {@render about(t(`cheatsheet.label.${item.id}`), t(`cheatsheet.hint.${item.id}`), '', undefined, '')}
    <dl>{#each item.items as [letter, gloss] (letter)}<div><dt>{letter}</dt>{#if gloss !== letter}<dd lang={item.lang}>{gloss}</dd>{/if}</div>{/each}</dl>
  </article>
{/snippet}

<div class="page" bind:this={page}>
  <PageHeader page="baishi-cheatsheet" title={t('cheatsheet.title')} {t} bind:locale links={[{ href: `./baishi.html?lang=${locale}`, label: t('baishi.title') }, { href: `./baishi.html?lang=${locale}#parser`, label: t('baishi.heading.parser') }]}>
    <button type="button" class="ui-button" data-size="icon" data-variant="quiet" aria-label={t('cheatsheet.help.title')} title={t('cheatsheet.help.title')} onclick={() => { helpOpen = true }}><Icon name="info" /></button>
  </PageHeader>

  <div class="body">
    <nav class="toc" aria-label={t('cheatsheet.contents')}>
      <ol>
        {#each sheet as section (section.id)}
          <li><a href={`#${section.id}`}>{t(`cheatsheet.section.${section.label}`)}</a>
            {#if section.groups.length}<ol>{#each section.groups as group (group.id)}<li><a href={`#${group.id}`}>{groupName(group.id)}</a></li>{/each}</ol>{/if}
          </li>
        {/each}
      </ol>
    </nav>

    <main>
      {#each sheet as section (section.id)}
        <section id={section.id} aria-labelledby={`${section.id}-title`}>
          <header class="level">
            <h2 id={`${section.id}-title`}>{t(`cheatsheet.section.${section.label}`)}</h2>
            {#if section.id !== 'worked'}<a class="spec" href={sectionHref('spec', section.id)}>{t('cheatsheet.spec')}<Icon name="arrow-right" size={13} /></a>{/if}
          </header>
          {@render rules(section.rules)}
          {#if section.cards.length}<div class="cards" class:worked={section.id === 'worked'}>{#each section.cards as item (item.id)}{@render card(item)}{/each}</div>{/if}
          {#each section.groups as group (group.id)}
            <section id={group.id} class="group" aria-labelledby={`${group.id}-title`}>
              <header class="level">
                <h3 id={`${group.id}-title`}>{groupName(group.id)}</h3>
                <a class="spec" href={sectionHref('spec', group.id)}>{t('cheatsheet.spec')}<Icon name="arrow-right" size={13} /></a>
              </header>
              {@render rules(group.rules)}
              <div class="cards">
                {#each group.cards as item (item.id)}{@render card(item)}{/each}
                {#each group.legends ?? [] as item (item.id)}{@render legend(item)}{/each}
                {#if group.id === 'unary-operator'}
                  <article class="card unused">
                    {@render about(t('cheatsheet.unused'), t('cheatsheet.hint.unused'), '', undefined, '')}
                    <div class="quote"><div class="text"><span class="idle" lang="ja">{UNUSED.join(' ')}</span></div></div>
                  </article>
                {/if}
              </div>
            </section>
          {/each}
        </section>
      {/each}

      <footer id="sources">
        <h2>{t('cheatsheet.sources')}</h2>
        <ul>
          <li><span class="what">{t('cheatsheet.source.data')}</span> <a href={SOURCE.repository} target="_blank" rel="noreferrer">yi-bai/ids</a> <a href={`${SOURCE.repository}/tree/${SOURCE.commit}`} target="_blank" rel="noreferrer"><code>{SOURCE.commit.slice(0, 8)}</code></a> · {SOURCE.date} · MIT</li>
          <li><span class="what">{t('cheatsheet.source.notation')}</span> <b class="key">{GRAMMAR.key}</b> <a href={GRAMMAR.url} target="_blank" rel="noreferrer" lang="zh-Hans">{GRAMMAR.title}</a> · {GRAMMAR.date} · {t('cheatsheet.source.notationBy')} <span class="weak">{t('cheatsheet.source.notationNote')}</span></li>
          <li><span class="what">{t('cheatsheet.source.grammar')}</span> <a href={sectionHref('spec', 'row')}>{t('baishi.title')}</a> · <a href={`./baishi-railroad.html?lang=${locale}`}>{t('railroad.title')}</a> · <code>data/baishi-ids.ebnf</code></li>
          <li><span class="what">{t('cheatsheet.source.outlines')}</span> <a href="https://github.com/notofonts/noto-cjk" target="_blank" rel="noreferrer">Noto Sans CJK</a> · <a href="https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project" target="_blank" rel="noreferrer">Plangothic</a> · <a href="https://github.com/mkpoli/han-compose" target="_blank" rel="noreferrer">han-compose</a> <code>{outlines.composer.commit}</code> · <a href="https://glyphwiki.org/wiki/jmj-034221@1">𡮂 JMJ-034221</a> · <a href="https://glyphwiki.org/wiki/u4d22-var-001@1">䴢 (u)</a> · <a href="https://github.com/NightFurySL2001/bai-ids/blob/0ca5ed48f51821d4d54246196f1f5f38c9d6bd6a/fonts/example.woff2">父 (qq222), 八d, 丰..p</a> © 2024–2025 -PT_AxH_RV- · <a href={exampleLicence}>SIL OFL 1.1</a> · <a href="https://glyphwiki.org/wiki/u4e42-j@2">乂J (GlyphWiki)</a> · <a href="https://glyphwiki.org/wiki/u24f44-g@3">𤽄 (.)</a> · <a href="https://github.com/yi-bai/iwds/tree/8302302d615ff1c1f60ae335b118b10060be0ed4">IWDS 128, 316</a></li>
          <li><a href="https://glyphwiki.org/wiki/aj1-13763">工 (q4082)</a> · {t('cheatsheet.source.gong')}</li>
        </ul>
      </footer>
    </main>
  </div>

  {#if !zoomOpen}{@render tooltip()}{/if}

  <Dialog bind:open={zoomOpen} title={zoomed ? zoomed.quote.char : ''} closeLabel={t('app.close')} wide>
    {#if zoomed}
      {@const quote = zoomed.quote}
      {@const owner = zoomed.card}
      <div class="zoom">
        <div class="zoomed">
          {#each quote.tiles as tile (tile.entry)}<div class="big" class:composed={tile.composed}>{@render drawing(tile, lit(quote, tile.entry), true)}</div>{/each}
        </div>
        <div class="beside-zoom">
          <NotationSequence tokens={quote.tokens} label={quote.text.replaceAll('\t', ' ')} numbered={quote.numbered} large active={pointed?.key === quote.key ? pointed.index : null} lit={pointed?.key === quote.key ? pointed.quote.tokens[pointed.index].lights : null}
            tip="cheatsheet-tip" onpoint={(index, element, how) => point(owner, quote, index, element, how)} />
          {#if owner.hint}<p>{t(`cheatsheet.hint.${owner.hint}`)}</p>{/if}
          {#if quote.tiles.some(tile => tile.composed)}<p class="weak">{t('cheatsheet.composed')}</p>{/if}
          <p class="weak"><code>{quote.file ?? 'ids_lv0.txt'}:{quote.row}</code></p>
        </div>
      </div>
      {@render tooltip()}
    {/if}
  </Dialog>

  <Dialog bind:open={helpOpen} title={t('cheatsheet.help.title')} closeLabel={t('app.close')}>
    <ul class="help">
      <li>{t('cheatsheet.help.colour')}</li>
      <li>{t('cheatsheet.help.subject')}</li>
      <li>{t('cheatsheet.help.glyphs')}</li>
      <li>{t('cheatsheet.help.entry')}</li>
      <li>{t('cheatsheet.help.composed')}</li>
      <li>{t('cheatsheet.help.marks')}</li>
    </ul>
  </Dialog>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh;
    /* One colour for each written part and the strokes it names: chosen to stay apart with red-green
       and blue-yellow colour-vision deficiencies, and to read as text on the card and its tile. The
       marker is what a card is about. */
    --part-0:light-dark(#2a67e0,#7db1ff);--part-1:light-dark(#cc4e00,#ffa35c);--part-2:light-dark(#0a5a3a,#12996a);--part-3:light-dark(#651a78,#f0bfea);
    --mark:light-dark(#ffeeb0,#3d3410)}
  .body{display:grid;grid-template-columns:200px minmax(0,1fr);gap:28px;width:100%;max-width:1500px;margin:0 auto;padding:22px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  .toc{position:sticky;top:70px;align-self:start;max-height:calc(100dvh - 86px);overflow:auto;font-size:13px}
  .toc ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
  .toc ol ol{margin:1px 0 6px 10px;padding-left:8px;border-left:1px solid var(--ui-color-border)}
  .toc a{display:block;padding:4px 8px;border-radius:var(--ui-radius-sm);color:var(--ui-color-ink-soft);text-decoration:none}
  .toc ol ol a{padding-block:2px;font-size:12px;color:var(--ui-color-ink-muted)}
  .toc a:hover{background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  main{min-width:0}
  section{scroll-margin-top:70px;margin:0 0 30px}
  .group{margin:16px 0 0}
  .level{display:flex;align-items:baseline;gap:12px;margin:0 0 6px}
  h2{margin:0;font-size:17px;font-weight:var(--ui-weight-bold)}
  h3{margin:0;font-size:13.5px;font-weight:var(--ui-weight-semibold);color:var(--ui-color-ink-soft)}
  .spec{display:inline-flex;align-items:center;gap:3px;font-size:12px;color:var(--ui-color-accent);text-decoration:none}
  .spec:hover{text-decoration:underline}
  .rules,.toc{scrollbar-width:thin;scrollbar-color:var(--ui-color-scrollbar) transparent}
  .rules{margin:0 0 10px;padding:0;overflow-x:auto;font-family:var(--ui-font-mono);font-size:12px;line-height:1.55;color:var(--ui-color-ink-muted);white-space:pre}

  /* Cards take the width of what they quote, so a sequence stays on one line where the window allows. */
  .cards{display:flex;flex-wrap:wrap;align-items:stretch;gap:8px}
  .card{position:relative;display:flex;flex-direction:column;gap:8px;min-width:150px;max-width:100%;padding:10px 12px 12px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface);scroll-margin-top:70px}
  .anchor{position:absolute;top:0;scroll-margin-top:70px}
  .about{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 14px;min-height:18px}
  .what{display:inline-flex;align-items:baseline;gap:6px;flex:none;font-size:12px;font-weight:var(--ui-weight-semibold);color:var(--ui-color-ink-soft)}
  .label{color:inherit;text-decoration:none}
  a.label:hover{color:var(--ui-color-accent);text-decoration:underline}
  .label[lang='ja']{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:15px}
  code.subject{padding:0 5px;border-radius:4px;background:var(--mark);font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:14px;font-weight:700;color:var(--ui-color-ink)}
  /* The description takes no width of its own: it wraps inside what the sequence needs. */
  .hint{flex:1 1 0;width:0;min-width:15em;margin:0;font-size:11.5px;line-height:1.4;color:var(--ui-color-ink-muted);text-align:end;text-wrap:pretty}

  .quote{display:flex;align-items:center;gap:12px;min-width:0}
  .tiles{display:flex;flex:none;gap:6px}
  .tile{all:unset;box-sizing:border-box;display:block;inline-size:64px;block-size:64px;border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken);cursor:zoom-in}
  #stroke-chain .tile,.worked .tile{inline-size:96px;block-size:96px}
  .tile:hover{box-shadow:0 0 0 1px var(--ui-color-border-strong)}
  .tile:focus-visible{outline:var(--ui-ring-width) solid var(--ui-color-focus);outline-offset:var(--ui-ring-offset)}
  /* Drawn by the composer from the sequence, for a form no outline has. */
  .tile.composed,.big.composed{background:none;outline:1.5px dashed var(--ui-color-control-border);outline-offset:-1.5px}
  .text{display:flex;flex-direction:column;gap:2px;min-width:0;overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--ui-color-scrollbar) transparent}
  .char{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:13px;line-height:1.2;color:var(--ui-color-ink-muted)}
  .idle{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:20px;color:var(--ui-color-ink-muted)}

  .glyph{display:block;inline-size:100%;block-size:100%;overflow:visible}
  .ink{fill:var(--ui-color-ink)}
  .rest{fill:var(--ui-color-border-strong)}
  .part{transition:opacity var(--ui-duration-fast) var(--ui-ease)}
  .part.s0,.join.s0,.closing.s0{--part:var(--part-0)}
  .part.s1,.join.s1,.closing.s1{--part:var(--part-1)}
  .part.s2,.join.s2,.closing.s2{--part:var(--part-2)}
  .part.s3,.join.s3,.closing.s3{--part:var(--part-3)}
  .part{fill:var(--part)}
  .part.dim{opacity:.2}
  /* Pointing at a drawn part dims the others of its drawing. */
  .glyph:has(.part:hover) .part:not(:hover){opacity:.2}
  /* Where a chain takes up each stroke, and where two of its strokes cross. */
  .join{fill:var(--ui-color-surface);stroke:var(--part);stroke-width:18}
  .small .join{stroke-width:26}
  .small .cross{stroke-width:20}
  .small .cross.halo{stroke-width:46}
  .closing{fill:var(--part)}
  .cross{fill:none;stroke:var(--ui-color-ink);stroke-width:14;stroke-linecap:round}
  .cross.halo{stroke:var(--ui-color-surface);stroke-width:34}
  .order{fill:var(--ui-color-ink);font:700 54px var(--ui-font-sans);text-anchor:middle;paint-order:stroke;stroke:var(--ui-color-surface);stroke-width:14}

  .unused{border-style:dashed;background:none}
  .legend dl{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0;max-width:420px}
  .legend dl div{display:flex;align-items:baseline;gap:4px}
  .legend dt{font-family:var(--ui-font-mono);font-size:14px;font-weight:700;color:var(--ui-color-ink)}
  .legend dd{margin:0;font-size:12px;color:var(--ui-color-ink-soft)}
  .legend dd[lang='ja']{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:17px;color:var(--ui-color-ink)}

  /* What a token is, under the token. */
  .tip{position:fixed;z-index:var(--ui-z-hint);display:flex;flex-direction:column;gap:5px;width:max-content;max-width:min(340px,calc(100vw - 16px));padding:9px 11px;border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-lg);
    background:var(--ui-color-surface);box-shadow:var(--ui-shadow-2);font-size:12px;line-height:1.45;color:var(--ui-color-ink-soft);pointer-events:none}
  .tip p{margin:0}
  .tip .kind{display:flex;align-items:baseline;gap:7px;font-weight:var(--ui-weight-semibold);color:var(--ui-color-ink)}
  .tip code{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:15px;color:var(--ui-color-ink)}
  /* The entries of a component's row side by side, each under the drawing of its form where there is one. */
  .variants,.beside{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px 8px;margin:0;padding:6px 0 0;border-top:1px solid var(--ui-color-border);list-style:none;min-width:0}
  .variants li,.beside li{display:flex;flex-direction:column;align-items:center;gap:3px;padding:3px 5px;border-radius:5px;overflow-wrap:anywhere}
  .variants li.named{background:var(--mark)}
  .variants li.more{align-self:center;color:var(--ui-color-ink-muted)}
  .mini{flex:none;display:block;inline-size:34px;block-size:34px;border-radius:5px;background:var(--ui-color-surface-sunken)}
  .mini.composed{background:none;outline:1.5px dashed var(--ui-color-control-border);outline-offset:-1.5px}
  .mini .line{fill:none;stroke:var(--ui-color-ink);stroke-width:64;stroke-linecap:round;stroke-linejoin:round}

  .zoom{display:flex;flex-wrap:wrap;align-items:flex-start;gap:18px}
  .zoomed{display:flex;flex-wrap:wrap;gap:10px}
  .big{inline-size:min(300px,70vw);block-size:min(300px,70vw);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface-sunken)}
  .beside-zoom{display:flex;flex:1 1 220px;flex-direction:column;gap:10px;min-width:0;font-size:13px;line-height:var(--ui-leading-normal);color:var(--ui-color-ink-soft);overflow-x:auto}
  .beside-zoom p{margin:0}

  footer{margin-top:34px;padding-top:14px;border-top:1px solid var(--ui-color-border);font-size:12px;color:var(--ui-color-ink-soft)}
  footer h2{font-size:14px;margin-bottom:8px}
  footer ul{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
  footer a{color:var(--ui-color-accent);text-decoration:none}
  footer a:hover{text-decoration:underline}
  footer code{font-family:var(--ui-font-mono);font-size:11.5px}
  footer .what{display:inline-block;min-inline-size:5.5em;margin-inline-end:6px;font-weight:400;color:var(--ui-color-ink-muted)}
  .weak{color:var(--ui-color-ink-muted)}
  .key{font-weight:var(--ui-weight-semibold);color:var(--ui-color-ink)}
  .help{display:flex;flex-direction:column;gap:10px;margin:0;padding-inline-start:18px;font-size:13px;line-height:var(--ui-leading-normal);color:var(--ui-color-ink-soft)}

  @media (max-width:860px) {
    .body{grid-template-columns:minmax(0,1fr);gap:14px}
    .toc{position:static;max-height:none}
    .toc>ol{flex-direction:row;flex-wrap:wrap;gap:2px 4px}
    .toc ol ol{display:none}
  }
  @media (max-width:520px) {
    .card{min-width:0;flex:1 1 auto}
    .quote{flex-wrap:wrap}
    #stroke-chain .tile,.worked .tile{inline-size:80px;block-size:80px}
    .hint{min-width:8em}
  }
  @media (prefers-reduced-motion:reduce) {
    .part{transition:none}
  }
</style>
