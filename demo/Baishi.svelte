<script>
  // The zi.tools IDS Extension (白式 in its documents) as a reference page: rows, operators, variant identifiers,
  // stroke chains, overlap, index and subtraction brackets, the unique separator, replacement and
  // the merge levels, each example cited to its document and page (demo/lib/baishi.js). Examples in
  // the current notation are drawn with the workshop's preview, chains as their own line; the
  // superseded notation is shown as printed.
  import PageHeader from './ui/PageHeader.svelte'
  import IdsPartIcon from '../src/svelte/IdsPartIcon.svelte'
  import { translator } from '../src/svelte/index.js'
  import { parse, withoutVariants, write } from '../src/core/index.js'
  import { chainPath } from '../src/core/chain-shape.js'
  import { composerPreview } from '@han-compose/composer'
  import engineOutlines from 'ids-engine-outlines'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { COMPOSER_BASE, readFrom } from './lib/composer.js'
  import { createIconDrawings } from './lib/icons.js'
  import { SvelteSet } from 'svelte/reactivity'
  import { onMount } from 'svelte'
  import RailroadCanvas from './ui/RailroadCanvas.svelte'
  import { CHEATSHEET_SECTIONS, ruleId, sectionHref } from './lib/baishi-sections.js'
  import { railroad, readGrammar } from './lib/railroad.js'
  import {
    ANGLES, CELLS, CHANGES, COMPOUNDS, CORRECTIONS, DATABASE, DATA_DIFFERENCES, DOCUMENTS, EBNF, EXAMPLES, EXAMPLE_DIFFERENCES, KINDS,
    MALFORMED, OPERATORS, QUOTES, QU_STEPS, SLICES, SOURCES, SPECIAL, TOOLS, STROKE_LETTERS, STYLE_LETTERS, SUBTRACTIONS, UNSETTLED, splitTag,
  } from './lib/baishi.js'
  import en from './lib/baishi-quotes/en.json'
  import ja from './lib/baishi-quotes/ja.json'
  import ko from './lib/baishi-quotes/ko.json'
  import vi from './lib/baishi-quotes/vi.json'
  import Menu from './ui/Menu.svelte'
  // The grammar the page shows and draws is the file it offers: data/baishi-ids.ebnf, beside its
  // Simplified and Traditional Chinese editions.
  import corrected from '../data/baishi-ids.ebnf?raw'
  import grammarUrl from '../data/baishi-ids.ebnf?url'
  import grammarHansUrl from '../data/baishi-ids.zh-Hans.ebnf?url'
  import grammarHantUrl from '../data/baishi-ids.zh-Hant.ebnf?url'

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

  // A quotation's rendering in the reader's language; a Chinese reader reads the quotation itself.
  const GLOSSES = /** @type {Record<string, Record<string, string>>} */ ({ en, ja, ko, vi })
  /** @param {string} id */
  const gloss = id => locale.startsWith('zh') ? '' : (GLOSSES[locale]?.[id] ?? en[/** @type {keyof typeof en} */ (id)] ?? '')

  // The drawings, one at a time from the workshop's composer, as the forms appendix draws them.
  const queued = createIconDrawings(composerPreview({ base: readFrom(COMPOSER_BASE), fontStyle: 'sans', loaders: engineOutlines }))
  const adapter = /** @type {import('../src/adapter/types.js').IdsAdapter} */ (/** @type {unknown} */ ({
    icon: queued, fontStyle: 'sans', drawable: async (/** @type {string} */ text) => ({ text, leaves: [] }),
  }))
  /**
   * What draws one description: a chain as its own line, a description the workshop reads as its
   * preview without the variant identifiers, or nothing. The preview applies no bracket after an
   * operator, and subtraction and replacement are search syntax, so none of those is drawn.
   * @param {string} body @returns {{ kind: 'chain', d: string } | { kind: 'composed', sequence: string } | null}
   */
  function drawingOf(body) {
    const bare = body.replace(/^\{[^}]*\}/u, '')
    if (/^#\(.*\)$/u.test(bare)) { const d = chainPath(bare); return d ? { kind: 'chain', d } : null }
    if (/[㇯🔄[]/u.test(body)) return null
    const read = parse(body)
    return !read.problem && read.tree !== null ? { kind: 'composed', sequence: write(withoutVariants(read.tree)) } : null
  }
  /** The descriptions the composer drew, and those it could not. */
  const composed = new SvelteSet(), undrawn = new SvelteSet()
  /** Ask for a description's drawing once its place comes into view.
   * @param {HTMLElement} node @param {string} sequence */
  function watch(node, sequence) {
    const ask = () => queued(sequence).then(got => { (got ? composed : undrawn).add(sequence) })
    if (typeof IntersectionObserver === 'undefined') { ask(); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); ask() }
    })
    observer.observe(node)
    return { destroy: () => observer.disconnect() }
  }
  /** Save a file the site serves, under its own name. @param {string} url @param {string} name */
  function download(url, name) {
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
  }
  const languageName = (/** @type {string} */ code) => LOCALES.find(([one]) => one === code)?.[1] ?? code
  const downloads = [
    { label: languageName('en'), note: 'baishi-ids.ebnf', run: () => download(grammarUrl, 'baishi-ids.ebnf') },
    { label: languageName('zh-Hans'), note: 'baishi-ids.zh-Hans.ebnf', run: () => download(grammarHansUrl, 'baishi-ids.zh-Hans.ebnf') },
    { label: languageName('zh-Hant'), note: 'baishi-ids.zh-Hant.ebnf', run: () => download(grammarHantUrl, 'baishi-ids.zh-Hant.ebnf') },
  ]
  const grammarRules = readGrammar(corrected)
  /** The rule the grammar's panel shows. */
  let chosen = $state('row')

  /** A printed text as groups (at TAB) of descriptions (at `;`), each kept as printed.
   * @param {string} text */
  const piecesOf = text => text.split('\t').map(group => group.split(';').map(piece => {
    const { body, tag } = splitTag(piece)
    return { lead: /^\s*/u.exec(piece)?.[0] ?? '', body, tag }
  }))

  const TOC = /** @type {const} */ ([
    ['rows', []], ['operators', ['angles']], ['variants', ['source-letters', 'ucv-position', 'imaginary-ucv', 'alternate', 'other']],
    ['chains', ['letters', 'modifiers', 'characters', 'compounds', 'reverse', 'cross', 'break-mark', 'closing', 'curves']],
    ['overlap', ['quick-slice', 'matrix', 'reverse-matrix', 'curveCase']], ['index', []], ['subtract', []], ['prefix', []],
    ['replace', []], ['levels', []], ['history', []], ['differences', []], ['unsettled', []], ['ebnf', []], ['sources', []],
  ])
  /** The message that names a section, where its id is not its key. */
  const TITLE = /** @type {Record<string, string>} */ ({ 'source-letters': 'sources', 'ucv-position': 'ucv', 'imaginary-ucv': 'imaginary',
    'break-mark': 'break', closing: 'closed', 'quick-slice': 'slice', 'reverse-matrix': 'reverseMatrix', history: 'changes', differences: 'data', sources: 'documents' })
  /** @param {string} id */
  const titleOf = id => t(`baishi.heading.${TITLE[id] ?? id}`)
  const cheatsheet = new Set(/** @type {readonly string[]} */ (CHEATSHEET_SECTIONS))
  // A link to a section lands on it: the page is drawn after the browser looks for the anchor.
  onMount(() => {
    let id = ''
    try { id = decodeURIComponent(location.hash.slice(1)) } catch { id = '' }
    if (id) document.getElementById(id)?.scrollIntoView()
  })
</script>

<svelte:head>
  <title>{t('baishi.title')} — {t('app.title')}</title>
</svelte:head>

{#snippet at(/** @type {readonly [string, string]} */ cite)}
  <a class="at" href={`#doc-${cite[0]}`}>{cite[0]} {cite[1]}</a>
{/snippet}

{#snippet said(/** @type {string} */ id, /** @type {readonly [string, string] | undefined} */ cite)}
  <blockquote>
    <p class="zh" lang="zh-Hans">{QUOTES[id]}</p>
    {#if gloss(id)}<p class="gloss">{gloss(id)}</p>{/if}
    {#if cite}<footer>{@render at(cite)}</footer>{/if}
  </blockquote>
{/snippet}

{#snippet grammar(/** @type {string[]} */ names)}
  <div class="rules" aria-label={t('baishi.grammar')}>
    {#each names as name (name)}
      <div class="rule-block anchor" id={ruleId(name)}>
        {@render cheat(ruleId(name))}
        <a class="rule" href="#grammar-view" onclick={() => { chosen = name }}><pre>{grammarRules.get(name)?.text}</pre></a>
        <div class="railroad">{@html railroad(grammarRules, name).svg}</div>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet cheat(/** @type {string} */ id)}
  {#if cheatsheet.has(id)}<a class="cheat" href={sectionHref('cheatsheet', id)}>{t('baishi.toCheatsheet')}</a>{/if}
{/snippet}

{#snippet badge(/** @type {string} */ kind)}
  <span class="badge" data-kind={kind}>{t(`baishi.${kind}`)}</span>
{/snippet}

{#snippet drawn(/** @type {string} */ body)}
  {@const drawing = drawingOf(body)}
  {#if drawing?.kind === 'chain'}
    <svg class="drawn" viewBox="0 0 1000 1000" aria-hidden="true"><path d={drawing.d} fill="none" stroke="currentColor" stroke-width="64" stroke-linecap="round" stroke-linejoin="round" /></svg>
  {:else if drawing}
    <!-- Only what the composer draws: its rough stand-in would set a chain's letters as text. -->
    {#if !undrawn.has(drawing.sequence)}
      <span class="drawn" use:watch={drawing.sequence}>{#if composed.has(drawing.sequence)}<IdsPartIcon sequence={drawing.sequence} {adapter} />{/if}</span>
    {/if}
  {/if}
{/snippet}

{#snippet written(/** @type {string} */ text)}
  <span class="ids" lang="zh-Hans">{#each piecesOf(text) as group, g (g)}{#if g}<span class="tab" title="TAB">⇥</span>{/if}{#each group as piece, p (p)}{#if p}<span class="semi">;</span>{/if}{piece.lead}{piece.body}{#if piece.tag}<span class="tag">({piece.tag})</span>{/if}{/each}{/each}</span>
{/snippet}

{#snippet example(/** @type {import('./lib/baishi.js').Example} */ one, /** @type {boolean} */ draw)}
  <div class="example">
    <div class="head">
      {#if draw}
        <span class="drawings">{#each piecesOf(one.text) as group, g (g)}{#each group as piece, p (p)}{@render drawn(piece.body)}{/each}{/each}</span>
      {/if}
      {#if one.char}<span class="char" lang="zh-Hans">{one.char}</span>{/if}
      <span class="text">
        {@render written(one.text)}
        {#if one.to}<span class="to"><span class="arrow" aria-label={t('baishi.becomes')}>→</span>{@render written(one.to)}</span>{/if}
      </span>
      <span class="meta">{#if one.label}<span class="label">{one.label}</span>{/if}{@render at(one.at)}</span>
    </div>
    {#if one.quote}
      <p class="zh small" lang="zh-Hans">{QUOTES[one.quote]}</p>
      {#if gloss(one.quote)}<p class="gloss small">{gloss(one.quote)}</p>{/if}
    {/if}
  </div>
{/snippet}

{#snippet examples(/** @type {string} */ key, draw = true)}
  <div class="examples">{#each EXAMPLES[key] as one, i (i)}{@render example(one, draw)}{/each}</div>
{/snippet}

<div class="page">
  <PageHeader page="baishi" title={t('baishi.title')} {t} bind:locale links={[{ href: `./baishi-cheatsheet.html?lang=${locale}`, label: t('cheatsheet.title') }]} />

  <div class="body">
    <nav class="toc" aria-label={t('baishi.contents')}>
      <ul>
        {#each TOC as [id, children] (id)}
          <li><a href={`#${id}`}>{titleOf(id)}</a>
            {#if children.length}<ul>{#each children as child (child)}<li><a href={`#${child}`}>{titleOf(child)}</a></li>{/each}</ul>{/if}
          </li>
        {/each}
      </ul>
    </nav>

    <main>
      <p class="lead">{t('baishi.lead')}</p>

      <section id="rows" aria-labelledby="rows-title">
        <h2 id="rows-title">{t('baishi.heading.rows')}</h2>
        <p>{t('baishi.row.body')}</p>
        {@render grammar(['row', 'headword', 'tab', 'primary group', 'alternative group', 'entry'])}
        {@render said('rowGroups', ['I26', 'p.4 §3.1'])}
        <div id="entry-separator" class="anchor">{@render cheat('entry-separator')}{@render said('rowVariants', ['I26', 'p.6 §4.2'])}</div>
        {@render examples('row')}
      </section>

      <section id="operators" aria-labelledby="operators-title">
        <h2 id="operators-title">{t('baishi.heading.operators')}</h2>
        <p>{t('baishi.operators.body')} {@render at(['I26', 'pp.2–3 §2.1'])}</p>
        <div class="scroll">
          <table>
            <thead><tr><th>{t('baishi.operators.char')}</th><th><span>{t('baishi.operators.code')} · {t('baishi.operators.key')}</span></th><th>{t('baishi.operators.meaning')}</th><th colspan="2">{t('baishi.operators.example')}</th></tr></thead>
            <tbody>
              {#each OPERATORS as [op, code, key, meaning, char, text] (op)}
                <tr>
                  <td class="op" lang="zh-Hans">{op}</td><td class="code">U+{code}<br />{key}</td>
                  <td><span lang="zh-Hans">{meaning}</span>{#if gloss(`idc.${op}`)} <span class="gloss">{gloss(`idc.${op}`)}</span>{/if}</td>
                  <td class="pair"><span class="char" lang="zh-Hans">{char}</span>{@render drawn(text)}</td><td>{@render written(text)}</td>
                </tr>
              {/each}
              <tr class="absent"><td class="op" lang="zh-Hans">〾</td><td class="code">U+303E</td><td colspan="3">{t('baishi.operators.ivi')}</td></tr>
            </tbody>
          </table>
        </div>
        <p>{t('baishi.operators.arity')}</p>
        {@render grammar(['ids', 'component', 'unary operator', 'binary operator', 'overlap operator', 'indexed operator', 'ternary operator'])}
        {@render said('nest', ['I26', 'p.3 §2.3'])}
        {@render said('u31ef', ['I26', 'p.3 §2.1'])}

        <section id="angles" aria-labelledby="angles-title">
          <h3 id="angles-title">{t('baishi.heading.angles')} {@render badge('proposal')}</h3>
          <p>{t('baishi.angles.body')}</p>
          <div class="scroll">
            <table>
              <thead><tr><th>{t('baishi.angles.form')}</th><th><a href="#doc-R101">R101</a></th><th><a href="#doc-R102">R102</a></th></tr></thead>
              <tbody>{#each ANGLES as [form, first, second] (form)}<tr><td>{@render written(form)}</td><td class="code">{first}</td><td class="code">{second}</td></tr>{/each}</tbody>
            </table>
          </div>
          {@render said('omit180', ['R101', 'slide 4'])}
          {@render said('omitPm180', ['R102', 'slide 4'])}
          <p class="inference">{@render badge('inference')} {t('baishi.angles.inference')}</p>
        </section>
      </section>

      <section id="variants" aria-labelledby="variants-title">
        <h2 id="variants-title">{t('baishi.heading.variants')}</h2>
        <p>{t('baishi.variants.body')}</p>
        {@render grammar(['component variant', 'sequence variants'])}
        {@render said('tagAfter', ['D1', 'p.1'])}
        {@render said('tagEnd', ['D1', 'p.1'])}
        {@render said('tagOmit', ['I26', 'p.8 §4.2'])}
        {@render examples('tags')}
        {@render examples('lists')}
        <p>{t('baishi.variants.kinds')}</p>
        {@render grammar(['variant id', 'style tag', 'tag char', 'lower letter'])}
        <p class="inference">{@render badge('inference')} {t('baishi.kind.order')}</p>
        <div class="scroll">
          <table class="compact">
            <thead><tr><th>{t('baishi.kind.name')}</th><th>{t('baishi.kind.pattern')} {@render at(['DB', '2597437b'])}</th></tr></thead>
            <tbody>{#each KINDS as [kind, pattern] (kind)}<tr><td>{t(`baishi.kind.${kind}`)}</td><td class="code">{pattern}</td></tr>{/each}</tbody>
          </table>
        </div>

        <section id="source-letters" aria-labelledby="source-letters-title">
          <h3 id="source-letters-title">{t('baishi.heading.sources')}</h3>
          {@render grammar(['source letter'])}
          <div class="scroll">
            <table>
              <thead><tr><th>{t('baishi.sources.letter')}</th><th>{t('baishi.sources.source')}</th><th>{t('baishi.sources.region')} {@render at(['I26', 'p.8 §4.3.1'])}</th></tr></thead>
              <tbody>
                {#each SOURCES as [letter, source, region] (letter)}
                  <tr><td class="code strong">{letter}</td><td class="code">{source}</td>
                    <td>{#if region.startsWith('@')}<span lang="zh-Hans">{QUOTES[region.slice(1)]}</span>{#if gloss(region.slice(1))}<br /><span class="gloss">{gloss(region.slice(1))}</span>{/if}{:else}<span lang="zh-Hans">{region}</span>{/if}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          {@render said('precedence', ['I26', 'p.9 §4.3.1'])}
          <p class="order"><span class="muted">{t('baishi.sources.order')}</span> <code>Q&gt;G&gt;H&gt;T&gt;J&gt;K&gt;P&gt;V&gt;M&gt;U&gt;S&gt;B</code></p>
          {@render examples('precedence')}
        </section>

        <section id="ucv-position" aria-labelledby="ucv-position-title">
          <h3 id="ucv-position-title">{t('baishi.heading.ucv')}{@render cheat('ucv-position')}</h3>
          {@render said('ucv', ['I26', 'pp.9–10 §4.3.2'])}
          {@render examples('ucv')}
        </section>

        <section id="imaginary-ucv" aria-labelledby="imaginary-ucv-title">
          <h3 id="imaginary-ucv-title">{t('baishi.heading.imaginary')}{@render cheat('imaginary-ucv')}</h3>
          {@render said('imaginary', ['I26', 'p.11 §4.3.2'])}
          {@render examples('imaginary')}
        </section>

        <section id="alternate" aria-labelledby="alternate-title">
          <h3 id="alternate-title">{t('baishi.heading.alternate')}</h3>
          {@render said('alternate', ['I26', 'p.12 §4.3.3'])}
          <div class="scroll">
            <table class="compact">
              <thead><tr><th>{t('baishi.alternate.letter')}</th><th>{t('baishi.alternate.gloss')} {@render at(['I26', 'pp.12–13 §4.3.3'])}</th></tr></thead>
              <tbody>{#each STYLE_LETTERS as [letter, text] (letter)}<tr><td class="code strong">{letter}</td><td><span lang="zh-Hans">{text}</span>{#if gloss(`style.${letter}`)} <span class="gloss">{gloss(`style.${letter}`)}</span>{/if}</td></tr>{/each}</tbody>
            </table>
          </div>
          {@render said('compose', ['I26', 'p.13 §4.3.3'])}
          {@render examples('alternate')}
        </section>

        <section id="other" aria-labelledby="other-title">
          <h3 id="other-title">{t('baishi.heading.other')}</h3>
          {@render examples('other')}
          {@render said('custom', ['I26', 'p.14 §4.3.5'])}
        </section>
      </section>

      <section id="chains" aria-labelledby="chains-title">
        <h2 id="chains-title">{t('baishi.heading.chains')}</h2>
        {@render said('chainWhy', ['I26', 'p.14 §5.1'])}
        <p>{t('baishi.chains.body')}</p>
        {@render grammar(['stroke chain', 'stroke part', 'stroke'])}
        {@render said('chain', ['I26', 'p.14 §5.2'])}

        <section id="letters" aria-labelledby="letters-title">
          <h3 id="letters-title">{t('baishi.heading.letters')}</h3>
          {@render grammar(['stroke letter'])}
          <div class="scroll">
            <table class="compact">
              <thead><tr><th>{t('baishi.letters.letter')}</th><th>{t('baishi.letters.stroke')}</th><th>{t('baishi.alternate.gloss')} {@render at(['I26', 'pp.14–15 §5.3'])}</th></tr></thead>
              <tbody>
                {#each STROKE_LETTERS as [letter, stroke, text] (letter)}
                  <tr><td class="code strong">{letter}</td><td class="pair"><span class="char" lang="zh-Hans">{stroke}</span></td>
                    <td>{#if text}<span lang="zh-Hans">{text}</span>{#if gloss(`stroke.${letter}`)} <span class="gloss">{gloss(`stroke.${letter}`)}</span>{/if}{/if}{#if letter === 'T'} <a class="at" href="#change-t">†</a>{/if}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          {@render said('clockwise', ['I26', 'p.15 §5.3'])}
        </section>

        <section id="modifiers" aria-labelledby="modifiers-title">
          <h3 id="modifiers-title">{t('baishi.heading.modifiers')}</h3>
          {@render examples('modifiers')}
        </section>

        <section id="characters" aria-labelledby="characters-title">
          <h3 id="characters-title">{t('baishi.heading.characters')}</h3>
          <p>{t('baishi.characters.body')} {@render at(['I26', 'p.32'])}</p>
          {@render grammar(['ideograph char', 'taggable char', 'hanzi', 'cjk stroke', 'curve'])}
          <div id="katakana" class="anchor">{@render cheat('katakana')}{@render examples('katakana')}</div>
        </section>

        <section id="compounds" aria-labelledby="compounds-title">
          <h3 id="compounds-title">{t('baishi.heading.compounds')} {@render at(['I26', 'p.16'])}</h3>
          <div class="compounds">
            {#each COMPOUNDS as [char, chain] (char)}
              <div class="compound">{@render drawn(chain)}<span class="char" lang="zh-Hans">{char}</span><span class="ids">{chain}</span></div>
            {/each}
          </div>
        </section>

        <section id="reverse" aria-labelledby="reverse-title">
          <h3 id="reverse-title"><code>-</code>{t('baishi.heading.reverse')}</h3>
          {@render grammar(['reversal'])}
          {@render said('reverse', ['I26', 'p.15 §5.3'])}
          {@render examples('reverse')}
        </section>

        <section id="cross" aria-labelledby="cross-title">
          <h3 id="cross-title"><code>x</code>{t('baishi.heading.cross')}</h3>
          {@render grammar(['crossing'])}
          {@render said('cross', ['I26', 'p.15 §5.3'])}
          {@render examples('cross')}
        </section>

        <section id="break-mark" aria-labelledby="break-mark-title">
          <h3 id="break-mark-title"><code>b</code>{t('baishi.heading.break')}</h3>
          {@render grammar(['break'])}
          {@render said('break', ['I26', 'p.15 §5.3'])}
          {@render examples('break')}
        </section>

        <section id="closing" aria-labelledby="closing-title">
          <h3 id="closing-title"><code>z</code>{t('baishi.heading.closed')}{@render cheat('closing')}</h3>
          {@render said('closed', ['I26', 'p.15 §5.3'])}
          {@render examples('closed')}
        </section>

        <section id="curves" aria-labelledby="curves-title">
          <h3 id="curves-title">{t('baishi.heading.curves')}</h3>
          <p>{t('baishi.curves.body')} {@render at(['I26', 'pp.14–15 §5.3'])}</p>
          {@render said('curveStart', ['D1', 'p.2'])}
          {@render said('curveReverse', ['D1', 'p.2'])}
        </section>

        <div class="history">
          <h3>{@render badge('history')}</h3>
          <p>{t('baishi.chainsHistory.letters')}</p>
          {@render said('oldLetters', ['D1', 'p.1'])}
          {@render said('oldConnector', ['D1', 'p.2'])}
          <p>{t('baishi.chainsHistory.first')}</p>
          {@render said('firstLetters', ['J22', 'p.1'])}
          {@render said('firstJoins', ['J22', 'p.1'])}
          {@render said('firstCurves', ['J22', 'pp.1–2'])}
          {@render examples('firstChains', false)}
        </div>
      </section>

      <section id="overlap" aria-labelledby="overlap-title">
        <h2 id="overlap-title">{t('baishi.heading.overlap')}</h2>
        {@render said('roles', ['I26', 'p.17 §6.1'])}
        <p>{t('baishi.overlap.body')}</p>
        {@render grammar(['overlap modifier', 'overlap spec'])}

        <section id="quick-slice" aria-labelledby="quick-slice-title">
          <h3 id="quick-slice-title">{t('baishi.heading.slice')}</h3>
          {@render grammar(['slice', 'slice bound', 'number', 'negative number', 'nonzero digit', 'digit'])}
          {@render said('slice', ['I26', 'p.17 §6.2'])}
          {@render said('sliceTouch', ['I26', 'p.18 §6.2.1'])}
          {@render said('virtual', ['I26', 'p.19 §6.2.5'])}
          {@render said('sign', ['I26', 'p.18 §6.2.2'])}
          <div class="scroll">
            <table>
              <thead><tr><th>{t('baishi.slice.char')}</th><th>{t('baishi.slice.written')} {@render at(['I26', 'p.18'])}</th><th>{t('baishi.slice.wrong')}</th></tr></thead>
              <tbody>
                {#each SLICES as [char, form, wrong] (char)}
                  <tr><td class="pair"><span class="char" lang="zh-Hans">{char}</span>{@render drawn(form)}</td><td>{@render written(form)}</td><td class="wrong">{#each wrong as one, i (i)}{#if i}<br />{/if}{@render written(one)}{/each}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          {@render said('you', ['I26', 'p.4 §3.1'])}
          {@render examples('sliceMore')}
        </section>

        <section id="matrix" aria-labelledby="matrix-title">
          <h3 id="matrix-title">{t('baishi.heading.matrix')}</h3>
          {@render grammar(['crossing matrix', 'matrix row', 'matrix cell'])}
          <p>{t('baishi.matrix.body')} {@render at(['I26', 'p.20 §6.3'])}</p>
          <div class="scroll">
            <table class="compact">
              <thead><tr><th>{t('baishi.matrix.cell')}</th><th>{t('baishi.matrix.means')}</th></tr></thead>
              <tbody>
                {#each CELLS as [cell, meaning] (cell)}
                  <tr><td class="code strong">{cell}</td>
                    <td>{#if meaning.startsWith('@')}<span lang="zh-Hans">{QUOTES[meaning.slice(1)]}</span>{#if gloss(meaning.slice(1))}<br /><span class="gloss">{gloss(meaning.slice(1))}</span>{/if}{:else}{t(`baishi.${meaning}`)}{/if}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          <p>{t('baishi.matrix.simplify')} {@render at(['I26', 'p.20 §6.3'])}</p>
          <div class="steps">
            <span class="muted">{t('baishi.matrix.qu')}</span>
            {#each QU_STEPS as step, i (i)}{#if i}<span class="arrow">→</span>{/if}<code>{step}</code>{/each}
            {@render at(['I26', 'pp.21–23'])}
          </div>
          {@render said('qu', ['I26', 'p.23'])}
          {@render examples('segments')}
          {@render examples('matrix')}
        </section>

        <section id="reverse-matrix" aria-labelledby="reverse-matrix-title">
          <h3 id="reverse-matrix-title">{t('baishi.heading.reverseMatrix')}{@render cheat('reverse-matrix')}</h3>
          <p>{t('baishi.reverseMatrix.body')}</p>
          {@render said('reverseMatrix', ['I26', 'p.23 §6.4'])}
          {@render examples('reverseMatrix')}
        </section>

        <section id="curveCase" aria-labelledby="curveCase-title">
          <h3 id="curveCase-title">{t('baishi.heading.curveCase')}</h3>
          {@render examples('curveCase')}
        </section>

        <div class="history">
          <h3>{@render badge('history')}</h3>
          <p>{t('baishi.overlapHistory')}</p>
          {@render said('oldMarks', ['D2', 'p.4'])}
          {@render examples('oldMarks', false)}
        </div>
      </section>

      <section id="index" aria-labelledby="index-title">
        <h2 id="index-title">{t('baishi.heading.index')}</h2>
        {@render grammar(['index modifier'])}
        {@render said('index', ['I26', 'pp.24–25 §6.6'])}
        {@render said('indexHalf', ['I26', 'p.25 §6.6'])}
        {@render examples('index')}
      </section>

      <section id="subtract" aria-labelledby="subtract-title">
        <h2 id="subtract-title">{t('baishi.heading.subtract')} {@render badge('searchOnly')}</h2>
        {@render said('subtract', ['I26', 'p.26 §6.7'])}
        <div class="scroll">
          <table>
            <thead><tr><th>{t('baishi.subtract.ids')} {@render at(['I26', 'p.26'])}</th><th>{t('baishi.subtract.char')}</th><th>{t('baishi.subtract.which')}</th></tr></thead>
            <tbody>
              {#each SUBTRACTIONS as [text, char, which] (text)}
                <tr><td>{@render written(text)}</td><td class="pair"><span class="char" lang="zh-Hans">{char}</span>{@render drawn(text)}</td>
                  <td><span lang="zh-Hans">{QUOTES[which]}</span>{#if gloss(which)} <span class="gloss">{gloss(which)}</span>{/if}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
        {@render said('subtractSearch', ['I26', 'p.26'])}
        {@render said('subtractChain', ['I26', 'p.26'])}
      </section>

      <section id="prefix" aria-labelledby="prefix-title">
        <h2 id="prefix-title">{t('baishi.heading.prefix')}</h2>
        {@render grammar(['uniqueness prefix'])}
        {@render said('unique', ['I26', 'pp.26–27 §7.1'])}
        {@render said('uniqueRare', ['I26', 'p.27 §7.1'])}
        {@render said('uniqueStroke', ['I26', 'p.27 §7.1'])}
        {@render said('uniqueQuestion', ['I26', 'p.27 §7.1'])}
        {@render said('uniqueSource', ['I26', 'p.27 §7.1'])}
        {@render said('abstract', ['I26', 'p.27 §7.1'])}
        <p class="link"><a href={DATABASE.abstractShape} target="_blank" rel="noreferrer">{DATABASE.abstractShape}</a> {@render at(['I26', 'p.27'])}</p>
        {@render examples('unique')}
      </section>

      <section id="replace" aria-labelledby="replace-title">
        <h2 id="replace-title"><span lang="zh-Hans">🔄</span> {t('baishi.heading.replace')} {@render badge('searchOnly')}</h2>
        {@render said('replace', ['I26', 'p.5 §3.2'])}
        {@render examples('replace')}
      </section>

      <section id="levels" aria-labelledby="levels-title">
        <h2 id="levels-title">{t('baishi.heading.levels')}</h2>
        <p>{t('baishi.levels.body')} {@render at(['I26', 'p.5 §3.3'])}</p>
        {@render said('lv0', ['I26', 'p.5 §3.3'])}
        {@render said('lv1', ['I26', 'p.5 §3.3'])}
        {@render said('lv2', ['I26', 'p.5 §3.3'])}
        {@render said('lv1Merge', ['I26', 'pp.27–28 §7.2'])}
        {@render examples('merge')}
        {@render said('lv2Merge', ['I26', 'p.28 §7.3'])}
        {@render examples('levels')}
      </section>

      <section id="history" aria-labelledby="history-title">
        <h2 id="history-title">{t('baishi.heading.changes')}</h2>
        <ol class="changes">
          {#each CHANGES as [id, cites, inferred] (id)}
            <li id={`change-${id}`}>{#if inferred}{@render badge('inference')} {/if}{t(`baishi.change.${id}`)} <span class="cites">{#each cites as cite, i (i)}{@render at(cite)}{/each}</span></li>
          {/each}
        </ol>
      </section>

      <section id="differences" aria-labelledby="differences-title">
        <h2 id="differences-title">{t('baishi.heading.data')}</h2>
        <p>{t('baishi.data.body', { commit: DATABASE.checked.commit.slice(0, 8), date: DATABASE.checked.date, rows: DATABASE.checked.rows, rejected: DATABASE.checked.rejected })} <a class="at" href={DATABASE.checked.url} target="_blank" rel="noreferrer">yi-bai/ids@{DATABASE.checked.commit.slice(0, 8)}</a></p>
        <h3>{t('baishi.heading.corrections')}</h3>
        <div class="scroll">
          <table>
            <tbody>
              {#each CORRECTIONS as [id, rule, evidence] (id)}
                <tr><td class="code strong">{id}</td><td>{t(`baishi.correction.${id}`)}<pre class="inline">{rule}</pre></td><td class="code" lang="zh-Hans">{evidence}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
        <h3>{t('baishi.heading.malformed')}</h3>
        <div class="scroll">
          <table>
            <tbody>
              {#each MALFORMED as [level, line, text, why] (`${level}-${line}`)}
                <tr><td class="code">{level} l.{line}</td><td>{@render written(text.split('\t')[1])} <span class="muted" lang="zh-Hans">{text.split('\t')[0]}</span></td><td>{t(`baishi.${why}`)}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
        <h3>{t('baishi.heading.dataDifferences')}</h3>
        <ol class="changes">
          {#each DATA_DIFFERENCES as [id, cites] (id)}
            <li>{t(`baishi.datadiff.${id}`)} <span class="cites">{#each cites as cite, i (i)}{@render at(cite)}{/each}</span></li>
          {/each}
        </ol>
        <h3>{t('baishi.heading.exampleDifferences')}</h3>
        <div class="scroll">
          <table>
            <thead><tr><th></th><th>{t('baishi.exampleDiff.document')}</th><th>{t('baishi.exampleDiff.data')} {@render at(['DB', '2597437b'])}</th></tr></thead>
            <tbody>
              {#each EXAMPLE_DIFFERENCES as [char, printed, cite, data, level] (char)}
                <tr><td class="char" lang="zh-Hans">{char}</td><td>{@render written(printed)} {@render at(cite)}</td><td>{@render written(data)}{#if level} <span class="label">lv{level}</span>{/if}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section id="unsettled" aria-labelledby="unsettled-title">
        <h2 id="unsettled-title">{t('baishi.heading.unsettled')}</h2>
        <ul class="changes">
          {#each UNSETTLED as id (id)}<li>{@render badge('open')} {t(`baishi.unsettled.${id}`)}</li>{/each}
        </ul>
      </section>

      <section id="ebnf" aria-labelledby="ebnf-title">
        <div class="heading-row">
          <h2 id="ebnf-title">{t('baishi.heading.ebnf')}</h2>
          <span class="download"><Menu label={t('appendix.download')} icon="download" items={downloads} align="end" keyHints={false} compact /></span>
        </div>
        <p>{t('baishi.formal')} {@render at(['DB', '2597437b'])}</p>
        <pre class="full">{corrected}</pre>
        <div class="scroll">
          <table class="compact">
            <tbody>{#each SPECIAL as [sequence, meaning] (sequence)}<tr><td class="code strong">{sequence}</td><td class="code">{meaning}</td></tr>{/each}</tbody>
          </table>
        </div>
        <h3 id="grammar-view">{t('baishi.heading.diagrams')}</h3>
        <RailroadCanvas rules={grammarRules} top="row" {t} bind:selected={chosen} />
        <details class="ebnf">
          <summary>{t('baishi.i26grammar')} · I26 pp.31–33</summary>
          {@render said('ebnf', ['I26', 'p.31'])}
          <pre>{EBNF}</pre>
        </details>
      </section>

      <section id="sources" aria-labelledby="sources-title">
        <h2 id="sources-title">{t('baishi.heading.documents')}</h2>
        <ol class="documents">
          {#each DOCUMENTS as doc (doc.key)}
            <li id={`doc-${doc.key}`}>
              <span class="key">{doc.key}</span>
              <div>
                <p class="doc-title" lang="zh-Hans">{doc.title}</p>
                <p class="people" lang="zh-Hans">{doc.people.join(' · ') || '—'}</p>
                <p class="facts">
                  {#if doc.version}<span><span class="muted">{t('baishi.doc.version')}</span> <span lang="zh-Hans">{doc.version}</span></span>{/if}
                  <span><span class="muted">{t('baishi.doc.date')}</span> {doc.date}{#if doc.key !== 'I26'}{' '}<span class="muted">({t('baishi.doc.fromFile')})</span>{/if}</span>
                  <span>{doc.extent}</span>
                </p>
                {#each doc.links as link (link)}<p class="link"><a href={link} target="_blank" rel="noreferrer">{link}</a></p>{/each}
                {#if 'edition' in doc && doc.edition}<p class="link"><a href={doc.edition.url} target="_blank" rel="noreferrer">{doc.edition.url}</a> <span class="muted">{t('baishi.doc.edition', { date: doc.edition.read })} <span lang="zh-Hans">{doc.edition.printed}</span></span></p>{/if}
                <p class="note">{t(`baishi.doc.note.${doc.key}`)}</p>
              </div>
            </li>
          {/each}
          <li id="doc-tools">
            <span class="key">EBNF</span>
            <div>
              {#each TOOLS as [title, link] (title)}<p>{title}{#if link} <a class="plain" href={link} target="_blank" rel="noreferrer">{link}</a>{/if}</p>{/each}
            </div>
          </li>
          <li id="doc-DB">
            <span class="key">DB</span>
            <div>
              <p class="doc-title">{t('baishi.heading.database')}</p>
              <p class="link"><a href={DATABASE.url} target="_blank" rel="noreferrer">{DATABASE.url}</a></p>
              <p class="note">{t('baishi.database.note', { version: DATABASE.version })} <a href={DATABASE.tree} target="_blank" rel="noreferrer">8a585351</a></p>
              <p class="note">{t('baishi.database.checked', { date: DATABASE.checked.date })} <a href={DATABASE.checked.url} target="_blank" rel="noreferrer">{DATABASE.checked.commit.slice(0, 8)}</a></p>
            </div>
          </li>
        </ol>
      </section>
    </main>
  </div>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  .body{display:grid;grid-template-columns:220px minmax(0,1fr);gap:28px;width:100%;max-width:1180px;margin:0 auto;padding:24px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  .toc{position:sticky;top:74px;align-self:start;max-height:calc(100dvh - 90px);overflow:auto}
  .toc ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
  .toc ul ul{margin:1px 0 4px 10px}
  .toc a{display:block;padding:4px 8px;border-radius:var(--ui-radius-sm);color:var(--ui-color-ink-soft);text-decoration:none;font-size:13px}
  .toc ul ul a{font-size:12px;color:var(--ui-color-ink-muted);padding:3px 8px}
  .toc a:hover{background:var(--ui-color-surface-sunken);color:var(--ui-color-ink)}
  main{min-width:0;max-width:900px}
  .lead{margin:0 0 26px;font-size:16px;line-height:1.6;color:var(--ui-color-ink)}
  section{scroll-margin-top:74px;margin:0 0 34px}
  section section{margin:22px 0 0}
  h2{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:18px;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--ui-color-border)}
  h3{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14.5px;margin:0 0 10px}
  h3 code{font-family:var(--ui-font-mono);font-size:14px;color:var(--ui-color-accent)}
  p{margin:0 0 10px;max-width:78ch;line-height:1.6;font-size:14px}
  .muted{color:var(--ui-color-ink-muted)}
  .at{font-family:var(--ui-font-mono);font-size:11px;white-space:nowrap;color:var(--ui-color-accent);text-decoration:none;padding:1px 5px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xs)}
  .at:hover{border-color:var(--ui-color-accent)}
  .badge{display:inline-block;padding:0 6px;border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-xs);font-size:10.5px;font-weight:500;line-height:1.7;color:var(--ui-color-ink-soft);vertical-align:1px}
  .badge[data-kind="inference"]{border-style:dashed}
  .badge[data-kind="proposal"],.badge[data-kind="searchOnly"]{color:var(--ui-color-accent);border-color:var(--ui-color-accent)}
  blockquote{margin:0 0 10px;padding:6px 0 6px 12px;border-left:3px solid var(--ui-color-border-strong);max-width:78ch}
  blockquote p{margin:0}
  blockquote footer{margin-top:4px}
  .zh{font-family:var(--cjk-sans);font-size:14px;line-height:1.65;color:var(--ui-color-ink)}
  .gloss{font-size:13px;line-height:1.55;color:var(--ui-color-ink-soft)}
  .small{font-size:12.5px;margin:6px 0 0}
  .ebnf pre{margin:0 0 12px;padding:9px 12px;background:var(--ui-color-surface-sunken);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);font-family:var(--ui-font-mono),var(--cjk-sans);font-size:12px;line-height:1.6;overflow-x:auto;white-space:pre;color:var(--ui-color-ink)}
  .rules{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}
  .rules .rule{text-decoration:none;color:inherit}
  .plain{color:var(--ui-color-accent);overflow-wrap:anywhere;font-size:12.5px}
  .rules pre,.full,pre.inline{margin:0;padding:8px 12px;background:var(--ui-color-surface-sunken);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);font-family:var(--ui-font-mono),var(--cjk-sans);font-size:12px;line-height:1.6;overflow-x:auto;white-space:pre;color:var(--ui-color-ink)}
  pre.inline{margin-top:6px;padding:4px 8px}
  .full{max-height:70dvh;margin:0 0 16px}
  .railroad{overflow-x:auto;padding:4px 0}
  .railroad :global(svg){display:block}
  .railroad :global(path){stroke:var(--ui-color-ink-soft);stroke-width:1.5;fill:none}
  .railroad :global(rect){stroke:var(--ui-color-border-strong);stroke-width:1.2;fill:var(--ui-color-surface)}
  .railroad :global(.terminal rect),.railroad :global(.special rect){fill:var(--ui-color-surface-sunken)}
  .railroad :global(.special rect){stroke-dasharray:4 3}
  .railroad :global(text){font:12.5px var(--ui-font-mono),var(--cjk-sans);text-anchor:middle;fill:var(--ui-color-ink)}
  .railroad :global(.non-terminal text){fill:var(--ui-color-accent)}
  #data h3,#ebnf h3{margin-top:24px}
  .cheat{margin-left:auto;font-size:12px;font-weight:400;color:var(--ui-color-accent);text-decoration:none;white-space:nowrap}
  .cheat:hover{text-decoration:underline}
  .anchor{scroll-margin-top:74px;display:flex;flex-direction:column}
  .anchor > .cheat{align-self:flex-end;margin:0 0 4px}
  .rule-block{gap:6px}
  .heading-row{display:flex;align-items:flex-start;gap:12px;border-bottom:1px solid var(--ui-color-border);margin:0 0 12px}
  .heading-row h2{flex:1;border-bottom:none;margin:0}
  .download{margin-left:auto;font-size:13px;font-weight:400;padding-bottom:6px}
  .ebnf summary{cursor:pointer;font-size:13px;color:var(--ui-color-accent);margin:0 0 8px}
  .ebnf pre{max-height:70dvh}
  .examples{align-items:start;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr));gap:8px;margin:0 0 12px}
  .example{min-width:0;padding:9px 11px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface)}
  .head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .drawings{display:flex;gap:4px;flex-wrap:wrap}
  .drawings:empty{display:none}
  .drawn{display:block;width:34px;height:34px;flex:none;color:var(--ui-color-ink)}
  .drawn :global(.part-icon){width:100%;height:100%}
  .char{font-family:var(--ids-font);font-size:24px;line-height:1;color:var(--ui-color-ink)}
  .text{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 180px}
  .ids{font-family:var(--ids-font);font-size:15px;line-height:1.5;color:var(--ui-color-ink);overflow-wrap:anywhere;white-space:pre-wrap}
  .tag{color:var(--ui-color-accent)}
  .semi,.tab{color:var(--ui-color-ink-muted);padding:0 2px}
  .to{display:flex;gap:6px;align-items:baseline}
  .arrow{color:var(--ui-color-ink-muted)}
  .meta{display:flex;gap:6px;align-items:center;margin-left:auto}
  .label{font-family:var(--ui-font-mono);font-size:11px;color:var(--ui-color-ink-muted)}
  .scroll{overflow-x:auto;margin:0 0 12px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm)}
  table{border-collapse:separate;border-spacing:0;width:100%;font-size:13px;line-height:1.45}
  th,td{padding:6px 10px;text-align:left;vertical-align:middle;border-bottom:1px solid var(--ui-color-border)}
  thead th{background:var(--ui-color-surface);font-size:12px;font-weight:600;color:var(--ui-color-ink-muted);border-bottom:1px solid var(--ui-color-border-strong);white-space:nowrap}
  tbody tr:last-child td{border-bottom:none}
  td.char{font-family:var(--ids-font);font-size:20px}
  td.op{font-family:var(--ids-font);font-size:20px}
  td.code{font-family:var(--ui-font-mono);font-size:12px;white-space:nowrap}
  td.strong{font-weight:600;color:var(--ui-color-ink)}
  td.pair{white-space:nowrap}
  td.pair .char,td.pair .drawn{display:inline-block;vertical-align:middle}
  td.pair .drawn{width:28px;height:28px;margin-left:8px}
  td.wrong .ids{color:var(--ui-color-ink-muted)}
  tr.absent td{color:var(--ui-color-ink-muted)}
  td .gloss{display:block;font-size:12.5px}
  .order code,.steps code{font-family:var(--ui-font-mono);font-size:12.5px}
  .steps{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 10px;font-size:13px}
  .compounds{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
  .compound{display:flex;align-items:center;gap:8px;padding:5px 8px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface)}
  .compound .drawn{width:26px;height:26px}
  .compound .char{font-size:20px}
  .compound .ids{font-size:13px}
  .history{margin:24px 0 0;padding:12px 14px;border:1px dashed var(--ui-color-border-strong);border-radius:var(--ui-radius-sm)}
  .inference{color:var(--ui-color-ink-soft)}
  .changes{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:8px;max-width:80ch}
  .changes li{font-size:13.5px;line-height:1.6;scroll-margin-top:74px}
  .cites{display:inline-flex;flex-wrap:wrap;gap:4px;margin-left:4px}
  .documents{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
  .documents li{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;padding:10px 12px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface);scroll-margin-top:74px}
  .documents li:target{border-color:var(--ui-color-accent)}
  .documents p{margin:0 0 3px;font-size:13px}
  .key{font-family:var(--ui-font-mono);font-size:12px;font-weight:600;color:var(--ui-color-accent)}
  .doc-title{font-size:14.5px !important;font-weight:600;color:var(--ui-color-ink)}
  .people{color:var(--ui-color-ink-soft)}
  .facts{display:flex;flex-wrap:wrap;gap:4px 14px}
  .link a{color:var(--ui-color-accent);overflow-wrap:anywhere;font-size:12.5px}
  .note{color:var(--ui-color-ink-soft)}
  .note a{color:var(--ui-color-accent);font-family:var(--ui-font-mono);font-size:12px}
  @media (max-width:760px) {
    .body{grid-template-columns:minmax(0,1fr);gap:16px}
    .toc{position:static;max-height:none}
    .toc > ul{flex-direction:row;flex-wrap:wrap;gap:2px 4px}
    .toc ul ul{display:none}
    .text{flex-basis:100%}
  }
</style>
