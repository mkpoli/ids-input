// @ts-check
// The names people call components by, and the search over them: 絞絲 and 绞丝 for 糸, ノ文 and
// のぶん for 攵, ノ木 and のぎ for 禾, 宝盖 and 寶蓋 for 宀. The table is `data/component-names.tsv`
// (name TAB char TAB source TAB detail); a name is folded before it is compared, so katakana and
// hiragana, wide and narrow letters, and spaces and punctuation do not tell names apart. A query
// finds a name that is the whole of it first, then one it starts, then one it stands inside, so a
// shorter way of writing a name (宝盖 for 宝盖头) still finds it.
import { isComponent } from './ids.js'

/**
 * @typedef {object} ComponentName A name for a component.
 * @property {string} name The name as it is written in the table.
 * @property {string} char The component the name stands for.
 * @property {string} source The source the name is attested in.
 * @property {string} detail What the source says about it.
 *
 * @typedef {object} NameHit A component a query found, by one of its names.
 * @property {string} char The component.
 * @property {string} label The name that matched, as the table writes it.
 * @property {number} score How close the match is; lower is closer.
 */

const KATAKANA = /[\u30A1-\u30F6]/g
const MARKS = /[\s　・·,，、.。:：;；/／|｜\\()（）「」『』【】\[\]{}<>《》〈〉'"“”‘’!?！？~〜～\-—–_ー]+/g

/**
 * A name folded for matching: NFKC, lower case, katakana as hiragana, and spaces and punctuation
 * out. ノ and の are the same, ブ and ぶ are the same, and a long vowel mark is ignored; kanji and
 * kana stay apart, and so do traditional and simplified characters.
 * @param {string | null | undefined} text
 */
export function foldName(text) {
  return (text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(KATAKANA, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(MARKS, '')
}

/**
 * The names in `data/component-names.tsv`, comments and blank lines left out. Every component must
 * be one that can stand in a description, and a name must name one.
 * @param {string} text
 * @returns {ComponentName[]}
 */
export function readNames(text) {
  /** @type {ComponentName[]} */
  const names = []
  let line = 0
  for (const row of (text ?? '').split('\n')) {
    line++
    if (!row.trim() || row.startsWith('#')) continue
    const [name, char, source = '', detail = ''] = row.replace(/\r$/, '').split('\t')
    if (!name?.trim() || !char) continue
    if ([...char].length !== 1 || !isComponent(char)) throw new Error(`component-names.tsv:${line}: ${JSON.stringify(char)} is not a component`)
    names.push({ name: name.trim(), char, source: source.trim(), detail: detail.trim() })
  }
  return names
}

/**
 * A search over `names`. Each name is folded once; a query is folded the same way and compared
 * against every name. A name that is the whole query comes first, then one the query starts, then
 * one it stands inside. Hits are one per component, labelled with the closest name that found it;
 * of several names for the same component, the closest wins.
 * @param {ComponentName[]} names
 * @param {{ limit?: number }} [options]
 */
export function createNameSearch(names, { limit = 50 } = {}) {
  const entries = names.map(name => ({ ...name, folded: foldName(name.name), size: [...name.name].length }))
  /**
   * How close `name` is to `query`: 0 for the name itself, 100s for a name the query starts, 200s
   * for a name the query stands inside.
   * @param {string} name @param {string} query
   */
  function scoreOf(name, query) {
    if (name === query) return 0
    if (name.startsWith(query)) return 100 + [...name].length - [...query].length
    const at = name.indexOf(query)
    if (at < 0) return Infinity
    return 200 + at * 10 + [...name].length - [...query].length
  }
  /**
   * The components the names of `query` stand for, closest first, at most `limit`.
   * @param {string} query
   * @param {{ limit?: number }} [options]
   * @returns {NameHit[]}
   */
  function search(query, { limit: most = limit } = {}) {
    const wanted = foldName(query)
    if (!wanted || most <= 0) return []
    /** @type {(ComponentName & { folded: string, size: number, score: number })[]} */
    const found = []
    for (const entry of entries) {
      const score = scoreOf(entry.folded, wanted)
      if (score !== Infinity) found.push({ ...entry, score })
    }
    found.sort((a, b) => a.score - b.score || a.size - b.size || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    /** @type {NameHit[]} */
    const hits = []
    const seen = new Set()
    for (const entry of found) {
      if (seen.has(entry.char)) continue
      seen.add(entry.char)
      hits.push({ char: entry.char, label: entry.name, score: entry.score })
      if (hits.length >= most) break
    }
    return hits
  }
  return { search }
}
