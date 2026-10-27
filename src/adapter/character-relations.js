// @ts-check
import { createCharacterInfo, characterScript } from './character-info.js'
import { createNameSearch, foldName } from '../core/names.js'

/** Emoji presentation selectors do not change a search term. @param {string} text */
const key = text => /\p{Extended_Pictographic}/u.test(text) ? text.replace(/[\uFE0E\uFE0F]/g, '').trim() : text.trim()
/** @param {string} char */
const code = char => `U+${char.codePointAt(0)?.toString(16).toUpperCase()}`
/** Short lemmas are searchable while the displayed gloss retains its qualifiers. @param {string} text */
const lemma = text => text.replace(/^(?:\([^)]*\)\s*)+/, '').replace(/^(?:to|a|an|the)\s+/i, '').trim()

/** Search recorded meanings and correspondences in both directions.
 * Usage links end a traversal: sharing a component does not imply sharing a meaning.
 * @param {import('./character-info.js').CharacterInfoData} doc
 * @param {import('./seal-data.js').SmallSealData | null} seal
 * @param {Map<string, import('../core/decompose.js').Sequence[]>} table
 */
export function createRelationSearch(doc, seal, table) {
  const lookup = createCharacterInfo(doc, seal)
  /** @typedef {'meaning' | 'association' | 'seal' | 'emoji' | 'usage'} Kind */
  /** @typedef {{ char: string, kind: Kind, sense?: string }} Edge */
  /** @typedef {{ label: string, sense?: string, curated?: boolean }} Meaning */
  /** @type {Map<string, Edge[]>} */ const graph = new Map()
  /** @type {Map<string, string>} */ const labels = new Map()
  /** @type {Map<string, Set<string>>} */ const literal = new Map()
  /** @type {Map<string, Meaning>} */ const aliases = new Map()
  /** @type {Map<string, string>} */ const senseLabels = new Map()
  /** @type {import('../core/names.js').ComponentName[]} */ const names = []
  const senses = new Map(doc.aids.flatMap(aid => aid.en.map(term => [foldName(term), foldName(aid.en[0])])) )
  /** @param {string} text */
  const senseOf = text => senses.get(foldName(lemma(text))) ?? foldName(lemma(text))
  /** @param {string} char */
  function node(char) {
    if (!graph.has(char)) graph.set(char, [])
    const folded = key(char), forms = literal.get(folded) ?? new Set()
    forms.add(char); literal.set(folded, forms)
  }
  /** @param {string} a @param {string} b @param {Kind} kind @param {string} [meaning] */
  function link(a, b, kind, meaning) {
    node(a); node(b)
    if (a === b) return
    const sense = meaning ? senseOf(meaning) : undefined
    for (const [from, char] of [[a, b], [b, a]]) {
      const edges = graph.get(from)
      if (!edges?.some(e => e.char === char && e.kind === kind && e.sense === sense)) edges?.push({ char, kind, sense })
    }
  }
  /** @param {string} char @param {string} name @param {string} label @param {string} [sense] @param {boolean} [curated] */
  function alias(char, name, label, sense, curated = false) {
    if (!name.trim()) return
    const id = `${char}\0${foldName(key(name))}`
    if (!aliases.has(id)) names.push({ char, name: key(name), source: '', detail: '' })
    aliases.set(id, { label, sense, curated })
    if (sense) senseLabels.set(`${char}\0${sense}`, label)
  }
  const drawable = new Set([...Object.keys(seal?.table ?? {}), ...(seal?.parts ?? []).map(p => p.part)])
  const chars = new Set([...Object.keys(doc.entries), ...Object.keys(doc.components), ...Object.keys(seal?.modern ?? {}), ...Object.values(seal?.modern ?? {}).flat()])
  for (const char of chars) {
    const info = lookup(char)
    if (!info || info.script === 'seal' && !drawable.has(char)) continue
    node(char)
    labels.set(char, info.glosses[0] ?? info.association ?? code(char))
    for (const gloss of info.glosses) {
      alias(char, gloss, gloss)
      for (const term of gloss.split(';')) {
        alias(char, term.trim(), gloss, senseOf(term))
        alias(char, lemma(term), gloss, senseOf(term))
      }
    }
    if (info.association) alias(char, info.association, info.association)
    for (const row of info.relations) link(char, row.char, row.kind === 'seal' || row.kind === 'modern' ? 'seal' : info.association ? 'association' : 'meaning', info.association ? undefined : row.meaning)
    for (const emoji of info.emoji) {
      link(char, emoji.text, 'emoji', info.association ? undefined : emoji.meaning)
      alias(emoji.text, emoji.meaning, emoji.meaning, senseOf(emoji.meaning), true)
      labels.set(emoji.text, emoji.meaning)
    }
    for (const i of doc.entries[char]?.aids ?? []) for (const term of doc.aids[i].en) {
      const sense = senseOf(term)
      alias(char, term, senseLabels.get(`${char}\0${sense}`) ?? labels.get(char) ?? term, sense, true)
    }
  }
  for (const aid of doc.aids) for (const han of aid.han) {
    node(han)
    for (const term of aid.en) alias(han, term, senseLabels.get(`${han}\0${senseOf(term)}`) ?? labels.get(han) ?? term, senseOf(term), true)
    for (const other of aid.han) link(han, other, 'meaning', aid.en[0])
  }
  // All glossed occurrences, including examples beyond the panel's four-row limit.
  for (const [word, entry] of Object.entries(doc.entries)) {
    if (entry.source !== 'wiktionary') continue
    for (const sequence of table.get(word) ?? []) for (const part of sequence.text) {
      if (characterScript(part) === 'component') link(word, part, 'usage')
    }
  }
  const meanings = createNameSearch(names)
  /** @param {string} query @param {{ limit?: number, seeds?: import('./types.js').Found[] }} [options]
   * @returns {{ char: string, label: string }[]} */
  function search(query, { limit = 24, seeds = [] } = {}) {
    const written = key(query)
    if (!written || limit <= 0) return []
    const direct = literal.get(written)
    /** @type {Map<string, {char: string, label: string, rank: number}>} */ const result = new Map()
    /** @type {{ char: string, depth: number, rank: number, expand: boolean, sense?: string }[]} */ const queue = []
    /** @type {Map<string, number>} */ const visited = new Map()
    /** @param {string} char @param {string} label @param {number} rank @param {number} depth @param {boolean} expand @param {string} [sense] */
    function add(char, label, rank, depth, expand, sense) {
      if (!result.has(char) || rank < /** @type {{rank:number}} */ (result.get(char)).rank) result.set(char, { char, label, rank })
      const id = `${char}\0${sense ?? '*'}\0${expand}\0${depth}`
      if ((visited.get(id) ?? Infinity) <= rank) return
      visited.set(id, rank); queue.push({ char, depth, rank, expand, sense })
    }
    for (const char of direct ?? []) add(char, labels.get(char) ?? code(char), 0, 0, true)
    for (const hit of seeds) {
      const matched = aliases.get(`${hit.char}\0${foldName(written)}`)
      add(hit.char, matched?.label ?? hit.label ?? labels.get(hit.char) ?? code(hit.char), matched ? matched.curated || doc.entries[hit.char]?.source === 'wiktionary' ? 1 : 4 : 1.5, 0, true, matched?.sense)
    }
    const matches = meanings.search(written, { limit: Infinity }).map(hit => {
      const matched = aliases.get(`${hit.char}\0${foldName(hit.label)}`)
      const rank = hit.score === 0 ? matched?.curated || doc.entries[hit.char]?.source === 'wiktionary' ? 1 : 4 : 10 + hit.score / 100
      return { hit, matched, rank }
    }).sort((a, b) => a.rank - b.rank).slice(0, Math.max(64, limit * 2))
    for (const { hit, matched, rank } of matches) {
      add(hit.char, matched?.label ?? hit.label, rank, 0, Boolean(characterScript(hit.char)), matched?.sense)
    }
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]
      if (!current.expand || current.depth >= 2) continue
      for (const edge of graph.get(current.char) ?? []) {
        if (current.sense && edge.sense && current.sense !== edge.sense) continue
        const sense = current.sense ?? edge.sense
        let label = (sense ? senseLabels.get(`${edge.char}\0${sense}`) : undefined) ?? labels.get(edge.char) ?? code(edge.char)
        if (edge.kind === 'usage') label = characterScript(edge.char) === 'component'
          ? `component of ${current.char} · ${(current.sense ? senseLabels.get(`${current.char}\0${current.sense}`) : undefined) ?? labels.get(current.char) ?? code(current.char)}`
          : `contains ${current.char} · ${label}`
        const expand = edge.kind === 'meaning' || edge.kind === 'association' || edge.kind === 'seal' || edge.kind === 'emoji' && Boolean(direct?.has(current.char))
        add(edge.char, label, edge.kind === 'usage' ? 100 + current.rank : Math.max(2, current.rank + 1), current.depth + 1, expand, sense)
      }
    }
    return [...result.values()].sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ char, label }) => ({ char, label }))
  }
  return { search }
}
