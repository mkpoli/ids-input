// @ts-check
import { isNode, parse, write, LONGEST } from '../../src/core/ids.js'
import { isSmallSeal } from '../../src/adapter/seal-data.js'

/**
 * @typedef {{ component: string, options: string[], selected: string | null, via: 'exact' | 'radical-form' | 'unmapped' }} SealMapping
 * @typedef {{ text: string, modernChar: string, modernIds: string, regions: string, mappings: SealMapping[], unmapped: string[], missingGlyphs: string[], expansions: {component: string, ids: string, regions: string}[] }} SealCandidate
 * @typedef {{ char: string, glyphAvailable: boolean, modern: string[], attested: string[], records: unknown[], sources: unknown[], modernSource: string,
 *   modernDescriptions: { char: string, text: string, regions: string, supported: boolean }[], candidates: SealCandidate[], truncated: boolean, generator: string }} SealComparison
 */
export const SEAL_GENERATOR = 'cjk-to-seal/2'

/**
 * Candidate generation never changes the source table. The Cartesian product is
 * bounded, and one assignment is reused for every occurrence of the same component.
 * @param {import('../../src/adapter/seal-data.js').SmallSealData} doc
 * @param {Map<string, import('../../src/core/decompose.js').Sequence[]>} table
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
      /** @param {string} component */
      const choices = component => {
        const direct = exact.get(component)?.filter(c => c !== char) ?? []
        const options = direct.length ? direct : (folded.get(fold(component)) ?? []).filter(c => c !== char)
        return { component, options, via: /** @type {SealMapping['via']} */ (direct.length ? 'exact' : options.length ? 'radical-form' : 'unmapped') }
      }
      /** @param {import('../../src/core/ids.js').Part} tree */
      const components = tree => {
        /** @type {string[]} */
        const leaves = []
        /** @param {import('../../src/core/ids.js').Part} part */
        const collect = part => { if (isNode(part)) part.parts.forEach(collect); else if (part && !leaves.includes(part)) leaves.push(part) }
        collect(tree)
        return leaves
      }
      // One decomposition choice per component, applied to every occurrence. Rebuilding
      // from the root also reuses choices when another nested expansion introduces it.
      /** @typedef {{component: string, ids: string, regions: string}} Expansion */
      /** @param {Expansion[]} expansions */
      const materialize = expansions => {
        const substitutions = new Map(expansions.map(e => [e.component, parse(e.ids).tree ?? null]))
        /** @param {import('../../src/core/ids.js').Part} part @param {string[]} path @returns {import('../../src/core/ids.js').Part} */
        const apply = (part, path = []) => isNode(part) ? {op: part.op, parts: part.parts.map(p => apply(p, path))}
          : part && substitutions.has(part) && !path.includes(part) ? apply(substitutions.get(part) ?? null, [...path, part]) : part
        return apply(parsed.tree ?? null, [])
      }
      /** @type {{tree: import('../../src/core/ids.js').Part, expansions: Expansion[], skipped: Set<string>}[]} */
      const queue = [{tree: parsed.tree ?? null, expansions: [], skipped: new Set()}]
      /** @type {typeof queue} */
      const templates = []
      let attempts = 0
      while (queue.length && templates.length <= cap) {
        const state = /** @type {typeof queue[number]} */ (queue.shift())
        const component = components(state.tree).find(c => !choices(c).options.length && !modern.includes(c) && !state.skipped.has(c) && !state.expansions.some(e => e.component === c))
        if (!component) { templates.push(state); continue }
        if (state.expansions.length >= 8 || ++attempts > 512) {
          result.truncated = true
          templates.push(state)
          continue
        }
        const descriptions = (table.get(component) ?? []).filter(d => {
          const p = parse(d.text)
          return !p.problem && isNode(p.tree)
        })
        let added = false
        for (const description of descriptions) {
          const expansions = [...state.expansions, {component, ids: description.text, regions: description.regions ?? ''}]
          const tree = materialize(expansions)
          if ([...write(tree)].length > LONGEST) { result.truncated = true; continue }
          if (queue.length >= cap + 1) { result.truncated = true; break }
          queue.push({tree, expansions, skipped: new Set(state.skipped)})
          added = true
        }
        if (!added) queue.push({...state, skipped: new Set([...state.skipped, component])})
      }
      if (queue.length) result.truncated = true
      /** @type {SealCandidate[][]} */
      const nestedVariants = []
      for (const {tree, expansions} of templates) {
        const mappings = components(tree).map(choices)
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
          /** @param {import('../../src/core/ids.js').Part} part @returns {import('../../src/core/ids.js').Part} */
          const replace = part => isNode(part) ? { op: part.op, parts: part.parts.map(replace) } : part ? replacement.get(part) ?? null : null
          list.push({ text: write(replace(tree)), expansions, modernChar: name, modernIds: sequence.text, regions: sequence.regions ?? '',
            mappings: mappings.map((m, i) => ({ ...m, selected: chosen[i] })), unmapped: mappings.filter(m => !m.options.length).map(m => m.component), missingGlyphs: [...new Set(chosen.filter(c => c !== null).filter(c => !glyphs.has(c)))] })
        }
        expand(0, [])
        nestedVariants.push(list)
      }
      // Keep one bucket per original modern description; nested alternatives must
      // not consume the turns reserved for other regional descriptions.
      /** @type {SealCandidate[]} */
      const descriptionCandidates = []
      outer: for (let i = 0; i <= cap; i++) for (const list of nestedVariants) if (list[i]) {
        descriptionCandidates.push(list[i])
        if (descriptionCandidates.length > cap) break outer
      }
      variants.push(descriptionCandidates)
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
