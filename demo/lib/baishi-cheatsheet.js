// @ts-check
// The cheatsheet of the zi.tools (白式) extended IDS: its sections in the order the grammar nests,
// what each card quotes, where the quotation stands in Yi Bai's data, and which contours of the
// character's outline each written part is. Every sequence is quoted from
// <https://github.com/yi-bai/ids> at `SOURCE.commit`; the build
// (demo/scripts/build-baishi-cheatsheet.mjs) checks each one against the row it names and stores the
// outlines. The notation is that of （白式）IDS 延展语法导论 (2026-11-16),
// <https://nightfurysl2001.github.io/bai-ids/>, the guide the data's commit is named in; the section ids are those of
// demo/lib/baishi-sections.js, which the specification page shares.
//
// A glyph is drawn in the form the font has (Noto Sans CJK JP, Plangothic beyond it). A quoted entry
// is the one of its row that describes that form: its (J) entry or, where the row has none, its default.
// Where a row gives another source an entry of its own, the outline was compared with the quoted
// entry by eye. A variant the font does not draw alone is shown where the data names it: 子t in 孩,
// 土t in 地, 凵y in 世, whose own entries carry those tags. An entry for a form no outline has is
// drawn by the workshop's composer from the sequence, without its tags, and marked as composed.
// 𱤻 stands for ⿾止 as the guide gives it (§2.1), though its row's default entry spells it otherwise.
import { chainStrokes } from '../../src/core/chain-shape.js'

// JMJ-034221 (GlyphWiki koseki-085450@6), drawn in Gothic at 10 KAGE units.
// Its top u5c0f-03@8 has the hooked 亅 of 小.; its bottom cdp-8bc4@7 has 白 over 小.
const smallJ = {
  char: '𡮂',
  contours: [
    'M525 63L525 267.5L475 267.5L475 63ZM525 267.5L523 282.5L517.5 297L507.5 309L495 317.5L481 323L466 325.5L450 325.5L432.5 324L414 321L393.5 316.5L406 268L423.5 272L439 274.5L451.5 275.5L461.5 275.5L468.5 274.5L472.5 273L474 272L474 272L474.5 271L475 267.5ZM378.5 138.5L360 159L339.5 179L317 199L293.5 218L267.5 236.5L240.5 254.5L211.5 272L181 289L149 305.5L115 321.5L94.5 276L127 260.5L157.5 245L186.5 228.5L214 212L239.5 195.5L263 178L285 160.5L305.5 142.5L324 124.5L341 106ZM608.5 98.5L642.5 111.5L675.5 125.5L707.5 140L738.5 155.5L768.5 171.5L797 188.5L824.5 206.5L851.5 225L876.5 244L901 264.5L868.5 302L845.5 283.5L822 265.5L797 248L771 231L743.5 215L715.5 200L686 185L655.5 171L624 158L591 145.5Z',
    'M554 389L544.5 395L533.5 402L521.5 409.5L507.5 418L492 426.5L475 436.5L456 446.5L436 458L414 469.5L390.5 482L367 438L390.5 425.5L412 414L432 403L450.5 392.5L467 383L482 374.5L495.5 366.5L507.5 359.5L517.5 353L526 347.5ZM251 435.5L251 743.5L201 743.5L201 435.5ZM201 435.5L838.5 435.5L838.5 485.5L201 485.5ZM838.5 435.5L838.5 743.5L788.5 743.5L788.5 435.5ZM201 536.5L838.5 536.5L838.5 586.5L201 586.5ZM201 643.5L838.5 643.5L838.5 693.5L201 693.5ZM545 649.5L545 856.5L495 856.5L495 649.5ZM545 856.5L543 871.5L537.5 886L527.5 898.5L515 907L501 912L486 914.5L470 915L452.5 913.5L434 910.5L413.5 906L426 857.5L443.5 861.5L459 864L471.5 865L481.5 865L488.5 863.5L492.5 862.5L494 861.5L494 861.5L494.5 860L495 856.5ZM357 760.5L335 780L311.5 799L286.5 817.5L260.5 834.5L232.5 851L203.5 866.5L172.5 881.5L140.5 895.5L107 908.5L72 921L56 873.5L89.5 861.5L121.5 849L152 836L180.5 822L208 807.5L234 792L258 776L281 759.5L302.5 742L322 724ZM655 712L696.5 727L735 742L770 756.5L802.5 771L832 785.5L858.5 799.5L882 814L902.5 828L920.5 843L936 857.5L898.5 891L887.5 880L873 868.5L855 856L833.5 843L809 830L781.5 816L750.5 802.5L716.5 788.5L679 774L638.5 759.5Z'
  ],
  parts: [[0], [1]],
}

// Assemble the upper-position variant in the boxes of GlyphWiki u4d22-var-001@1.
// Keep 比. in u9e7f-03@7, replacing just the vertical dot with the sloping dot
// of u9e7f-t03@3. The lower 木 is u6728-04@6.
const deerUpper = {
  char: '䴢',
  composed: true,
  contours: [
    'M450 37L466 44L481 51.5L495.5 59.5L509 67.5L521.5 75.5L533 83.5L543.5 92L553 101L562 110L570 120L530 150L524.5 143.5L518.5 137L511 130L502.5 123.5L493 116.5L482.5 110L471 103L458.5 96L444.5 89.5L429.5 82.5ZM135 130L920 130L920 180L135 180ZM185 130L185 355L135 355L135 130ZM185 355L184 392.5L181 428.5L176 463.5L169 497.5L160 530L149 561L135.5 590.5L120.5 618.5L103.5 645.5L84 670.5L45.5 639L62.5 616.5L77.5 593.5L90.5 568.5L102.5 542.5L112 514.5L120.5 485.5L126.5 455L131 423L134 389.5L135 355ZM135 215L855 215L855 265L135 265ZM855 215L855 410L805 410L805 215ZM425 130L425 360L375 360L375 130ZM645 130L645 360L595 360L595 130ZM135 310L855 310L855 360L135 360ZM285 410L540 410L540 460L285 460ZM335 350L335 560L285 560L285 350ZM201.5 540L234 535.5L266.5 531L300.5 526L335 520L370.5 514L406.5 507L443.5 500L481.5 492.5L520 484L559.5 475.5L570 524L530.5 533L491.5 541L453 549L416 556.5L379 563L343.5 569.5L308.5 575L274 580.5L240.5 585.5L208 589.5ZM844.5 427.5L829 434L811.5 440L793 446L772.5 452L751 458L727.5 463.5L702.5 469L676.5 474L648.5 479.5L619 484.5L610.5 435L639.5 430L667 425L692.5 420L716.5 414.5L738.5 409L759.5 404L778.5 398.5L795.5 393L811 387.5L825 382ZM640 350L640 500L590 500L590 350ZM640 500L640 506.5L641 511.5L642 515.5L643.5 518L645 519.5L646.5 521L649 522.5L653 523.5L658 524.5L665 525L665 575L652.5 574L640.5 572L629.5 568L619 562.5L609.5 555L602 545.5L596.5 535L592.5 524L590.5 512L590 500ZM665 525L850 525L850 575L665 575ZM850 525L854.5 524.5L858.5 523L863 520.5L868 516L873.5 510L879 501L885 490L890.5 477L895.5 461.5L900.5 443.5L949 456L943.5 476L937 494.5L930 511.5L922.5 526.5L913.5 540L903.5 551.5L892 561L879 568.5L864.5 573L850 575Z',
    'M90 626.5L910 626.5L910 676.5L90 676.5ZM525 539L525 930.5L475 930.5L475 539ZM489.5 667L460 701.5L427.5 734.5L392.5 765.5L355 794.5L314.5 822L271 847.5L225.5 871L177 893L126 913L72.5 931L57 883.5L109 866L157.5 846.5L203.5 826L247 803.5L287.5 779.5L325.5 754L360.5 727L393 698L423 668L450 636ZM542.5 633.5L572 661.5L603.5 688L636.5 713.5L670.5 737.5L706.5 760L743.5 781L782.5 801L822.5 819.5L864.5 836.5L908 852.5L891.5 900L846.5 883.5L803 865.5L760.5 846L720 825L680.5 803L643 779L606.5 753.5L572 727L539 699L507 669.5Z',
  ],
  parts: [[0], [1]],
}

// Sans drawing of IWDS 408-2 (aj1-13763), traced from the ImageGen study.
// Keep the three parts separate for token highlighting.
const gong408 = {
  char: '工',
  contours: [
    'M165 104H835V176H165Z',
    'M460 176H530L421 438H665V498L513 824H433L579 505H320Z',
    'M80 824H920V896H80Z',
  ],
  parts: [[0], [1], [2]],
}

// U+E021 of the guide's fonts/example.woff2 at 0ca5ed48 (§4.3.2).
// The right leg of 儿 meets 乂. Split their shared contour at the contact for highlighting.
// © 2024-2025 -PT_AxH_RV-, fonts/OFL-Baishi-example.txt.
const fu222 = {
  char: '父',
  contours: [
    'M310 57C300 193 264 286 64 351C79 364 104 400 112 417C332 343 382 218 392 60Z',
    'M591 60V260C591 329 610 353 669 357L684 358C685 358 687 358 689 358H849C918 358 938 323 944 182C924 177 894 164 878 152C874 272 870 284 841 284H703C673 284 669 280 669 254V60Z',
    'M669 357C629 469 574 562 502 639C429 560 372 467 333 363L261 383C307 502 368 607 446 693C340 784 205 848 39 892C56 907 83 942 93 958C256 909 391 842 500 748C607 846 741 918 907 958C918 937 942 904 960 888C797 852 663 785 558 693C639 608 703 504 750 377L684 358Z',
  ],
  parts: [[0, 1], [2]],
}

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
export const GRAMMAR = { key: 'I26', title: '（白式）IDS 延展语法导论', date: '2026-11-16', url: 'https://nightfurysl2001.github.io/bai-ids/' }

/**
 * A piece of an outline: a contour by its number, or the part of one inside a box
 * `[contour, left, top, right, bottom]`, where the font draws two strokes as one contour.
 * @typedef {number | [number, number, number, number, number]} Piece
 */
/**
 * A character's outline and the pieces of each coloured part of it, by slot; `rest` the pieces
 * drawn faint because nothing quoted names them. Without `parts` the outline is drawn in ink. For a
 * chain, `joins` is where the line takes up each stroke, in the chain's order, and `cross` where
 * two of its strokes cross.
 * @typedef {{ char: string, composed?: boolean, contours?: string[], parts?: Piece[][], rest?: Piece[], joins?: [number, number][], cross?: [number, number] }} Glyph
 */
/**
 * One quotation: the character, the text as the data has it (an entry, or a whole row when it holds
 * a TAB), the line of its row in `file` (ids_lv0.txt unless named), the drawing of each entry in it
 * (an outline, or `'composed'` for the composer's drawing of the sequence), the slot of each leaf
 * where leaves share a colour, what the card is about (a piece of the text or a range of its code
 * points), and whether each stroke of a chain is a leaf of its own.
 * @typedef {{ char: string, text: string, row: number, file?: string, glyphs: (Glyph | 'composed' | null)[], slots?: number[],
 *   focus?: (string | [number, number])[], strokes?: boolean }} Quote
 */
/**
 * A card: its quotations, the shared anchors it stands for, and its label and its one-sentence
 * description (message keys).
 * @typedef {{ id: string, anchors?: string[], label?: string, hint?: string, quotes: Quote[] }} Card
 */
/** Letters of an identifier or a stroke with what each stands for. @typedef {{ id: string, lang?: string, items: [string, string][] }} Legend */
/** A group of cards under an anchor of its own, with the grammar's rules for it. @typedef {{ id: string, rules?: string[], cards?: Card[], legends?: Legend[] }} Group */
/** A section: a level of the grammar. @typedef {{ id: string, label: string, rules?: string[], cards?: Card[], groups?: Group[] }} Section */

/** An operator's card: the operator is what it shows. @param {string} op @param {string} char @param {string} text @param {number} row @param {Piece[][]} parts @returns {Card} */
const operator = (op, char, text, row, parts) => ({ id: `op-${(op.codePointAt(0) ?? 0).toString(16)}`, quotes: [{ char, text, row, glyphs: [{ char, parts }], focus: [op] }] })

/** The operator no row of the data uses: the guide gives it to searches on zi.tools (§6.7). */
export const UNUSED = ['㇯']

/**
 * The stroke letters with the stroke each spells, as the stroke's own row gives it: letters,
 * stroke, line of the row in ids_lv0.txt.
 * @type {[string, string, number][]}
 */
export const STROKE_LETTERS = [
  ['H', '一', 1], ['S', '丨', 41], ['P', '丿', 64], ['N', '乀', 65], ['D', '丶', 55], ['T', '㇀', 102018], ['J', '㇝', 102032],
  ['Wg', '㇁', 102019], ['SZ', '㇘', 102031], ['Qa', '◝', 101999], ['Qb', '◞', 102000], ['Qc', '◟', 102001], ['Qd', '◜', 101998],
]

/** The letters of an identifier with the gloss the guide prints for each (§4.3.1, §4.3.3), in the language it prints it in. */
const SOURCE_LETTERS = /** @type {Legend} */ ({ id: 'sourceLetters', items: [['B', 'UK'], ['G', 'G'], ['H', 'H'], ['J', 'J'], ['K', 'K'], ['M', 'M'], ['P', 'KP'], ['Q', 'UCS2003'], ['S', 'SAT'], ['T', 'T'], ['U', 'UTC'], ['V', 'V']] })
const STYLE_LETTERS = /** @type {Legend} */ ({ id: 'styleLetters', lang: 'zh-Hans', items: [['d', '点'], ['g', '钩'], ['h', '横'], ['n', '捺'], ['p', '撇'], ['s', '竖'], ['t', '提'], ['w', '弯'], ['x', '更多交叉'], ['y', '更少交叉'], ['z', '折']] })
const POSITION_LETTERS = /** @type {Legend} */ ({ id: 'positionLetters', lang: 'zh-Hans', items: [['u', '上'], ['l', '左'], ['r', '右']] })
const LETTERS = /** @type {Legend} */ ({ id: 'strokeLetters', lang: 'ja', items: STROKE_LETTERS.map(([letters, stroke]) => [letters, stroke]) })
/** What a source or style letter stands for, by the letter. */
export const GLOSS = { source: Object.fromEntries(SOURCE_LETTERS.items), style: Object.fromEntries([...STYLE_LETTERS.items, ...POSITION_LETTERS.items]), stroke: Object.fromEntries(LETTERS.items) }

/** The sheet's own name for a group, where it has one beside the rule's: the kind and name of its message
 * (`cheatsheet.<kind>.<name>`), by the group's id. @type {Record<string, string>} */
export const GROUP_LABELS = {
  'uniqueness-prefix': 'section.prefix', 'binary-operator': 'group.binary', 'ternary-operator': 'group.ternary',
  'overlap-operator': 'group.overlap', 'indexed-operator': 'group.indexed', 'unary-operator': 'group.unary',
  'taggable-char': 'group.taggable', 'component-variant': 'section.tags', 'sequence-variants': 'section.lists',
  'source-letter': 'label.sourceLetters', 'style-tag': 'label.styleLetters', 'stroke-letter': 'section.letters',
}

/** The sheet, top down as the grammar nests. @type {Section[]} */
export const SHEET = [
  { id: 'row', label: 'rows', rules: ['row', 'primary group', 'alternative group'], cards: [
    { id: 'row-entries', anchors: ['primary-group', 'entry-separator'], label: 'entries', hint: 'entries', quotes: [{ char: '十', text: '十\t⿻丨一.(.);⿻丨一t(.t)', row: 1346, glyphs: [{ char: '十', parts: [[1], [0]] }, null], focus: [';'] }] },
    { id: 'row-alternative', anchors: ['alternative-group'], label: 'alternative', hint: 'alternative', quotes: [{ char: '三', text: '三\t⿱一.二.\t⿱二.一.', row: 10, glyphs: [{ char: '三', parts: [[0], [1, 2]] }, { char: '三', parts: [[0, 1], [2]] }], focus: [[7, 8]] }] },
  ] },
  { id: 'entry', label: 'entry', rules: ['entry'], groups: [
    { id: 'uniqueness-prefix', rules: ['uniqueness prefix'], cards: [
      { id: 'prefix-same', label: 'sameSequence', hint: 'prefixSame', quotes: [
        { char: '士', text: '{士}⿱十.一.(.)', row: 2796, glyphs: [{ char: '士', parts: [[1, 2], [0]] }], focus: ['{士}'] },
        { char: '土', text: '⿱十.一.(.)', row: 2336, glyphs: [{ char: '土', parts: [[0, 2], [1]] }] },
      ] },
      { id: 'prefix-distant', label: 'distant', hint: 'prefixDistant', quotes: [
        { char: '径', text: '{?0径}⿰彳圣(T)', row: 4485, glyphs: ['composed'], focus: ['{?0径}'] },
        { char: '叱', text: '{?叱}⿰口.七.(V)', row: 1522, glyphs: ['composed'], focus: ['{?叱}'] },
      ] },
      { id: 'prefix-source', label: 'oneSource', hint: 'prefixSource', quotes: [{ char: '𡮂', text: '{𡮂J}⿱小.𤽄V(J)', row: 34639, glyphs: [smallJ], focus: ['{𡮂J}'] }] },
    ] },
  ] },
  { id: 'ids', label: 'operators', rules: ['ids'], groups: [
    { id: 'binary-operator', rules: ['binary operator'], cards: [
      operator('⿰', '明', '⿰日月.', 6159, [[5, 0, 1], [7, 2, 3, 4, 6]]),
      operator('⿱', '男', '⿱田力', 10040, [[2, 1, 3, 0], [4, 5, 6]]),
      operator('⿸', '厚', '⿸厂.㫗', 1435, [[7, 8], [0, 1, 2, 3, 4, 5, 6]]),
      operator('⿹', '句', '⿹勹口.', 1510, [[4, 2, 3], [1, 0]]),
      operator('⿺', '処', '⿺夂.几.', 999, [[0, 1, 2, 3], [4, 5, 6]]),
      operator('⿽', '斗', '⿽十.⺀', 6040, [[0, 1], [2, 3]]),
    ] },
    { id: 'ternary-operator', rules: ['ternary operator'], cards: [
      operator('⿲', '心', '⿲丶.⿺乚.丶.丶.', 4548, [[2], [0], [1], [3]]),
      operator('⿳', '魚', '⿳⺈田灬', 19803, [[5, 4, 6], [2, 1, 3, 0], [10, 7, 8, 9]]),
    ] },
    { id: 'overlap-operator', rules: ['overlap operator'], cards: [
      operator('⿻', '中', '⿻丨口.', 46, [[2], [0, 1]]),
    ] },
    { id: 'indexed-operator', rules: ['indexed operator'], cards: [
      operator('⿴', '回', '⿴囗.口.', 2271, [[2, 3], [1, 0]]),
      operator('⿵', '問', '⿵門.口.', 1872, [[7, 5, 2, 6, 4, 3], [1, 0]]),
      operator('⿶', '凶', '⿶凵.乂d', 1015, [[1, 0, 2], [3, 4]]),
      operator('⿷', '匠', '⿷匚.斤', 1313, [[4, 5], [3, 2, 0, 1]]),
      operator('⿼', '𢎛', '⿼弓.丶.', 36712, [[0], [1]]),
    ] },
    { id: 'unary-operator', rules: ['unary operator'], cards: [
      operator('⿾', '𫸪', '⿰弓.⿾弓.', 76246, [[0], [1]]),
      operator('⿿', '𠄔', '⿿予', 27873, [[0]]),
    ] },
  ] },
  { id: 'component', label: 'components', rules: ['component'], groups: [
    { id: 'taggable-char', rules: ['taggable char'], cards: [
      { id: 'kana-yu', hint: 'taggable', quotes: [{ char: '侯', text: '⿰亻⿱ユ.矢.(.)', row: 432, glyphs: [{ char: '侯', parts: [[7, 8], [0, 1], [2, 3, 4, 5, 6]] }], focus: ['ユ.'] }] },
      { id: 'kana-su', quotes: [{ char: '久', text: '⿸丿スn(.)', row: 70, glyphs: [{ char: '久', parts: [[0], [2, 3, 1]] }], focus: ['スn'] }] },
    ] },
    { id: 'katakana', cards: [
      { id: 'kana-ko', hint: 'untagged', quotes: [{ char: '已', text: '⿹コ乚.(.)', row: 4083, glyphs: [{ char: '已', parts: [[2, 1], [0]] }], focus: ['コ'] }] },
      { id: 'kana-ri', quotes: [{ char: '班', text: '⿴玨.リ(J)', row: 9710, glyphs: [{ char: '班', parts: [[6, 9, 8, 7, 1, 4, 3, 2], [0, 5]] }], focus: ['リ'] }] },
    ] },
  ] },
  { id: 'variant-id', label: 'variants', rules: ['variant id'], groups: [
    { id: 'component-variant', rules: ['component variant'], cards: [
      { id: 'tag-default', label: 'default', hint: 'tagDefault', quotes: [{ char: '子', text: '⿻了.一.(.)', row: 3409, glyphs: [{ char: '子', parts: [[2, 3, 1], [0]] }], focus: [[2, 3], [4, 5]] }] },
      { id: 'tag-source', label: 'source', hint: 'tagSource', quotes: [{ char: '字', text: '⿱宀J子.(J)', row: 3416, glyphs: [{ char: '字', parts: [[4, 5], [0, 3, 2, 1]] }], focus: [[2, 3]] }] },
      { id: 'tag-parts', label: 'perPart', hint: 'tagParts', quotes: [{ char: '邦', text: '⿰丰..p阝(.)', row: 17063, glyphs: [{ char: '邦', parts: [[0, 2, 1, 3], [4, 5]] }], focus: [[2, 5]] }] },
      { id: 'tag-style', label: 'style', hint: 'tagStyle', quotes: [
        { char: '孩', text: '⿰子t亥J(J)', row: 3434, glyphs: [{ char: '孩', parts: [[1, 3, 2, 0], [4, 5, 6, 7, 8, 9, 10]] }], focus: [[2, 3]] },
        { char: '子', text: '⿻了.一t(t)', row: 3409, glyphs: [{ char: '孩', parts: [[1, 3, 2], [0]], rest: [4, 5, 6, 7, 8, 9, 10] }], focus: ['(t)'] },
      ] },
    ] },
    { id: 'sequence-variants', rules: ['sequence variants'], cards: [
      { id: 'list-default', label: 'default', hint: 'listDefault', quotes: [{ char: '一', text: '#(H)(.)', row: 1, glyphs: [{ char: '一', parts: [[0]] }], strokes: true, focus: ['(.)'] }] },
      { id: 'list-source', label: 'source', hint: 'listSource', quotes: [{ char: '画', text: '⿱一.⿶凵.由(J)', row: 10044, glyphs: [{ char: '画', parts: [[1], [2, 0, 3], [4, 5, 6, 7, 8]] }], focus: ['(J)'] }] },
      { id: 'list-style', label: 'style', hint: 'listStyle', quotes: [{ char: '土', text: '⿱十.一t(t)', row: 2336, glyphs: [{ char: '地', parts: [[4, 5], [6]], rest: [0, 1, 2, 3] }], focus: ['(t)'] }] },
      { id: 'list-position', label: 'position', hint: 'listPosition', quotes: [
        { char: '䴢', text: '⿱鹿.木.(u)', row: 27427, glyphs: [deerUpper], focus: ['(u)'] },
        { char: '䴢', text: '⿸鹿.木.(.)', row: 27427, glyphs: [{ char: '䴢', parts: [[0, 7, 6, 4, 5, 12, 14, 2, 13, 8, 9], [1, 3, 11, 10]] }] },
      ] },
      { id: 'list-mirror', label: 'mirror', hint: 'listMirror', quotes: [{ char: '𱤻', text: '⿾止.(m)', row: 94401, glyphs: [{ char: '𱤻', parts: [[0]] }], focus: ['(m)'] }] },
      { id: 'list-merged', label: 'merged', hint: 'listMerged', quotes: [{ char: '七', text: '⿻乚一(.,T)', row: 4, file: 'ids_lv1.txt', glyphs: [{ char: '七', parts: [[1], [0]] }], focus: ['(.,T)'] }] },
    ] },
    { id: 'source-letter', rules: ['source letter'], legends: [SOURCE_LETTERS] },
    { id: 'style-tag', rules: ['style tag'], legends: [STYLE_LETTERS, POSITION_LETTERS], cards: [
      { id: 'list-ucv', anchors: ['ucv-position'], label: 'ucv', hint: 'listUcv', quotes: [{ char: '工', text: '⿳一.𠃑.一.(q4082)', row: 4070, glyphs: [gong408], focus: ['(q4082)'] }] },
      { id: 'list-analogy', anchors: ['imaginary-ucv'], label: 'analogy', hint: 'listAnalogy', quotes: [{ char: '父', text: '⿱儿.乂.(qq222)', row: 9271, glyphs: [fu222], focus: ['(qq222)'] }] },
    ] },
  ] },
  { id: 'stroke-chain', label: 'chains', rules: ['stroke chain', 'stroke part'], cards: [
    { id: 'chain', label: 'chain', hint: 'chain', quotes: [{ char: '己', text: '#(𠃍-一乚)(.)', row: 4082, strokes: true, glyphs: [{ char: '己', parts: [[1], [0], [2]], joins: [[80, 79], [779, 437], [92, 437]] }], focus: [[0, 2], [6, 7]] }] },
    { id: 'chain-reverse', anchors: ['reversal'], label: 'reverse', hint: 'reverse', quotes: [{ char: '人', text: '#(-丿乀)(.)', row: 187, strokes: true, glyphs: [{ char: '人', parts: [[0], [1]], joins: [[82, 925], [527, 80]] }], focus: ['-'] }] },
    { id: 'chain-cross', anchors: ['crossing'], label: 'cross', hint: 'cross', quotes: [{ char: '又', text: '#(-乀x1㇇)(.)', row: 1481, strokes: true, glyphs: [{ char: '又', parts: [[0], [1, 2]], joins: [[925, 905], [135, 86]], cross: [556, 652] }], focus: ['x1'] }] },
    { id: 'chain-break', anchors: ['break'], label: 'break', hint: 'break', quotes: [{ char: '凵', text: '#(丨b一-丨)(y)', row: 1014, strokes: true, glyphs: [{ char: '世', parts: [[4], [2], [5]], rest: [0, 1, 3], joins: [[500, 78], [500, 607], [770, 607]] }], focus: ['b'] }] },
    { id: 'chain-closed', anchors: ['closing'], label: 'closed', hint: 'closed', quotes: [{ char: '口', text: '#(-丨𠃍-一z)(.)', row: 1508, strokes: true,
      glyphs: [{ char: '口', parts: [[[0, 0, 0, 123.5, 1000]], [[0, 123.5, 0, 1000, 1000]], [1]], joins: [[85, 818], [85, 82], [919, 818]] }], focus: ['z'] }] },
    { id: 'chain-curves', anchors: ['curve'], label: 'curves', hint: 'curves', quotes: [{ char: '〇', text: '#(◟◜◝◞z)', row: 102011, strokes: true,
      glyphs: [{ char: '〇', parts: [[[0, 0, 500.7, 502.6, 1000], [1, 0, 500.7, 502.6, 1000]], [[0, 0, 0, 502.6, 500.7], [1, 0, 0, 502.6, 500.7]], [[0, 502.6, 0, 1000, 500.7], [1, 502.6, 0, 1000, 500.7]], [[0, 502.6, 500.7, 1000, 1000], [1, 502.6, 500.7, 1000, 1000]]],
        joins: [[502.6, 922], [78, 500.7], [502.6, 79], [927, 500.7]] }], focus: ['◟◜◝◞'] }] },
  ], groups: [
    { id: 'stroke-letter', rules: ['stroke letter'], legends: [LETTERS], cards: [
      { id: 'chain-letters', label: 'letters', hint: 'letters', quotes: [{ char: '乙', text: '#(HPHwg)', row: 90, strokes: true, glyphs: [{ char: '乙', parts: [[0], [1]], joins: [[82, 88], [748, 88]] }], focus: ['HPHwg'] }] },
      { id: 'chain-spelled', label: 'spelled', hint: 'spelled', quotes: [{ char: '𠃍', text: '#(HS)', row: 27802, strokes: true, glyphs: [{ char: '𠃍', parts: [[[0, 0, 0, 1000, 120.6]], [[0, 0, 120.6, 1000, 1000]]], joins: [[80, 81], [925, 81]] }], focus: ['HS'] }] },
      { id: 'chain-hook', label: 'hook', hint: 'hook', quotes: [{ char: '亅', text: '#(Sg)', row: 134, strokes: true, glyphs: [{ char: '亅', parts: [[0]], joins: [[682, 80]] }], focus: ['Sg'] }] },
    ] },
  ] },
  { id: 'overlap-modifier', label: 'overlap', rules: ['overlap modifier', 'overlap spec'], cards: [
    { id: 'overlap-slice', anchors: ['slice'], label: 'slice', hint: 'slice', quotes: [
      { char: '由', text: '⿻[:-1]丨日', row: 10034, glyphs: [{ char: '由', parts: [[3], [2, 0, 1]] }], focus: ['[:-1]'] },
      { char: '申', text: '⿻丨日', row: 10036, glyphs: [{ char: '申', parts: [[3], [0, 1, 2]] }] },
      { char: '甲', text: '⿻[1:]丨日', row: 10035, glyphs: [{ char: '甲', parts: [[0], [1, 2, 3]] }], focus: ['[1:]'] },
    ] },
    { id: 'overlap-matrix', anchors: ['crossing-matrix'], label: 'matrix', hint: 'matrix', quotes: [
      { char: '及', text: '⿻[l,b]㇋人.(.)', row: 1483, glyphs: [{ char: '及', parts: [[1, 3, 4, 2], [5, 0]] }], focus: ['[l,b]'] },
      { char: '包', text: '⿻[l,l,.]勹己.(J)', row: 1286, glyphs: [{ char: '包', parts: [[0, 1, 2], [3, 4]] }], focus: ['[l,l,.]'] },
    ] },
    { id: 'overlap-segment', label: 'segment', hint: 'segment', quotes: [{ char: '与', text: '⿺⿻[b]㇉一.一.(J)', row: 15, glyphs: [{ char: '与', parts: [[4, 0, 3], [2], [1]] }], focus: ['[b]'] }] },
    { id: 'overlap-reverse', anchors: ['reverse-matrix'], label: 'reverse2', hint: 'reverse2', quotes: [{ char: '𫠣', text: '⿻[1:|b]𠃌⿱⿻𠃊.一.八d', row: 74703, glyphs: [{ char: '𫠣', parts: [
        [[2, 0, 342.5, 1000, 410.9], [2, 400, 410.9, 1000, 537.1], [0, 400, 410.9, 1000, 537.1], [2, 300, 610.5, 1000, 1000]],
        [[2, 0, 0, 1000, 175.1], [2, 0, 249.6, 1000, 342.5], [2, 0, 410.9, 400, 537.1], [0, 0, 410.9, 400, 537.1], [2, 0, 537.1, 1000, 610.5], [2, 0, 610.5, 300, 1000]],
        [[2, 0, 175.1, 1000, 249.6]],
        [1, 3]] }], focus: ['[1:|b]'] }] },
  ] },
  { id: 'index-modifier', label: 'index', rules: ['index modifier'], cards: [
    { id: 'index-space', label: 'space', hint: 'space', quotes: [{ char: '𫡆', text: '⿴[1]⿴㠯.一.一.', row: 74738, glyphs: [{ char: '𫡆', parts: [
      [[4, 0, 0, 1000, 200.5], [2, 0, 0, 1000, 200.5], [4, 0, 200.5, 127.5, 266.8], [4, 833, 200.5, 1000, 266.8], [4, 0, 266.8, 1000, 678.8], [3, 0, 266.8, 1000, 678.8], [0, 0, 266.8, 1000, 678.8],
        [4, 0, 678.8, 127.5, 745.2], [4, 877, 678.8, 1000, 745.2], [4, 0, 745.2, 1000, 1000], [1, 0, 745.2, 1000, 1000]],
      [[4, 127.5, 200.5, 833, 266.8]],
      [[4, 127.5, 678.8, 877, 745.2]]] }], focus: ['[1]'] }] },
  ] },
  { id: 'worked', label: 'worked', cards: [
    { id: 'worked-shi', hint: 'workedShi', quotes: [
      { char: '世', text: '⿻⿺𠃊.凵y一.(.)', row: 23, glyphs: [{ char: '世', parts: [[3, 1], [4, 2, 5], [0]] }], focus: ['凵y'] },
      { char: '凵', text: '#(丨b一-丨)(y)', row: 1014, strokes: true, glyphs: [{ char: '世', parts: [[4], [2], [5]], rest: [0, 1, 3], joins: [[500, 78], [500, 607], [770, 607]] }], focus: ['(y)'] },
    ] },
    { id: 'worked-mu', hint: 'workedMu', quotes: [
      { char: '母', text: '⿻⿴#(-𠃌𠃊x0)⺀一.', row: 7630, strokes: true, glyphs: [{ char: '母', parts: [[0, 3], [4, 1], [5, 6], [2]], joins: [[560, 900], [267, 76]], cross: [812, 748] }], focus: ['x0'] },
    ] },
    { id: 'worked-ya', hint: 'workedYa', quotes: [
      { char: '亞', text: '⿳一.⿰#(丨-一𠃑)#(𠃑-一丨)一.(.)', row: 159, glyphs: [{ char: '亞', parts: [[0], [4, 3, 2], [5, 6, 7], [1]] }] },
    ] },
    { id: 'worked-er', hint: 'workedEr', quotes: [
      { char: '耳', text: '⿼干t⿰丨二.(J)', row: 12852, glyphs: [{ char: '耳', parts: [[0, 3, 5], [4], [1, 2]] }], focus: ['干t'] },
    ] },
    { id: 'worked-wang', hint: 'workedWang', quotes: [
      { char: '亡', text: '⿱亠J𠃊w(J)', row: 162, glyphs: [{ char: '亡', parts: [[1, 0], [2]] }], focus: ['亠J', '𠃊w'] },
    ] },
    { id: 'worked-wu', hint: 'workedWu', quotes: [
      { char: '乌', text: '⿱丿⿹#(-𠃌㇉)一.(.)', row: 77, glyphs: [{ char: '乌', parts: [[2], [4, 3, 0], [1]] }] },
    ] },
    { id: 'worked-han', hint: 'workedHan', quotes: [
      { char: '函', text: '⿻[:-1]丂⿶凵.⿰冫⿱丿丶.(J)', row: 1022, slots: [0, 1, 2, 3, 3], glyphs: [{ char: '函', parts: [[1, 6, 7, 8], [2, 0, 3], [5, 9], [10, 4]] }], focus: ['[:-1]'] },
    ] },
    { id: 'worked-che', hint: 'workedChe', quotes: [
      { char: '車', text: '車\t⿻十.旦.\t⿻丨亘.', row: 16587, glyphs: [{ char: '車', parts: [[0, 2], [5, 4, 3, 1]] }, { char: '車', parts: [[2], [0, 5, 4, 3, 1]] }], focus: [[7, 8]] },
    ] },
    { id: 'worked-gui', hint: 'workedGui', quotes: [
      { char: '龜', text: '⿱⺈⿴[4]⿻[.,.__,r,,bxx]⿹⿺乚.丨⿱ココ⿱#(一-𠃍丨b一)コ乂d(J)', row: 20893, slots: [0, 1, 1, 1, 1, 1, 1, 2],
        glyphs: [{ char: '龜', parts: [[0, 1, 15], [2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14], [9, 10]] }], focus: ['[4]'] },
    ] },
  ] },
]

/** Every card of the sheet, in order. @returns {Card[]} */
export const cardsOf = () => SHEET.flatMap(section => [...(section.cards ?? []), ...(section.groups ?? []).flatMap(group => group.cards ?? [])])
/** Every anchor the sheet has that the shared module names: its sections, its groups and its cards' anchors. @returns {string[]} */
export const anchorsOf = () => SHEET.filter(section => section.id !== 'worked').flatMap(section => [section.id, ...(section.cards ?? []).flatMap(card => card.anchors ?? []),
  ...(section.groups ?? []).flatMap(group => [group.id, ...(group.cards ?? []).flatMap(card => card.anchors ?? [])])])

/** Every anchor of the specification the sheet links to: its sections, its groups and the first anchor of each card that has one. @returns {string[]} */
export const linkedOf = () => SHEET.filter(section => section.id !== 'worked').flatMap(section => [section.id, ...(section.cards ?? []).flatMap(card => card.anchors?.slice(0, 1) ?? []),
  ...(section.groups ?? []).flatMap(group => [group.id, ...(group.cards ?? []).flatMap(card => card.anchors?.slice(0, 1) ?? [])])])

const UNARY = '⿾⿿', TERNARY = '⿲⿳', BINARY = '⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯'
/** The katakana components that take no tag. */
const UNTAGGED = 'コリ'
/** How many parts an operator of the grammar takes, 0 for what is none. @param {string} char */
export const arityOf = char => UNARY.includes(char) ? 1 : TERNARY.includes(char) ? 3 : BINARY.includes(char) ? 2 : 0

/**
 * A stretch of a token's text and what it is: an operator and its bracket (`mod`), a component
 * (`char`) and its identifier (`tag`), a stroke with its `-` (`rev`) and its `xN` or `b` (`mark`),
 * or punctuation; `at` is where it starts in the quotation, in code points.
 * @typedef {{ text: string, role: 'op' | 'mod' | 'char' | 'tag' | 'rev' | 'stroke' | 'mark' | 'punct', at: number }} Stretch
 */
/**
 * A token of a quotation: what a reader points at. `head` is the row's character, `tab` and `sep`
 * what separates groups and entries, `prefix` the braces, `op` an operator with its bracket, `part`
 * a component with its identifier, `open` and `shut` the `#(` and `)` of a chain, `stroke` a stroke
 * with its marks, `close` the final `z`, `list` the parenthesised identifiers. `entry` is the entry
 * of the row it stands in, `path` its place in the entry's tree (a chain's pieces share the chain's),
 * `leaf` the leaf it belongs to, `leaves` every leaf under an operator or in a chain, `chain` the
 * chain it is a piece of, `order` a stroke's number in its chain, and `top` which top-level operand
 * of the entry it stands in, where a long sequence may break.
 * @typedef {{ kind: 'head' | 'tab' | 'sep' | 'prefix' | 'op' | 'part' | 'open' | 'stroke' | 'close' | 'shut' | 'list', text: string, stretches: Stretch[],
 *   entry: number, at: number, top: number, path?: number[], leaf?: number, leaves?: number[], chain?: number, order?: number }} Token
 */

/**
 * A quotation read into its tokens. With `strokes`, every stroke of a chain is a leaf of its own;
 * otherwise a chain is one leaf, like a component. Throws on text the notation does not write.
 * @param {string} text An entry, or a row: the character, a TAB, its entries.
 * @param {{ strokes?: boolean }} [options]
 * @returns {Token[]}
 */
export function tokenise(text, { strokes = false } = {}) {
  const chars = [...text]
  /** @type {Token[]} */
  const tokens = []
  let at = 0, entry = 0, leaf = 0, chain = 0
  /** @param {string} piece @param {Stretch['role']} role @returns {Stretch} */
  const stretch = (piece, role) => { const made = { text: piece, role, at }; at += [...piece].length; return made }
  /** @param {Token['kind']} kind @param {Stretch[]} stretches @param {Partial<Token>} [more] */
  const add = (kind, stretches, more = {}) => {
    /** @type {Token} */
    const token = { kind, text: stretches.map(piece => piece.text).join(''), stretches, entry, at: stretches[0].at, top: 0, ...more }
    tokens.push(token)
    return token
  }
  /** @param {string} end */
  const through = end => { const stop = chars.indexOf(end, at); if (stop < 0) throw new Error(`${text}: no ${end}`); return chars.slice(at, stop + 1).join('') }
  /** @param {number[]} path @param {number} top @returns {number[]} The leaves read. */
  const sequence = (path, top) => {
    const char = chars[at]
    if (char === undefined) throw new Error(`${text}: ends early`)
    if (char === '#' && chars[at + 1] === '(') {
      const whole = through(')'), read = chainStrokes(whole)
      if (!read) throw new Error(`${text}: ${whole} is no chain`)
      const start = at, own = leaf, id = chain++
      /** @type {number[]} */
      const leaves = []
      const open = add('open', [stretch('#(', 'punct')], { path, chain: id, top, leaves })
      read.strokes.forEach((stroke, order) => {
        const of = strokes ? leaf++ : own
        if (!leaves.includes(of)) leaves.push(of)
        add('stroke', [...(stroke.back ? [stretch('-', 'rev')] : []), stretch(stroke.stroke, 'stroke'), ...(stroke.mark ? [stretch(stroke.mark, 'mark')] : [])], { path, chain: id, leaf: of, order, top })
      })
      if (read.closed) add('close', [stretch('z', 'punct')], { path, chain: id, top, leaves })
      add('shut', [stretch(')', 'punct')], { path, chain: id, top, leaves })
      if (!strokes) leaf++
      if (at - start !== [...whole].length) throw new Error(`${text}: ${whole} is read otherwise`)
      open.leaves = leaves
      return leaves
    }
    const arity = arityOf(char)
    if (arity) {
      const stretches = [stretch(char, 'op')]
      if (chars[at] === '[') stretches.push(stretch(through(']'), 'mod'))
      /** @type {number[]} */
      const leaves = []
      add('op', stretches, { path, top, leaves })
      // Where the entry is one operator, each of its operands is a place a long line may break.
      for (let n = 0; n < arity; n++) leaves.push(...sequence([...path, n], path.length ? top : n))
      return leaves
    }
    // A component is a character of its own: no ASCII, which only writes tags, brackets and lists.
    if (/^[\0-\x7f]$/.test(char)) throw new Error(`${text}: ${char} is no component`)
    const of = leaf++
    const stretches = [stretch(char, 'char')]
    if (!UNTAGGED.includes(char)) {
      let tag = ''
      while (/^[0-9A-Za-z.]$/.test(chars[at + tag.length] ?? '')) tag += chars[at + tag.length]
      if (tag) stretches.push(stretch(tag, 'tag'))
    }
    add('part', stretches, { path, leaf: of, top })
    return [of]
  }
  const one = () => {
    leaf = 0
    const first = tokens.length
    if (chars[at] === '{') add('prefix', [stretch(through('}'), 'punct')])
    sequence([], 0)
    const last = tokens[tokens.length - 1].top
    if (chars[at] === '(') add('list', [stretch(through(')'), 'punct')], { top: last })
    return first
  }
  if (chars.includes('\t')) { add('head', [stretch(chars[0], 'char')]); entry = -1 }
  else one()
  while (at < chars.length) {
    if (chars[at] === '\t') add('tab', [stretch('\t', 'punct')])
    else if (chars[at] === ';') add('sep', [stretch(';', 'punct')])
    else throw new Error(`${text}: ${chars.slice(at).join('')} is left over`)
    entry++
    one()
  }
  return tokens
}

/** The entries of a quotation, each as it stands in the row: what the build looks for there.
 * @param {string} text @returns {string[]} */
export const entriesOf = text => text.includes('\t') ? text.split('\t').slice(1).flatMap(group => group.split(';')) : [text]

/** An entry as the composer reads it: its operators and components, without tags, brackets, prefix or list;
 * null where it writes a chain or a bracket, which the composer does not draw.
 * @param {Token[]} tokens @param {number} entry @returns {string | null} */
export function bareOf(tokens, entry) {
  const own = tokens.filter(token => token.entry === entry)
  if (own.some(token => token.kind === 'open' || token.stretches.some(piece => piece.role === 'mod'))) return null
  return own.filter(token => token.kind === 'op' || token.kind === 'part').map(token => token.stretches[0].text).join('')
}

/** An entry without its list: what a variant is drawn from. @param {string} entry */
export const variantBody = entry => entry.replace(/(?<!#)\([^()]*\)$/u, '')

/** The identifiers of an entry's list, or none where it has no list: the brackets of a chain are no list.
 * @param {string} entry @returns {string[]} */
export const idsOf = entry => /(?<!#)\(([^()]*)\)$/u.exec(entry)?.[1].split(',') ?? []

/** What kind of identifier a tag or a list item is, by the patterns the grammar gives, the first match winning.
 * @param {string} id @returns {'default' | 'source' | 'analogy' | 'ucv' | 'mirror' | 'position' | 'style' | 'other'} */
export function kindOf(id) {
  if (id === '.') return 'default'
  if (/^[BGHJKMPQSTUV]$/.test(id)) return 'source'
  if (/^qq(?:\d{3}(?:z[a-z]|[a-z])?)+$/.test(id)) return 'analogy'
  if (/^[qpxy]\d{3}(?:z[a-z]|[a-z])?(?:[1-9]|\d{2})[xy]?$/.test(id)) return 'ucv'
  if (id === 'm') return 'mirror'
  if (/^[ulr]$/.test(id)) return 'position'
  if (/^[dghnpstwxyz.]+$/.test(id)) return 'style'
  return 'other'
}

/** The code-point ranges of what a quotation's card is about. @param {Quote} quote @returns {[number, number][]} */
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
export const quotations = () => cardsOf().flatMap(card => card.quotes.map(quote => /** @type {[string, number, string]} */ ([quote.file ?? 'ids_lv0.txt', quote.row, quote.text])))

// 宀 in Noto Sans CJK Regular, SC CID 15443 and JP CID 15442.
// Centre each 1000-em outline vertically; retain its native width and stroke proportions.
export const ROOF_FORMS = new Map([
  ['⿱丶.冖', 'M408 335C436 375 466 428 479 464L557 432C543 398 513 346 483 308ZM88 464V692H167V536H830V692H913V464Z'],
  ['⿱丶s冖', 'M87 466V705H164V538H833V704H913V466H538V295H457V466Z'],
])

// The three entries of 八 and 乂 in ids_lv0.txt. Keys keep the stroke tags because
// stripping t would turn a raised-onset na into an ordinary na.
// Noto Sans CJK Regular: 八 SC CID 10906 and TC CID 10907 (the short roof);
// 乂 CID 09570 is the plain form in every region. 凶 JP CID 11177 supplies 乂d.
// 八d is E012 of the guide's example.woff2, shown in §4.3.2 (same OFL as 父 above).
// 乂J is GlyphWiki u4e42-j@2, drawn with KAGE Gothic, kWidth 7, on a 1000-unit em.
export const NA_FORMS = new Map([
  ['⿰丿乀.', 'M305 137C285 413 240 728 32 899C49 912 75 940 87 955C306 771 359 440 387 144ZM660 114 587 119C593 202 618 724 908 954C923 936 947 917 973 902C688 685 664 187 660 114Z'],
  ['⿰丿乀t', 'M307 120C288 404 245 733 38 912C57 924 86 949 99 964C314 774 363 429 389 126ZM483 101V177H578C620 511 704 805 888 966C907 949 940 925 962 914C771 762 685 451 645 101Z'],
  ['⿰丿丶.', 'M594 133C714 409 796 698 844 937L924 920C874 677 793 380 670 108ZM317 129C297 403 251 715 47 884C62 898 88 924 99 940C317 758 370 428 397 135Z'],
  ['⿻丿乀.', 'M253 111 176 128C233 352 314 537 439 679C334 772 201 841 34 891C51 909 79 944 90 963C255 907 388 834 496 738C606 841 744 916 920 962C932 940 956 906 974 890C801 849 665 777 557 678C685 541 772 361 835 127L751 107C697 324 618 492 499 620C380 488 303 316 253 111Z'],
  ['⿻丿乀t', 'M153 307L171 287L187 266L204 245L220 223L235 201L250 179L264 157L278 134L291 112L304 88L366 122L352 146L338 170L323 194L308 218L293 241L276 264L260 287L243 309L225 331L207 353ZM334 154L357 259L387 355L425 445L470 527L524 602L584 670L653 731L730 785L815 832L907 872L883 938L784 895L693 844L610 786L535 719L469 646L411 564L362 475L321 379L289 276L266 166ZM769 142L740 258L702 367L655 469L599 563L534 650L460 729L378 800L286 864L186 920L78 968L52 902L155 857L249 804L335 745L412 679L481 605L541 524L593 436L637 341L673 238L701 128Z'],
  ['⿻丿丶.', 'M161 282C260 349 366 429 465 510C368 652 256 773 132 865C157 879 199 912 217 928C334 832 442 712 538 573C644 665 737 757 797 831L869 748C805 671 705 579 594 487C668 368 734 236 789 98L694 72C647 197 587 316 520 427C421 351 318 276 223 214Z'],
])

// Stroke glyphs for the rounded and angular variants in component tooltips (guide §5.3).
export const TURN_GLYPHS = new Map([['#(SHw)', '㇄'], ['#(SH)', '𠃊']])

/** Every character whose outline a card or its tooltip draws. @returns {string[]} */
export function glyphsDrawn() {
  const chars = cardsOf().flatMap(card => card.quotes.flatMap(quote =>
    quote.glyphs.flatMap(glyph => glyph && glyph !== 'composed' && !glyph.contours ? [glyph.char] : [])))
  return [...new Set([...chars, ...TURN_GLYPHS.values()])]
}

/** Every component a card writes, whose own row and outline a tooltip shows. @returns {string[]} */
export const componentsWritten = () => [...new Set(cardsOf().flatMap(card => card.quotes.flatMap(quote => tokenise(quote.text, { strokes: quote.strokes }).filter(token => token.kind === 'part').map(token => token.stretches[0].text))))]

/** Every sequence the composer draws for a card. @returns {string[]} */
export const composedDrawn = () => [...new Set(cardsOf().flatMap(card => card.quotes.flatMap(quote => {
  const tokens = tokenise(quote.text, { strokes: quote.strokes })
  return quote.glyphs.flatMap((glyph, entry) => {
    if (glyph !== 'composed') return []
    const bare = bareOf(tokens, entry)
    if (bare === null) throw new Error(`${quote.text}: the composer draws no chain or bracket`)
    return [bare]
  })
})))]

/** The contours a glyph's pieces name, each once. @param {Piece[]} pieces */
export const contoursOf = pieces => [...new Set(pieces.map(piece => typeof piece === 'number' ? piece : piece[0]))]
