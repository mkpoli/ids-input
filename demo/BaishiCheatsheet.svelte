<script>
  // The zi.tools (白式) extended IDS on one sheet: each construct as a quoted sequence beside the
  // character it describes, a written part and the strokes it names in one colour. The cards and
  // their sources are demo/lib/baishi-cheatsheet.js; the outlines are prepared by
  // demo/scripts/build-baishi-cheatsheet.mjs, and a chain's line is drawn from the chain itself.
  import PageHeader from './ui/PageHeader.svelte'
  import Dialog from './ui/Dialog.svelte'
  import Icon from './ui/Icon.svelte'
  import { translator } from '../src/svelte/index.js'
  import { watchFallback } from '../src/svelte/fallback-font.js'
  import { chainStrokes } from '../src/core/chain-shape.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { pages } from './lib/pages.js'
  import { DRAFTS, GRAMMAR, LEGENDS, SECTIONS, SOURCE, UNUSED, focusOf, tokenise } from './lib/baishi-cheatsheet.js'
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
  // The reference page of the same notation, once the workshop has it.
  const reference = $derived(pages(t).find(page => page.id === 'baishi'))

  const GLYPHS = /** @type {Record<string, string[]>} */ (outlines.glyphs)
  /** The syntax each section is about, as written. */
  const SHAPES = /** @type {Record<string, string>} */ ({ rows: '字⇥…;…⇥…', operators: '⿰ … ⿿', katakana: 'コ リ ユ ス', tags: '字x', lists: '(x,y)', prefix: '{字}', chains: '#(…)', letters: 'H S P N …', overlap: '⿻[…]', index: '⿴[n]' })

  /** @typedef {import('./lib/baishi-cheatsheet.js').Card} Card */
  /** @typedef {import('./lib/baishi-cheatsheet.js').Quote} Quote */
  /**
   * A quotation ready to draw: its pieces with their colour slot and whether they are underlined,
   * and its tiles, an outline per entry and the chain's line.
   * @param {Card} card @param {Quote} quote
   */
  function prepare(card, quote) {
    const ranges = focusOf(quote)
    // A written part takes a colour only where something drawn has the same one.
    /** @param {number} entry */
    const coloured = entry => Boolean(quote.glyphs?.[entry]?.parts || quote.chain || quote.slots)
    let stroke = 0
    const tokens = tokenise(quote.text, { strokes: card.strokes }).map(token => ({
      ...token,
      slot: token.leaf !== undefined && coloured(token.entry) ? (quote.slots?.[token.leaf] ?? token.leaf) : null,
      focus: ranges.some(([from, to]) => token.at < to && token.at + [...token.text].length > from),
      index: card.indices && token.kind === 'stroke' ? stroke++ : null,
    }))
    const tiles = (quote.glyphs ?? []).flatMap((glyph, entry) => {
      if (!glyph) return []
      const contours = GLYPHS[glyph.char]
      /** @param {number[]} list */
      const path = list => list.map(index => contours[index]).join('')
      return [{ kind: /** @type {const} */ ('glyph'), entry, char: glyph.char,
        layers: (glyph.parts ?? []).map((list, slot) => ({ slot, d: path(list), names: tokens.filter(token => token.entry === entry && token.slot === slot).map(token => token.text).join('') })),
        rest: path(glyph.rest ?? []), ink: glyph.parts ? '' : contours.join('') }]
    })
    const chain = quote.chain ? chainStrokes(/#\([^)]*\)/u.exec(quote.text)?.[0] ?? '') : null
    return { ...quote, tokens, tiles, line: chain ? chain.strokes.map((part, index) => ({ ...part, slot: card.strokes ? index : 0, index })) : null }
  }
  const sections = SECTIONS.map(section => ({ ...section, cards: section.cards.map(card => ({ ...card, quotes: card.quotes.map(quote => prepare(card, quote)) })) }))

  let helpOpen = $state(false)
  /** @type {HTMLElement | null} */ let main = $state(null)
  $effect(() => { if (main) return watchFallback(main) })
</script>

<svelte:head>
  <title>{t('cheatsheet.title')} — {t('app.title')}</title>
</svelte:head>

{#snippet sequence(/** @type {ReturnType<typeof prepare>} */ quote)}
  <code class="seq" lang="ja">{#each quote.tokens as token, at (at)}<span
    class={['tok', token.kind, token.slot !== null && `s${token.slot}`, token.focus && 'focus']} data-index={token.index}
    title={token.kind === 'tab' ? 'TAB' : undefined}>{token.kind === 'tab' ? '⇥' : token.text}</span>{/each}</code>
{/snippet}

<div class="page">
  <PageHeader page="baishi-cheatsheet" title={t('cheatsheet.title')} {t} bind:locale links={reference ? [{ href: `./baishi.html?lang=${locale}`, label: reference.label }] : []}>
    <button type="button" class="ui-button" data-size="icon" data-variant="quiet" aria-label={t('cheatsheet.help.title')} title={t('cheatsheet.help.title')} onclick={() => { helpOpen = true }}><Icon name="info" /></button>
  </PageHeader>

  <main bind:this={main}>
    {#each sections as section (section.id)}
      <section id={section.id} class={section.id} aria-labelledby={`${section.id}-title`}>
        <h2 id={`${section.id}-title`}>{t(`cheatsheet.section.${section.id}`)}{#if SHAPES[section.id]}<code class="shape" lang="ja">{SHAPES[section.id]}</code>{/if}</h2>
        <div class="grid">
          {#each section.cards as card (card.id)}
            <article class="card" class:small={card.small} class:wide={card.wide}>
              {#if card.label || card.hint}
                <details class="about">
                  <summary><span class="label" lang={card.label ? undefined : 'ja'}>{card.label ? t(`cheatsheet.label.${card.label}`) : card.quotes[0].char}</span>{#if card.open}<span class="open">{t('cheatsheet.open')}</span>{/if}<Icon name="chevron" size={14} /></summary>
                  <p>{t(`cheatsheet.hint.${card.hint}`)}</p>
                </details>
              {/if}
              {#each card.quotes as quote, index (index)}
                <div class="quote">
                  {#if quote.tiles.length || quote.line}
                    <div class="tiles">
                      {#each quote.tiles as tile (tile.entry)}
                        <svg class="tile" viewBox="0 0 1000 1000" role="img" aria-label={tile.layers.length ? `${tile.char}: ${tile.layers.map(layer => layer.names).join(' ')}` : tile.char}>
                          {#if tile.ink}<path class="ink" d={tile.ink} />{/if}
                          {#if tile.rest}<path class="rest" d={tile.rest} />{/if}
                          {#each tile.layers as layer (layer.slot)}
                            <path class={['part', `s${layer.slot}`]} d={layer.d}><title>{layer.names}</title></path>
                          {/each}
                        </svg>
                      {/each}
                      {#if quote.line}
                        <svg class="tile line" viewBox="0 0 1000 1000" role="img" aria-label={t('cheatsheet.line')}>
                          <title>{t('cheatsheet.line')}</title>
                          {#each quote.line as part (part.index)}
                            <path class={['stroke', `s${part.slot}`]} d={part.d} />
                          {/each}
                          {#each quote.line as part (part.index)}
                            <circle class={['start', `s${part.slot}`]} cx={part.from[0]} cy={part.from[1]} r="46" />
                          {/each}
                        </svg>
                      {/if}
                    </div>
                  {/if}
                  <div class="text">
                    <!-- A whole row opens with its character; an entry is named by the one it describes. -->
                    {#if !quote.text.includes('\t')}<span class="char" lang="ja">{quote.char}</span>{/if}
                    <span title={`${quote.file ?? 'ids_lv0.txt'}:${quote.row}`}>{@render sequence(quote)}</span>
                  </div>
                </div>
              {/each}
            </article>
          {/each}
          {#if section.id === 'operators'}
            <article class="card unused">
              <details class="about">
                <summary><span class="label">{t('cheatsheet.unused')}</span><Icon name="chevron" size={14} /></summary>
                <p>{t('cheatsheet.hint.unused')}</p>
              </details>
              <div class="quote"><div class="text"><code class="seq" lang="ja">{UNUSED.join(' ')}</code></div></div>
            </article>
          {/if}
          {#each LEGENDS[section.id] ?? [] as legend (legend.id)}
            <article class="card legend">
              <details class="about">
                <summary><span class="label">{t(`cheatsheet.label.${legend.id}`)}</span><Icon name="chevron" size={14} /></summary>
                <p>{t(`cheatsheet.hint.${legend.id}`)}</p>
              </details>
              <dl>
                {#each legend.items as [letter, gloss] (letter)}
                  <div><dt>{letter}</dt>{#if gloss !== letter}<dd lang={legend.lang}>{gloss}</dd>{/if}</div>
                {/each}
              </dl>
            </article>
          {/each}
        </div>
      </section>
    {/each}

    <footer>
      <h2>{t('cheatsheet.sources')}</h2>
      <ul>
        <li><span class="what">{t('cheatsheet.source.data')}</span> <a href={SOURCE.repository} target="_blank" rel="noreferrer">yi-bai/ids</a> <a href={`${SOURCE.repository}/tree/${SOURCE.commit}`} target="_blank" rel="noreferrer"><code>{SOURCE.commit.slice(0, 8)}</code></a> · {SOURCE.date} · MIT</li>
        <li><span class="what">{t('cheatsheet.source.notation')}</span> <b class="key">{GRAMMAR.key}</b> <a href={GRAMMAR.url} target="_blank" rel="noreferrer" lang="zh-Hans">{GRAMMAR.title}</a> · {GRAMMAR.date} · {t('cheatsheet.source.notationBy')} <span class="weak">{t('cheatsheet.source.notationNote')}</span></li>
        <li><span class="what">{t('cheatsheet.source.drafts')}</span> <b class="key">{DRAFTS.key}</b> {DRAFTS.author}, <span lang="zh-Hans">{DRAFTS.title}</span> {DRAFTS.versions} <span class="weak">{t('cheatsheet.source.draftsNote')}</span></li>
        <li><span class="what">{t('cheatsheet.source.outlines')}</span> <a href="https://github.com/notofonts/noto-cjk" target="_blank" rel="noreferrer">Noto Sans CJK JP</a> · <a href="https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project" target="_blank" rel="noreferrer">Plangothic</a> · <a href="https://github.com/mkpoli/han-compose" target="_blank" rel="noreferrer">han-compose</a> <code>{outlines.composer.commit}</code></li>
      </ul>
    </footer>
  </main>
</div>

<Dialog bind:open={helpOpen} title={t('cheatsheet.help.title')} closeLabel={t('app.close')}>
  <ul class="help">
    <li>{t('cheatsheet.help.colour')}</li>
    <li>{t('cheatsheet.help.glyphs')}</li>
    <li>{t('cheatsheet.help.entry')}</li>
    <li>{t('cheatsheet.help.lines')}</li>
    <li>{t('cheatsheet.help.open')}</li>
  </ul>
</Dialog>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh;
    /* One colour for each written part and the strokes it names: chosen to stay apart with red-green
       and blue-yellow colour-vision deficiencies, and to read as text on the card and its tile. */
    --part-0:light-dark(#2a67e0,#7db1ff);--part-1:light-dark(#cc4e00,#ffa35c);--part-2:light-dark(#0a5a3a,#12996a);--part-3:light-dark(#651a78,#f0bfea)}
  main{width:100%;max-width:1360px;margin:0 auto;padding:20px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  section{scroll-margin-top:74px;margin:0 0 26px}
  h2{display:flex;align-items:baseline;gap:10px;margin:0 0 10px;font-size:14px;font-weight:var(--ui-weight-semibold)}
  .shape{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:14px;font-weight:400;color:var(--ui-color-ink-muted)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:8px;align-items:start}
  .rows .grid,.chains .grid{grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr))}
  .operators .grid,.katakana .grid{grid-template-columns:repeat(auto-fill,minmax(176px,1fr))}
  .letters .grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr))}
  .worked .grid{grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr))}

  .card{display:flex;flex-direction:column;gap:8px;min-width:0;padding:10px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .card.small{padding:8px}
  .about{font-size:12px}
  .about summary{display:flex;align-items:center;gap:6px;width:fit-content;max-width:100%;list-style:none;cursor:pointer;border-radius:var(--ui-radius-xs);color:var(--ui-color-ink-soft);font-weight:var(--ui-weight-semibold)}
  .about summary::-webkit-details-marker{display:none}
  .about summary :global(svg){flex:none;color:var(--ui-color-ink-muted);transition:rotate var(--ui-duration-fast) var(--ui-ease)}
  .about[open] summary :global(svg){rotate:180deg}
  .about summary:hover{color:var(--ui-color-ink)}
  .about .label[lang]{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:15px}
  .about p{margin:6px 0 0;color:var(--ui-color-ink-soft);line-height:var(--ui-leading-normal)}
  .open{padding:0 6px;border:1px dashed var(--ui-color-control-border);border-radius:var(--ui-radius-pill);color:var(--ui-color-ink-muted);font-size:11px;font-weight:var(--ui-weight-medium);line-height:1.6}

  .quote{display:flex;align-items:center;gap:10px;min-width:0}
  .tiles{display:flex;flex:none;gap:6px}
  .tile{inline-size:60px;block-size:60px;border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken)}
  .small .tile{inline-size:40px;block-size:40px}
  .wide .tile{inline-size:112px;block-size:112px}
  .text{display:flex;flex-direction:column;gap:2px;min-width:0}
  .char{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:13px;line-height:1.2;color:var(--ui-color-ink-muted)}
  .seq{font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:20px;line-height:1.5;color:var(--ui-color-ink);overflow-wrap:anywhere}
  .small .seq{font-size:16px}
  .small .char{font-size:16px;color:var(--ui-color-ink)}
  .wide .seq{font-size:22px}
  /* A quotation with nothing drawn stands under the text of the one above it. */
  .wide .quote:not(:has(.tiles)){padding-inline-start:122px}

  /* Written pieces. A part and its tag share a colour and an underline of that slot's pattern, so the
     pairing does not rest on colour alone; what the card is about stands in a box. */
  .tok{border-radius:3px;white-space:nowrap;transition:opacity var(--ui-duration-fast) var(--ui-ease)}
  .tok:is(.tab,.sep,.chain,.close,.list,.prefix){color:var(--ui-color-ink-muted)}
  .tok.mod{color:var(--ui-color-ink-soft)}
  .tok.tab{padding-inline:3px}
  .tok:is(.s0,.s1,.s2,.s3){font-weight:700;text-decoration-line:underline;text-decoration-thickness:2px;text-underline-offset:5px;text-decoration-skip-ink:none}
  .tok.s0{color:var(--part-0);text-decoration-style:solid}
  .tok.s1{color:var(--part-1);text-decoration-style:dashed}
  .tok.s2{color:var(--part-2);text-decoration-style:dotted}
  .tok.s3{color:var(--part-3);text-decoration-style:double;text-decoration-thickness:1px}
  .tok.focus{box-shadow:0 0 0 1.5px var(--ui-color-control-border)}
  .tok.focus:is(.tab,.sep,.chain,.close,.list,.prefix,.mod){color:var(--ui-color-ink)}
  .tok[data-index]::after{content:attr(data-index);margin-inline-start:1px;font-size:11px;font-weight:600;vertical-align:sub;font-family:var(--ui-font-sans)}
  /* Pointing at a part, written or drawn, dims the others of its quotation. */
  .quote:has(.s0:hover) :is(.s1,.s2,.s3),.quote:has(.s1:hover) :is(.s0,.s2,.s3),.quote:has(.s2:hover) :is(.s0,.s1,.s3),.quote:has(.s3:hover) :is(.s0,.s1,.s2){opacity:.28}

  .ink{fill:var(--ui-color-ink)}
  .rest{fill:var(--ui-color-border-strong)}
  .part{transition:opacity var(--ui-duration-fast) var(--ui-ease)}
  .part.s0{fill:var(--part-0)}
  .part.s1{fill:var(--part-1)}
  .part.s2{fill:var(--part-2)}
  .part.s3{fill:var(--part-3)}
  .stroke{fill:none;stroke-width:64;stroke-linecap:round;stroke-linejoin:round;transition:opacity var(--ui-duration-fast) var(--ui-ease)}
  .stroke.s0,.start.s0{stroke:var(--part-0)}
  .stroke.s1,.start.s1{stroke:var(--part-1)}
  .stroke.s2,.start.s2{stroke:var(--part-2)}
  .stroke.s3,.start.s3{stroke:var(--part-3)}
  /* Where the pen starts a stroke. */
  .start{fill:var(--ui-color-surface-sunken);stroke-width:22;transition:opacity var(--ui-duration-fast) var(--ui-ease)}

  .unused{border-style:dashed;background:none}
  .unused .seq{color:var(--ui-color-ink-muted)}
  .legend dl{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0}
  .legend dl div{display:flex;align-items:baseline;gap:4px}
  .legend dt{font-family:var(--ui-font-mono);font-size:14px;font-weight:700;color:var(--ui-color-ink)}
  .legend dd{margin:0;font-size:12px;color:var(--ui-color-ink-soft)}

  footer{margin-top:34px;padding-top:14px;border-top:1px solid var(--ui-color-border);font-size:12px;color:var(--ui-color-ink-soft)}
  footer ul{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
  footer a{color:var(--ui-color-accent);text-decoration:none}
  footer a:hover{text-decoration:underline}
  footer code{font-family:var(--ui-font-mono);font-size:11.5px}
  .what{display:inline-block;min-inline-size:5.5em;margin-inline-end:6px;color:var(--ui-color-ink-muted)}
  .weak{color:var(--ui-color-ink-muted)}
  .key{font-weight:var(--ui-weight-semibold);color:var(--ui-color-ink)}
  .help{display:flex;flex-direction:column;gap:10px;margin:0;padding-inline-start:18px;font-size:13px;line-height:var(--ui-leading-normal);color:var(--ui-color-ink-soft)}

  @media (max-width:520px) {
    .grid,.operators .grid,.katakana .grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
    .worked .grid{grid-template-columns:minmax(0,1fr)}
    .wide .quote{flex-direction:column;align-items:flex-start}
    .wide .quote:not(:has(.tiles)){padding-inline-start:0}
    .wide .tile{inline-size:96px;block-size:96px}
    .seq{font-size:18px}
    .wide .seq{font-size:19px}
  }
  @media (prefers-reduced-motion:reduce) {
    .tok,.part,.stroke,.start,.about summary :global(svg){transition:none}
  }
</style>
