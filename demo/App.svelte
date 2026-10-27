<script>
  // The IDS workshop: a tab for each description being edited, each its composed drawing, in a strip
  // below the toolbar; under it the input at the start (the sequence, the operators, where
  // parts come from), the tree and search in the middle, and the output at the end (the drawing, the
  // sequence, the character it encodes, its code points, export). File and Edit menus lead the toolbar;
  // the toolbar holds undo, redo, examples, sharing, the language, settings and sources.
  import { tick, untrack } from 'svelte'
  import { IdsCharacterInfo, IdsOperators, IdsPartTools, IdsPicker, IdsPreview, IdsSearch, IdsStructuralSearch, IdsSequence, IdsTree, IdsTreeList, createEditor, shortcut, translator } from '../src/svelte/index.js'
  import { smallSealAdapter } from '../src/adapter/index.js'
  import { hasTangut } from '../src/composer/tangut.js'
  import { composerPreview } from '../src/composer/index.js'
  import { EMPTY_MARKS, componentQuery, parse, unalias } from '../src/core/index.js'
  import ids from '../data/babelstone-ids.tsv.gz?url'
  import additionalIds from '../data/yi-bai-ids.tsv.gz?url'
  import sealData from '../data/small-seal.json.gz?url'
  import parts from '../data/ids-parts.json?url'
  import forms from '../data/component-forms.tsv?url'
  import names from '../data/component-names.tsv?url'
  import folds from '../data/component-name-folds.tsv?url'
  import characterInfo from '../data/character-info.json.gz?url'
  import characters from '../data/character-vocabulary.tsv.gz?url'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { EXAMPLES, EXAMPLE_GROUPS } from './lib/examples.js'
  import { createIconDrawings } from './lib/icons.js'
  import { treeGlyph } from './lib/tree-glyph.js'
  import exampleDrawings from './lib/example-drawings.json'
  import { COMPOSER_BASE, COMPOSER_BASES } from './lib/composer.js'
  import { drafts as storedDrafts, forget, keep } from './lib/projects.js'
  import { linkTo, sequenceFrom } from './lib/share.js'
  import { canonical, makeTab, readActiveTab, readTabs, writeTabs } from './lib/tabs.js'
  import { applyTheme, storedTheme } from './lib/theme.js'
  import { load, save } from './lib/storage.js'
  import { columnWidths, MIN_INPUT, MIN_OUTPUT, storedWidth } from './lib/panels.js'
  import AboutDialog from './ui/AboutDialog.svelte'
  import ExportPanel from './ui/ExportPanel.svelte'
  import Icon from './ui/Icon.svelte'
  import KeyHint from './ui/KeyHint.svelte'
  import Menu from './ui/Menu.svelte'
  import MenuBar from './ui/MenuBar.svelte'
  import MenuList from './ui/MenuList.svelte'
  import Dialog from './ui/Dialog.svelte'
  import PreferencesDialog from './ui/PreferencesDialog.svelte'
  import ShareDialog from './ui/ShareDialog.svelte'
  import ReplacementDialog from './ui/ReplacementDialog.svelte'
  import TabStrip from './ui/TabStrip.svelte'
  import Toast from './ui/Toast.svelte'
  import ColumnSplitter from './ui/ColumnSplitter.svelte'

  const params = new URLSearchParams(location.search)
  /** @type {'sans' | 'serif' | 'klee'} */
  let face = $state(load('font', 'sans'))
  $effect(() => save('font', face === 'sans' ? undefined : face))
  $effect(() => { document.documentElement.dataset.font = face })
  // The han-compose export the preview draws from; `?composer=`, VITE_COMPOSER_BASE or Preferences point it elsewhere.
  let composer = $state(params.get('composer') || load('composer', '') || '')
  const base = $derived(composer || import.meta.env.VITE_COMPOSER_BASE || COMPOSER_BASES[face] || COMPOSER_BASE)
  $effect(() => save('composer', params.get('composer') ? undefined : composer || undefined))
  const babel = smallSealAdapter({ data: sealData, ids, additionalIds, parts, forms, names, folds, characters, characterInfo })
  // Manual changes to the preview belong to the active document tab.
  let adjusting = $state(false)
  /** @type {Record<string, { dx?: number, dy?: number, scale?: number, rotate?: number }>} */
  let adjustments = $state({})
  const adjustmentCount = $derived(Object.keys(adjustments).length)
  const separate = $derived(adjusting || adjustmentCount > 0)
  /** @type {Map<string, ReturnType<typeof composerPreview>>} */
  const previews = new Map()
  /** @param {string} at @param {boolean} split @param {'sans' | 'serif' | 'kaisho'} style */
  const previewAt = (at, split, style) => {
    const key = `${at}\0${split ? '1' : '0'}\0${style}`
    if (!previews.has(key)) previews.set(key, composerPreview({ base: at, separate: split, fontStyle: style }))
    return /** @type {ReturnType<typeof composerPreview>} */ (previews.get(key))
  }
  /** The drawings prepared by demo/scripts/build-example-drawings.mjs for this export. @type {Map<string, import('../src/adapter/types.js').Drawing>} */
  const prepared = new Map(Object.entries(exampleDrawings.drawings).map(([sequence, entry]) => [sequence, entry.drawn]))
  /** @type {Map<string, ReturnType<typeof composerPreview>>} */
  const previewsWithExamples = new Map()
  /** A base as the composer's loader settles it: absolute, with a trailing slash on the path. @param {string} value */
  function exportUrl(value) {
    try {
      const url = new URL(value, location.href)
      if (!url.pathname.endsWith('/')) url.pathname += '/'
      return url.href
    } catch { return null }
  }
  const preparedBase = exportUrl(COMPOSER_BASE)
  /** A prepared drawing applies only to the composed preview. @param {string} at @param {boolean} split @param {'sans' | 'serif' | 'kaisho'} style */
  function previewFor(at, split, style) {
    const key = `${at}\0${split ? '1' : '0'}\0${style}`
    const known = previewsWithExamples.get(key)
    if (known) return known
    // The compact Serif export covers the BMP; a sequence outside it draws from the sans export.
    const outsideSerif = at === COMPOSER_BASES.serif && [...editor.whole].some(ch => (ch.codePointAt(0) ?? 0) > 0xffff)
    const usableAt = outsideSerif ? COMPOSER_BASE : at
    const usableStyle = outsideSerif ? 'sans' : style
    const composed = previewAt(usableAt, split, usableStyle)
    if (split || usableStyle !== 'sans' || exportUrl(usableAt) !== preparedBase) { previewsWithExamples.set(key, composed); return composed }
    /** @type {ReturnType<typeof composerPreview>} */
    const preview = Object.assign(async (sequence, options) => {
      options?.signal?.throwIfAborted()
      return prepared.get(sequence) ?? composed(sequence, options)
    }, {
      warm: (/** @type {string | undefined} */ sequence) => {
        if (sequence === undefined || !prepared.has(sequence)) composed.warm()
      },
    })
    previewsWithExamples.set(key, preview)
    return preview
  }
  // Tab icons need their own drawer so their requests cannot cancel the main preview.
  /** @type {Map<string, ReturnType<typeof createIconDrawings>>} */
  const iconDrawings = new Map()
  /** @param {string} at @param {'sans' | 'serif' | 'kaisho'} style */
  const iconsAt = (at, style) => {
    const key = `${at}\0${style}`
    if (!iconDrawings.has(key)) {
      const composed = composerPreview({ base: at, fontStyle: style })
      iconDrawings.set(key, createIconDrawings(async sequence =>
        (style === 'sans' && exportUrl(at) === preparedBase ? prepared.get(sequence) : null) ?? composed(sequence)))
    }
    return /** @type {ReturnType<typeof createIconDrawings>} */ (iconDrawings.get(key))
  }
  const componentStyle = $derived(face === 'serif' ? 'serif' : face === 'klee' ? 'kaisho' : 'sans')
  const icons = $derived(iconsAt(base, componentStyle))
  const adapter = $derived({ ...babel, preview: previewFor(base, separate, componentStyle), icon: icons, fontStyle: componentStyle })
  /** @type {Map<string, ReturnType<typeof createIconDrawings>>} */
  const treeDrawers = new Map()
  /** @param {string} at @param {'sans' | 'serif' | 'kaisho'} style */
  function treeDrawer(at, style) {
    const key = `${at}\0${style}`
    if (!treeDrawers.has(key)) treeDrawers.set(key, createIconDrawings(composerPreview({ base: at, fontStyle: style })))
    return /** @type {ReturnType<typeof createIconDrawings>} */ (treeDrawers.get(key))
  }
  const treeDraw = $derived.by(() => {
    const draw = treeDrawer(base, componentStyle)
    return (/** @type {string} */ part) => treeGlyph(part).then(result => result ?? draw(part))
  })

  const wanted = String(params.get('lang') ?? load('locale', null) ?? navigator.language ?? '')
  // A browser asking for Traditional Chinese names its region or script, never the catalogue's code.
  const traditional = /^zh-(?:Hant|TW|HK|MO)\b/i
  let locale = $state(LOCALES.find(([code]) => code === wanted)?.[0]
    ?? (traditional.test(wanted) ? 'zh-Hant' : undefined)
    ?? LOCALES.find(([code]) => wanted.startsWith(code.split('-')[0]))?.[0] ?? 'en')
  $effect(() => save('locale', locale))
  $effect(() => { document.documentElement.lang = locale })
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
  const savedTint = load('tintMode', 'hover')
  /** @type {import('../src/svelte/editor.svelte.js').TintMode} */
  let tintMode = $state(savedTint === 'on' || savedTint === 'off' ? savedTint : 'hover')
  $effect(() => save('tintMode', tintMode === 'hover' ? undefined : tintMode))
  let keyHints = $state(load('keyHints', true))
  $effect(() => save('keyHints', keyHints ? undefined : false))
  let view = $state(load('view', 'shape'))
  $effect(() => save('view', view === 'shape' ? undefined : view))
  let exampleCards = $state(load('exampleCards', true))
  $effect(() => save('exampleCards', exampleCards ? undefined : false))
  // The share of the middle column given to the tree; the search takes the rest.
  let split = $state(clampSplit(load('split', 60)))
  /** @type {HTMLElement | null} */ let middleEl = $state(null)
  let resizing = false
  $effect(() => save('split', split === 60 ? undefined : split))

  let workWidth = $state(innerWidth)
  let inputWidth = $state(storedWidth(load('inputWidth', null)))
  let outputWidth = $state(storedWidth(load('outputWidth', null)))
  const columns = $derived(columnWidths(workWidth, inputWidth, outputWidth))
  $effect(() => save('inputWidth', inputWidth ?? undefined))
  $effect(() => save('outputWidth', outputWidth ?? undefined))
  /** Freeze the other column at its displayed width during a resize. @param {'input' | 'output'} side @param {number | null} width */
  function resizeColumn(side, width) {
    if (side === 'input') {
      if (width !== null && columns.desktop && columns.output !== (outputWidth ?? 400)) outputWidth = columns.output
      inputWidth = width
    } else {
      if (width !== null && columns.input !== (inputWidth ?? 380)) inputWidth = columns.input
      outputWidth = width
    }
  }

  const uid = $props.id()
  const editor = createEditor(() => ({ adapter, messages, locale, tintMode }))
  let structuralSearch = $state(false)
  const wholeComponentLookup = $derived(componentQuery(editor.whole))
  const searchQuery = $derived(editor.tree === null ? '' : editor.chosen === null || (editor.picked === null && wholeComponentLookup) ? editor.whole : editor.picked === null ? '' : editor.sequenceAt(editor.chosen))
  const componentLookup = $derived(componentQuery(searchQuery))
  /** @type {HTMLElement | null} */ let work = $state(null)
  /** @type {HTMLInputElement | null} */ let slot = $state(null)
  let fromText_ = $state('')
  /** @type {import('../src/adapter/types.js').Drawing | null} */
  let drawing = $state.raw(null)
  /** @type {{ save: (format?: 'svg' | 'png') => Promise<void> } | undefined} */
  let exportPanel = $state()
  /** @type {HTMLButtonElement | null} */ let settingsButton = $state(null)

  // The tabs of the workspace: one description each, the open ones and the active one kept for the
  // next visit. A tab's tree and history wait in `states` while another tab is shown.
  const stored = readTabs(), linked = canonical(sequenceFrom(location))
  // Bring the old single-document autosave into the first tab on upgrade.
  if (!stored.length) {
    const previous = load('current', '')
    if (typeof previous === 'string' && previous) stored.push(makeTab(previous))
  }
  const keptTab = stored.find(tab => tab.id === readActiveTab())
  const linkedTab = linked ? stored.find(tab => tab.sequence === linked) : undefined
  // A link opens its tab, or a tab of its own when none has it; of two tabs holding the same text,
  // the one kept active stays.
  const fromLink = linked && !linkedTab ? makeTab(linked) : undefined
  const opening = stored.length ? [...stored, ...(fromLink ? [fromLink] : [])] : [fromLink ?? makeTab(linked || EXAMPLES[0].sequence)]
  const initial = fromLink ?? (keptTab && linked && keptTab.sequence === linked ? keptTab : linkedTab) ?? keptTab ?? opening[0]
  let tabs = $state(opening)
  let activeId = $state(initial.id)
  const activeTab = $derived(/** @type {import('./lib/tabs.js').Tab} */ (tabs.find(tab => tab.id === activeId) ?? tabs[0]))
  /** @type {Map<string, ReturnType<typeof editor.snapshot>>} */
  const states = new Map()
  editor.reset(initial.sequence)
  const pathKey = (/** @type {number[]} */ path) => path.join('.')
  let knownSequence = editor.whole
  $effect(() => {
    const sequence = editor.whole
    untrack(() => {
      if (sequence === knownSequence) return
      knownSequence = sequence
      adjustments = {}
    })
  })
  function resetChosen() {
    const at = editor.chosen
    if (!at) return
    const key = pathKey(at)
    adjustments = Object.fromEntries(Object.entries(adjustments).filter(([name]) => name !== key && !name.startsWith(`${key}.`)))
  }
  // The address starts on the tab shown, as it does after every change.
  history.replaceState(null, '', linkTo(editor.draft, location))
  // Each change stays in its tab and is written into the address, so the link opens it; the tabs
  // and the active one are kept at the same time, a keystroke at a time.
  $effect(() => editor.listen(text => {
    const tab = tabs.find(tab => tab.id === activeId)
    if (tab) { tab.sequence = text; tab.whole = editor.tree === null ? '' : editor.whole }
    store()
    history.replaceState(null, '', linkTo(text, location))
  }))
  untrack(store)

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
    const known = EXAMPLES.filter(example => example.sequence === text && example.char).map(example => example.char)
    encoded = known
    if (!text || !ask) return
    let live = true
    ask(text).then(found => { if (live) encoded = [...new Set([...known, ...found])] }, () => {})
    return () => { live = false }
  })
  /** @param {string} ch */
  const cp = ch => `U+${/** @type {number} */ (ch.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`
  const points = $derived([...editor.whole].map(ch => ({ ch, cp: cp(ch) })))
  /** @param {string} text */
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); note(t('app.copied', { text })) } catch { note(t('app.copyFailed')) }
  }

  // The tabs: choose one, open a new one, open a sequence in one, and close one. A tab closed by
  // mistake comes back from the note, with its tree and history.
  const current = () => /** @type {import('./lib/tabs.js').Tab} */ (tabs.find(tab => tab.id === activeId))
  /** @typedef {{ adjustments: typeof adjustments, adjusting: boolean }} AdjustState */
  /** @type {Map<string, AdjustState>} */
  const adjustedStates = new Map()
  const currentAdjustments = () => ({ adjustments: structuredClone($state.snapshot(adjustments)), adjusting })
  /** @param {string} id */
  function restoreAdjustments(id) {
    const kept = adjustedStates.get(id)
    adjustments = kept?.adjustments ?? {}
    adjusting = kept?.adjusting ?? false
    knownSequence = editor.whole
  }
  /** Keep the open tabs and the chosen one for the next visit. */
  function store() { writeTabs(tabs, activeId) }
  /** Keep the active tab's tree and history before another is shown. */
  function flush() {
    const tab = current()
    if (tab) {
      states.set(tab.id, editor.snapshot())
      adjustedStates.set(tab.id, currentAdjustments())
    }
  }
  /** @param {string} id */
  function activate(id) {
    if (id === activeId) return
    const tab = tabs.find(tab => tab.id === id)
    if (!tab) return
    flush()
    activeId = id
    toast = null
    const kept = states.get(id)
    states.delete(id)
    if (kept) editor.restore(kept)
    else editor.reset(tab.sequence)
    restoreAdjustments(id)
    store()
  }
  /** A new empty tab, or one over `sequence`, shown at once. @param {string} [sequence] */
  function addTab(sequence = '') {
    flush()
    const tab = makeTab(sequence)
    tabs.push(tab)
    activeId = tab.id
    toast = null
    editor.reset(sequence)
    adjustments = {}
    adjusting = false
    knownSequence = editor.whole
    store()
    return tab
  }
  /** Copy a document beside its source, including its editor history and drawing adjustments. @param {string} id */
  function duplicateTab(id) {
    const source = tabs.find(tab => tab.id === id)
    if (!source) return
    flush()
    const tab = makeTab(source.sequence, source.saved)
    const state = states.get(id)
    if (state) states.set(tab.id, structuredClone($state.snapshot(state)))
    const adjusted = adjustedStates.get(id)
    if (adjusted) adjustedStates.set(tab.id, structuredClone(adjusted))
    tabs.splice(tabs.indexOf(source) + 1, 0, tab)
    activate(tab.id)
  }
  /** A sequence opened in the active tab when it is empty, in the tab already showing it, else in a new tab. @param {string} sequence */
  function openSequence(sequence) {
    const text = canonical(sequence)
    const open = tabs.find(tab => tab.sequence === text)
    if (open) { activate(open.id); return }
    const tab = current()
    // Only an empty tab is reused: an unreadable draft, or one with history, keeps its tab.
    if (tab && !editor.canUndo && !editor.canRedo && (!tab.sequence || EMPTY_MARKS.includes(tab.sequence))) {
      toast = null
      editor.reset(text)
      adjustments = {}
      adjusting = false
      knownSequence = editor.whole
      if (editor.draft === editor.whole) tab.saved = tab.sequence
      store()
      return
    }
    addTab(text)
  }
  /** Close a tab, showing its neighbour; the note brings it back. @param {string} id */
  function closeTab(id) {
    if (tabs.length < 2) return
    const at = tabs.findIndex(tab => tab.id === id)
    if (at < 0) return
    const tab = tabs[at]
    const state = id === activeId ? editor.snapshot() : states.get(id)
    const adjusted = id === activeId ? currentAdjustments() : adjustedStates.get(id)
    states.delete(id)
    adjustedStates.delete(id)
    tabs.splice(at, 1)
    if (id === activeId) {
      const next = tabs[at] ?? tabs[at - 1]
      activeId = next.id
      const saved = states.get(next.id)
      states.delete(next.id)
      if (saved) editor.restore(saved)
      else editor.reset(next.sequence)
      restoreAdjustments(next.id)
    }
    toast = { id: ++notes, text: t('app.tabs.closed', { name: tab.sequence || t('app.tabs.untitled') }), action: t('ids.undo'),
      run: () => reopen(tab, state, adjusted, at) }
    store()
  }
  /**
   * Put a closed tab back where it was.
   * @param {import('./lib/tabs.js').Tab} tab
   * @param {ReturnType<typeof editor.snapshot> | undefined} state
   * @param {AdjustState | undefined} adjusted
   * @param {number} at
   */
  function reopen(tab, state, adjusted, at) {
    if (tabs.some(kept => kept.id === tab.id)) return
    tabs.splice(Math.min(at, tabs.length), 0, tab)
    if (state) states.set(tab.id, state)
    if (adjusted) adjustedStates.set(tab.id, adjusted)
    activate(tab.id)
  }
  /** Show the tab `step` places on, round the strip. @param {number} step */
  function cycle(step) {
    const at = tabs.findIndex(tab => tab.id === activeId)
    if (tabs.length < 2 || at < 0) return
    activate(tabs[(at + step + tabs.length) % tabs.length].id)
  }

  // Saved drafts.
  let drafts = $state(storedDrafts())
  function keepDraft() {
    if (editor.tree === null) return
    drafts = keep(editor.whole)
    const tab = current()
    // The tab is saved when its field holds the tree saved: a draft it cannot read stays marked.
    if (tab && editor.draft === editor.whole) tab.saved = tab.sequence
    store()
    note(t('app.drafts.kept', { sequence: editor.whole }))
  }
  const fileItems = $derived([
    { label: t('app.file.new'), icon: 'plus', run: () => addTab() },
    { label: t('app.tabs.duplicate'), icon: 'copy', run: () => duplicateTab(activeId) },
    { label: t('app.drafts.save'), icon: 'save', shortcut: shortcut('mod+s'), disabled: editor.tree === null, run: keepDraft },
    { separator: /** @type {const} */ (true) },
    { label: t('app.share'), icon: 'share', disabled: editor.tree === null, run: () => shareOpen = true },
    .../** @type {const} */ (['svg', 'png']).map(format => ({ label: t('app.file.export', { format: format.toUpperCase() }), icon: 'download', disabled: !drawing, run: () => { exportPanel?.save(format) } })),
    ...(drafts.length ? [{ separator: /** @type {const} */ (true) }, { heading: t('app.drafts.heading') },
      ...drafts.slice(0, 12).map(d => ({ label: d.sequence, lang: 'ja', hint: new Date(d.saved).toLocaleString(locale), run: () => openSequence(d.sequence) })),
      { separator: /** @type {const} */ (true) },
      { label: t('app.drafts.forget', { sequence: drafts[0].sequence }), icon: 'trash', lang: 'ja', run: () => { drafts = forget(drafts[0].id) } }] : []),
  ])

  const selectedText = $derived(editor.chosen ? editor.sequenceAt(editor.chosen) : editor.whole)
  const canCopy = $derived(editor.chosen ? editor.picked != null : editor.tree !== null)
  /** Clipboard writes must succeed before a cut changes the tree. @param {boolean} [cut] */
  async function copySelection(cut = false) {
    const tree = editor.tree, path = editor.chosen ?? [], text = selectedText
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(text)
      if (cut && editor.tree === tree) editor.empty(path)
      else note(t('app.copied', { text }))
    } catch { note(t('app.copyFailed')) }
  }
  async function pasteSelection() {
    const tree = editor.tree, path = editor.chosen
    try {
      const text = unalias((await navigator.clipboard.readText()).trim())
      if (editor.tree !== tree) return
      if (!text || parse(text, { open: true }).problem) { note(t('app.edit.invalidPaste')); return }
      if (path) editor.take(text, path)
      else editor.open(text)
    } catch { note(t('app.edit.pasteFailed')) }
  }
  function selectAll() { if (editor.tree !== null) { editor.choose([], { toggle: false }); editor.focusChosen(work) } }
  /** @param {{ sequence: string, char: string, modern?: string }} example @param {string} lang */
  function exampleItem(example, lang) {
    const point = example.char ? cp(example.char) : ''
    return {
      leading: example.char || undefined,
      label: example.sequence,
      sequence: example.sequence,
      note: example.char ? [example.modern, point].filter(Boolean).join(' · ') : t('app.examples.none'),
      unencoded: !example.char,
      lang,
      drawing: prepared.get(example.sequence),
      hint: example.char ? `${example.char}　${example.sequence}　${point}` : `${example.sequence}　${t('app.examples.none')}`,
      run: () => addTab(canonical(example.sequence)),
    }
  }
  const exampleItems = $derived(EXAMPLE_GROUPS.flatMap(group => [
    { heading: t(`app.examples.${group.key}`) },
    ...group.examples.map(example => exampleItem(example, hasTangut(example.sequence) ? 'txg' : 'ja')),
  ]))
  const exampleView = $derived({ list: t('app.examples.list'), cards: t('app.examples.cards'), cardsSelected: exampleCards, onchange: (/** @type {boolean} */ cards) => exampleCards = cards })
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

  let replacementOpen = $state(false), aboutOpen = $state(false), prefsOpen = $state(false), shareOpen = $state(false), moreOpen = $state(false), pointsOpen = $state(false)
  async function focusActiveEditor() {
    await tick()
    if (!work) return
    if (view === 'tree') {
      const row = /** @type {HTMLElement | null} */ (work.querySelector('.ids-treelist [aria-selected="true"]') ?? work.querySelector('.ids-treelist [tabindex="0"]'))
      row?.focus()
    } else await editor.focusChosen(work)
  }
  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (event.defaultPrevented || event.isComposing) return
    const target = /** @type {HTMLElement} */ (event.target)
    if (target.closest('dialog, [role="dialog"]')) return
    const command = (event.ctrlKey || event.metaKey) && !event.altKey
    const mod = command && !event.shiftKey
    if (mod && event.key === ',') { event.preventDefault(); prefsOpen = true; return }
    // The browser may keep Ctrl+Tab for itself; where it does not, it moves between the tabs.
    if (command && tabs.length > 1 && (event.key === 'Tab' || event.key === 'PageDown' || event.key === 'PageUp')) {
      event.preventDefault()
      const inStrip = Boolean(target.closest('.tabbar'))
      const inEditor = target instanceof Node && Boolean(work?.contains(target))
      cycle(event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : (event.key === 'PageDown' ? 1 : -1))
      if (inStrip) tick().then(() => /** @type {HTMLElement | null} */ (document.querySelector('.tabbar .tab.on [role="tab"]'))?.focus())
      else if (inEditor) focusActiveEditor()
      return
    }
    if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); keepDraft(); return }
    if (target.closest('input, textarea, select, [contenteditable="true"], [role="menu"]')) return
    if (mod && ['c', 'x', 'v', 'a'].includes(event.key.toLowerCase())) {
      if (['c', 'x'].includes(event.key.toLowerCase()) && !getSelection()?.isCollapsed) return
      event.preventDefault()
      if (event.key.toLowerCase() === 'a') selectAll()
      else if (event.key.toLowerCase() === 'v') pasteSelection()
      else copySelection(event.key.toLowerCase() === 'x')
      return
    }
    editor.keydown(event, { root: work, slot })
  }
  const undoTitle = $derived(editor.steps.done.at(-1) ? t('ids.undo.named', { step: editor.steps.done.at(-1) ?? '' }) : t('ids.undo'))
  const redoTitle = $derived(editor.steps.undone[0] ? t('ids.redo.named', { step: editor.steps.undone[0] }) : t('ids.redo'))
  const editItems = $derived([
    { label: undoTitle, icon: 'undo', shortcut: shortcut('mod+z'), disabled: !editor.canUndo, run: () => editor.undo() },
    { label: redoTitle, icon: 'redo', shortcut: shortcut('mod+shift+z'), disabled: !editor.canRedo, run: () => editor.redo() },
    { separator: /** @type {const} */ (true) },
    { label: t('app.edit.cut'), icon: 'cut', shortcut: shortcut('mod+x'), disabled: !canCopy, run: () => { copySelection(true) } },
    { label: t('app.copy'), icon: 'copy', shortcut: shortcut('mod+c'), disabled: !canCopy, run: () => { copySelection() } },
    { label: t('app.edit.paste'), icon: 'paste', shortcut: shortcut('mod+v'), run: () => { pasteSelection() } },
    { separator: /** @type {const} */ (true) },
    { label: t('app.edit.selectAll'), shortcut: shortcut('mod+a'), disabled: editor.tree === null, run: selectAll },
    { label: t('ids.clear'), icon: 'trash', disabled: editor.picked == null, run: () => editor.empty(editor.chosen) },
    { separator: /** @type {const} */ (true) },
    { label: t('app.prefs.title'), icon: 'settings', shortcut: shortcut('mod+,'), run: () => prefsOpen = true },
  ])
  /** @param {import('./lib/theme.js').Theme} next */
  const setTheme = next => { theme = next; applyTheme(next) }
</script>

<svelte:window onkeydown={keys} />
<svelte:head><title>{t('app.title')} — {t('ids.label')}</title></svelte:head>

<div class="app" lang={locale} data-composer={base}>
  <div class="chrome">
    <header class="bar">
      <a class="brand" href="./" aria-label={t('app.title')}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="var(--accent)" /><path d="M7 7h4v10H7zM13 7h4v4h-4zM13 13h4v4h-4z" fill="var(--on-accent)" /></svg>
        <span>{t('app.title')}</span>
      </a>
      <span class="wide-only"><MenuBar label={t('app.menu')} menus={[{ label: t('app.file'), items: fileItems }, { label: t('app.edit'), items: editItems }]} {keyHints} /></span>
      <nav class="tools" aria-label={t('app.toolbar')}>
        <div class="group">
          <button type="button" class="tool key-hint" disabled={!editor.canUndo} title={undoTitle} aria-label={undoTitle} aria-keyshortcuts="Control+Z Meta+Z" onclick={() => editor.undo()}>
            <Icon name="undo" />{#if keyHints}<KeyHint combos={['mod+z']} />{/if}</button>
          <button type="button" class="tool key-hint" disabled={!editor.canRedo} title={redoTitle} aria-label={redoTitle} aria-keyshortcuts="Control+Shift+Z Control+Y Meta+Shift+Z Meta+Y" onclick={() => editor.redo()}>
            <Icon name="redo" />{#if keyHints}<KeyHint combos={['mod+shift+z', 'mod+y']} />{/if}</button>
          <span class="wide-only"><Menu label={t('app.history')} icon="history" text={false} items={historyItems} {keyHints} /></span>
        </div>
        <span class="wide-only"><Menu label={t('app.examples')} icon="book" items={exampleItems} {keyHints} wide view={exampleView} /></span>
      <div class="font-switch" role="group" aria-label={t('app.font')}>
        <button type="button" class="font-choice" aria-pressed={face === 'sans'} aria-label={t('app.font.sans')} title={t('app.font.sans')} onclick={() => face = 'sans'}><span class="aa sans">Aa</span><span class="wide">{t('app.font.sans')}</span></button>
        <button type="button" class="font-choice" aria-pressed={face === 'serif'} aria-label={t('app.font.serif')} title={t('app.font.serif')} onclick={() => face = 'serif'}><span class="aa serif">Aa</span><span class="wide">{t('app.font.serif')}</span></button>
        <button type="button" class="font-choice" aria-pressed={face === 'klee'} aria-label={t('app.font.klee')} title={t('app.font.klee')} onclick={() => face = 'klee'}><span class="aa klee">Aa</span><span class="wide">{t('app.font.klee')}</span></button>
      </div>
      </nav>
      <div class="end">
        <button type="button" class="tool" disabled={editor.tree === null} title={t('app.share')} aria-label={t('app.share')} onclick={() => shareOpen = true}><Icon name="share" /><span class="wide">{t('app.share')}</span></button>
        <Menu label={localeName} ariaLabel={`${t('app.language')}: ${localeName}`} icon="globe" items={localeItems} align="end" {keyHints} compact />
        <button type="button" class="tool key-hint" bind:this={settingsButton} aria-haspopup="dialog" aria-expanded={prefsOpen} title={t('app.prefs.title')} aria-label={t('app.prefs.title')} aria-keyshortcuts="Control+, Meta+," onclick={() => prefsOpen = !prefsOpen}><Icon name="settings" />{#if keyHints}<KeyHint combos={['mod+,']} />{/if}</button>
        <button type="button" class="tool" title={t('app.about.title')} aria-label={t('app.about.title')} onclick={() => aboutOpen = true}><Icon name="info" /></button>
      </div>
      <button type="button" class="tool more phone-only" title={t('app.menu')} aria-label={t('app.menu')} aria-haspopup="dialog" aria-expanded={moreOpen} onclick={() => moreOpen = true}><Icon name="menu" /></button>
    </header>
    <div class="tabs-slot">
      <TabStrip {tabs} {activeId} panelId={uid} {t} draw={icons} onselect={activate} onclose={closeTab} onnew={() => addTab()} onduplicate={duplicateTab} />
    </div>
  </div>

  <main class="workspace" bind:this={work}>
    <div class="work" id={uid} role="tabpanel" aria-labelledby={`${uid}-tab-${activeTab.id}`}
      bind:clientWidth={workWidth} style:--input-width="{columns.input}px" style:--output-width="{columns.output}px">
      <section class="pane input" id="input-panel" aria-label={t('app.input')}>
        <div class="block">
          <div class="label-row">
            <h2 class="label">{t('ids.label')}</h2>
            {#if points.length}
              <button type="button" class="points-btn" aria-haspopup="dialog" title={t('app.codePoints', { count: points.length })} onclick={() => pointsOpen = true}>{t('app.codePoints', { count: points.length })}</button>
            {/if}
          </div>
          <div class="seq-line">
            <IdsSequence {editor} label={false} />
            <button type="button" class="tool seq-copy" disabled={!editor.whole} title={t('app.copySequence')} aria-label={t('app.copySequence')} onclick={() => copy(editor.whole)}><Icon name="copy" /></button>
          </div>
          <button type="button" class="replacement-link" onclick={() => replacementOpen = true}>{t('app.replacement.title')}</button>
          {#if editor.problem}<p class="status fault" role="status">{editor.problem}</p>
          {:else if editor.pending}<p class="status" role="status">{wholeComponentLookup ? t('ids.search.emptyHint') : editor.pending}</p>{/if}
        </div>
        <div class="block"><IdsOperators {editor} {keyHints} /></div>
        <div class="block grow"><IdsPicker {editor} pickers={['parts', 'templates', 'from', 'find', 'characters']} bind:fromText={fromText_} title={false} /></div>
      </section>

      <div class="column-gap input-gap">
        <ColumnSplitter value={columns.input} min={MIN_INPUT} max={columns.inputMax} label={t('app.panels.resizeWidth', { panel: t('app.input') })}
          controls="input-panel" onchange={width => resizeColumn('input', width)} onreset={() => resizeColumn('input', null)} />
      </div>

      <div class="middle" bind:this={middleEl} style:--upper="{split}%">
        <section class="pane tree" aria-label={t('ids.structure')}>
          <div class="view-tabs" role="tablist" aria-label={t('ids.view')}>
            <button type="button" role="tab" id="shape-tab" aria-selected={view === 'shape'} aria-controls="shape-panel" tabindex={view === 'shape' ? 0 : -1}
              onclick={() => view = 'shape'} onkeydown={viewKey}>{t('ids.view.shape')}</button>
            <button type="button" role="tab" id="tree-tab" aria-selected={view === 'tree'} aria-controls="tree-panel" tabindex={view === 'tree' ? 0 : -1}
              onclick={() => view = 'tree'} onkeydown={viewKey}>{t('ids.view.tree')}</button>
          </div>
          {#if view === 'shape'}
            <div class="tree-box" role="tabpanel" id="shape-panel" aria-labelledby="shape-tab"><IdsTree {editor} {keyHints} draw={treeDraw} fontStyle={componentStyle} /></div>
          {:else}
            {#key activeId}
              <div class="tree-list" role="tabpanel" id="tree-panel" aria-labelledby="tree-tab"><IdsTreeList {editor} /></div>
            {/key}
          {/if}
          <div class="block tools-row"><IdsPartTools {editor} {keyHints} bind:slot status={false} /></div>
        </section>
        <div class="split" role="separator" aria-orientation="horizontal" aria-label={t('app.panels.resize')} title={`${t('app.panels.resize')} (${Math.round(split)}%)`}
          aria-valuemin="35" aria-valuemax="78" aria-valuenow={Math.round(split)} tabindex="0"
          onpointerdown={splitStart} onpointermove={splitMove} onpointerup={splitEnd} onpointercancel={splitEnd}
          onkeydown={splitKey} ondblclick={splitReset}>
          <span class="grip" aria-hidden="true"></span>
        </div>
        <section class="pane results" class:structural={structuralSearch} aria-label={t('ids.search.title')}>
          <div class="search-modes" aria-label={t('ids.search.title')}>
            <button type="button" aria-pressed={!structuralSearch} onclick={() => structuralSearch = false}>{t('ids.search.title')}</button>
            <button type="button" aria-pressed={structuralSearch} onclick={() => structuralSearch = true}>{t('ids.structural.title')}</button>
          </div>
          {#if structuralSearch}
            <IdsStructuralSearch {adapter} {messages} {locale} onopen={hit => openSequence(hit.sequence)} ontake={hit => { fromText_ = hit.char }} />
          {:else}
          <h2 class="label">{componentLookup?.kind === 'parts' ? t('ids.search.partsOf', { char: componentLookup.char }) : searchQuery ? t('ids.search.containing', { sequence: componentLookup?.char ?? searchQuery }) : t('ids.search.title')}</h2>
          <IdsSearch {adapter} query={searchQuery} {messages} {locale}
            onopen={hit => openSequence(hit.sequence)} ontake={hit => { fromText_ = hit.char }} />
          {/if}
        </section>
      </div>
      <div class="column-gap output-gap">
        <ColumnSplitter value={columns.output} min={MIN_OUTPUT} max={columns.outputMax} label={t('app.panels.resizeWidth', { panel: t('app.output') })}
          controls="output-panel" reverse onchange={width => resizeColumn('output', width)} onreset={() => resizeColumn('output', null)} />
      </div>
      <section class="pane output" id="output-panel" aria-label={t('app.output')}>
        <div class="preview">
          {#key activeId}
            <IdsPreview {adapter} tree={editor.tree} chosen={editor.chosen} {messages} {locale} notes={false}
              editable={adjusting} bind:adjustments onchoose={path => editor.choose(path, { toggle: false })} bind:drawing>
              {#snippet detailContent()}
                {#each encoded as ch (ch)}
                  <span class="encoded-character"><code>{cp(ch)}</code><button type="button" title={t('app.copyChar', { char: ch })} aria-label={t('app.copyChar', { char: ch })} onclick={() => copy(ch)}><Icon name="copy" size={13} /></button></span>
                {/each}
              {/snippet}
            </IdsPreview>
          {/key}
          <div class="adjust">
            <button type="button" class="adjust-toggle" aria-pressed={adjusting} disabled={!drawing || Boolean(drawing.cut)}
              title={drawing?.cut ? t('ids.adjust.unavailable') : undefined}
              onclick={() => { adjusting = !adjusting }}>{t(adjusting ? 'ids.adjust.done' : 'ids.adjust.title')}</button>
            {#if adjusting}
              <button type="button" disabled={!editor.chosen} onclick={resetChosen}>{t('ids.adjust.reset')}</button>
              <button type="button" disabled={!adjustmentCount} onclick={() => { adjustments = {} }}>{t('ids.adjust.resetAll')}</button>
              <span class="adjust-hint">{t('ids.adjust.hint')}</span>
            {/if}
          </div>
        </div>
        <div class="details">
          <div class="block"><ExportPanel bind:this={exportPanel} {drawing} sequence={editor.whole} {t} onnote={note} /></div>
        </div>
      </section>
    </div>
  </main>
  <IdsCharacterInfo root={work} {adapter} {messages} {locale} />

</div>

<Toast {toast} ondone={() => toast = null} />
<Dialog bind:open={moreOpen} title={t('app.menu')} closeLabel={t('app.close')}>
  <div class="more-sheet">
    <div class="more-row">
      <Menu label={localeName} ariaLabel={`${t('app.language')}: ${localeName}`} icon="globe" items={localeItems} align="end" {keyHints} compact />
    </div>
    <MenuList label={t('app.history')} items={historyItems} onpick={() => moreOpen = false} />
    <MenuList label={t('app.file')} items={fileItems} onpick={() => moreOpen = false} />
    <MenuList label={t('app.edit')} items={editItems} onpick={() => moreOpen = false} />
    <MenuList label={t('app.examples')} items={exampleItems} onpick={() => moreOpen = false} view={exampleView} />
    <MenuList label={t('app.more')} onpick={() => moreOpen = false} items={[
      { label: t('app.about.title'), icon: 'info', run: () => aboutOpen = true },
    ]} />
  </div>
</Dialog>
<AboutDialog bind:open={aboutOpen} {t} />
<PreferencesDialog anchor={settingsButton} bind:open={prefsOpen} {theme} bind:keyHints bind:tintMode bind:composer defaultComposer={COMPOSER_BASE} {t} ontheme={setTheme} />
<ReplacementDialog bind:open={replacementOpen} {adapter} {t} onopen={openSequence} />
<ShareDialog bind:open={shareOpen} link={linkTo(editor.whole, location)} sequence={editor.whole} {t} onnote={note} />
<Dialog bind:open={pointsOpen} title={t('app.codePoints', { count: points.length })} closeLabel={t('app.close')}>
  <div class="point-sheet">
    <ol class="point-list">{#each points as p, i (i)}<li><span lang="ja">{p.ch}</span><code>{p.cp}</code></li>{/each}</ol>
    <button type="button" class="tool" onclick={() => copy(points.map(p => p.cp).join(' '))}><Icon name="copy" /><span>{t('app.copyPoints')}</span></button>
  </div>
</Dialog>

<style>
  .search-modes{display:flex;gap:4px;margin-bottom:8px}
  .search-modes button{font:inherit;font-size:12px;padding:5px 9px;border:1px solid var(--line);border-radius:6px;background:transparent;color:inherit;cursor:pointer}
  .search-modes button[aria-pressed=true]{background:var(--surface-2);font-weight:600}

  .app{display:flex;flex-direction:column;min-height:100dvh}
  .chrome{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px)}
  .bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
    padding:max(8px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 8px max(16px,env(safe-area-inset-left))}
  .brand{display:flex;align-items:center;gap:8px;color:var(--ink);text-decoration:none;font-weight:650;font-size:15px;white-space:nowrap}
  .brand svg{flex:none}
  .tools,.end,.group{display:flex;align-items:center;gap:6px}
  .group{gap:0;height:32px;border-radius:9px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line)}
  .font-switch{display:flex;align-items:center;gap:2px;height:32px;padding:2px;border:1px solid var(--line);border-radius:9px;background:var(--surface)}
  .font-choice{display:flex;align-items:center;gap:5px;height:26px;padding:0 7px;border:0;border-radius:7px;background:none;color:var(--muted);font:inherit;font-size:11px;cursor:pointer}
  .font-choice .aa{font-size:14px;line-height:1;color:var(--ink);font-family:var(--cjk-sans)}
  .font-choice .aa.serif{font-family:var(--cjk-serif)}
  .font-choice[aria-pressed="true"] .aa.klee{font-family:var(--cjk-klee)}
  .font-choice:hover{color:var(--ink)}
  .font-choice[aria-pressed="true"]{background:var(--accent-soft);color:var(--accent)}
  .font-choice:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  @media (max-width:1100px){.font-choice .wide{display:none}}
  .group :global(.tool){height:32px;border:0;border-left:1px solid var(--line);border-radius:0;background:none}
  .group > :global(.tool:first-child){border-left:0;border-radius:9px 0 0 9px}
  .group .wide-only:last-child :global(.tool){border-radius:0 9px 9px 0}
  .group :global(.tool:focus-visible){outline-offset:-2px}
  .end{margin-left:auto}
  :global(.tool){display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 9px;border:1px solid var(--line);border-radius:9px;background:var(--surface);
    color:var(--ink);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
  :global(.tool:not(:disabled):hover),:global(.tool.on){background:var(--hover)}
  :global(.tool:disabled){color:var(--muted);background:var(--surface-2);cursor:default}
  :global(.tool:focus-visible){outline:2px solid var(--focus);outline-offset:1px}
  .wide-only{display:contents}
  .phone-only{display:none}
  .more-sheet{display:flex;flex-direction:column;gap:14px}
  .more-row{display:flex;align-items:center;justify-content:space-between;gap:8px}

  .tabs-slot{display:flex;height:48px;min-width:0;padding-inline:max(6px,env(safe-area-inset-left)) max(16px,env(safe-area-inset-right));overflow:hidden;background:var(--surface)}
  .workspace{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}
  .work{flex:1;display:grid;gap:16px;padding:16px;grid-template-columns:minmax(0,1fr);min-width:0}
  .pane{display:flex;flex-direction:column;gap:16px;min-width:0;padding:16px;border-radius:14px;background:var(--surface);box-shadow:var(--shadow)}
  .block{display:flex;flex-direction:column;gap:6px;min-width:0}
  .label{margin:0;font-size:11px;font-weight:600;letter-spacing:.03em;color:var(--muted)}
  .label-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px}
  .seq-line{position:relative}
  .seq-line :global(.ids-field){width:100%}
  .seq-line :global(.ids-field input){padding-right:44px}
  .seq-line .seq-copy{position:absolute;right:6px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--muted);cursor:pointer}
  .seq-line .seq-copy:hover{background:var(--surface-2);color:var(--ink)}
  .seq-line .seq-copy:disabled{color:var(--muted);background:none;cursor:default}
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
  .encoded-character{display:inline-flex;align-items:center;gap:2px;color:var(--muted)}
  .encoded-character code{font:11px ui-monospace,monospace}
  .encoded-character button{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer}
  .encoded-character button:hover{color:var(--ink);background:var(--hover)}
  .encoded-character button:focus-visible{outline:2px solid var(--focus)}
  .preview :global(.ids-preview-meta){position:absolute;top:10px;left:10px;z-index:1}
  .preview :global(.ids-preview-large){border-radius:12px;background:var(--surface-2)}
  .adjust{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding-top:8px}
  .adjust button{height:28px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:12px;cursor:pointer}
  .adjust button:hover:not(:disabled){border-color:var(--accent)}
  .adjust button[aria-pressed="true"]{border-color:var(--accent);color:var(--accent)}
  .adjust button:disabled{opacity:.45;cursor:default}
  .adjust button:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .adjust-hint{font-size:11px;color:var(--muted)}
  .details{display:flex;flex-direction:column;gap:16px;min-width:0}
  .replacement-link{align-self:flex-start;padding:2px 0;border:0;background:transparent;color:var(--accent);font:inherit;font-size:12px;cursor:pointer}
  .replacement-link:hover{text-decoration:underline}
  .replacement-link:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
  .points-btn{height:24px;padding:0 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--muted);font:inherit;font-size:12px;cursor:pointer}
  .points-btn:hover{color:var(--ink);border-color:var(--line-strong)}
  .points-btn:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
  .point-sheet{display:flex;flex-direction:column;gap:14px}
  .point-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:6px 10px;margin:0;padding:0;list-style:none}
  .point-list li{display:flex;align-items:baseline;gap:5px;padding:4px 6px;border:1px solid var(--line);border-radius:7px}
  .point-list li span{font-family:var(--cjk);font-size:18px}
  code{font:12px ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--muted)}

  .middle{display:flex;flex-direction:column;gap:16px;min-width:0}
  .column-gap{display:none}
  .split{display:none}
  .results{gap:6px}
  .results.structural{overflow:auto}
  .results.structural :global(.hits){overflow:visible;flex:none}
  /* Two columns: input beside the tree and its own search panel; the output under both. */
  @media (min-width:880px){
    .work{grid-template-columns:var(--input-width) 16px minmax(0,1fr);column-gap:0;align-items:stretch}
    .input{grid-column:1;grid-row:1}
    .input-gap{display:block;grid-column:2;grid-row:1}
    .middle{grid-column:3;grid-row:1}
    .output{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}
  }
  /* Three columns filling the window: input, the tree over its own search panel, output. */
  @media (min-width:1280px){
    .app{height:100dvh;min-height:0}
    .work{grid-template-columns:var(--input-width) 16px minmax(0,1fr) 16px var(--output-width);min-height:0;align-items:stretch}
    .output-gap{display:block;grid-column:4;grid-row:1}
    .pane{overflow:auto;min-height:0}
    .pane.input :global(.parts-grid),.pane.input :global(.from-found),.pane.input :global(.from-tree){max-height:none;overflow:visible}
    .middle{display:grid;grid-template-rows:var(--upper,60%) 12px minmax(0,1fr);gap:0;min-height:0}
    .split{display:grid;place-items:center;min-height:12px;cursor:row-resize;touch-action:none}
    .split .grip{width:56px;height:5px;border-radius:999px;background:var(--line-strong);transition:background-color .12s,width .12s}
    .split:hover .grip,.split:focus-visible .grip{background:var(--accent);width:72px}
    .split:focus-visible{outline:2px solid var(--focus);outline-offset:-2px;border-radius:8px}
    .tree{flex:none;justify-content:flex-start;container-type:size}
    .tree-box{width:min(100%,max(140px,calc(100cqh - 100px)))}
    .output{grid-column:5;grid-row:1;display:flex;flex-direction:column;align-items:stretch}
    .results{flex:none;min-height:0;max-height:none;overflow:hidden}
    .results :global(.ids-search-results){flex:1;min-height:0}
    .results :global(.hits){flex:1;min-height:0;overflow:auto}
    .results :global(.empty){margin:auto}
  }
  @media (max-width:640px){
    .bar{flex-wrap:nowrap;gap:6px;padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right))}
    .tabs-slot{padding-inline:max(12px,env(safe-area-inset-left)) max(12px,env(safe-area-inset-right))}
    .brand{margin-right:auto}
    .brand span,.wide,.wide-only,.end{display:none}
    .phone-only{display:inline-flex}
    .group > :global(.tool:last-of-type){border-radius:0 9px 9px 0}
    .work{padding:12px;gap:12px}
    .pane{padding:14px}
  }
</style>
