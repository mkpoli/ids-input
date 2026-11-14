// @ts-check
// The cheatsheet of the zi.tools (白式) extended IDS: what each card quotes, where the quotation
// stands in Yi Bai's data, and which contours of the character's outline each written part is.
// Every sequence is quoted from <https://github.com/yi-bai/ids> at `SOURCE.commit`; the build
// (demo/scripts/build-baishi-cheatsheet.mjs) checks each one against the row it names and stores the
// outlines. The notation is that of （白式）IDS 延展语法导论 (2026-03-20),
// <https://nightfurysl2001.github.io/bai-ids/>.
//
// A glyph is drawn in the form the font has (Noto Sans CJK JP, Plangothic beyond it). A quoted entry
// is the one of its row that describes that form: its (J) entry or, where the row has none, its default.
// Where a row gives another source an entry of its own, the outline was compared with the quoted
// entry by eye. A variant the font does not draw alone is shown where the data names it: 子t in 孩,
// 凵y in 世, whose own entries carry those tags.
import { chainStrokes } from '../../src/core/chain-shape.js'

/** The data every sequence is quoted from. */
export const SOURCE = {
  repository: 'https://github.com/yi-bai/ids',
  commit: '2597437b928e8d530b7ae09cf53fe5ec7868569c',
  date: '2026-10-31',
  sha256: {
    'ids_lv0.txt': 'af5a0de3aae85ee1a69001918a78d4060d9a334c508ad2c6ac5854786791d474',
    'ids_lv1.txt': 'aa9ba7e394d8fd5cf797b6b9bd6ae5b4546f5222d10f15158c656f099b35c0cf',
  },
}
/** The document the notation is read from. */
export const GRAMMAR = { key: 'I26', title: '（白式）IDS 延展语法导论', date: '2026-03-20', url: 'https://nightfurysl2001.github.io/bai-ids/' }
/** The earlier drafts that read an overlap bracket mark by mark: PDF exports with no address of their own, dated from their metadata. */
export const DRAFTS = { key: 'D2–D3', author: 'Losketch', title: 'IDS说明文档', versions: '2.0 beta (2024-04-13), 3.0 beta (2024-06-04)' }

/**
 * A character's outline and the contours of each coloured part of it, by slot; `rest` the contours
 * drawn faint because nothing quoted names them. Without `parts` the outline is drawn in ink.
 * @typedef {{ char: string, parts?: number[][], rest?: number[] }} Glyph
 */
/**
 * One quotation: the character, the text as the data has it (an entry, or a whole row when it holds
 * a TAB), the line of its row in `file` (ids_lv0.txt unless named), the outline of each entry in
 * it, the slot of each leaf where leaves share a colour, and what is underlined: a piece of the
 * text or a range of its code points.
 * @typedef {{ char: string, text: string, row: number, file?: string, glyphs?: (Glyph | null)[], slots?: number[],
 *   focus?: (string | [number, number])[], chain?: boolean }} Quote
 */
/**
 * A card: its quotations; `strokes` colours each stroke of a chain rather than each component,
 * `indices` numbers them, `small` is a card of the letter grid, `wide` one of the worked examples.
 * @typedef {{ id: string, label?: string, hint?: string, open?: boolean, strokes?: boolean, indices?: boolean, small?: boolean, wide?: boolean, quotes: Quote[] }} Card
 */

/** An operator's card: the operator is what it shows. @param {string} op @param {string} char @param {string} text @param {number} row @param {number[][]} parts @returns {Card} */
const operator = (op, char, text, row, parts) => ({ id: `op-${(op.codePointAt(0) ?? 0).toString(16)}`, quotes: [{ char, text, row, glyphs: [{ char, parts }], focus: [op] }] })
/** A stroke letter's card: the chain a stroke's own row gives it. @param {string} char @param {string} text @param {number} row @returns {Card} */
const letter = (char, text, row) => ({ id: `letter-${(char.codePointAt(0) ?? 0).toString(16)}`, small: true, strokes: true, quotes: [{ char, text, row, chain: true }] })

/** @type {{ id: string, cards: Card[] }[]} */
export const SECTIONS = [
  { id: 'rows', cards: [
    { id: 'row-entries', label: 'entries', hint: 'entries', quotes: [{ char: '十', text: '十\t⿻丨一.(.);⿻丨一t(.t)', row: 1346, glyphs: [{ char: '十', parts: [[1], [0]] }, null], focus: [';'] }] },
    { id: 'row-alternative', label: 'alternative', hint: 'alternative', quotes: [{ char: '三', text: '三\t⿱一.二.\t⿱二.一.', row: 10, glyphs: [{ char: '三', parts: [[0], [1, 2]] }, { char: '三', parts: [[0, 1], [2]] }], focus: [[7, 8]] }] },
  ] },
  { id: 'operators', cards: [
    operator('⿰', '明', '⿰日月.', 6159, [[5, 0, 1], [7, 2, 3, 4, 6]]),
    operator('⿱', '男', '⿱田力', 10040, [[2, 1, 3, 0], [4, 5, 6]]),
    operator('⿲', '心', '⿲丶.⿺乚.丶.丶.', 4548, [[2], [0], [1], [3]]),
    operator('⿳', '魚', '⿳⺈田灬', 19803, [[5, 4, 6], [2, 1, 3, 0], [10, 7, 8, 9]]),
    operator('⿴', '回', '⿴囗.口.', 2271, [[2, 3], [1, 0]]),
    operator('⿵', '問', '⿵門.口.', 1872, [[7, 5, 2, 6, 4, 3], [1, 0]]),
    operator('⿶', '凶', '⿶凵.乂d', 1015, [[1, 0, 2], [3, 4]]),
    operator('⿷', '匠', '⿷匚.斤', 1313, [[4, 5], [3, 2, 0, 1]]),
    operator('⿸', '厚', '⿸厂.㫗', 1435, [[7, 8], [0, 1, 2, 3, 4, 5, 6]]),
    operator('⿹', '句', '⿹勹口.', 1510, [[4, 2, 3], [1, 0]]),
    operator('⿺', '処', '⿺夂.几.', 999, [[0, 1, 2, 3], [4, 5, 6]]),
    operator('⿻', '中', '⿻丨口.', 46, [[2], [0, 1]]),
    operator('⿼', '𢎛', '⿼弓.丶.', 36712, [[0], [1]]),
    operator('⿽', '斗', '⿽十.⺀', 6040, [[0, 1], [2, 3]]),
    operator('⿾', '𫸪', '⿰弓.⿾弓.', 76246, [[0], [1]]),
    operator('⿿', '𠄔', '⿿予', 27873, [[0]]),
  ] },
  { id: 'katakana', cards: [
    { id: 'kana-ko', quotes: [{ char: '已', text: '⿹コ乚.(.)', row: 4083, glyphs: [{ char: '已', parts: [[2, 1], [0]] }], focus: ['コ'] }] },
    { id: 'kana-ri', quotes: [{ char: '班', text: '⿴玨.リ(J)', row: 9710, glyphs: [{ char: '班', parts: [[6, 9, 8, 7, 1, 4, 3, 2], [0, 5]] }], focus: ['リ'] }] },
    { id: 'kana-su', quotes: [{ char: '久', text: '⿸丿スn(.)', row: 70, glyphs: [{ char: '久', parts: [[0], [2, 3, 1]] }], focus: ['スn'] }] },
    { id: 'kana-yu', quotes: [{ char: '丑', text: '⿼ユ.十.(.)', row: 18, focus: ['ユ.'] }] },
  ] },
  { id: 'tags', cards: [
    { id: 'tag-default', label: 'default', hint: 'tagDefault', quotes: [{ char: '子', text: '⿻了.一.(.)', row: 3409, glyphs: [{ char: '子', parts: [[2, 3, 1], [0]] }], focus: [[2, 3], [4, 5]] }] },
    { id: 'tag-source', label: 'source', hint: 'tagSource', quotes: [{ char: '字', text: '⿱宀J子.(J)', row: 3416, glyphs: [{ char: '字', parts: [[4, 5], [0, 3, 2, 1]] }], focus: [[2, 3]] }] },
    { id: 'tag-parts', label: 'perPart', hint: 'tagParts', quotes: [{ char: '邦', text: '⿰丰..p阝(.)', row: 17063, glyphs: [{ char: '邦', parts: [[0, 2, 1, 3], [4, 5]] }], focus: [[2, 5]] }] },
    { id: 'tag-style', label: 'style', hint: 'tagStyle', quotes: [
      { char: '孩', text: '⿰子t亥J(J)', row: 3434, glyphs: [{ char: '孩', parts: [[1, 3, 2, 0], [4, 5, 6, 7, 8, 9, 10]] }], focus: [[2, 3]] },
      { char: '子', text: '⿻了.一t(t)', row: 3409, glyphs: [{ char: '孩', parts: [[1, 3, 2], [0]], rest: [4, 5, 6, 7, 8, 9, 10] }], focus: ['(t)'] },
    ] },
  ] },
  { id: 'lists', cards: [
    { id: 'list-default', label: 'default', hint: 'listDefault', quotes: [{ char: '一', text: '#(H)(.)', row: 1, focus: ['(.)'] }] },
    { id: 'list-source', label: 'source', hint: 'listSource', quotes: [{ char: '画', text: '⿱一.⿶凵.由(J)', row: 10044, glyphs: [{ char: '画', parts: [[1], [2, 0, 3], [4, 5, 6, 7, 8]] }], focus: ['(J)'] }] },
    { id: 'list-style', label: 'style', hint: 'listStyle', quotes: [{ char: '子', text: '⿻了.一t(t)', row: 3409, focus: ['(t)'] }] },
    { id: 'list-position', label: 'position', hint: 'listPosition', quotes: [{ char: '勳', text: '⿺熏.力(r)', row: 1268, focus: ['(r)'] }] },
    { id: 'list-ucv', label: 'ucv', hint: 'listUcv', quotes: [{ char: '口', text: '⿴〢二.(q3162)', row: 1508, focus: ['(q3162)'] }] },
    { id: 'list-analogy', label: 'analogy', hint: 'listAnalogy', quotes: [{ char: '父', text: '⿱儿.乂.(qq222)', row: 9271, focus: ['(qq222)'] }] },
    { id: 'list-mirror', label: 'mirror', hint: 'listMirror', quotes: [{ char: '臦', text: '⿰⿾臣臣(m)', row: 13287, focus: ['(m)'] }] },
    { id: 'list-merged', label: 'merged', hint: 'listMerged', quotes: [{ char: '七', text: '⿻乚一(.,T)', row: 4, file: 'ids_lv1.txt', focus: ['(.,T)'] }] },
  ] },
  { id: 'prefix', cards: [
    { id: 'prefix-same', label: 'sameSequence', hint: 'prefixSame', quotes: [
      { char: '士', text: '{士}⿱十.一.(.)', row: 2796, glyphs: [{ char: '士', parts: [[1, 2], [0]] }], focus: ['{士}'] },
      { char: '土', text: '⿱十.一.(.)', row: 2336, glyphs: [{ char: '土', parts: [[0, 2], [1]] }] },
    ] },
    { id: 'prefix-distant', label: 'distant', hint: 'prefixDistant', open: true, quotes: [
      { char: '径', text: '{?0径}⿰彳圣(T)', row: 4485, focus: ['{?0径}'] },
      { char: '叱', text: '{?叱}⿰口.七.(V)', row: 1522, focus: ['{?叱}'] },
    ] },
    { id: 'prefix-source', label: 'oneSource', hint: 'prefixSource', quotes: [{ char: '𡮂', text: '{𡮂J}⿱小.𤽄V(J)', row: 34639, focus: ['{𡮂J}'] }] },
  ] },
  { id: 'chains', cards: [
    { id: 'chain', label: 'chain', hint: 'chain', strokes: true, quotes: [{ char: '己', text: '#(𠃍-一乚)(.)', row: 4082, glyphs: [{ char: '己', parts: [[1], [0], [2]] }], chain: true, focus: [[0, 2], [6, 7]] }] },
    { id: 'chain-reverse', label: 'reverse', hint: 'reverse', strokes: true, quotes: [{ char: '人', text: '#(-丿乀)(.)', row: 187, glyphs: [{ char: '人', parts: [[0], [1]] }], chain: true, focus: ['-'] }] },
    { id: 'chain-cross', label: 'cross', hint: 'cross', strokes: true, indices: true, quotes: [{ char: '又', text: '#(-乀x1㇇)(.)', row: 1481, glyphs: [{ char: '又', parts: [[0], [1, 2]] }], chain: true, focus: ['x1'] }] },
    { id: 'chain-break', label: 'break', hint: 'break', strokes: true, quotes: [{ char: '凵', text: '#(丨b一-丨)(y)', row: 1014, glyphs: [{ char: '世', parts: [[4], [2], [5]], rest: [0, 1, 3] }], chain: true, focus: ['b'] }] },
    { id: 'chain-closed', label: 'closed', hint: 'closed', strokes: true, quotes: [{ char: '口', text: '#(-丨𠃍-一z)(.)', row: 1508, glyphs: [{ char: '口' }], chain: true, focus: ['z'] }] },
    { id: 'chain-curves', label: 'curves', hint: 'curves', strokes: true, quotes: [{ char: '〇', text: '#(◟◜◝◞z)', row: 102011, glyphs: [{ char: '〇' }], chain: true, focus: ['◟◜◝◞'] }] },
    { id: 'chain-letters', label: 'letters', hint: 'letters', strokes: true, quotes: [{ char: '乙', text: '#(HPHwg)', row: 90, glyphs: [{ char: '乙', parts: [[0], [1]] }], chain: true, focus: ['HPHwg'] }] },
  ] },
  { id: 'letters', cards: [
    letter('一', '#(H)(.)', 1), letter('丨', '#(S)', 41), letter('丿', '#(P)', 64), letter('乀', '#(N)(.)', 65), letter('丶', '#(D)(.)', 55),
    letter('㇀', '#(T)', 102018), letter('㇝', '#(J)', 102032), letter('㇁', '#(Wg)', 102019), letter('㇘', '#(SZ)', 102031),
    letter('◝', '#(Qa)', 101999), letter('◞', '#(Qb)', 102000), letter('◟', '#(Qc)', 102001), letter('◜', '#(Qd)', 101998),
    letter('㇄', '#(SHw)', 102021), letter('亅', '#(Sg)', 134), letter('𠃍', '#(HS)', 27802),
  ] },
  { id: 'overlap', cards: [
    { id: 'overlap-slice', label: 'slice', hint: 'slice', quotes: [
      { char: '由', text: '⿻[:-1]丨日', row: 10034, glyphs: [{ char: '由', parts: [[3], [2, 0, 1]] }], focus: ['[:-1]'] },
      { char: '申', text: '⿻丨日', row: 10036, glyphs: [{ char: '申', parts: [[3], [0, 1, 2]] }] },
      { char: '甲', text: '⿻[1:]丨日', row: 10035, glyphs: [{ char: '甲', parts: [[0], [1, 2, 3]] }], focus: ['[1:]'] },
    ] },
    { id: 'overlap-matrix', label: 'matrix', hint: 'matrix', open: true, quotes: [
      { char: '及', text: '⿻[l,b]㇋人.(.)', row: 1483, glyphs: [{ char: '及', parts: [[1, 3, 4, 2], [5, 0]] }], focus: ['[l,b]'] },
      { char: '包', text: '⿻[l,l,.]勹己.(J)', row: 1286, glyphs: [{ char: '包', parts: [[0, 1, 2], [3, 4]] }], focus: ['[l,l,.]'] },
    ] },
    { id: 'overlap-segment', label: 'segment', hint: 'segment', quotes: [{ char: '与', text: '⿺⿻[b]㇉一.一.(J)', row: 15, glyphs: [{ char: '与', parts: [[4, 0, 3], [2], [1]] }], focus: ['[b]'] }] },
    { id: 'overlap-reverse', label: 'reverse2', hint: 'reverse2', quotes: [{ char: '𫠣', text: '⿻[1:|b]𠃌⿱⿻𠃊.一.八d', row: 74703, glyphs: [{ char: '𫠣' }], focus: ['[1:|b]'] }] },
  ] },
  { id: 'index', cards: [
    { id: 'index-space', label: 'space', hint: 'space', quotes: [{ char: '𫡆', text: '⿴[1]⿴㠯.一.一.', row: 74738, glyphs: [{ char: '𫡆' }], focus: ['[1]'] }] },
  ] },
  { id: 'worked', cards: [
    { id: 'worked-shi', wide: true, hint: 'workedShi', quotes: [
      { char: '世', text: '⿻⿺𠃊.凵y一.(.)', row: 23, glyphs: [{ char: '世', parts: [[3, 1], [4, 2, 5], [0]] }], focus: ['凵y'] },
      { char: '凵', text: '#(丨b一-丨)(y)', row: 1014, slots: [1], focus: ['(y)'] },
    ] },
    { id: 'worked-mu', wide: true, strokes: true, indices: true, hint: 'workedMu', quotes: [
      { char: '母', text: '⿻⿴#(-𠃌𠃊x0)⺀一.', row: 7630, glyphs: [{ char: '母', parts: [[0, 3], [4, 1], [5, 6], [2]] }], focus: ['x0'] },
    ] },
    { id: 'worked-ya', wide: true, hint: 'workedYa', quotes: [
      { char: '亞', text: '⿳一.⿰#(丨-一𠃑)#(𠃑-一丨)一.(.)', row: 159, glyphs: [{ char: '亞', parts: [[0], [4, 3, 2], [5, 6, 7], [1]] }] },
    ] },
    { id: 'worked-gui', wide: true, hint: 'workedGui', open: true, quotes: [
      { char: '龜', text: '⿱⺈⿴[4]⿻[.,.__,r,,bxx]⿹⿺乚.丨⿱ココ⿱#(一-𠃍丨b一)コ乂d(J)', row: 20893, slots: [0, 1, 1, 1, 1, 1, 1, 2],
        glyphs: [{ char: '龜', parts: [[0, 1, 15], [2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14], [9, 10]] }], focus: ['[4]'] },
    ] },
  ] },
]

/** The operators no row of the data uses. */
export const UNUSED = ['㇯', '〾']

/**
 * The letters of an identifier, with the gloss the grammar prints for each (pp.8, 12–13), in the
 * language it prints it in.
 * @type {Record<string, { id: string, lang?: string, items: [string, string][] }[]>}
 */
export const LEGENDS = {
  lists: [
    { id: 'sourceLetters', items: [['B', 'UK'], ['G', 'G'], ['H', 'H'], ['J', 'J'], ['K', 'K'], ['M', 'M'], ['P', 'KP'], ['Q', 'UCS2003'], ['S', 'SAT'], ['T', 'T'], ['U', 'UTC'], ['V', 'V']] },
    { id: 'styleLetters', lang: 'zh-Hans', items: [['d', '点'], ['g', '钩'], ['h', '横'], ['n', '捺'], ['p', '撇'], ['s', '竖'], ['t', '提'], ['w', '弯'], ['x', '更多交叉'], ['y', '更少交叉'], ['z', '折']] },
    { id: 'positionLetters', lang: 'zh-Hans', items: [['u', '上'], ['l', '左'], ['r', '右']] },
  ],
}

const UNARY = '⿾⿿', TERNARY = '⿲⿳', BINARY = '⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯'
/** The katakana components that take no tag. */
const UNTAGGED = 'コリ'

/**
 * A piece of a quotation: its text, what it is, the entry of the row it stands in, the leaf it
 * belongs to (a component with its tag, or a stroke with its marks) and where it starts, in code
 * points. `head` is the row's character, `tab` and `sep` what separates groups and entries,
 * `prefix` the braces, `op` an operator and `mod` its bracket, `part` a component and `tag` its
 * identifier, `chain` the `#(` and `)` of a chain, `stroke` a stroke and `mark` its `-`, `xN` or
 * `b`, `close` the final `z`, `list` the parenthesised identifiers.
 * @typedef {{ text: string, kind: 'head' | 'tab' | 'sep' | 'prefix' | 'op' | 'mod' | 'part' | 'tag' | 'chain' | 'stroke' | 'mark' | 'close' | 'list',
 *   entry: number, leaf?: number, at: number }} Token
 */

/**
 * A quotation read into its pieces. With `strokes`, every stroke of a chain is a leaf of its own;
 * otherwise a chain is one leaf, like a component. Throws on text the notation does not read.
 * @param {string} text An entry, or a row: the character, a TAB, its entries.
 * @param {{ strokes?: boolean }} [options]
 * @returns {Token[]}
 */
export function tokenise(text, { strokes = false } = {}) {
  const chars = [...text]
  /** @type {Token[]} */
  const tokens = []
  let at = 0, entry = 0, leaf = 0
  /** @param {string} piece @param {Token['kind']} kind @param {number} [of] */
  const push = (piece, kind, of) => { tokens.push({ text: piece, kind, entry, ...(of === undefined ? {} : { leaf: of }), at }); at += [...piece].length }
  /** @param {string} end */
  const through = end => { const stop = chars.indexOf(end, at); if (stop < 0) throw new Error(`${text}: no ${end}`); return chars.slice(at, stop + 1).join('') }
  const sequence = () => {
    const char = chars[at]
    if (char === undefined) throw new Error(`${text}: ends early`)
    if (char === '#' && chars[at + 1] === '(') {
      const whole = through(')'), read = chainStrokes(whole)
      if (!read) throw new Error(`${text}: ${whole} is no chain`)
      const start = at, own = leaf
      push('#(', 'chain')
      for (const stroke of read.strokes) {
        const of = strokes ? leaf++ : own
        if (stroke.back) push('-', 'mark', of)
        push(stroke.stroke, 'stroke', of)
        if (stroke.mark) push(stroke.mark, 'mark', of)
      }
      if (read.closed) push('z', 'close')
      push(')', 'chain')
      if (!strokes) leaf++
      if (at - start !== [...whole].length) throw new Error(`${text}: ${whole} is read otherwise`)
      return
    }
    const arity = UNARY.includes(char) ? 1 : TERNARY.includes(char) ? 3 : BINARY.includes(char) ? 2 : 0
    if (arity) {
      push(char, 'op')
      if (chars[at] === '[') push(through(']'), 'mod')
      for (let n = 0; n < arity; n++) sequence()
      return
    }
    // A component is a character of its own: no ASCII, which only writes tags, brackets and lists.
    if (/^[\0-\x7f]$/.test(char)) throw new Error(`${text}: ${char} is no component`)
    const of = leaf++
    push(char, 'part', of)
    if (UNTAGGED.includes(char)) return
    let tag = ''
    while (at + [...tag].length < chars.length && /^[0-9A-Za-z.]$/.test(chars[at + [...tag].length])) tag += chars[at + [...tag].length]
    if (tag) push(tag, 'tag', of)
  }
  const one = () => {
    leaf = 0
    if (chars[at] === '{') push(through('}'), 'prefix')
    sequence()
    if (chars[at] === '(') push(through(')'), 'list')
  }
  if (chars.includes('\t')) { push(chars[0], 'head'); entry = -1 }
  else one()
  while (at < chars.length) {
    if (chars[at] === '\t') push('\t', 'tab')
    else if (chars[at] === ';') push(';', 'sep')
    else throw new Error(`${text}: ${chars.slice(at).join('')} is left over`)
    entry++
    one()
  }
  return tokens
}

/** The entries of a quotation, each as it stands in the row: what the build looks for there.
 * @param {string} text @returns {string[]} */
export const entriesOf = text => text.includes('\t') ? text.split('\t').slice(1).flatMap(group => group.split(';')) : [text]

/** The code-point ranges a quotation underlines. @param {Quote} quote @returns {[number, number][]} */
export function focusOf(quote) {
  const chars = [...quote.text]
  return (quote.focus ?? []).map(item => {
    if (typeof item !== 'string') return item
    const piece = [...item]
    const start = chars.findIndex((_, index) => piece.every((char, offset) => chars[index + offset] === char))
    if (start < 0) throw new Error(`${quote.text}: no ${item}`)
    return /** @type {[number, number]} */ ([start, start + piece.length])
  })
}

/** Every quotation as the build looks it up: its file, the line of its row and its text. @returns {[string, number, string][]} */
export const quotations = () => SECTIONS.flatMap(section => section.cards.flatMap(card => card.quotes.map(quote => /** @type {[string, number, string]} */ ([quote.file ?? 'ids_lv0.txt', quote.row, quote.text]))))

/** Every character whose outline a card draws. @returns {string[]} */
export const glyphsDrawn = () => [...new Set(SECTIONS.flatMap(section => section.cards.flatMap(card => card.quotes.flatMap(quote => (quote.glyphs ?? []).flatMap(glyph => glyph ? [glyph.char] : [])))))]
