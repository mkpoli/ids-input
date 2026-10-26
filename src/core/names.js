// @ts-check
// The names people call components by, and the search over them: 絞絲 and 绞丝 for 糸, ノ文 and
// のぶん for 攵, ノ木 and のぎ for 禾, 宝盖 and 寶蓋 for 宀, and the words and readings that lead to
// them (water, silk, みず, shui, mizu, jiaosipang). The table is `data/component-names.tsv`
// (name TAB char TAB source TAB detail); a name is folded before it is compared, so katakana and
// hiragana, wide and narrow letters, Chinese scripts, and spaces, punctuation and Latin accents do
// not tell names apart. A query finds a name that is the whole of it first, then one it starts, then
// one it stands inside, so a shorter way of writing a name (宝盖 for 宝盖头) still finds it.
import { isComponent } from './ids.js'

/**
 * @typedef {object} ComponentName A name for a component.
 * @property {string} name The name as it is written in the table.
 * @property {string} char The component the name stands for.
 * @property {string} source The source the name is attested in.
 * @property {string} detail What the source says about it.
 * @property {number} [rank] How common the character is; lower comes first among equal matches.
 *
 * @typedef {object} NameHit A component a query found, by one of its names.
 * @property {string} char The component.
 * @property {string} label The name that matched, as the table writes it.
 * @property {number} score How close the match is; lower is closer.
 */

const KATAKANA = /[\u30A1-\u30F6]/g
const MARK = /[\u0300-\u036f]/g
const MARKS = /[\s　・·,，、.。:：;；/／|｜\\()（）「」『』【】\[\]{}<>《》〈〉'"“”‘’!?！？~〜～\-—–_ー]+/g

/**
 * A name folded for matching: NFKC, lower case, katakana as hiragana, Latin accents off, Chinese
 * forms folded by `folds`, and spaces and punctuation out. ノ and の are the same, ブ and ぶ are the
 * same, a long vowel mark is ignored, and 寶 and 宝 are one when the folds table says so; kanji and
 * kana stay apart, and so do voiced and unvoiced kana.
 * @param {string | null | undefined} text
 * @param {Map<string, string>} [folds]
 */
export function foldName(text, folds = new Map()) {
  const plain = (text ?? '')
    .normalize('NFKD')
    .replace(MARK, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(KATAKANA, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(MARKS, '')
  if (!folds.size) return plain
  return [...plain].map(char => folds.get(char) ?? char).join('')
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
    const [name, char, source = '', detail = '', rank] = row.replace(/\r$/, '').split('\t')
    if (!name?.trim() || !char) continue
    if ([...char].length !== 1 || !isComponent(char)) throw new Error(`component-names.tsv:${line}: ${JSON.stringify(char)} is not a component`)
    const order = rank === undefined || rank === '' ? undefined : Number(rank)
    names.push({ name: name.trim(), char, source: source.trim(), detail: detail.trim(), ...(order !== undefined && !Number.isNaN(order) ? { rank: order } : {}) })
  }
  return names
}

/**
 * The folds in `data/component-name-folds.tsv` (form TAB char [TAB source]): a character of one
 * Chinese script or component form, and the one it folds to. Kept apart from the names so a host can
 * leave the table out and still search the names as they are written.
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function readFolds(text) {
  /** @type {Map<string, string>} */
  const folds = new Map()
  let line = 0
  for (const row of (text ?? '').split('\n')) {
    line++
    if (!row.trim() || row.startsWith('#')) continue
    const [form, char] = row.replace(/\r$/, '').split('\t')
    if (!form || !char) continue
    if ([...form].length !== 1 || !isComponent(form)) throw new Error(`component-name-folds.tsv:${line}: ${JSON.stringify(form)} is not a component`)
    if ([...char].length !== 1 || !isComponent(char)) throw new Error(`component-name-folds.tsv:${line}: ${JSON.stringify(char)} is not a component`)
    folds.set(form, char)
  }
  return folds
}

/**
 * A search over `names`, compared after `folds` (from `readFolds`) is applied to both sides. Each
 * name is folded once; a query is folded the same way. A name that is the whole query comes first
 * (the name written exactly as the query, then one that only folds to it), then one the query starts,
 * then one it stands inside. A Latin query matches whole names and their starts, never the inside of
 * a word. Hits are one per component, labelled with the closest name that found it.
 * @param {ComponentName[]} names
 * @param {{ limit?: number, folds?: Map<string, string> }} [options]
 */
export function createNameSearch(names, { limit = 50, folds = new Map() } = {}) {
  const entries = names.map(name => ({ ...name, folded: foldName(name.name, folds), size: [...name.name].length }))
  /**
   * How close `name` is to `query`: 0 for the name itself, 100s for a name the query starts, 200s
   * for a name the query stands inside. A Latin query is not matched inside a name.
   * @param {string} name @param {string} query @param {boolean} latin
   */
  function scoreOf(name, query, latin) {
    // A numbered name such as 'radical 120' is found only by a query that carries a number.
    if (latin && !/\d/.test(query) && /\d/.test(name)) return Infinity
    if (name === query) return 0
    if (name.startsWith(query)) return 100 + [...name].length - [...query].length
    // A Latin word of five letters or more may stand inside a longer name, so caldron reaches
    // 'type of caldron with three hollow legs'; a numbered alias has no such inside.
    if (latin && (query.length < 5 || /\d/.test(name))) return Infinity
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
    const written = (query ?? '').trim()
    const wanted = foldName(written, folds)
    if (!wanted || most <= 0) return []
    const latin = /^[a-z0-9]+$/.test(wanted)
    if (latin && wanted.length < 2) return []
    /** @type {(ComponentName & { folded: string, size: number, score: number })[]} */
    const found = []
    for (const entry of entries) {
      const score = scoreOf(entry.folded, wanted, latin)
      if (score !== Infinity) found.push({ ...entry, score })
    }
    // A Latin query that is a whole name takes that name alone; mizu does not reach mizukara.
    const exact = latin && found.some(entry => entry.score === 0)
    const shown = exact ? found.filter(entry => entry.score === 0) : found
    shown.sort((a, b) =>
      Number(b.name === written) - Number(a.name === written)
      || a.score - b.score
      || (a.rank ?? Infinity) - (b.rank ?? Infinity)
      || a.size - b.size
      || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0)
      || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    /** @type {NameHit[]} */
    const hits = []
    const seen = new Set()
    for (const entry of shown) {
      if (seen.has(entry.char)) continue
      seen.add(entry.char)
      hits.push({ char: entry.char, label: entry.name, score: entry.score })
      if (hits.length >= most) break
    }
    return hits
  }
  return { search }
}
