// @ts-check
import { isSmallSeal } from './seal-data.js'

/** Which kind each source record is; the card names the site and the note by this key. */
export const SOURCE_KINDS = /** @type {const} */ (['editorial', 'unicodeSealSource', 'sealSource', 'openTangut', 'unihan', 'component', 'tangutIds'])
/** @typedef {(typeof SOURCE_KINDS)[number]} SourceKind */
/** @typedef {{ label: string, url: string, license?: string, note?: SourceKind }} InfoSource */
/** @typedef {{ en: string[], han: string[], emoji: string }} MeaningAid */
/** @typedef {{ en: string[], ja?: string[], zh?: string[], readings?: Record<string, string>, sounds?: Record<string, string>, source: 'unihan' | 'openTangut', aids?: number[] }} GlossEntry */
/** @typedef {{ format: string, entries: Record<string, GlossEntry>, aids: MeaningAid[], components: Record<string, { en: string, sense?: string, han: string[], emoji: string, source: InfoSource }> }} CharacterInfoData */
/** @typedef {{ char: string, kind: 'han' | 'tangut' | 'seal' | 'modern' | 'usage', meaning?: string }} CharacterRelation */
/** @typedef {{ name: string, value: string }} InfoReading */
/** @typedef {{ char: string, script: 'han' | 'tangut' | 'component' | 'seal', glosses: string[], meanings?: { ja?: string[], zh?: string[] }, readings?: InfoReading[], soundGlosses?: InfoReading[], association?: string, emoji: { text: string, meaning: string }[], relations: CharacterRelation[], sources: InfoSource[], sourceSites?: string[] }} CharacterInfo */

/** @param {string} char */
export const characterScript = char => [...char].length !== 1 ? null : isSmallSeal(char) ? 'seal'
  : /^[\u{18800}-\u{18AFF}]$/u.test(char) ? 'component'
  : /^[\u{17000}-\u{187FF}\u{18D00}-\u{18DFF}]$/u.test(char) ? 'tangut'
  : /^[\p{Unified_Ideograph}\p{Radical}\uF900-\uFAFF\u{2F800}-\u{2FA1F}〇]$/u.test(char) ? 'han' : null

const editorial = { label: 'Editorial meaning aids', url: 'https://github.com/mkpoli/ids-input/blob/main/data/README.md#character-information-panels', note: /** @type {const} */ ('editorial') }
const unicodeSealSource = { label: 'Unicode · SealSources', url: 'https://github.com/frankslin/kaiyuan-small-seal-font/blob/97433695858330ec9fdb7de9c4604da2f635eba6/third_party/unicode/ucd/SealSources.txt', license: 'Unicode License v3', note: /** @type {const} */ ('unicodeSealSource') }
const sealSource = { label: 'CHISE · Jiguge Small Seal', url: 'https://gitlab.chise.org/CHISE/ids', license: 'GPL-2.0-or-later', note: /** @type {const} */ ('sealSource') }
const openTangut = { label: 'Open Tangut', url: 'https://github.com/imlooh/open-tangut', license: 'MIT', note: /** @type {const} */ ('openTangut') }
// The eight reconstructions and two sound glosses the records carry, in the card's order.
const TANGUT_READINGS = /** @type {const} */ ([
  { key: 'li_fanwen', name: 'Li Fanwen 2008' },
  { key: 'gong_huangcheng', name: 'Gong Hwang-cherng' },
  { key: 'gong_xun_202411', name: 'Gong Xun 2024-11' },
  { key: 'arakawa_shintaro', name: 'Arakawa Shintarō' },
  { key: 'miyake', name: 'Marc Miyake' },
  { key: 'nishida', name: 'Nishida 1966' },
  { key: 'kychanov', name: 'Kychanov 2006' },
  { key: 'sofronov', name: 'Sofronov 1968' },
])
const TANGUT_SOUNDS = /** @type {const} */ ([
  { key: 'li_fanwen', name: 'Li Fanwen' },
  { key: 'nie_lishan', name: 'Nie Lishan' },
])
/** @param {string} char */
const unihan = char => /** @type {const} */ ({ label: 'Unicode · Unihan kDefinition', url: `https://www.unicode.org/cgi-bin/GetUnihanData.pl?codepoint=${char.codePointAt(0)?.toString(16).toUpperCase()}`, license: 'Unicode License v3', note: 'unihan' })

/** Every record a character is built from, tagged with its kind and deduplicated the way the card
 *  shows them: one entry per kind, named by its first record, so Unihan, Open Tangut, CHISE, the
 *  Unicode seal list and the editorial aids each appear once whatever number of records feed them.
 *  @param {InfoSource[]} records @returns {InfoSource[]} */
export function mergeSources(records) {
  /** @type {InfoSource[]} */
  const merged = []
  for (const record of records) {
    const kind = record.note ?? 'component'
    if (!merged.some(other => (other.note ?? 'component') === kind)) merged.push({ ...record, note: kind })
  }
  return merged
}

/** @param {CharacterInfoData} doc @param {import('./seal-data.js').SmallSealData | null} [seal] */
export function createCharacterInfo(doc, seal = null) {
  if (doc.format !== 'ids-character-info-2') throw new Error('Unsupported character information format')
  /** @type {Map<string, CharacterRelation[]>} */
  const translations = new Map()
  for (const [char, entry] of Object.entries(doc.entries)) {
    if (entry.source !== 'openTangut') continue
    for (const i of entry.aids ?? []) {
      const aid = doc.aids[i]
      for (const han of aid.han) {
        const list = translations.get(han) ?? []
        if (!list.some(r => r.char === char && r.meaning === aid.en[0])) list.push({ char, kind: 'tangut', meaning: aid.en[0] })
        translations.set(han, list)
      }
    }
  }
  /** @type {Map<string, string[]>} */
  const seals = new Map()
  const drawable = new Set([...Object.keys(seal?.table ?? {}), ...(seal?.parts ?? []).map(p => p.part)])
  // The palette's 𠙵 → 口 lookup alias is a modern-variant search aid.
  // Retain only direct recorded correspondences in historical-form panels.
  const directModern = (/** @type {string[]} */ names) => names.filter(c => c !== '口' || !names.includes('𠙵'))
  for (const [old, modern] of Object.entries(seal?.modern ?? {})) for (const han of directModern(modern)) {
    if (!drawable.has(old)) continue
    const list = seals.get(han) ?? []
    list.push(old); seals.set(han, list)
  }
  /** @param {string} char @returns {CharacterInfo | null} */
  return char => {
    const script = characterScript(char)
    if (!script) return null
    const entry = doc.entries[char], component = doc.components[char]
    /** @type {CharacterInfo} */
    const result = { char, script, glosses: entry?.en ?? [], emoji: [], relations: [], sources: [] }
    if (entry) result.sources.push(entry.source === 'unihan' ? unihan(char) : openTangut)
    if (entry?.ja?.length || entry?.zh?.length) result.meanings = { ...(entry.ja?.length ? { ja: entry.ja } : {}), ...(entry.zh?.length ? { zh: entry.zh } : {}) }
    if (entry?.readings) result.readings = TANGUT_READINGS.flatMap(({ key, name }) => entry.readings?.[key] ? [{ name, value: entry.readings[key] }] : [])
    if (entry?.sounds) result.soundGlosses = TANGUT_SOUNDS.flatMap(({ key, name }) => entry.sounds?.[key] ? [{ name, value: entry.sounds[key] }] : [])
    for (const i of entry?.aids ?? []) {
      const aid = doc.aids[i]
      result.emoji.push({ text: aid.emoji, meaning: aid.en[0] })
      if (script === 'tangut') result.relations.push(...aid.han.map(han => ({ char: han, kind: /** @type {const} */ ('han'), meaning: aid.en[0] })))
    }
    if (component) {
      result.association = component.en
      result.emoji.push({ text: component.emoji, meaning: component.en })
      result.relations.push(...component.han.map(han => ({ char: han, kind: /** @type {const} */ ('han'), meaning: component.en })))
      result.sources.push({ ...component.source, note: /** @type {const} */ ('component') })
    }
    if (script === 'han') {
      result.relations.push(...(translations.get(char) ?? []))
      // Open Tangut gives the Tangut relation its Han translation; the record's site is the way in.
      if (result.relations.some(relation => relation.kind === 'tangut')) result.sources.push(openTangut)
      result.relations.push(...(seals.get(char) ?? []).map(old => ({ char: old, kind: /** @type {const} */ ('seal') })))
    } else if (script === 'seal') {
      result.relations.push(...directModern(seal?.modern[char] ?? []).map(han => ({ char: han, kind: /** @type {const} */ ('modern') })))
    }
    if (result.relations.some(r => r.kind === 'seal' || r.kind === 'modern')) result.sources.push(sealSource, unicodeSealSource)
    if (result.emoji.length || result.relations.some(r => r.kind === 'tangut')) result.sources.push(editorial)
    result.emoji = result.emoji.filter((e, i, all) => all.findIndex(v => v.text === e.text && v.meaning === e.meaning) === i)
    result.relations = result.relations.filter((r, i, all) => all.findIndex(v => v.char === r.char && v.kind === r.kind && v.meaning === r.meaning) === i)
    result.sources = mergeSources(result.sources)
    result.sourceSites = /** @type {SourceKind[]} */ (result.sources.map(source => source.note))
    return result
  }
}

/** Explicit component occurrences in recorded IDS, with dictionary meanings. No inferred component gloss.
 * @param {string} char @param {CharacterInfoData} doc @param {Map<string, import('../core/decompose.js').Sequence[]>} table */
export function componentExamples(char, doc, table) {
  return Object.entries(doc.entries).filter(([word, entry]) => entry.source === 'openTangut' && entry.en.length && table.get(word)?.some(s => s.text.includes(char)))
    .slice(0, 4).map(([word, entry]) => ({ char: word, kind: /** @type {const} */ ('usage'), meaning: entry.en[0] }))
}
export { openTangut as openTangutSource }
