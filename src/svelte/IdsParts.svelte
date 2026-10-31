<script>
  // The parts palette: the parts of ideographic description sequences that are hard to type
  // (難輸入部件), as the adapter's `parts()` gives them (the shipped `data/ids-parts.json`). Components
  // shows, by the choice above the grid, the parts 50 or more ideographs use, most used families
  // first with related forms adjacent, or every part of one stroke count, the Han components and CJK
  // strokes together, grouped by the class of the first stroke (横 豎 撇 點 折, where recorded,
  // unknown last). Tangut the Tangut components in code point order, Small Seal the seal forms,
  // Bopomofo the bopomofo letters, Letters & numbers the Latin, Cyrillic and ASCII parts, Hangul the
  // Hangul letters, Gongche the gongche notation, Recent the parts picked here before (kept in this
  // browser under `recentKey`, none when it is null), and Other scripts the rest. A filter of
  // characters finds those parts or matching compound IDS, a number the parts of that many strokes.
  // Picking a part calls `onpick(part)`.
  import { onMount } from 'svelte'
  import { GONGCHE_PARTS, gongcheGroups } from '../core/gongche.js'
  import { HANGUL_FINALS, HANGUL_INITIALS, HANGUL_MEDIALS, composeHangul, composeJamo, findSyllablesByRomanization, romanizeHangul, toConjoiningJamo } from '../core/hangul.js'
  import { shuishuLabel } from '../adapter/shuishu-data.js'
  import { adjacentVariants, matchScriptParts } from '../core/palette.js'
  import { characterScript, groupPaletteParts, isOtherScript } from '../core/scripts.js'
  import coverage from '../../data/unicode-coverage.json' with { type: 'json' }
  import scriptIndex from '../../data/script-parts-index.json' with { type: 'json' }
  import { unpack } from '../composer/loader.js'
  import IdsPartIcon from './IdsPartIcon.svelte'
  import { isNewKorean, isSequence } from '../core/ids.js'
  import { translator } from './i18n.js'

  /**
   * @typedef {import('../adapter/types.js').IdsAdapter} IdsAdapter
   * @typedef {import('../adapter/types.js').PalettePart} PalettePart
   */
  /** @type {{ adapter: IdsAdapter, disabled?: boolean, messages?: Record<string, string>, locale?: string, recentKey?: string | null, onpick?: (part: string) => void }} */
  let { adapter, disabled = false, messages, locale = 'en', recentKey = 'ids-input.recentParts', onpick } = $props()
  const t = $derived(translator(messages, locale))
  const uid = $props.id()

  const RECENT_MAX = 30
  /** @type {('横' | '豎' | '撇' | '點' | '折')[]} */
  const CLASSES = ['横', '豎', '撇', '點', '折']
  const CLASS_KEY = { 横: 'h', 豎: 's', 撇: 'p', 點: 'd', 折: 'z' }
  /** @type {('components' | 'gongche' | 'tangut' | 'seal' | 'shuishu' | 'bopomofo' | 'marks' | 'alphabet' | 'hangul' | 'recent' | 'other')[]} */
  const TABS = ['components', 'gongche', 'tangut', 'seal', 'shuishu', 'bopomofo', 'marks', 'alphabet', 'hangul', 'recent', 'other']

  /** @param {string} key @returns {unknown} */
  const stored = key => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null } }
  /** @param {string} key @param {unknown} value */
  const remember = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Kept for this page only. */ } }

  const range = (/** @type {number} */ first, /** @type {number} */ last) =>
    Array.from({ length: last - first + 1 }, (_, i) => String.fromCodePoint(first + i))
  const bopomofo = [...range(0x3105, 0x312f), ...range(0x31a0, 0x31bf), ...'ˉˊˇˋ˙˪˫']
  const alphabet = [...new Set([
    ...range(0x30, 0x39), ...range(0x41, 0x5a), ...range(0x61, 0x7a),
    ...range(0x400, 0x4ff).filter(char => /\p{Letter}/u.test(char)),
    ...coverage.flatMap(([first, last]) => range(first, last).filter(char => ['latin', 'cyrillic'].includes(characterScript(char) ?? ''))),
  ])]
  // Compatibility jamo are visible on their own; conjoining jamo and extensions include old forms.
  const substitutes = ['◇', '⿺𠃊一', '⿺𠃊二', '⿰⿺𠃊一⿺𠃊一', '𠃊']
  const substituteNames = /** @type {Record<string, string>} */ ({ '◇': '微', '⿺𠃊一': '知', '⿺𠃊二': '徹', '⿰⿺𠃊一⿺𠃊一': '澄', '𠃊': '孃' })
  // The unencoded letters of the New Korean Orthography, and the two recycled letters, by name.
  /** @type {Record<string, { name: string, form?: string, code?: string, aliases: string[] }>} */
  const newKoreanNames = {
    '\u{A97D}': { name: '여린리을', form: '첫소리', code: 'U+A97D', aliases: ['yeorin rieul', 'soft rieul', 'rieu'] },
    '\u{D7FC}': { name: '여린리을', form: '끝소리', code: 'U+D7FC', aliases: ['yeorin rieul', 'soft rieul', 'rieu final'] },
    '\u{A97E}': { name: '된리을', form: '첫소리', code: 'U+A97E', aliases: ['doen rieul', 'strong rieul', 'lieul'] },
    '\u{D7FD}': { name: '된리을', form: '끝소리', code: 'U+D7FD', aliases: ['doen rieul', 'strong rieul', 'lieul final'] },
    '\u{A97F}': { name: '위읍', form: '첫소리', code: 'U+A97F', aliases: ['wi eup', 'wi-eup', 'ueub'] },
    '\u{D7FE}': { name: '위읍', form: '끝소리', code: 'U+D7FE', aliases: ['wi eup', 'wi-eup', 'ueub final'] },
    '\u{D7C7}': { name: '여린이', form: '가운뎃소리', code: 'U+D7C7', aliases: ['yeorin i', 'soft i', 'banmoeum i', 'banmoeumi'] },
    '\u{317F}': { name: '반시읏', code: 'U+317F', aliases: ['ban si eut', 'ban si-eut', 'pansios'] },
    '\u{1140}': { name: '반시읏', code: 'U+1140', aliases: ['ban si eut', 'ban si-eut', 'pansios choseong'] },
    '\u{11EB}': { name: '반시읏', form: '끝소리', code: 'U+11EB', aliases: ['ban si eut', 'ban si-eut', 'pansios jongseong'] },
    '\u{3186}': { name: '여린히읗', code: 'U+3186', aliases: ['yeorin hieuh', 'yeorinhieuh'] },
    '\u{1159}': { name: '여린히읗', code: 'U+1159', aliases: ['yeorin hieuh', 'yeorinhieuh choseong'] },
    '\u{11F9}': { name: '여린히읗', form: '끝소리', code: 'U+11F9', aliases: ['yeorin hieuh', 'yeorinhieuh jongseong'] },
  }
  const hangulLetters = [...range(0x3131, 0x318e), ...range(0x1100, 0x11ff), ...range(0xa960, 0xa97f), ...range(0xd7b0, 0xd7ff), ...range(0xffa1, 0xffdc)]
    .filter(char => isNewKorean(char) || /\p{Letter}/u.test(char) && !/\p{Default_Ignorable_Code_Point}/u.test(char))
  // Hangul tone marks and enclosed forms also have bundled Unicode outlines.
  const hangul = [...substitutes, ...hangulLetters, ...range(0x3200, 0x321e), ...range(0x3260, 0x327e), '〮', '〯']
  const hangulSyllables = range(0xac00, 0xd7a3)
  // All jamo at once, in the three classes and modern forms first. Each class keeps its modern
  // forms in the familiar order, then the historical forms from the conjoining jamo tables.
  const MODERN_INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ']
  const MODERN_VOWELS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ']
  const MODERN_FINAL_CLUSTERS = [...'ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ']
  /** @typedef {'consonant' | 'vowel' | 'final'} JamoKind */
  /** @typedef {{ key: string, label: string, chars: readonly string[], kind: JamoKind }} JamoGroup */
  /** @type {ReadonlyArray<JamoGroup>} */
  const JAMO_GROUPS = [
    { key: 'consonants', label: 'parts.hangul.consonants', chars: [...MODERN_INITIALS, ...HANGUL_INITIALS.historical], kind: 'consonant' },
    { key: 'vowels', label: 'parts.hangul.vowels', chars: [...MODERN_VOWELS, ...HANGUL_MEDIALS.historical], kind: 'vowel' },
    { key: 'finals', label: 'parts.hangul.finals', chars: [...MODERN_FINAL_CLUSTERS, ...HANGUL_FINALS.historical], kind: 'final' },
  ]

  // Loose marks (`marksOf` reads them from a description's end): Bopomofo tone marks, tone bars and
  // Chinese tone letters, combining diacritics, kana voicing marks, Hangul tone marks, superscripts.
  const marks = [...new Set([
    ...'ˉˊˇˋ˙˪˫', ...'˥˦˧˨˩ˬ', ...'꜀꜁꜂꜃꜄꜅꜆꜇',
    '\u0300', '\u0301', '\u0304', '\u0306', '\u0307', '\u0308', '\u0309', '\u030A', '\u030B', '\u030C',
    '\u030F', '\u0311', '\u0313', '\u0315', '\u0323', '\u0325', '\u0327', '\u0328', '\u0330', '\u0331',
    '\u3099', '\u309A', '\u309B', '\u309C', '\u302E', '\u302F', ...'⁰¹²³⁴⁵⁶⁷⁸⁹',
  ])]
  /** A combining mark over a dotted circle, so it is visible before it annotates anything. */
  const markPalette = /** @type {PalettePart[]} */ (marks.map(part => ({ part, kind: 'extra', display: /^\p{M}$/u.test(part) ? `◌${part}` : part })))

  /** @param {string[]} chars @returns {PalettePart[]} */
  const extraParts = chars => chars.map(part => ({ part, kind: 'extra' }))
  let parts = $state.raw(/** @type {PalettePart[] | null} */ (null))
  let failed = $state(false)
  let tab = $state(/** @type {(typeof TABS)[number]} */ ('components')), filter = $state('')
  // The group shown in Components: a stroke count, null for the parts lacking one, undefined for the
  // curated parts the panel opens on.
  /** @type {number | null | undefined} */
  let count = $state(undefined)
  // The Components tail: every part from HAN_TAIL strokes up in one group.
  let partTail = $state(false)
  /** @type {string[]} */
  let recent = $state([])
  $effect(() => {
    const kept = recentKey ? stored(recentKey) : null
    recent = Array.isArray(kept) ? [...new Set(kept.filter(part => typeof part === 'string'))].slice(0, RECENT_MAX) : []
    const read = adapter.parts
    if (!read) { failed = true; return }
    read().then(found => { const seen = new Set(found.map(part => part.part)); parts = [...found, ...extraParts([...bopomofo, ...alphabet, ...hangul].filter(part => !seen.has(part))), ...markPalette.filter(part => !seen.has(part.part))]; failed = false }, () => { failed = true })
  })

  const PAGE_SIZE = 120
  // The stroke count where the single character chips stop.
  const HAN_TAIL = 23
  let hangulGroup = $state(/** @type {'jamo' | 'compose' | 'syllable'} */ ('jamo')), hangulPage = $state(0)
  $effect(() => { tab; hangulGroup; filter; hangulPage = 0 })
  const hangulKeys = $derived.by(() => {
    const syllables = hangulGroup === 'syllable'
    const base = syllables ? hangulSyllables : hangulGroup === 'jamo' ? hangul : []
    const extra = hangulGroup === 'compose' ? [] : (partsByScript.get('hangul') ?? []).map(part => part.part).filter(part => {
      const point = part.codePointAt(0) ?? 0
      return (point >= 0xac00 && point <= 0xd7a3) === syllables
    })
    return [...new Set([...base, ...extra])]
  })
  const hangulMatches = $derived.by(() => {
    if (hangulGroup === 'compose') return []
    const term = filter.trim()
    if (!term) return hangulKeys
    if (hangulGroup === 'syllable') {
      const romanized = findSyllablesByRomanization(term)
      if (romanized.length) return romanized
    }
    const code = /^U\+([0-9a-f]{1,6})$/i.exec(term), point = code ? parseInt(code[1], 16) : null
    const text = point !== null && point <= 0x10ffff ? String.fromCodePoint(point)
      : hangulGroup === 'syllable' ? composeJamo(term) ?? term : term
    const matches = matchScriptParts(hangulKeys, text, Boolean(code))
    const available = new Set(hangulKeys)
    const metadata = (partsByScript.get('hangul') ?? []).filter(part => available.has(part.part) &&
      (/^\d+$/.test(term) && part.strokes === Number(term) || part.aliases?.some(alias => alias.includes(term))))
    const folded = term.toLocaleLowerCase()
    const named = Object.entries(newKoreanNames)
      .filter(([, info]) => info.name.includes(term) || info.code?.toLowerCase().includes(folded) || info.aliases.some(alias => alias.includes(folded)))
      .map(([part]) => part)
      .filter(part => available.has(part))
    return [...new Set([...matches, ...metadata.map(part => part.part), ...named])]
  })
  const hangulPages = $derived(Math.max(1, Math.ceil(hangulMatches.length / PAGE_SIZE)))
  const hangulShown = $derived(hangulMatches.slice(hangulPage * PAGE_SIZE, (hangulPage + 1) * PAGE_SIZE)
    .map(part => byPart.get(part) ?? { part, kind: /** @type {const} */ ('extra') }))

  // The composer's whole Han repertoire, beside the components: a paged list of the characters its
  // export draws, indexed by the stroke count Unihan records. Loaded only when the view is opened.
  let characters = $state(false), hanPage = $state(0)
  /** @type {number | 'tail' | 'unknown' | undefined} */
  let hanCount = $state(undefined)
  /** @type {string[] | null} */
  let hanKeys = $state.raw(null)
  /** @type {(number | null)[] | null} */
  let hanStrokesData = $state.raw(null)
  let hanFailed = $state(false), hanLoading = false
  $effect(() => {
    if (tab !== 'components' || !characters || hanKeys || hanLoading || hanFailed) return
    hanLoading = true
    fetch(new URL('../../data/han-parts.json.gz', import.meta.url))
      .then(response => { if (!response.ok) throw new Error('Han characters'); return response.arrayBuffer() })
      .then(unpack).then(JSON.parse).then(data => { hanKeys = data.keys; hanStrokesData = data.strokes })
      .catch(() => { hanLoading = false; hanFailed = true })
  })
  function retryHan() { hanLoading = false; hanFailed = false }
  $effect(() => { tab; characters; hanCount; filter; hanPage = 0 })
  /** @type {Map<string, number | null>} */
  const hanStrokes = $derived(new Map((hanKeys ?? []).map((key, index) => [key, hanStrokesData?.[index] ?? null])))
  const hanCounts = $derived([...new Set([...hanStrokes.values()].filter(count => count != null))].sort((a, b) => /** @type {number} */ (a) - /** @type {number} */ (b)))
  // Counts below the tail stay single chips; everything from 23 strokes up shares one.
  const hanChips = $derived(hanCounts.filter(count => count < HAN_TAIL))
  const hanTail = $derived(hanCounts.some(count => count >= HAN_TAIL))
  const hanUnknown = $derived([...hanStrokes.values()].some(count => count == null))
  const hanMatches = $derived.by(() => {
    const keys = hanKeys ?? []
    const picked = hanCount === undefined ? keys
      : hanCount === 'unknown' ? keys.filter(key => hanStrokes.get(key) == null)
      : hanCount === 'tail' ? keys.filter(key => (hanStrokes.get(key) ?? 0) >= HAN_TAIL)
      : keys.filter(key => hanStrokes.get(key) === hanCount)
    const term = filter.trim()
    if (!term) return picked
    const code = /^U\+([0-9a-f]{1,6})$/i.exec(term), point = code ? parseInt(code[1], 16) : null
    const text = point !== null && point <= 0x10ffff ? String.fromCodePoint(point) : term
    return matchScriptParts(picked, text, Boolean(code))
  })
  const hanPages = $derived(Math.max(1, Math.ceil(hanMatches.length / PAGE_SIZE)))
  const hanShown = $derived(hanMatches.slice(hanPage * PAGE_SIZE, (hanPage + 1) * PAGE_SIZE)
    .map(part => ({ part, kind: /** @type {const} */ ('extra'), strokes: hanStrokes.get(part) })))

  // The jamo keyboard composes in the order the letters are clicked: initial, medial, final.
  let initial = $state(''), medial = $state(''), final = $state('')
  const composed = $derived(initial && medial ? composeHangul(initial, medial, final) : null)
  const preview = $derived(composed?.text ?? initial)
  /** @param {string | undefined} text */
  const codePoints = text => text ? [...text].map(char => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ') : ''
  const previewPoints = $derived(codePoints(preview))
  /** @param {string} char */
  const canConsonant = char => Boolean(!medial ? toConjoiningJamo(char, 'L') : toConjoiningJamo(char, 'T'))
  /** @param {string} char */
  const canVowel = char => Boolean(toConjoiningJamo(char, 'V')) && !final
  /** @param {string} char */
  const canFinal = char => Boolean(initial && medial && toConjoiningJamo(char, 'T'))
  /** @param {string} char @param {JamoKind} kind */
  const canJamo = (char, kind) => kind === 'vowel' ? canVowel(char) : kind === 'final' ? canFinal(char) : canConsonant(char)
  /** @param {string} char */
  function chooseConsonant(char) {
    if (!canConsonant(char)) return
    const jamo = /** @type {string} */ (toConjoiningJamo(char, medial ? 'T' : 'L'))
    if (!medial) initial = jamo
    else final = jamo
  }
  /** @param {string} char */
  function chooseVowel(char) {
    if (!canVowel(char)) return
    if (!initial) initial = /** @type {string} */ (toConjoiningJamo('ㅇ', 'L'))
    medial = /** @type {string} */ (toConjoiningJamo(char, 'V'))
  }
  /** @param {string} char */
  function chooseFinal(char) {
    if (!canFinal(char)) return
    final = /** @type {string} */ (toConjoiningJamo(char, 'T'))
  }
  function backspace() {
    if (final) final = ''
    else if (medial) medial = ''
    else initial = ''
  }
  function clearCompose() { initial = ''; medial = ''; final = '' }
  function pickComposed() {
    if (!composed || disabled) return
    const text = composed.text
    clearCompose()
    pick(text)
  }
  const filterLabel = $derived(t(tab === 'components' && characters ? 'parts.characters.find' : tab === 'seal' ? 'parts.seal.filter' : tab === 'shuishu' ? 'parts.shuishu.filter' : tab === 'hangul' && hangulGroup === 'syllable' ? 'parts.hangul.find' : 'parts.filter'))
  let otherScript = $state('Grek'), otherPage = $state(0)
  /** @type {Record<string, string[]> | null} */
  let otherData = $state.raw(null)
  let otherFailed = $state(false), otherLoading = false
  const partsByScript = $derived(groupPaletteParts(parts ?? []))
  const scriptNames = $derived.by(() => { try { return new Intl.DisplayNames([locale], { type: 'script' }) } catch { return null } })
  // Symbols and mixed-script descriptions are not scripts, so they have no display name of their own.
  // @x18n-keys
  /** @type {Record<string, string>} */
  const PSEUDO_SCRIPTS = { symbols: 'parts.script.symbols', mixed: 'parts.script.mixed' }
  /** @param {string} id */
  const scriptName = id => PSEUDO_SCRIPTS[id] ? t(PSEUDO_SCRIPTS[id]) : scriptNames?.of(id) ?? id
  const otherScripts = $derived.by(() => {
    const ids = new Set([...scriptIndex.map(group => group.id), ...partsByScript.keys()])
    return [...ids].filter(isOtherScript).sort((a, b) => scriptName(a).localeCompare(scriptName(b)))
  })
  $effect(() => {
    if (tab !== 'other' || !parts || otherData || otherLoading || otherFailed) return
    otherLoading = true
    fetch(new URL('../../data/script-parts.json.gz', import.meta.url))
      .then(response => { if (!response.ok) throw new Error('script parts'); return response.arrayBuffer() })
      .then(unpack).then(JSON.parse).then(data => { otherData = data })
      .catch(() => { otherLoading = false; otherFailed = true })
  })
  function retryOther() { otherLoading = false; otherFailed = false }
  $effect(() => { tab; otherScript; filter; otherPage = 0 })
  const otherKeys = $derived([...new Set([...(partsByScript.get(otherScript) ?? []).map(part => part.part), ...(otherData?.[otherScript] ?? [])])])
  const otherMatches = $derived.by(() => {
    const term = filter.trim()
    if (!term) return otherKeys
    const code = /^U\+([0-9a-f]{1,6})$/i.exec(term), point = code ? parseInt(code[1], 16) : null
    const text = point !== null && point <= 0x10ffff ? String.fromCodePoint(point) : term
    return matchScriptParts(otherKeys, text, Boolean(code))
  })
  const otherPages = $derived(Math.max(1, Math.ceil(otherMatches.length / PAGE_SIZE)))
  /** @type {PalettePart[]} */
  const otherShown = $derived(otherMatches.slice(otherPage * PAGE_SIZE, (otherPage + 1) * PAGE_SIZE)
    .map(part => byPart.get(part) ?? { part, kind: /** @type {const} */ ('extra') }))

  let alphabetPage = $state(0)
  $effect(() => { tab; filter; alphabetPage = 0 })
  const alphabetKeys = $derived.by(() => [...new Set([...alphabet, ...(partsByScript.get('latin') ?? []).map(part => part.part), ...(partsByScript.get('cyrillic') ?? []).map(part => part.part)])])
  const alphabetMatches = $derived.by(() => {
    const term = filter.trim()
    if (!term) return alphabetKeys
    const code = /^U\+([0-9a-f]{1,6})$/i.exec(term), point = code ? parseInt(code[1], 16) : null
    const text = point !== null && point <= 0x10ffff ? String.fromCodePoint(point) : term
    return matchScriptParts(alphabetKeys, text, Boolean(code))
  })
  const alphabetPages = $derived(Math.max(1, Math.ceil(alphabetMatches.length / PAGE_SIZE)))
  const alphabetShown = $derived(alphabetMatches.slice(alphabetPage * PAGE_SIZE, (alphabetPage + 1) * PAGE_SIZE)
    .map(part => byPart.get(part) ?? { part, kind: /** @type {const} */ ('extra') }))

  const byPart = $derived(new Map([...GONGCHE_PARTS, ...(parts ?? [])].map(part => [part.part, part])))
  // The Components panel: the parts whose real IDS use is at least COMMON_USE, with related forms
  // adjacent, or every part of one stroke count, Han components and CJK strokes together. A host part
  // without a use count falls back to its c kind. `chosen` drops a count the palette no longer holds,
  // back to the frequent set.
  const COMMON_USE = 50
  const commonParts = $derived(adjacentVariants((parts ?? []).filter(part =>
    (part.kind === 'c' || part.kind === 'd') && (part.uses == null ? part.kind === 'c' : part.uses >= COMMON_USE))))
  const countedParts = $derived((parts ?? []).filter(part => part.kind === 'c' || part.kind === 'd' || part.kind === 's'))
  // The stroke counts the counted parts hold, in order, null (not recorded) last. Counts from
  // HAN_TAIL up share one chip, as the character list does.
  const counts = $derived([...new Set(countedParts.map(part => part.strokes ?? null))].sort((a, b) => (a ?? Infinity) - (b ?? Infinity)))
  const partChips = $derived(/** @type {number[]} */ (counts.filter(value => value != null && value < HAN_TAIL)))
  // The Components views page like the character list: the frequent set, or one count, in
  // first-stroke order, 120 at a time.
  let componentPage = $state(0)
  $effect(() => { tab; count; partTail; characters; filter; componentPage = 0 })
  const componentList = $derived.by(() => {
    /** @type {{ part: PalettePart, cls: string | null | undefined }[]} */
    const list = []
    if (tab !== 'components' || characters) return list
    if (chosen === undefined && !partTail) {
      for (const part of commonParts) list.push({ part, cls: undefined })
      return list
    }
    const chosenParts = countedParts.filter(part => partTail ? (part.strokes ?? 0) >= HAN_TAIL : (part.strokes ?? null) === chosen)
    for (const group of grouped(chosenParts)) for (const part of group.parts) list.push({ part, cls: group.cls })
    return list
  })
  const componentPages = $derived(Math.max(1, Math.ceil(componentList.length / PAGE_SIZE)))
  const componentShown = $derived.by(() => {
    /** @type {{ cls: string | null | undefined, parts: PalettePart[] }[]} */
    const groups = []
    for (const entry of componentList.slice(componentPage * PAGE_SIZE, (componentPage + 1) * PAGE_SIZE)) {
      const last = groups.at(-1)
      if (last && last.cls === entry.cls) last.parts.push(entry.part)
      else groups.push({ cls: entry.cls, parts: [entry.part] })
    }
    return groups
  })
  const partTailCount = $derived(countedParts.filter(part => (part.strokes ?? 0) >= HAN_TAIL).length)
  const partUnknown = $derived(counts.includes(null))
  const chosen = $derived(count === undefined || counts.includes(count) ? count : undefined)
  /** @param {PalettePart[]} list */
  const grouped = list => [...CLASSES, null]
    .map(cls => ({ cls, parts: adjacentVariants(list.filter(part => (part.first ?? null) === cls)) }))
    .filter(group => group.parts.length)

  // The full outline index is loaded only when the Tangut tab is opened.
  /** @type {string[] | null} */
  let tangutData = $state.raw(null)
  let tangutFailed = $state(false), tangutLoading = false, tangutPage = $state(0)
  $effect(() => {
    if (tab !== 'tangut' || !parts || tangutData || tangutLoading || tangutFailed) return
    tangutLoading = true
    fetch(new URL('../../data/tangut-parts.json.gz', import.meta.url))
      .then(response => { if (!response.ok) throw new Error('Tangut parts'); return response.arrayBuffer() })
      .then(unpack).then(JSON.parse).then(data => { tangutData = data })
      .catch(() => { tangutLoading = false; tangutFailed = true })
  })
  function retryTangut() { tangutLoading = false; tangutFailed = false }
  /** @type {Record<string, number> | null} */
  let tangutStrokes = $state.raw(null)
  $effect(() => {
    if (tab !== 'tangut' || tangutStrokes) return
    fetch(new URL('../../data/tangut-strokes.json.gz', import.meta.url))
      .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('Tangut strokes')))
      .then(unpack).then(JSON.parse).then(data => { tangutStrokes = data.values })
      .catch(() => { /* Counts stay unknown. */ })
  })
  /** @type {number | null | undefined} */
  let tangutStroke = $state(undefined)
  $effect(() => { tab; filter; tangutStroke; tangutPage = 0 })
  const tangutKeys = $derived([...new Set([...(partsByScript.get('tangut') ?? []).map(part => part.part), ...(tangutData ?? [])])])
  const tangutCounts = $derived([...new Set(Object.values(tangutStrokes ?? {}))].sort((a, b) => a - b))
  const tangutUncounted = $derived(tangutKeys.filter(key => tangutStrokes?.[key] == null).length)
  const tangutMatches = $derived.by(() => {
    const keys = tangutStroke === undefined ? tangutKeys
      : tangutStroke === null ? tangutKeys.filter(key => tangutStrokes?.[key] == null)
      : tangutKeys.filter(key => tangutStrokes?.[key] === tangutStroke)
    const term = filter.trim()
    if (!term) return keys
    if (/^\d+$/.test(term)) {
      const count = Number(term)
      return keys.filter(key => (byPart.get(key)?.strokes ?? tangutStrokes?.[key]) === count)
    }
    const code = /^U\+([0-9a-f]{1,6})$/i.exec(term), point = code ? parseInt(code[1], 16) : null
    const text = point !== null && point <= 0x10ffff ? String.fromCodePoint(point) : term
    const matches = matchScriptParts(keys, text, Boolean(code))
    const metadata = (partsByScript.get('tangut') ?? []).filter(part =>
      /^\d+$/.test(term) && part.strokes === Number(term) || part.aliases?.some(alias => alias.includes(term)))
    return [...new Set([...matches, ...metadata.map(part => part.part)])]
  })
  const tangutPages = $derived(Math.max(1, Math.ceil(tangutMatches.length / PAGE_SIZE)))
  const tangutShown = $derived(tangutMatches.slice(tangutPage * PAGE_SIZE, (tangutPage + 1) * PAGE_SIZE)
    .map(part => byPart.get(part) ?? { part, kind: /** @type {const} */ ('t') }))

  // Group names, and the message each one reads: `other` would read as a plural form in the catalogue.
  const SEAL_GROUPS = /** @type {const} */ ([{ name: 'basic', message: 'basic' }, { name: 'compound', message: 'compound' }, { name: 'other', message: 'misc' }])
  let sealGroup = $state(/** @type {(typeof SEAL_GROUPS)[number]['name']} */ ('basic'))
  const sealParts = $derived((parts ?? []).filter(part => part.kind === 'seal'))
  const sealGroups = $derived(SEAL_GROUPS.map(group => ({ ...group, parts: sealParts.filter(part => (part.sealGroup ?? 'other') === group.name) })).filter(group => group.parts.length))
  const selectedSealGroup = $derived(sealGroups.find(group => group.name === sealGroup) ?? sealGroups[0])
  const SHUI_GROUPS = /** @type {const} */ ([{ name: 'dictionary', message: 'dictionary' }, { name: 'radical', message: 'radical' }, { name: 'logogram', message: 'logogram' }])
  let shuiGroup = $state(/** @type {(typeof SHUI_GROUPS)[number]['name']} */ ('dictionary'))
  const shuiParts = $derived((parts ?? []).filter(part => part.kind === 'shui'))
  const shuiGroups = $derived(SHUI_GROUPS.map(group => ({ ...group, parts: shuiParts.filter(part => part.shuiGroup === group.name) })).filter(group => group.parts.length))
  const selectedShuiGroup = $derived(shuiGroups.find(group => group.name === shuiGroup) ?? shuiGroups[0])
  const query = $derived(filter.trim())
  const gongcheShown = $derived(gongcheGroups(query))
  const filtered = $derived.by(() => {
    if (!query || !parts || tab === 'other') return null
    if (tab === 'alphabet') { const chars = new Set([...query]); return alphabet.filter(part => chars.has(part)).map(part => byPart.get(part) ?? { part, kind: /** @type {const} */ ('extra') }) }
    if (tab === 'seal') return sealParts.filter(part => [...query].includes(part.part) || isSequence(part.part) && part.part.includes(query) || part.modern?.some(char => [...query].includes(char)))
    if (tab === 'shuishu') {
      // A code point written U+1B300, or as bare hex when that is all there is.
      const code = /^(?:U\+)?((?=.*\d)[0-9a-f]{4,6})$/i.exec(query)
      if (code) return shuiParts.filter(part => part.part.codePointAt(0) === parseInt(code[1], 16))
      // A description names the character built that way, before its components do, and the parts
      // it is written with when nothing is built that way.
      const built = shuiParts.filter(part => part.ids === query)
      if (built.length) return built
      if (isSequence(query)) return shuiParts.filter(part => query.includes(part.part))
      const lowered = query.toLowerCase()
      return shuiParts.filter(part => part.part === query)
        .concat(shuiParts.filter(part => part.part !== query && shuiWords(part).some(word => word.includes(lowered))))
    }
    if (/^\d+$/.test(query)) return adjacentVariants(parts.filter(part => part.strokes === Number(query)))
    const chars = new Set([...query])
    return adjacentVariants(parts.filter(part => !isSequence(query) && chars.has(part.part) || isSequence(part.part) && part.part.includes(query) || part.aliases?.some(alias => alias.includes(query))))
  })

  /** @type {{ cls: string | null | undefined, parts: PalettePart[] }[]} */
  const shown = $derived.by(() => {
    if (!parts) return []
    if (tab === 'bopomofo') return [{ cls: undefined, parts: bopomofo.map(part => byPart.get(part)).filter(/** @returns {part is PalettePart} */ (part => !!part)) }]
    if (tab === 'marks') return [{ cls: undefined, parts: markPalette }]
    if (tab === 'alphabet') return [{ cls: undefined, parts: alphabet.map(part => byPart.get(part)).filter(/** @returns {part is PalettePart} */ (part => !!part)) }]
    if (tab === 'hangul') return [{ cls: undefined, parts: hangul.map(part => byPart.get(part)).filter(/** @returns {part is PalettePart} */ (part => !!part)) }]
    if (tab === 'seal') return [{ cls: undefined, parts: selectedSealGroup?.parts ?? [] }]
    if (tab === 'shuishu') return [{ cls: undefined, parts: selectedShuiGroup?.parts ?? [] }]
    if (tab === 'tangut') return [{ cls: undefined, parts: parts.filter(part => part.kind === 't') }]
    return [{ cls: undefined, parts: recent.map(part => byPart.get(part) ?? { part, kind: 'd' }) }]
  })

  /** @param {string} part */
  function pick(part) {
    recent = [part, ...recent.filter(other => other !== part)].slice(0, RECENT_MAX)
    if (recentKey) remember(recentKey, recent)
    onpick?.(part)
  }
  // Give a double-click time to select text without inserting its first click.
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let pickTimer
  /** @type {string | undefined} */
  let pendingPart
  /** @type {EventTarget | null} */
  let pendingTarget = null
  let selectionAtDown = ''
  function flushPick() {
    clearTimeout(pickTimer)
    const part = pendingPart
    pendingPart = undefined
    pendingTarget = null
    if (part !== undefined) pick(part)
  }
  onMount(() => {
    /** @param {PointerEvent} event */
    const pointer = event => {
      if (pendingTarget && !event.composedPath().includes(pendingTarget) && !(event.target instanceof Element && event.target.closest('.part'))) flushPick()
    }
    /** @param {KeyboardEvent} event */
    const keyboard = event => {
      if (pendingPart === undefined) return
      if (['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) return
      if ((event.ctrlKey || event.metaKey) && ['a', 'c'].includes(event.key.toLowerCase()) && event.target === pendingTarget) {
        clearTimeout(pickTimer); pendingPart = undefined; pendingTarget = null
      } else flushPick()
    }
    window.addEventListener('pointerdown', pointer, true)
    window.addEventListener('keydown', keyboard, true)
    return () => {
      clearTimeout(pickTimer)
      window.removeEventListener('pointerdown', pointer, true)
      window.removeEventListener('keydown', keyboard, true)
    }
  })
  /** @param {MouseEvent} event @param {string} part */
  function clickPart(event, part) {
    if (pendingPart !== undefined && pendingPart !== part) flushPick()
    clearTimeout(pickTimer)
    pendingPart = undefined
    pendingTarget = null
    if (event.detail === 0) { pick(part); return }
    if (event.detail > 1) return
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) {
      if (selection.toString() !== selectionAtDown) return
      selection.removeAllRanges()
    }
    if ('pointerType' in event && event.pointerType === 'touch') { pick(part); return }
    pendingPart = part
    pendingTarget = event.currentTarget
    pickTimer = setTimeout(flushPick, 500)
  }
  /** @param {MouseEvent} event */
  function selectPart(event) {
    clearTimeout(pickTimer)
    pendingPart = undefined
    pendingTarget = null
    const text = /** @type {HTMLElement} */ (event.currentTarget).querySelector('.part-text')
    if (!text) return
    const range = document.createRange(), selection = window.getSelection()
    range.selectNodeContents(text)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  /** @param {KeyboardEvent} event */
  function selectionKey(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const button = /** @type {HTMLElement} */ (event.currentTarget)
    const key = event.key.toLowerCase()
    const target = key === 'a' ? button.closest('.parts-panel')
      : key === 'c' && window.getSelection()?.isCollapsed ? button.querySelector('.part-text') : null
    if (!target) return
    if (key === 'a') event.preventDefault()
    const range = document.createRange(), selection = window.getSelection()
    range.selectNodeContents(target)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  /** The name, reading and meaning a Shuishu part is found by, lowercased. @param {PalettePart} part */
  function shuiWords(part) {
    return [part.shuiName, part.shuiReading, part.shuiMeaning, part.shuiGloss, part.ids, ...(part.modern ?? [])]
      .filter(Boolean).map(word => /** @type {string} */ (word).toLowerCase())
  }
  /** @param {PalettePart} part */
  const title = part => {
    if (part.kind === 'shui') return shuishuLabel(/** @type {import('../adapter/shuishu-data.js').ShuishuPart} */ (part))
    const nko = tab === 'hangul' ? newKoreanNames[part.part] : null
    const romanization = tab === 'hangul' && hangulGroup === 'syllable' ? romanizeHangul(part.part) : null
    // Tangut characters carry their count in the tab's own data, not in the palette rows.
    const strokeCount = part.strokes ?? (tab === 'tangut' ? tangutStrokes?.[part.part] : null) ?? null
    // The composer's character list has no first-stroke class; its code point identifies the character.
    const composerCharacters = tab === 'components' && characters
    return [
      isNewKorean(part.part) ? null : part.part,
      (tab === 'gongche' && !isSequence(part.part) || tab === 'marks' || composerCharacters) ? `U+${part.part.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}` : null,
      nko ? [nko.name, nko.form, nko.code].filter(Boolean).join(' · ') : tab === 'hangul' ? substituteNames[part.part] : null,
      romanization,
      ...(part.aliases ?? []),
      ...(part.modern ?? []),
      part.sealBasis === 'cjk-ids' ? t('parts.seal.inferred', { ids: part.modernIds?.join(' / ') ?? '' }) : part.sealBasis === 'crosswalk' ? t('parts.seal.crosswalk') : null,
      nko || romanization ? null : tab === 'gongche' && strokeCount == null ? null : strokeCount == null ? t('parts.unknownStrokes') : `${part.derived ? '≈ ' : ''}${t('parts.strokeCount', { count: strokeCount })}`,
      part.uses ? t('parts.uses', { count: part.uses }) : null,
    ].filter(Boolean).join(' · ')
  }
  // Arrow keys, Home and End move between the tabs and choose the one reached.
  /** @type {HTMLButtonElement[]} */
  let tabButtons = $state([])
  /** @param {KeyboardEvent} event @param {number} index */
  function tabKey(event, index) {
    const last = TABS.length - 1
    const to = /** @type {Record<string, number>} */ ({ ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last })[event.key]
    if (to === undefined) return
    event.preventDefault()
    tab = TABS[to]
    tabButtons[to]?.focus()
  }
  // In the one-stroke group, a part without a first-stroke class is ㇣, a stroke outside the five;
  // in every other group it is a part whose first stroke was never recorded.
  /** @param {string | null | undefined} cls */
  const heading = cls => cls ? t(`parts.first.${CLASS_KEY[/** @type {keyof typeof CLASS_KEY} */ (cls)]}`) : !partTail && chosen === 1 ? t('parts.first.rest') : t('parts.first.unknown')
</script>

{#snippet grid(/** @type {PalettePart[]} */ list)}
  <div class="parts-grid">
    {#each list as part (part.part)}
      <button type="button" class="part" data-character={part.part} data-mark={part.display ? 'true' : undefined} class:compound={isSequence(part.part)} {disabled} lang={tab === 'other' ? /** @type {Record<string, string>} */ ({ Arab: 'ar', Hebr: 'he', Hira: 'ja', Kana: 'ja', Deva: 'hi' })[otherScript] : tab === 'hangul' && newKoreanNames[part.part] ? 'ko' : part.kind === 't' ? 'txg' : part.kind === 'shui' ? 'swi' : 'ja'} dir={tab === 'other' ? 'auto' : undefined} title={title(part)} aria-label={title(part)}
        onpointerdown={event => { selectionAtDown = window.getSelection()?.toString() ?? ''; event.currentTarget.draggable = !disabled && !(/** @type {Element} */ (event.target).closest('.part-text')) }}
        ondragstart={event => { if (event.target === event.currentTarget) event.dataTransfer?.setData('text/plain', part.part) }}
        onclick={event => clickPart(event, part.part)} ondblclick={selectPart} onkeydown={selectionKey}>
        {#if isSequence(part.part)}
          <IdsPartIcon sequence={part.part} {adapter} />
          <span class="part-text compound-text">{part.part}</span>
        {:else}
          <span class="part-text">{part.display ?? part.part}</span>
          {#if part.kind === 'shui' && part.ids}<span class="shui-ids" aria-hidden="true">{part.ids}</span>{/if}
          {#if part.sealBasis === 'cjk-ids'}<span class="seal-estimate" aria-hidden="true">≈</span>{/if}
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet hangulCompose()}
  <div class="hangul-compose" role="group" aria-label={t('parts.hangul.compose')}>
    <div class="compose-head">
      <button type="button" class="compose-result" data-character={composed?.text ?? ''} disabled={disabled || !composed}
        title={preview ? `${preview} · ${previewPoints}` : undefined}
        aria-label={composed ? `${t('parts.hangul.insert')} ${composed.text}` : t('parts.hangul.compose')}
        aria-describedby={composed && !composed.precomposed ? `${uid}-hangul-note` : undefined}
        onclick={pickComposed}>
        <span class="compose-glyph">{preview || '⬚'}</span>
        <span class="compose-detail">
          <span class="compose-code">{previewPoints}</span>
          <span class="compose-action">{t('parts.hangul.insert')}</span>
        </span>
      </button>
      <div class="compose-actions">
        <button type="button" class="compose-backspace" aria-label={t('parts.hangul.backspace')} title={t('parts.hangul.backspace')}
          disabled={disabled || (!initial && !medial && !final)} onclick={backspace}>←</button>
        <button type="button" class="compose-clear" disabled={disabled || (!initial && !medial && !final)} onclick={clearCompose}>{t('parts.hangul.clear')}</button>
      </div>
    </div>
    {#each JAMO_GROUPS as group (group.key)}
      <section class="jamo-group" data-hangul-group={group.key}>
        <h4>{t(group.label)}</h4>
        <div class="jamo-grid" role="group" aria-label={t(group.label)}>
          {#each group.chars as char (char)}
            <button type="button" class="jamo-key" data-jamo={char} title={char} aria-label={char}
              disabled={disabled || !canJamo(char, group.kind)}
              onclick={() => group.kind === 'vowel' ? chooseVowel(char) : group.kind === 'final' ? chooseFinal(char) : chooseConsonant(char)}>{char}</button>
          {/each}
        </div>
      </section>
    {/each}
    {#if composed && !composed.precomposed}<p class="parts-note" id={`${uid}-hangul-note`}>{t('parts.hangul.oldCluster')}</p>{/if}
    <p class="compose-live" aria-live="polite">{composed ? `${composed.text} ${previewPoints}` : ''}</p>
  </div>
{/snippet}

<div class="ids-parts" role="group" aria-label={t('parts.label')}>
  <div class="parts-top">
    <div class="parts-tabs" role="tablist" aria-label={t('parts.label')}>
      {#each TABS as name, index (name)}
        <button type="button" role="tab" id={`${uid}-tab-${name}`} aria-controls={`${uid}-panel`} bind:this={tabButtons[index]}
          class:active={tab === name} aria-selected={tab === name} tabindex={tab === name ? 0 : -1}
          onclick={() => { tab = name; filter = '' }} onkeydown={event => tabKey(event, index)}>{name === 'other' ? t('parts.script.choose') : t(`parts.tab.${name}`)}</button>
      {/each}
    </div>
    {#if tab === 'hangul'}
      <div class="hangul-views" role="group" aria-label={t('parts.hangul.group')}>
        {#each /** @type {const} */ ([['jamo', 'parts.hangul.jamo'], ['compose', 'parts.hangul.compose'], ['syllable', 'parts.hangul.syllable']]) as [group, label] (group)}
          <button type="button" class:active={hangulGroup === group} aria-pressed={hangulGroup === group}
            onclick={() => { hangulGroup = /** @type {'jamo' | 'compose' | 'syllable'} */ (group); filter = '' }}>{t(label)}</button>
        {/each}
      </div>
    {/if}
    {#if tab === 'other'}
      <label class="script-select">{t('parts.script.label')}
        <select value={otherScript} onchange={event => { otherScript = event.currentTarget.value; filter = '' }}>
          {#each otherScripts as script (script)}<option value={script}>{scriptName(script)}</option>{/each}
        </select>
      </label>
    {/if}
    {#if !(tab === 'hangul' && hangulGroup === 'compose')}
      <input class="parts-filter" type="search" bind:value={filter} lang="ja" spellcheck="false" autocomplete="off"
        placeholder={filterLabel} aria-label={filterLabel} />
    {/if}
  </div>
  {#if tab === 'tangut' && tangutData && tangutStrokes}
    <div class="parts-counts" role="group" aria-label={t('parts.tangut.strokes')}>
      <button type="button" class:active={tangutStroke === undefined} aria-pressed={tangutStroke === undefined}
        onclick={() => { tangutStroke = undefined }}>{t('parts.tangut.anyStrokes')}</button>
      {#each tangutCounts as value (value)}
        {@const label = t('parts.strokeCount', { count: value })}
        <button type="button" class:active={tangutStroke === value} aria-pressed={tangutStroke === value}
          title={label} aria-label={label}
          onclick={() => { tangutStroke = value }}>{t('parts.strokeChip', { count: value })}</button>
      {/each}
      {#if tangutUncounted}
        <button type="button" class:active={tangutStroke === null} aria-pressed={tangutStroke === null}
          title={t('parts.unknownStrokes')} aria-label={t('parts.unknownStrokes')}
          onclick={() => { tangutStroke = null }}>?</button>
      {/if}
    </div>
  {/if}
  {#if tab === 'seal' && !query && sealGroups.length}
    <div class="script-groups" role="group" aria-label={t('parts.seal.groups')}>
      {#each sealGroups as group (group.name)}
        <button type="button" class:active={selectedSealGroup?.name === group.name} aria-pressed={selectedSealGroup?.name === group.name}
          onclick={() => sealGroup = group.name}>{t(`parts.seal.${group.message}`)} <span>{group.parts.length}</span></button>
      {/each}
    </div>
  {/if}
  {#if tab === 'seal' && (filtered ?? selectedSealGroup?.parts ?? []).some(part => part.sealBasis === 'cjk-ids')}
    <p class="parts-note">{t('parts.seal.estimate')}</p>
  {/if}
  {#if tab === 'shuishu' && !query && shuiGroups.length}
    <div class="script-groups" role="group" aria-label={t('parts.shuishu.groups')}>
      {#each shuiGroups as group (group.name)}
        <button type="button" class:active={selectedShuiGroup?.name === group.name} aria-pressed={selectedShuiGroup?.name === group.name}
          onclick={() => shuiGroup = group.name}>{t(`parts.shuishu.${group.message}`)} <span>{group.parts.length}</span></button>
      {/each}
    </div>
  {/if}
  {#if tab === 'shuishu'}
    <p class="parts-note">{t('parts.shuishu.note')}</p>
    <p class="parts-note">{t('parts.shuishu.ids')}</p>
  {/if}
  {#if tab === 'components'}
    <div class="parts-counts" role="group" aria-label={t('parts.groups')}>
      <button type="button" class:active={!characters && !partTail && chosen === undefined} aria-pressed={!characters && !partTail && chosen === undefined}
        onclick={() => { count = undefined; partTail = false; characters = false }}>{t('parts.tab.common')}</button>
      {#if characters}
        {#each hanChips as value (value)}
          {@const label = t('parts.strokeCount', { count: value })}
          <button type="button" class:active={hanCount === value} aria-pressed={hanCount === value}
            title={label} aria-label={label}
            onclick={() => hanCount = value}>{t('parts.strokeChip', { count: value })}</button>
        {/each}
        {#if hanTail}
          <button type="button" class:active={hanCount === 'tail'} aria-pressed={hanCount === 'tail'}
            title={t('parts.characters.fromStrokes', { count: HAN_TAIL })} aria-label={t('parts.characters.fromStrokes', { count: HAN_TAIL })}
            onclick={() => hanCount = 'tail'}>{HAN_TAIL}+</button>
        {/if}
        {#if hanUnknown}
          <button type="button" class:active={hanCount === 'unknown'} aria-pressed={hanCount === 'unknown'}
            title={t('parts.unknownStrokes')} aria-label={t('parts.unknownStrokes')}
            onclick={() => hanCount = 'unknown'}>?</button>
        {/if}
      {:else}
        {#each partChips as value (value)}
          {@const label = t('parts.strokeCount', { count: value })}
          <button type="button" class:active={!partTail && value === chosen} aria-pressed={!partTail && value === chosen}
            title={label} aria-label={label}
            onclick={() => { count = value; partTail = false }}>{t('parts.strokeChip', { count: value })}</button>
        {/each}
        {#if partTailCount}
          <button type="button" class:active={partTail} aria-pressed={partTail}
            title={t('parts.characters.fromStrokes', { count: HAN_TAIL })} aria-label={t('parts.characters.fromStrokes', { count: HAN_TAIL })}
            onclick={() => { partTail = true; count = undefined }}>{HAN_TAIL}+</button>
        {/if}
        {#if partUnknown}
          <button type="button" class:active={!partTail && chosen === null} aria-pressed={!partTail && chosen === null}
            title={t('parts.unknownStrokes')} aria-label={t('parts.unknownStrokes')}
            onclick={() => { count = null; partTail = false }}>?</button>
        {/if}
      {/if}
      <button type="button" class:active={characters} aria-pressed={characters}
        onclick={() => { characters = true; hanCount = undefined }}>{t('parts.characters.label')}</button>
    </div>
  {/if}
  <div class="parts-panel" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`}>
    {#if tab === 'tangut' && parts}
      {#if !tangutData && !tangutFailed}<p class="parts-note" role="status">{t('parts.loading')}</p>{/if}
      {#if tangutFailed}<p class="parts-note" role="status">{t('parts.script.unavailable')} <button type="button" onclick={retryTangut}>{t('parts.script.retry')}</button></p>{/if}
      {#if tangutMatches.length}
        {#if tangutPages > 1}
          <div class="script-pages" role="group" aria-label={t('parts.script.pages')}>
            <button type="button" disabled={tangutPage === 0} onclick={() => tangutPage--}>{t('parts.script.previous')}</button>
            <input type="number" min="1" max={tangutPages} value={tangutPage + 1} aria-label={t('parts.script.pages')}
              onchange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) tangutPage = Math.max(0, Math.min(tangutPages - 1, Math.floor(value) - 1)) }} />
            <span>{t('parts.script.page', { page: tangutPage + 1, pages: tangutPages, count: tangutMatches.length })}</span>
            <button type="button" disabled={tangutPage + 1 >= tangutPages} onclick={() => tangutPage++}>{t('parts.script.next')}</button>
          </div>
        {/if}
        {@render grid(tangutShown)}
      {:else if tangutData}<p class="parts-note">{t('parts.none')}</p>{/if}
    {:else if tab === 'gongche'}
      {#each gongcheShown as group (group.key)}
        <h4 class="parts-class">{t(`parts.gongche.${group.key}`)}</h4>
        {@render grid(group.parts)}
      {:else}<p class="parts-note">{t('parts.none')}</p>{/each}
      <details class="gongche-guide"><summary>{t('parts.gongche.guide')}</summary>
        <p>{t('parts.gongche.conventions')}</p>
        <p>{t('parts.gongche.compose')}</p>
        <a href="https://dict.th.gov.tw/detailPage.aspx?Ca=163&ID=2045" target="_blank" rel="noopener noreferrer">{t('parts.gongche.beiguan')} ↗</a>
        <a href="https://www.ccli.gov.hk/doc/wgcliac2022-03.pdf" target="_blank" rel="noopener noreferrer">{t('parts.gongche.cantonese')} ↗</a>
        <a href="https://www.unicode.org/L2/L2018/18245-n4967-gongche.pdf" target="_blank" rel="noopener noreferrer">{t('parts.gongche.kunquSource')} ↗</a>
        <a href="https://hkmusicminiatures.com/notes-on-traditional-mnemonic-notation-and-gongche-notation/" target="_blank" rel="noopener noreferrer">{t('parts.gongche.marksSource')} ↗</a>
        <a href="https://tcmb.culture.tw/zh-tw/detail?id=245144&indexCode=Culture_Media" target="_blank" rel="noopener noreferrer">{t('parts.gongche.beiguanSource')} ↗</a>
        <a href="https://www.isc.meiji.ac.jp/~katotoru/singaku-20.html" target="_blank" rel="noopener noreferrer">{t('parts.gongche.seirakuSource')} ↗</a>
      </details>
    {:else if failed}
      <p class="parts-note" role="status">{t('parts.failed')}</p>
    {:else if !parts}
      <p class="parts-note" role="status">{t('parts.loading')}</p>
    {:else if tab === 'hangul'}
      {#if hangulGroup === 'compose'}
        {@render hangulCompose()}
      {:else if hangulMatches.length}
        {#if hangulPages > 1}
          <div class="script-pages" role="group" aria-label={t('parts.script.pages')}>
            <button type="button" disabled={hangulPage === 0} onclick={() => hangulPage--}>{t('parts.script.previous')}</button>
            <input type="number" min="1" max={hangulPages} value={hangulPage + 1} aria-label={t('parts.script.pages')}
              onchange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) hangulPage = Math.max(0, Math.min(hangulPages - 1, Math.floor(value) - 1)) }} />
            <span>{t('parts.script.page', { page: hangulPage + 1, pages: hangulPages, count: hangulMatches.length })}</span>
            <button type="button" disabled={hangulPage + 1 >= hangulPages} onclick={() => hangulPage++}>{t('parts.script.next')}</button>
          </div>
        {/if}
        {@render grid(hangulShown)}
      {:else}<p class="parts-note">{t('parts.none')}</p>{/if}
    {:else if tab === 'other'}
      {#if !otherData && !otherFailed}<p class="parts-note" role="status">{t('parts.loading')}</p>{/if}
      {#if otherFailed}<p class="parts-note" role="status">{t('parts.script.unavailable')} <button type="button" onclick={retryOther}>{t('parts.script.retry')}</button></p>{/if}
      {#if otherMatches.length}
        {#if otherPages > 1}
          <div class="script-pages" role="group" aria-label={t('parts.script.pages')}>
            <button type="button" disabled={otherPage === 0} onclick={() => otherPage--}>{t('parts.script.previous')}</button>
            <input type="number" min="1" max={otherPages} value={otherPage + 1} aria-label={t('parts.script.pages')}
              onchange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) otherPage = Math.max(0, Math.min(otherPages - 1, Math.floor(value) - 1)) }} />
            <span>{t('parts.script.page', { page: otherPage + 1, pages: otherPages, count: otherMatches.length })}</span>
            <button type="button" disabled={otherPage + 1 >= otherPages} onclick={() => otherPage++}>{t('parts.script.next')}</button>
          </div>
        {/if}
        {@render grid(otherShown)}
      {:else if otherData && !otherFailed}<p class="parts-note">{t('parts.none')}</p>{/if}
    {:else if tab === 'alphabet'}
      {#if alphabetMatches.length}
        {#if alphabetPages > 1}
          <div class="script-pages" role="group" aria-label={t('parts.script.pages')}>
            <button type="button" disabled={alphabetPage === 0} onclick={() => alphabetPage--}>{t('parts.script.previous')}</button>
            <input type="number" min="1" max={alphabetPages} value={alphabetPage + 1} aria-label={t('parts.script.pages')}
              onchange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) alphabetPage = Math.max(0, Math.min(alphabetPages - 1, Math.floor(value) - 1)) }} />
            <span>{t('parts.script.page', { page: alphabetPage + 1, pages: alphabetPages, count: alphabetMatches.length })}</span>
            <button type="button" disabled={alphabetPage + 1 >= alphabetPages} onclick={() => alphabetPage++}>{t('parts.script.next')}</button>
          </div>
        {/if}
        {@render grid(alphabetShown)}
      {:else}<p class="parts-note">{t('parts.none')}</p>{/if}
    {:else if tab === 'components' && characters}
      {#if !hanKeys && !hanFailed}<p class="parts-note" role="status">{t('parts.loading')}</p>{/if}
      {#if hanFailed}<p class="parts-note" role="status">{t('parts.characters.unavailable')} <button type="button" onclick={retryHan}>{t('parts.script.retry')}</button></p>{/if}
      {#if hanMatches.length}
        {#if hanPages > 1}
          <div class="script-pages" role="group" aria-label={t('parts.script.pages')}>
            <button type="button" disabled={hanPage === 0} onclick={() => hanPage--}>{t('parts.script.previous')}</button>
            <input type="number" min="1" max={hanPages} value={hanPage + 1} aria-label={t('parts.script.pages')}
              onchange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) hanPage = Math.max(0, Math.min(hanPages - 1, Math.floor(value) - 1)) }} />
            <span>{t('parts.script.page', { page: hanPage + 1, pages: hanPages, count: hanMatches.length })}</span>
            <button type="button" disabled={hanPage + 1 >= hanPages} onclick={() => hanPage++}>{t('parts.script.next')}</button>
          </div>
        {/if}
        {@render grid(hanShown)}
      {:else if hanKeys}<p class="parts-note">{t('parts.none')}</p>{/if}
    {:else if filtered}
      {#if filtered.length}{@render grid(filtered)}{:else}<p class="parts-note">{t('parts.none')}</p>{/if}
    {:else if tab === 'components'}
      {#if componentPages > 1}
        <div class="script-pages" role="group" aria-label={t('parts.script.pages')}>
          <button type="button" disabled={componentPage === 0} onclick={() => componentPage--}>{t('parts.script.previous')}</button>
          <input type="number" min="1" max={componentPages} value={componentPage + 1} aria-label={t('parts.script.pages')}
            onchange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) componentPage = Math.max(0, Math.min(componentPages - 1, Math.floor(value) - 1)) }} />
          <span>{t('parts.script.page', { page: componentPage + 1, pages: componentPages, count: componentList.length })}</span>
          <button type="button" disabled={componentPage + 1 >= componentPages} onclick={() => componentPage++}>{t('parts.script.next')}</button>
        </div>
      {/if}
      {#each componentShown as group (group.cls ?? 'all')}
        {#if group.cls !== undefined}<h4 class="parts-class">{heading(group.cls)}</h4>{/if}
        {@render grid(group.parts)}
      {/each}
    {:else}
      {#if tab === 'recent' && !recent.length}
        <p class="parts-note">{t('parts.noRecent')}</p>
      {/if}
      {#each shown as group (group.cls ?? 'all')}
        {#if group.cls !== undefined}<h4 class="parts-class">{heading(group.cls)}</h4>{/if}
        {@render grid(group.parts)}
      {/each}
    {/if}
  </div>
</div>

<style>
  .ids-parts{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_muted:var(--ids-muted,light-dark(#686874,#9d9daa));
    --_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));--_control-border:var(--ids-control-border,light-dark(#8a8a96,#6f6f7e));--_surface:var(--ids-surface,light-dark(#fff,#1b1b20));
    --_surface-subtle:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));--_surface-selected:var(--ids-surface-selected,light-dark(#eeeef3,#26262d));
    --_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));--_accent-light:var(--ids-accent-light,light-dark(#e9edfd,#232c4c));
    --_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));
    display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--_ink)}
  :where(.ids-parts) :is(button,input,select){font:inherit;color:inherit;border:1px solid var(--_line);border-radius:6px;background:var(--_surface)}
  :where(.ids-parts) input{border-color:var(--_control-border)}
  :where(.ids-parts) select{border-color:var(--_control-border)}
  :where(.ids-parts) button{cursor:pointer}
  :where(.ids-parts) button:disabled{cursor:default;opacity:.55}
  :where(.ids-parts) :is(button,input,select):focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .parts-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
  .parts-tabs{display:flex;flex-wrap:wrap;gap:4px}
  .parts-tabs button,.parts-counts button{border:0;background:transparent;font-size:12px;padding:6px 10px;border-radius:5px;color:var(--_muted)}
  .parts-tabs button.active,.parts-counts button.active{background:var(--_surface-selected);color:var(--_ink)}
  .parts-filter{flex:1 1 100%;min-width:0;padding:6px 8px;font-size:13px}
  .script-select{display:flex;align-items:center;gap:8px;width:100%;font-size:13px}
  .script-select select{flex:1;min-width:0;padding:4px 6px}
  .hangul-views{display:flex;gap:2px;padding:3px;border:1px solid var(--_line);border-radius:8px;background:var(--_surface-subtle)}
  .hangul-views button{border:0;background:transparent;padding:5px 10px;border-radius:6px;font-size:12px;color:var(--_muted)}
  .hangul-views button.active{background:var(--_surface);color:var(--_ink);box-shadow:0 1px 2px #00000018}
  .script-pages{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--_muted)}
  .script-pages button,.script-pages input{padding:4px 6px}
  .script-pages input{width:6em}
  .hangul-compose{display:flex;flex-direction:column;gap:8px}
  .compose-head{display:flex;gap:8px;align-items:stretch;min-width:0}
  .compose-actions{display:flex;flex-direction:column;gap:4px;flex:none}
  .compose-actions button{padding:0 8px;font-size:12px;color:var(--_muted)}
  .compose-actions .compose-backspace{font-size:16px;line-height:1}
  .compose-result{display:flex;align-items:center;justify-content:center;gap:14px;flex:1;min-width:0;min-height:104px;padding:12px;border-color:var(--_line);
    background:var(--_surface-subtle);font-family:"IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Strokes",var(--ids-font,var(--ids-glyph-fallback,"IDS Fallback"),sans-serif)}
  .compose-result:not(:disabled):hover{border-color:var(--_accent);background:var(--_accent-light)}
  .compose-glyph{font-size:48px;line-height:1;font-family:var(--ids-font,var(--ids-glyph-fallback,"IDS Fallback"),sans-serif)}
  .compose-detail{display:flex;flex-direction:column;align-items:flex-start;gap:3px;max-width:15em;font-family:var(--ids-ui-font,system-ui,sans-serif);color:var(--_muted)}
  .compose-code{font:11px/1.35 ui-monospace,"SF Mono",Menlo,Consolas,monospace;overflow-wrap:anywhere}
  .compose-action{font-size:12px;color:var(--_accent)}
  .jamo-group{display:flex;flex-direction:column;gap:4px;min-width:0}
  .jamo-group h4{margin:2px 0 0;font-size:11px;font-weight:500;color:var(--_muted)}
  .jamo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:3px;max-height:168px;overflow:auto;padding:1px}
  .jamo-key{display:flex;align-items:center;justify-content:center;aspect-ratio:1;padding:0;font-size:19px;line-height:1;
    border-color:transparent;background:var(--_surface-subtle);font-family:"IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Strokes",var(--ids-font,var(--ids-glyph-fallback,"IDS Fallback"),sans-serif)}
  .jamo-key:not(:disabled):hover{border-color:var(--_accent);background:var(--_accent-light)}
  .compose-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;margin:0}
  .parts-counts{display:flex;flex-wrap:wrap;gap:4px;user-select:none}
  .parts-counts button{min-width:30px;padding:4px 7px;white-space:nowrap;font-variant-numeric:tabular-nums}
  .parts-panel{display:flex;flex-direction:column;gap:8px;min-width:0}
  /* The subset faces first: their ranges cover only the strokes and rare parts, so other text falls
     through to the page's own fonts. */
  .parts-class,.parts-filter{font-family:"IDS Strokes","IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu",var(--ids-ui-font,system-ui,sans-serif)}
  .parts-class{margin:4px 0 0;font-size:11px;font-weight:500;color:var(--_muted);user-select:none}
  .parts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:3px;max-height:260px;overflow:auto}
  .part{display:flex;align-items:center;justify-content:center;aspect-ratio:1;padding:0;font-size:22px;line-height:1;user-select:text;
    border-color:transparent;background:var(--_surface-subtle);font-family:"IDS Seal","IDS Parts","IDS Tangut","IDS New Korean","IDS Shuishu","IDS Strokes",var(--ids-font,var(--ids-glyph-fallback,"IDS Fallback"),sans-serif)}
  .part.compound{position:relative;padding:5px}
  .part :global(.part-icon){user-select:none}
  .compound-text{position:absolute;bottom:0;max-width:100%;overflow:hidden;white-space:nowrap;
    font:8px/1 var(--ids-font,var(--ids-glyph-fallback,"IDS Fallback"),sans-serif);color:var(--_ink);background:var(--_surface)}
  .part:not(:disabled):hover{border-color:var(--_accent);background:var(--_accent-light)}
  .script-groups{display:flex;flex-wrap:wrap;gap:4px}
  .script-groups button{padding:5px 8px;font-size:12px;background:transparent;border-color:transparent;color:var(--_muted)}
  .script-groups button.active{background:var(--_surface-selected);color:var(--_ink)}
  .script-groups span{font-size:10px;font-variant-numeric:tabular-nums;margin-inline-start:4px}
  .part{position:relative}
  /* A mark over a dotted circle: the subset faces have no marks, and the page's own font stacks
     place them over a Latin base the way the standard dotted-circle notation expects. */
  .part[data-mark]{font-family:"Noto Sans","DejaVu Sans","Liberation Sans",var(--ids-font,var(--ids-glyph-fallback,"IDS Fallback"),sans-serif)}
  .seal-estimate{position:absolute;right:3px;bottom:1px;font:11px system-ui;color:var(--_muted);user-select:none}
  .part:has(> .shui-ids){padding-bottom:12px;font-size:20px}
  .shui-ids{position:absolute;inset:auto 1px 1px;font-size:10px;line-height:1;text-align:center;color:var(--_ink);background:inherit;white-space:nowrap;overflow:hidden;user-select:none}
  .gongche-guide p{margin:8px 0;font-size:12px;color:var(--_muted)}
  .gongche-guide{font-size:12px;color:var(--_muted)}.gongche-guide summary{cursor:pointer}.gongche-guide a{display:block;color:var(--_accent);margin:5px 0}
  .parts-note{margin:0;font-size:12px;color:var(--_muted)}
</style>
