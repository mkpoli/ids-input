// @ts-check
import { parse, write } from './ids.js'

// Query-only visual correspondences. Kana families use the encoded components named by Ashide:
// https://ashide.otodo.net/setumei/ziboziso.html
// https://ashide.otodo.net/setumei/tebiki.html
// Read 2026-10-27. Stroke-code fragments and five-keystroke selection rules are not imported.
// 亼 and 弋 are named in the learning guide; ヰ → 井 is named in the correspondence rules.
//
// ヱ is outside the 46 basic kana, and the correspondence table names no component for it, though
// it names 井 for ヰ. Unihan's provisional kStrange gives 𭛝 (U+2D6DD) K:U+30F1: a component of
// the character resembles katakana ヱ. BabelStone describes the character as ⿰彳𠀄, and 𠀄 is
// that component.
// https://www.unicode.org/reports/tr38/#kStrange, https://www.babelstone.co.uk/CJK/IDS.TXT

/** @type {Readonly<Record<string, string>>} */
const KANA = {
  ア: '了㇌卩刀丫', イ: '亻𠂆人入㐄井', ウ: '宀', エ: '工', オ: '才扌',
  カ: '力尸', キ: '十弋', ク: '𠂊勹', ケ: '亼个', コ: '凵囗〇',
  サ: '卄廾艹䒑', シ: '氵辶辶丨', ス: '大丌', セ: '七土士廿', ソ: '丷',
  タ: '夕月', チ: '千干', ツ: '灬小川巛𫶧', テ: '亍于', ト: '卜⺊𠂉',
  ナ: '𠂇', ニ: '二', ヌ: '又', ネ: '礻', ノ: '丿㇢亅',
  ハ: '八', ヒ: '匕匚匸', フ: '乛丆厂', ヘ: '乀乁一㇀', ホ: '木朩𣎳',
  マ: '龴丅丁', ミ: '三彡', ム: '厶', メ: '乂', モ: '乇王壬',
  ヤ: '巾㔾', ユ: '丄亠', ヨ: '彐⺕日', ラ: '广', リ: '刂',
  ル: '儿几𠘧', レ: '𠄌㇗㇄乚𡿨乙', ロ: '口', ワ: '冖冂', ヲ: '丩丬山屮', ン: '冫丶',
  ヰ: '井', ヱ: '𠀄',
}
/** The Hangul alias families: each written shape and the component it stands for. */
const HANGUL = [
  ['ㅅᄉᆺ', '人'], ['ㅆᄊᆻ', '从'], ['스', '亼'], ['ㅁᄆᆷ', '口'], ['ㅇᄋᆼ', '〇'],
  ['ㅣᅵ', '丨'], ['ㅡᅳ', '一'], ['ㄱᄀᆨ', '𠃍'], ['ㄴᄂᆫ', '𠃊'], ['ㄷᄃᆮ', '匚'],
]
/** @type {Readonly<Record<string, string[]>>} */
const SHAPES = {
  ...Object.fromEntries(Object.entries(KANA).map(([kana, components]) => [kana, [...components]])),
  ...Object.fromEntries(HANGUL.flatMap(([shapes, component]) => [...shapes].map(shape => [shape, [component]]))),
}
/** Query runs accept named targets such as 〇 without changing the renderer's component grammar. */
export const SHAPE_COMPONENTS = new Set(Object.values(SHAPES).flat())

/** A written shape and the components it may stand for. Search matches the shape itself first and
 * its lookalikes after; the description keeps the shape as written.
 * @typedef {{ shape: string, anyOf: string[] }} Shape */

/** @param {string} token @param {string | undefined} next @returns {string | Shape} */
export function searchShape(token, next) {
  if (/^[\u3099-\u309C\uFF9E\uFF9F]/u.test(next ?? '')) return token
  const base = [...token][0]
  const lookup = /^[\uFF66-\uFF9D\uFFA0-\uFFDC]$/u.test(base) ? base.normalize('NFKC') : base
  const choices = SHAPES[lookup]
  if (!choices) return token
  return { shape: token, anyOf: choices.map(component => component + token.slice(base.length)) }
}


/** The most sequences a substitution expands to. */
export const SUBSTITUTE_LIMIT = 32

/**
 * The canonical descriptions a query's visual substitutes can stand for, without the typed one.
 * `⿰彳ヱ` gives `⿰彳𠀄`; `⿰木キ` gives `⿰木十` and `⿰木弋`. A draft or a description with no
 * substitutes gives none.
 * @param {string} text
 * @returns {string[]}
 */
export function substituteSequences(text) {
  const parsed = parse(text, { open: true })
  if (parsed.problem || parsed.tree === null) return []
  /** @param {import('./ids.js').Part} part @returns {string[]} */
  const forms = part => {
    if (part === null) return []
    if (typeof part === 'string') {
      const shape = searchShape(part, undefined)
      return typeof shape === 'string' ? [shape] : shape.anyOf
    }
    let out = ['']
    for (const child of part.parts) {
      const choices = forms(child)
      const next = []
      for (const prefix of out) for (const choice of choices) next.push(prefix + choice)
      out = next.slice(0, SUBSTITUTE_LIMIT)
    }
    return out.map(inner => part.op + inner)
  }
  const typed = write(parsed.tree)
  return [...new Set(forms(parsed.tree))].filter(sequence => sequence !== typed).slice(0, SUBSTITUTE_LIMIT)
}


/** The query-only substitutions grouped for an appendix: each kana, and each Hangul family. */
export function equivalences() {
  return {
    kana: Object.entries(KANA).map(([kana, components]) => ({ shapes: [kana], components: [...components] })),
    hangul: HANGUL.map(([shapes, component]) => ({ shapes: [...shapes], components: [component] })),
  }
}
