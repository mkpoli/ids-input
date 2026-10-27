// @ts-check
import { isNode, parse, write } from '../core/ids.js'
import { isSmallSeal } from './seal-data.js'

/**
 * @typedef {{ component: string, options: string[], selected: string | null, via: 'exact' | 'radical-form' | 'unmapped' }} SealMapping
 * @typedef {{ text: string, modernChar: string, modernIds: string, regions: string, mappings: SealMapping[], unmapped: string[], missingGlyphs: string[] }} SealCandidate
 * @typedef {{ char: string, glyphAvailable: boolean, modern: string[], attested: string[], records: unknown[], sources: unknown[], modernSource: string,
 *   modernDescriptions: { char: string, text: string, regions: string, supported: boolean }[], candidates: SealCandidate[], truncated: boolean, generator: string }} SealComparison
 */
export const SEAL_GENERATOR = 'cjk-to-seal/1'

/**
 * Candidate generation never changes the source table. The Cartesian product is
 * bounded, and one assignment is reused for every occurrence of the same component.
 * @param {import('./seal-data.js').SmallSealData} doc
 * @param {Map<string, import('../core/decompose.js').Sequence[]>} table
 * @param {Map<string, string>} forms Radical/positional folds only, not seal equivalence groups.
 * @param {string} [modernSource]
 */
export function createSealCandidates(doc, table, forms = new Map(), modernSource = 'provided table') {
  const glyphs = new Set([...doc.parts.map(p => p.part), ...Object.keys(doc.table)])
  /** @type {Map<string, string[]>} */
  const exact = new Map()
  /** @type {Map<string, string[]>} */
  const folded = new Map()
  /** @param {string} c */
  const fold = c => forms.get(c) ?? c
  for (const [seal, modern] of Object.entries(doc.modern)) {
    if (!isSmallSeal(seal)) continue
    for (const name of modern) for (const [map, key] of /** @type {[Map<string, string[]>, string][]} */ ([[exact, name], [folded, fold(name)]])) {
      const list = map.get(key) ?? []
      if (!list.includes(seal)) list.push(seal)
      map.set(key, list)
    }
  }
  for (const map of [exact, folded]) for (const list of map.values()) list.sort()

  /** @param {string} char @param {number} [limit] @returns {SealComparison} */
  function compare(char, limit = 64) {
    const cap = Number.isFinite(limit) ? Math.max(1, Math.min(128, Math.floor(limit))) : 64
    const modern = doc.modern[char] ?? []
    /** @type {SealComparison} */
    const result = { char, glyphAvailable: glyphs.has(char), modern: [...modern], attested: [...(doc.table[char] ?? [])],
      records: (doc.records ?? []).filter(row => row.char === char),
      sources: [...(doc.sources ?? []), ...(doc.paletteSources ?? [])], modernSource,
      modernDescriptions: [], candidates: [], truncated: false, generator: SEAL_GENERATOR }
    /** @type {SealCandidate[][]} */
    const variants = []
    for (const name of modern) for (const sequence of table.get(name) ?? []) {
      const parsed = parse(sequence.text)
      const supported = !parsed.problem && isNode(parsed.tree)
      result.modernDescriptions.push({ char: name, text: sequence.text, regions: sequence.regions ?? '', supported })
      if (!supported) continue
      /** @type {string[]} */
      const leaves = []
      /** @param {import('../core/ids.js').Part} part */
      const collect = part => { if (isNode(part)) part.parts.forEach(collect); else if (part && !leaves.includes(part)) leaves.push(part) }
      const tree = parsed.tree ?? null
      collect(tree)
      const mappings = leaves.map(component => {
        const direct = exact.get(component)?.filter(c => c !== char) ?? []
        const options = direct.length ? direct : (folded.get(fold(component)) ?? []).filter(c => c !== char)
        return { component, options, via: /** @type {SealMapping['via']} */ (direct.length ? 'exact' : options.length ? 'radical-form' : 'unmapped') }
      })
      /** @type {SealCandidate[]} */
      const list = []
      /** @param {number} index @param {(string | null)[]} chosen */
      function expand(index, chosen) {
        if (list.length > cap) return
        if (index < mappings.length) {
          for (const c of mappings[index].options.length ? mappings[index].options : [null]) {
            expand(index + 1, [...chosen, c])
            if (list.length > cap) break
          }
          return
        }
        const replacement = new Map(mappings.map((m, i) => [m.component, chosen[i]]))
        /** @param {import('../core/ids.js').Part} part @returns {import('../core/ids.js').Part} */
        const replace = part => isNode(part) ? { op: part.op, parts: part.parts.map(replace) } : part ? replacement.get(part) ?? null : null
        list.push({ text: write(replace(tree)), modernChar: name, modernIds: sequence.text, regions: sequence.regions ?? '',
          mappings: mappings.map((m, i) => ({ ...m, selected: chosen[i] })), unmapped: mappings.filter(m => !m.options.length).map(m => m.component), missingGlyphs: [...new Set(chosen.filter(c => c !== null).filter(c => !glyphs.has(c)))] })
      }
      expand(0, [])
      variants.push(list)
    }
    // Round-robin across modern descriptions before taking additional mapping choices.
    for (let i = 0; i <= cap; i++) for (const list of variants) if (list[i]) {
      if (result.candidates.length === cap) { result.truncated = true; return result }
      result.candidates.push(list[i])
    }
    return result
  }
  return { compare }
}
