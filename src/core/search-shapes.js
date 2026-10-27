// @ts-check
// Query-only visual correspondences. Kana families use the encoded components named by Ashide:
// https://ashide.otodo.net/setumei/ziboziso.html
// https://ashide.otodo.net/setumei/tebiki.html
// Read 2026-10-27. Stroke-code fragments and five-keystroke selection rules are not imported.
// 亼 and 弋 are named in the learning guide; ヰ → 井 is named in the correspondence rules.

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
  ヰ: '井',
}
/** @type {Readonly<Record<string, string[]>>} */
const SHAPES = {
  ...Object.fromEntries(Object.entries(KANA).map(([kana, components]) => [kana, [...components]])),
  ...Object.fromEntries([
    ['ㅅᄉᆺ', '人'], ['ㅆᄊᆻ', '从'], ['스', '亼'], ['ㅁᄆᆷ', '口'], ['ㅇᄋᆼ', '〇'],
    ['ㅣᅵ', '丨'], ['ㅡᅳ', '一'], ['ㄱᄀᆨ', '𠃍'], ['ㄴᄂᆫ', '𠃊'], ['ㄷᄃᆮ', '匚'],
  ].flatMap(([shapes, component]) => [...shapes].map(shape => [shape, [component]]))),
}
/** Query runs accept named targets such as 〇 without changing the renderer's component grammar. */
export const SHAPE_COMPONENTS = new Set(Object.values(SHAPES).flat())

/** @typedef {{ anyOf: string[] }} Shape A query-only choice of components. */

/** @param {string} token @param {string | undefined} next @returns {string | Shape} */
export function searchShape(token, next) {
  if (/^[\u3099-\u309C\uFF9E\uFF9F]/u.test(next ?? '')) return token
  const base = [...token][0]
  const lookup = /^[\uFF66-\uFF9D\uFFA0-\uFFDC]$/u.test(base) ? base.normalize('NFKC') : base
  const choices = SHAPES[lookup]
  if (!choices) return token
  const anyOf = choices.map(component => component + token.slice(base.length))
  return anyOf.length === 1 ? anyOf[0] : { anyOf }
}
