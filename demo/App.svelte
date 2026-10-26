<script>
  // The IDS workshop: the input at the start (the sequence, the operators, where parts come from),
  // the tree in the middle, the output at the end (the drawing, the sequence, the character it
  // encodes, its code points, export). A toolbar holds undo and redo with the history, examples,
  // saved drafts, sharing, the theme, the language, preferences and sources.
  import { untrack } from 'svelte'
  import { IdsOperators, IdsPartTools, IdsPicker, IdsPreview, IdsSearch, IdsSequence, IdsTree, IdsTreeList, createEditor, shortcut, translator } from '../src/svelte/index.js'
  import { babelStoneAdapter } from '../src/adapter/index.js'
  import { composerPreview } from '../src/composer/index.js'
  import { isSequence, parse, write } from '../src/core/index.js'
  import ids from '../data/babelstone-ids.tsv.gz?url'
  import parts from '../data/ids-parts.json?url'
  import forms from '../data/component-forms.tsv?url'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { EXAMPLES } from './lib/examples.js'
  import { drafts as storedDrafts, forget, fromText, keep, toText } from './lib/projects.js'
  import { linkTo, sequenceFrom } from './lib/share.js'
  import { applyTheme, storedTheme } from './lib/theme.js'
  import { load, save } from './lib/storage.js'
  import { download, pickText } from './lib/files.js'
  import AboutDialog from './ui/AboutDialog.svelte'
  import ExportPanel from './ui/ExportPanel.svelte'
  import Icon from './ui/Icon.svelte'
  import KeyHint from './ui/KeyHint.svelte'
  import Menu from './ui/Menu.svelte'
  import MenuList from './ui/MenuList.svelte'
  import Dialog from './ui/Dialog.svelte'
  import PreferencesDialog from './ui/PreferencesDialog.svelte'
  import ShareDialog from './ui/ShareDialog.svelte'
  import ThemeSwitch from './ui/ThemeSwitch.svelte'
  import Toast from './ui/Toast.svelte'

  const params = new URLSearchParams(location.search)
  // The han-compose export the preview draws from; `?composer=`, VITE_COMPOSER_BASE or Preferences point it elsewhere.
  const COMPOSER = 'https://glyphatlas.org/atlas/composer/bd0829bc6fbf-sans-compose-layout-v4-f5/'
  let composer = $state(params.get('composer') || load('composer', '') || '')
  const base = $derived(composer || import.meta.env.VITE_COMPOSER_BASE || COMPOSER)
  $effect(() => save('composer', params.get('composer') ? undefined : composer || undefined))
  const babel = babelStoneAdapter({ ids, parts, forms })
  /** @type {Map<string, ReturnType<typeof composerPreview>>} */
  const previews = new Map()
  /** @param {string} at */
  const previewAt = at => { if (!previews.has(at)) previews.set(at, composerPreview({ base: at })); return /** @type {ReturnType<typeof composerPreview>} */ (previews.get(at)) }
  const adapter = $derived({ ...babel, preview: previewAt(base) })

  const wanted = String(params.get('lang') ?? load('locale', null) ?? navigator.language ?? '')
  // A browser asking for Traditional Chinese names its region or script, never the catalogue's code.
  const traditional = /^zh-(?:Hant|TW|HK|MO)\b/i
  let locale = $state(LOCALES.find(([code]) => code === wanted)?.[0]
    ?? (traditional.test(wanted) ? 'zh-Hant' : undefined)
    ?? LOCALES.find(([code]) => wanted.startsWith(code.split('-')[0]))?.[0] ?? 'en')
  $effect(() => save('locale', locale))
  const messages = $derived(LOCALES.find(([code]) => code === locale)?.[2])
  const t = $derived(translator({ ...appMessages('en'), ...messages, ...appMessages(locale) }, locale))
  const localeName = $derived(LOCALES.find(([code]) => code === locale)?.[1] ?? 'English')
  const localeItems = $derived(LOCALES.map(([code, name]) => ({ label: name, lang: code, checked: code === locale, run: () => { locale = code } })))

  /** @param {unknown} value */
  function clampSplit(value) {
    const n = Number(value)
    return Number.isFinite(n) ? Math.min(78, Math.max(35, Math.round(n * 10) / 10)) : 60
  }
  /** @param {PointerEvent} event */
  function splitStart(event) {
    const el = /** @type {HTMLElement} */ (event.currentTarget)
    resizing = true
    el.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
  /** @param {PointerEvent} event */
  function splitMove(event) {
    if (!resizing || !middleEl) return
    const box = middleEl.getBoundingClientRect()
    split = clampSplit(((event.clientY - box.top) / box.height) * 100)
  }
  /** @param {PointerEvent} event */
  function splitEnd(event) {
    resizing = false
    const el = /** @type {HTMLElement} */ (event.currentTarget)
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId)
  }
  /** @param {KeyboardEvent} event */
  function splitKey(event) {
    const step = event.shiftKey ? 5 : 2
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      split = clampSplit(split + (event.key === 'ArrowUp' ? step : -step))
    } else if (event.key === 'Home') {
      event.preventDefault()
      split = 35
    } else if (event.key === 'End') {
      event.preventDefault()
      split = 78
    }
  }
  function splitReset() { split = 60 }
  /** @param {KeyboardEvent} event */
  function viewKey(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    view = view === 'shape' ? 'tree' : 'shape'
    queueMicrotask(() => /** @type {HTMLElement | null} */ (document.getElementById(`${view}-tab`))?.focus())
  }

  let theme = $state(storedTheme())
  let keyHints = $state(load('keyHints', true))
  $effect(() => save('keyHints', keyHints ? undefined : false))
  let view = $state(load('view', 'shape'))
  $effect(() => save('view', view === 'shape' ? undefined : view))
  // The share of the middle column given to the tree; the search takes the rest.
  let split = $state(clampSplit(load('split', 60)))
  /** @type {HTMLElement | null} */ let middleEl = $state(null)
  let resizing = false
  $effect(() => save('split', split === 60 ? undefined : split))

  const editor = createEditor(() => ({ adapter, messages, locale }))
  /** @type {HTMLElement | null} */ let work = $state(null)
  /** @type {HTMLInputElement | null} */ let slot = $state(null)
  let fromText_ = $state('')
  /** @type {import('../src/adapter/types.js').Drawing | null} */
  let drawing = $state.raw(null)

  // Where the page starts: the link's sequence, else the draft left last time, else 疑.
  editor.reset(sequenceFrom(location) || load('current', '') || EXAMPLES[0].sequence)
  // Each change is kept for the next visit and written into the address, so the link opens it.
  $effect(() => editor.listen(text => {
    save('current', text)
    history.replaceState(null, '', linkTo(text, location))
  }))

  // A note at the foot of the page, with Undo after a change that threw something away.
  /** @type {{ id: number, text: string, action?: string, run?: () => void } | null} */
  let toast = $state(null)
  let notes = 0
  /** @param {string} text */
  const note = text => { toast = { id: ++notes, text } }
  // Its Undo takes back that change only: any later change takes the note away.
  $effect(() => {
    const change = editor.change
    untrack(() => {
      if (change?.destructive && !change.undone) toast = { id: ++notes, text: change.label, action: t('ids.undo'), run: () => editor.undo() }
      else if (change && toast?.run) toast = null
    })
  })

  // The output: the encoded characters the whole sequence describes, and its code points.
  let encoded = $state(/** @type {string[]} */ ([]))
  $effect(() => {
    const text = editor.usable ? editor.whole : '', ask = adapter.encoded
    encoded = []
    if (!text || !ask) return
    let live = true
    ask(text).then(found => { if (live) encoded = found }, () => {})
    return () => { live = false }
  })
  /** @param {string} ch */
  const cp = ch => `U+${/** @type {number} */ (ch.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`
  const points = $derived([...editor.whole].map(ch => ({ ch, cp: cp(ch) })))
  /** @param {string} text */
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); note(t('app.copied', { text })) } catch { note(t('app.copyFailed')) }
  }

  // Saved drafts.
  let drafts = $state(storedDrafts())
  function keepDraft() { if (editor.tree !== null) { drafts = keep(editor.whole); note(t('app.drafts.kept', { sequence: editor.whole })) } }
  async function importDrafts() {
    const text = await pickText('.txt,text/plain')
    if (text === null) return
    const found = fromText(text).filter(s => isSequence(s) && !parse(s, { open: true }).problem).map(s => write(parse(s, { open: true }).tree ?? null))
    for (const sequence of found.reverse()) drafts = keep(sequence)
    note(t('app.drafts.imported', { count: found.length }))
  }
  const draftItems = $derived([
    { label: t('app.drafts.new'), icon: 'plus', disabled: editor.tree === null, run: () => editor.open('') },
    { label: t('app.drafts.save'), icon: 'save', shortcut: shortcut('mod+s'), disabled: editor.tree === null, run: keepDraft },
    ...(drafts.length ? [{ separator: /** @type {const} */ (true) }, { heading: t('app.drafts.heading') },
      ...drafts.slice(0, 12).map(d => ({ label: d.sequence, lang: 'ja', hint: new Date(d.saved).toLocaleString(locale), run: () => editor.open(d.sequence) }))] : []),
    { separator: /** @type {const} */ (true) },
    { label: t('app.drafts.import'), icon: 'upload', run: importDrafts },
    { label: t('app.drafts.export'), icon: 'download', disabled: !drafts.length, run: () => download(new Blob([toText(drafts)], { type: 'text/plain' }), 'ids-drafts.txt') },
    ...(drafts.length ? [{ label: t('app.drafts.forget', { sequence: drafts[0].sequence }), icon: 'trash', lang: 'ja', run: () => { drafts = forget(drafts[0].id) } }] : []),
  ])
  /** @param {{ sequence: string, char: string }} example */
  function exampleItem(example) {
    const point = example.char ? cp(example.char) : ''
    return {
      leading: example.char || undefined,
      label: example.sequence,
      sequence: example.sequence,
      note: example.char ? point : t('app.examples.none'),
      unencoded: !example.char,
      lang: 'ja',
      hint: example.char ? `${example.char}　${example.sequence}　${point}` : `${example.sequence}　${t('app.examples.none')}`,
      run: () => editor.open(example.sequence),
    }
  }
  const exampleItems = $derived([
    { heading: t('app.examples.encoded') },
    ...EXAMPLES.filter(example => example.char).map(exampleItem),
    { heading: t('app.examples.unencoded') },
    ...EXAMPLES.filter(example => !example.char).map(exampleItem),
  ])
  // The history, oldest first; a step undone is the next to redo.
  const historyItems = $derived.by(() => {
    const { done, undone } = editor.steps
    if (!done.length && !undone.length) return [{ label: t('app.history.empty'), disabled: true }]
    return [
      ...done.map((label, i) => ({ label, checked: i === done.length - 1 ? true : undefined, run: () => editor.travel(i + 1 - done.length) })),
      ...(undone.length ? [{ heading: t('app.history.undone') }] : []),
      ...undone.map((label, i) => ({ label, run: () => editor.travel(i + 1) })),
    ]
  })

  let aboutOpen = $state(false), prefsOpen = $state(false), shareOpen = $state(false), moreOpen = $state(false)
  /** @param {KeyboardEvent} event */
  function keys(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === ',' && !event.shiftKey) { event.preventDefault(); prefsOpen = true; return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !event.shiftKey) { event.preventDefault(); keepDraft(); return }
    editor.keydown(event, { root: work, slot })
  }
  const undoTitle = $derived(editor.steps.done.at(-1) ? t('ids.undo.named', { step: editor.steps.done.at(-1) ?? '' }) : t('ids.undo'))
  const redoTitle = $derived(editor.steps.undone[0] ? t('ids.redo.named', { step: editor.steps.undone[0] }) : t('ids.redo'))
  const themeLabels = $derived({ system: t('app.theme.system'), light: t('app.theme.light'), dark: t('app.theme.dark') })
  /** @param {import('./lib/theme.js').Theme} next */
  const setTheme = next => { theme = next; applyTheme(next) }
</script>

<svelte:window onkeydown={keys} />

<div class="app" lang={locale}>
  <header class="bar">
    <a class="brand" href="./" aria-label={t('app.title')}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="var(--accent)" /><path d="M7 7h4v10H7zM13 7h4v4h-4zM13 13h4v4h-4z" fill="var(--on-accent)" /></svg>
      <span>{t('app.title')}</span>
    </a>
    <nav class="tools" aria-label={t('app.toolbar')}>
      <div class="group">
        <button type="button" class="tool key-hint" disabled={!editor.canUndo} title={undoTitle} aria-label={undoTitle} aria-keyshortcuts="Control+Z Meta+Z" onclick={() => editor.undo()}>
          <Icon name="undo" />{#if keyHints}<KeyHint combos={['mod+z']} />{/if}</button>
        <button type="button" class="tool key-hint" disabled={!editor.canRedo} title={redoTitle} aria-label={redoTitle} aria-keyshortcuts="Control+Shift+Z Control+Y Meta+Shift+Z Meta+Y" onclick={() => editor.redo()}>
          <Icon name="redo" />{#if keyHints}<KeyHint combos={['mod+shift+z', 'mod+y']} />{/if}</button>
        <span class="wide-only"><Menu label={t('app.history')} icon="history" text={false} items={historyItems} {keyHints} /></span>
      </div>
      <span class="wide-only"><Menu label={t('app.drafts')} icon="folder" items={draftItems} keys={keyHints ? ['mod+s'] : undefined} {keyHints} /></span>
      <span class="wide-only"><Menu label={t('app.examples')} icon="book" items={exampleItems} {keyHints} wide /></span>
    </nav>
    <div class="end">
      <button type="button" class="tool" disabled={editor.tree === null} title={t('app.share')} aria-label={t('app.share')} onclick={() => shareOpen = true}><Icon name="share" /><span class="wide">{t('app.share')}</span></button>
      <Menu label={localeName} ariaLabel={`${t('app.language')}: ${localeName}`} icon="globe" items={localeItems} align="end" {keyHints} compact />
      <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={themeLabels} onchange={setTheme} />
      <button type="button" class="tool key-hint" title={t('app.prefs.title')} aria-label={t('app.prefs.title')} aria-keyshortcuts="Control+, Meta+," onclick={() => prefsOpen = true}><Icon name="settings" />{#if keyHints}<KeyHint combos={['mod+,']} />{/if}</button>
      <button type="button" class="tool" title={t('app.about.title')} aria-label={t('app.about.title')} onclick={() => aboutOpen = true}><Icon name="info" /></button>
    </div>
    <button type="button" class="tool more phone-only" title={t('app.menu')} aria-label={t('app.menu')} aria-haspopup="dialog" onclick={() => moreOpen = true}><Icon name="menu" /></button>
  </header>

  <main class="work" bind:this={work}>
    <section class="pane input" aria-label={t('app.input')}>
      <div class="block">
        <h2 class="label">{t('ids.label')}</h2>
        <IdsSequence {editor} label={false} />
        {#if editor.problem}<p class="status fault" role="status">{editor.problem}</p>
        {:else if editor.pending}<p class="status" role="status">{editor.pending}</p>{/if}
      </div>
      <div class="block"><IdsOperators {editor} {keyHints} /></div>
      <div class="block grow"><IdsPicker {editor} pickers={['parts', 'from', 'find']} bind:fromText={fromText_} title={false} /></div>
    </section>

    <div class="middle" bind:this={middleEl} style:--upper="{split}%">
      <section class="pane tree" aria-label={t('ids.structure')}>
        <div class="view-tabs" role="tablist" aria-label={t('ids.view')}>
          <button type="button" role="tab" id="shape-tab" aria-selected={view === 'shape'} aria-controls="shape-panel" tabindex={view === 'shape' ? 0 : -1}
            onclick={() => view = 'shape'} onkeydown={viewKey}>{t('ids.view.shape')}</button>
          <button type="button" role="tab" id="tree-tab" aria-selected={view === 'tree'} aria-controls="tree-panel" tabindex={view === 'tree' ? 0 : -1}
            onclick={() => view = 'tree'} onkeydown={viewKey}>{t('ids.view.tree')}</button>
        </div>
        {#if view === 'shape'}
          <div class="tree-box" role="tabpanel" id="shape-panel" aria-labelledby="shape-tab"><IdsTree {editor} {keyHints} /></div>
        {:else}
          <div class="tree-list" role="tabpanel" id="tree-panel" aria-labelledby="tree-tab"><IdsTreeList {editor} /></div>
        {/if}
        <div class="block tools-row"><IdsPartTools {editor} {keyHints} bind:slot status={false} /></div>
      </section>
      <div class="split" role="separator" aria-orientation="horizontal" aria-label={t('app.panels.resize')} title={`${t('app.panels.resize')} (${Math.round(split)}%)`}
        aria-valuemin="35" aria-valuemax="78" aria-valuenow={Math.round(split)} tabindex="0"
        onpointerdown={splitStart} onpointermove={splitMove} onpointerup={splitEnd} onpointercancel={splitEnd}
        onkeydown={splitKey} ondblclick={splitReset}>
        <span class="grip" aria-hidden="true"></span>
      </div>
      <section class="pane results" aria-label={t('ids.search.title')}>
        <h2 class="label">{t('ids.search.title')}</h2>
        <IdsSearch {adapter} query={editor.tree === null ? '' : editor.whole} {messages} {locale}
          onopen={hit => editor.open(hit.sequence)} ontake={hit => { fromText_ = hit.char }} />
      </section>
    </div>

    <section class="pane output" aria-label={t('app.output')}>
      <div class="preview"><IdsPreview {adapter} tree={editor.tree} chosen={editor.chosen} {messages} {locale} notes={false} bind:drawing /></div>
      <div class="details">
        <div class="readout">
          <div class="seq-row">
            <output class="seq" lang="ja">{editor.whole}</output>
            {#each encoded as ch (ch)}
              <button type="button" class="char" title={t('app.copyChar', { char: ch })} aria-label={`${t('app.encoded')} ${ch}`} onclick={() => copy(ch)}><span lang="ja">{ch}</span><code>{cp(ch)}</code></button>
            {/each}
            <button type="button" class="tool" title={t('app.copySequence')} aria-label={t('app.copySequence')} onclick={() => copy(editor.whole)}><Icon name="copy" /></button>
          </div>
          <details class="points">
            <summary>{t('app.codePoints', { count: points.length })}</summary>
            <ol>{#each points as p, i (i)}<li><span lang="ja">{p.ch}</span><code>{p.cp}</code></li>{/each}</ol>
            <button type="button" class="link" onclick={() => copy(points.map(p => p.cp).join(' '))}>{t('app.copyPoints')}</button>
          </details>
        </div>
        <div class="block"><ExportPanel {drawing} sequence={editor.whole} {t} onnote={note} /></div>
      </div>
    </section>
  </main>

  <footer class="foot">
    <a href="https://github.com/mkpoli/ids-input"><Icon name="github" size={14} />ids-input</a>
    <span aria-hidden="true">·</span>
    <button type="button" class="link" onclick={() => aboutOpen = true}>{t('app.footer.about')}</button>
    <span aria-hidden="true">·</span>
    <a href="https://github.com/mkpoli/han-compose">han-compose</a>
  </footer>
</div>

<Toast {toast} ondone={() => toast = null} />
<Dialog bind:open={moreOpen} title={t('app.menu')} closeLabel={t('app.close')}>
  <div class="more-sheet">
    <div class="more-row">
      <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={themeLabels} onchange={setTheme} />
      <Menu label={localeName} ariaLabel={`${t('app.language')}: ${localeName}`} icon="globe" items={localeItems} align="end" {keyHints} compact />
    </div>
    <MenuList label={t('app.history')} items={historyItems} onpick={() => moreOpen = false} />
    <MenuList label={t('app.drafts')} items={draftItems} onpick={() => moreOpen = false} />
    <MenuList label={t('app.examples')} items={exampleItems} onpick={() => moreOpen = false} />
    <MenuList label={t('app.more')} onpick={() => moreOpen = false} items={[
      { label: t('app.share'), icon: 'share', disabled: editor.tree === null, run: () => shareOpen = true },
      { label: t('app.prefs.title'), icon: 'settings', run: () => prefsOpen = true },
      { label: t('app.about.title'), icon: 'info', run: () => aboutOpen = true },
    ]} />
  </div>
</Dialog>
<AboutDialog bind:open={aboutOpen} {t} />
<PreferencesDialog bind:open={prefsOpen} {theme} bind:keyHints bind:composer defaultComposer={COMPOSER} {t} ontheme={setTheme} />
<ShareDialog bind:open={shareOpen} link={linkTo(editor.whole, location)} sequence={editor.whole} {t} onnote={note} />

<style>
  .app{display:flex;flex-direction:column;min-height:100dvh}
  .bar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:12px;flex-wrap:wrap;
    padding:max(8px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 8px max(16px,env(safe-area-inset-left));background:color-mix(in srgb,var(--bg) 88%,transparent);
    backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  .brand{display:flex;align-items:center;gap:8px;margin-right:8px;color:var(--ink);text-decoration:none;font-weight:650;font-size:15px;white-space:nowrap}
  .tools,.end,.group{display:flex;align-items:center;gap:6px}
  .group{gap:0;height:32px;border-radius:9px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line)}
  .group :global(.tool){height:32px;border:0;border-left:1px solid var(--line);border-radius:0;background:none}
  .group > :global(.tool:first-child){border-left:0;border-radius:9px 0 0 9px}
  .group .wide-only:last-child :global(.tool){border-radius:0 9px 9px 0}
  .group :global(.tool:focus-visible){outline-offset:-2px}
  .end{margin-left:auto}
  :global(.tool){display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 9px;border:1px solid var(--line);border-radius:9px;background:var(--surface);
    color:var(--ink);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
  :global(.tool:not(:disabled):hover),:global(.tool.on){background:var(--hover)}
  :global(.tool:disabled){color:var(--muted);background:var(--surface-2);cursor:default}
  :global(.tool:focus-visible),.link:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .wide-only{display:contents}
  .phone-only{display:none}
  .more-sheet{display:flex;flex-direction:column;gap:14px}
  .more-row{display:flex;align-items:center;justify-content:space-between;gap:8px}

  .work{flex:1;display:grid;gap:16px;padding:16px;grid-template-columns:minmax(0,1fr);min-width:0}
  .pane{display:flex;flex-direction:column;gap:16px;min-width:0;padding:16px;border-radius:14px;background:var(--surface);box-shadow:var(--shadow)}
  .block{display:flex;flex-direction:column;gap:6px;min-width:0}
  .label{margin:0;font-size:11px;font-weight:600;letter-spacing:.03em;color:var(--muted)}
  .status{margin:0;font-size:12px;line-height:1.45;color:var(--muted)}
  .status.fault{color:var(--fault)}
  .view-tabs{display:flex;align-self:flex-start;gap:2px;padding:2px;border:1px solid var(--line);border-radius:9px;background:var(--surface-2)}
  .view-tabs button{height:26px;padding:0 10px;border:0;border-radius:7px;background:none;color:var(--muted);font:inherit;font-size:12px;cursor:pointer}
  .view-tabs button[aria-selected="true"]{background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}
  .view-tabs button:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .tree-list{flex:1;min-height:0;overflow:hidden;border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}
  .tree-box{display:grid;width:100%;aspect-ratio:1;margin:0 auto;border-radius:12px;background:var(--surface-2);border:1px solid var(--line);overflow:hidden}
  .tree-box :global(.ids-tree){height:100%;overflow:auto}
  .tree-box :global(.ids-tree-root){width:min(100%,600px)}
  .tree-box{--ids-part-size:clamp(32px,4.2vw,56px)}
  .preview{position:relative;display:grid;width:100%;--ids-preview-size:100%}
  .preview :global(.ids-preview-meta){position:absolute;top:10px;left:10px;z-index:1}
  .preview :global(.ids-preview-large){border-radius:12px;background:var(--surface-2)}
  .details{display:flex;flex-direction:column;gap:16px;min-width:0}
  .readout{display:flex;flex-direction:column;gap:10px}
  .seq-row{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}
  .seq{flex:1;min-width:0;font-family:var(--cjk);font-size:22px;overflow-wrap:anywhere}
  .char{display:inline-flex;flex:none;align-items:center;gap:6px;padding:0 8px 0 4px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);cursor:pointer;font:inherit}
  .char span{font-family:var(--cjk);font-size:22px;line-height:1.3}
  .char:hover{border-color:var(--accent)}
  .char:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  code{font:12px ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--muted)}
  .points summary{cursor:pointer;font-size:12px;color:var(--muted)}
  .points ol{display:flex;flex-wrap:wrap;gap:4px 12px;margin:8px 0;padding:0;list-style:none}
  .points li{display:flex;align-items:baseline;gap:4px}
  .points li span{font-family:var(--cjk);font-size:16px}
  .link{padding:0;border:0;background:none;color:var(--accent);font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
  .foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:4px 16px 12px;font-size:12px;color:var(--muted)}
  .foot a{display:inline-flex;align-items:center;gap:5px;color:inherit}
  .foot .link{color:inherit}

  .middle{display:flex;flex-direction:column;gap:16px;min-width:0}
  .split{display:none}
  .results{gap:6px;max-height:min(720px,80dvh);overflow:auto}
  /* Two columns: input beside the tree and its own search panel; the output under both. */
  @media (min-width:880px){
    .work{grid-template-columns:minmax(300px,360px) minmax(0,1fr);align-items:start}
    .output{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}
  }
  /* Three columns filling the window: input, the tree over its own search panel, output. */
  @media (min-width:1280px){
    .app{height:100dvh;min-height:0}
    .work{grid-template-columns:minmax(320px,380px) minmax(0,1fr) minmax(340px,400px);min-height:0;align-items:stretch}
    .pane{overflow:auto;min-height:0}
    .middle{display:grid;grid-template-rows:var(--upper,60%) 12px minmax(0,1fr);gap:0;min-height:0}
    .split{display:grid;place-items:center;min-height:12px;cursor:row-resize;touch-action:none}
    .split .grip{width:56px;height:5px;border-radius:999px;background:var(--line-strong);transition:background-color .12s,width .12s}
    .split:hover .grip,.split:focus-visible .grip{background:var(--accent);width:72px}
    .split:focus-visible{outline:2px solid var(--focus);outline-offset:-2px;border-radius:8px}
    .tree{flex:none;justify-content:flex-start;container-type:size}
    .tree-box{width:min(100%,max(140px,calc(100cqh - 154px)))}
    .output{grid-column:auto;display:flex;flex-direction:column}
    .results{flex:none;min-height:0;max-height:none;overflow:hidden}
    .results :global(.ids-search-results){flex:1;min-height:0}
    .results :global(.hits){flex:1;min-height:0;overflow:auto}
    .results :global(.empty){margin:auto}
  }
  @media (max-width:640px){
    .bar{flex-wrap:nowrap;gap:6px;padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right))}
    .brand{margin-right:auto}
    .brand span,.wide,.wide-only,.end{display:none}
    .phone-only{display:inline-flex}
    .group > :global(.tool:last-of-type){border-radius:0 9px 9px 0}
    .grow{max-height:440px;overflow:auto}
    .work{padding:12px;gap:12px}
    .pane{padding:14px}
  }
</style>
