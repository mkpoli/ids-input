// @ts-check
import { isSmallSeal } from './seal-data.js'

/** @typedef {{ label: string, url: string, license?: string }} InfoSource */
/** @typedef {{ en: string[], han: string[], emoji: string }} MeaningAid */
/** @typedef {{ en: string[], source: 'unihan' | 'wiktionary', aids?: number[] }} GlossEntry */
/** @typedef {{ format: string, entries: Record<string, GlossEntry>, aids: MeaningAid[], components: Record<string, { en: string, sense?: string, han: string[], emoji: string, source: InfoSource }> }} CharacterInfoData */
/** @typedef {{ char: string, kind: 'han' | 'tangut' | 'seal' | 'modern' | 'usage', meaning?: string }} CharacterRelation */
/** @typedef {{ char: string, script: 'han' | 'tangut' | 'component' | 'seal', glosses: string[], association?: string, emoji: { text: string, meaning: string }[], relations: CharacterRelation[], sources: InfoSource[] }} CharacterInfo */

/** @param {string} char */
export const characterScript = char => [...char].length !== 1 ? null : isSmallSeal(char) ? 'seal'
  : /^[\u{18800}-\u{18AFF}]$/u.test(char) ? 'component'
  : /^[\u{17000}-\u{187FF}\u{18D00}-\u{18DFF}]$/u.test(char) ? 'tangut'
  : /^[\p{Unified_Ideograph}\p{Radical}\uF900-\uFAFF\u{2F800}-\u{2FA1F}〇]$/u.test(char) ? 'han' : null

const editorial = { label: 'Editorial meaning aids', url: 'https://github.com/mkpoli/ids-input/blob/main/data/README.md#character-information-panels' }
const unicodeSealSource = { label: 'Unicode · SealSources', url: 'https://github.com/frankslin/kaiyuan-small-seal-font/blob/97433695858330ec9fdb7de9c4604da2f635eba6/third_party/unicode/ucd/SealSources.txt', license: 'Unicode License v3' }
const sealSource = { label: 'CHISE · Jiguge Small Seal', url: 'https://gitlab.chise.org/CHISE/ids', license: 'GPL-2.0-or-later' }
/** @param {string} char */
const wiktionary = char => ({ label: 'Wiktionary contributors', url: `https://en.wiktionary.org/wiki/${encodeURIComponent(char)}#Tangut`, license: 'CC BY-SA 4.0' })
/** @param {string} char */
const unihan = char => ({ label: 'Unicode · Unihan kDefinition', url: `https://www.unicode.org/cgi-bin/GetUnihanData.pl?codepoint=${char.codePointAt(0)?.toString(16).toUpperCase()}`, license: 'Unicode License v3' })

/** @param {CharacterInfoData} doc @param {import('./seal-data.js').SmallSealData | null} [seal] */
export function createCharacterInfo(doc, seal = null) {
  if (doc.format !== 'ids-character-info-1') throw new Error('Unsupported character information format')
  /** @type {Map<string, CharacterRelation[]>} */
  const translations = new Map()
  for (const [char, entry] of Object.entries(doc.entries)) {
    if (entry.source !== 'wiktionary') continue
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
    if (entry) result.sources.push(entry.source === 'unihan' ? unihan(char) : wiktionary(char))
    for (const i of entry?.aids ?? []) {
      const aid = doc.aids[i]
      result.emoji.push({ text: aid.emoji, meaning: aid.en[0] })
      if (script === 'tangut') result.relations.push(...aid.han.map(han => ({ char: han, kind: /** @type {const} */ ('han'), meaning: aid.en[0] })))
    }
    if (component) {
      result.association = component.en
      result.emoji.push({ text: component.emoji, meaning: component.en })
      result.relations.push(...component.han.map(han => ({ char: han, kind: /** @type {const} */ ('han'), meaning: component.en })))
      result.sources.push(component.source)
    }
    if (script === 'han') {
      result.relations.push(...(translations.get(char) ?? []))
      for (const relation of result.relations) result.sources.push(wiktionary(relation.char))
      result.relations.push(...(seals.get(char) ?? []).map(old => ({ char: old, kind: /** @type {const} */ ('seal') })))
    } else if (script === 'seal') {
      result.relations.push(...directModern(seal?.modern[char] ?? []).map(han => ({ char: han, kind: /** @type {const} */ ('modern') })))
    }
    if (result.relations.some(r => r.kind === 'seal' || r.kind === 'modern')) result.sources.push(sealSource, unicodeSealSource)
    if (result.emoji.length || result.relations.some(r => r.kind === 'tangut')) result.sources.push(editorial)
    result.emoji = result.emoji.filter((e, i, all) => all.findIndex(v => v.text === e.text && v.meaning === e.meaning) === i)
    result.relations = result.relations.filter((r, i, all) => all.findIndex(v => v.char === r.char && v.kind === r.kind && v.meaning === r.meaning) === i)
    result.sources = result.sources.filter((s, i, all) => all.findIndex(v => v.url === s.url) === i)
    return result
  }
}

/** Explicit component occurrences in recorded IDS, with dictionary meanings. No inferred component gloss.
 * @param {string} char @param {CharacterInfoData} doc @param {Map<string, import('../core/decompose.js').Sequence[]>} table */
export function componentExamples(char, doc, table) {
  return Object.entries(doc.entries).filter(([word, entry]) => entry.source === 'wiktionary' && table.get(word)?.some(s => s.text.includes(char)))
    .slice(0, 4).map(([word, entry]) => ({ char: word, kind: /** @type {const} */ ('usage'), meaning: entry.en[0] }))
}
export { wiktionary as tangutGlossSource }
