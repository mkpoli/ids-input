// The zi.tools IDS Extension (白式 in its guide) as zi.tools writes it: the examples, table rows and
// quotations of its guide, （白式）IDS 延展语法导论, each with the section it stands in, and rows of
// the database at the commit the guide names. Quotations keep the guide's wording, and their
// renderings live in baishi-quotes/<locale>.json (a Chinese reader reads the quotation itself).
// What other documents say (earlier drafts and a proposal, none of them part of the notation) is
// kept apart, from OTHER_DOCUMENTS down.

/** The guide (I26), an earlier draft or a proposal, and DB for the database. @typedef {'I26' | 'D1' | 'D2' | 'D3' | 'A4' | 'R101' | 'R102' | 'J22' | 'DB'} Doc */
/** A place in a document: its key and the section, page or slide, or a line of the database. @typedef {[Doc, string]} Cite */
/**
 * One visual glyph form shown on an example card: its key in baishi-spec-glyphs.json (omitted when
 * no attested outline exists), its variant tag or label, its IDS body, an optional alternative
 * decomposition, an optional per-form simplification (`to`), or whether it is a muted reference
 * form (such as the default form shown beside a tagged variant so the difference is visible at a
 * glance).
 * @typedef {{ glyph?: string, tag?: string, body?: string, alt?: string, to?: string, reference?: boolean, char?: string, ucv?: { entry: string, position: number } }} Form
 */
/**
 * An example: the character it describes (none for a hypothetical one), the text as printed (rows
 * keep their TAB, groups their `;`), what the text becomes (`to`), a quotation about it, a short
 * label that needs no translation, an optional single attested `glyph` key, optional per-variant
 * `forms` (for multi-variant rows or reference-vs-variant contrasts), whether the card spans the
 * full grid width (`wide`), and where it is printed.
 * @typedef {{ char?: string, text: string, to?: string, quote?: string, label?: string, glyph?: string, forms?: Form[], wide?: boolean, at: Cite }} Example
 */

/** The guide: exact title, people as it credits them, the date it prints, the commit read and where it is published. */
export const GUIDE = /** @type {const} */ ({
  key: 'I26',
  title: '（白式）IDS 延展语法导论',
  people: ['白易 (zi.tools)', 'NightFurySL2001（夜煞之乐）', '-PT_AxH_RV-', 'Losketch'],
  version: '（2026-11-16 更新）',
  date: '2026-11-16',
  url: 'https://nightfurysl2001.github.io/bai-ids/',
  repository: 'https://github.com/NightFurySL2001/bai-ids',
  commit: '0ca5ed48f51821d4d54246196f1f5f38c9d6bd6a',
  licence: 'MIT',
})

/** Documents that are not the notation: a proposal and the drafts that came before the guide, newest
 * first. PDF and slide exports with no address of their own, dated from their metadata. */
export const OTHER_DOCUMENTS = /** @type {const} */ ([
  { key: 'R102', kind: 'proposal', title: '对于⿿这一IDS的补充', people: ['鹏鹏喵'], version: 'V1.0.2', date: '2024-07-02', extent: '5 slides' },
  { key: 'R101', kind: 'proposal', title: '对于⿿这一IDS的补充', people: ['鹏鹏喵'], version: 'V1.0.1', date: '2024-07-02', extent: '5 slides' },
  { key: 'A4', kind: 'draft', title: 'IDS の描述', people: ['ml-UFOp-W.S.-ahcvsh-qnb'], version: 'α-Ⅳ', date: '2024-07-02', extent: '5 pp.' },
  { key: 'D3', kind: 'draft', title: 'IDS说明文档', people: ['Losketch', 'Yi-Bai'], version: '3.0 beta', date: '2024-06-04', extent: '5 pp.' },
  { key: 'D2', kind: 'draft', title: 'IDS说明文档', people: ['Losketch'], version: '2.0 beta', date: '2024-04-13', extent: '5 pp.' },
  { key: 'D1', kind: 'draft', title: 'IDS说明文档', people: ['Losketch'], version: '1.0', date: '2024-04-04', extent: '3 pp.' },
  { key: 'J22', kind: 'draft', title: '解读特殊 IDS', people: [], version: '', date: '2022-12-18', extent: '3 pp.' },
])

/** The database the notation describes, at the commit the guide names and every row of ids_lv0,
 * ids_lv1 and ids_lv2 was read at. */
export const DATABASE = {
  url: 'https://github.com/yi-bai/ids',
  version: 'v18.0.67261101',
  commit: '2597437b928e8d530b7ae09cf53fe5ec7868569c',
  date: '2026-10-31',
  rows: '306,102',
  rejected: 4,
  tree: 'https://github.com/yi-bai/ids/tree/2597437b928e8d530b7ae09cf53fe5ec7868569c',
  abstractShape: 'https://zhuanlan.zhihu.com/p/480635382',
  // The guide's own run of its grammar over the three files, which reports the same four rows.
  verified: 'https://github.com/NightFurySL2001/bai-ids/blob/0ca5ed48f51821d4d54246196f1f5f38c9d6bd6a/check_out.txt',
}
/** A line of the database at the checked commit, as a citation. @param {0 | 1 | 2} level @param {number} line @returns {Cite} */
const row = (level, line) => ['DB', `lv${level} l.${line}`]

/** The rows of the checked commit outside the grammar: file, line, row as it stands. */
export const MALFORMED = /** @type {const} */ ([
  ['lv0', 7942, '洅\t⿰氵.再(.);⿰氵.⿱[:-1]一.冉K(J)', 'malformed.slice'],
  ['lv2', 6220, '晋\t⿱亚日(q3883,)', 'malformed.empty'],
  ['lv2', 7557, '殄\t⿰歹㐱(q397a2,)', 'malformed.empty'],
  ['lv2', 35419, '𡺎\t⿰山𫥎(,T)', 'malformed.empty'],
])

/** How the identifier kinds are told apart: a pattern each, the first match wins. The grammar
 * reads every one as a source letter or a lower-case tag. */
export const KINDS = /** @type {const} */ ([
  ['wildcard', '^\\.$'],
  ['source', '^[BGHJKMPQSTUV]$'],
  ['imaginary', '^qq(?:\\d{3}(?:z[a-z]|[a-z])?)+$'],
  ['ucv', '^[qpxy]\\d{3}(?:z[a-z]|[a-z])?(?:[1-9]|\\d{2})[xy]?$'],
  ['otherQ', '^q'],
  ['style', '^[0-9a-z.]+$'],
])

/** What the data has that the guide does not describe, each with where it shows. */
export const DATA_DIFFERENCES = /** @type {const} */ ([
  ['readme', [['DB', 'README']]],
  ['mixed', [row(0, 1310)]],
  ['lists', [row(0, 6031)]],
  ['lv2', [['I26', '§7.3']]],
  ['v', [['I26', '§4.3.3'], row(0, 6428)]],
])

/** The special sequences of the grammar. */
export const SPECIAL = /** @type {const} */ ([
  ['? Ideographic ?', 'Ideographic=Yes · PropList.txt 18.0.0'],
  ['? Radical ?', 'Radical=Yes · PropList.txt 18.0.0'],
  ['? CJK stroke ?', 'U+31C0..U+31E5'],
  ['? TAB ?', 'U+0009'],
])

/** What the grammar is written in, what it is read with, and whose layout its diagrams follow. */
export const TOOLS = /** @type {const} */ ([
  ['ISO/IEC 14977:1996, Information technology — Syntactic metalanguage — Extended BNF', ''],
  ['Unicode 18.0.0, PropList.txt (2026-08-07)', 'https://www.unicode.org/Public/18.0.0/ucd/PropList.txt'],
  ['Tab Atkins Jr., railroad-diagrams: the layout the diagrams follow', 'https://github.com/tabatkins/railroad-diagrams'],
])

/** Questions neither the guide nor the data settle. */
export const UNSETTLED = /** @type {const} */ (['zai', 'lv1', 'order'])

/** The guide's quotations, word for word. */
export const QUOTES = /** @type {Record<string, string>} */ ({
  rowGroups: '<IDS 定义组> 是默认拆分的方式，<IDS 另类定义组> (alternative) 则是拆分成比较不合理、不常见的部件。',
  rowYan: '一般应拆成「⿰氵艳」，而不是另类组的「⿰沣色」',
  rowVariants: '其中每段变体的 IDS 之间以 ; 分隔，且每段变体后面以括号 () 包裹「字形变体标识符」',
  tagUse: '如果要使用以上的变体，在其他使用「令」的汉字时，在「令」后面加上「字形变体标识符」即可。',
  nest: 'IDS 允许无限嵌套',
  u31ef: '注：U+31EF 较为特殊，因为它不在表意描述字符区段中，可能是由于该区段已无空位。',
  tagOmit: '注：如果汉字本身没有对应的字形变体，则可以省略字形变体标识符。',
  sourceG: '中国大陆（仅用于不符合「抽象构型」的「彐（U+5F50）」）',
  sourceQ: 'UTN #53，Unicode 13.0 以前的 UCS2003 栏 仅用于中日韩统一汉字——扩展B区 (CJK Unified Ideographs Extension B)',
  sourceAny: '取符合「抽象构型」的所有提交源，默认包括 G 源（除上述特例）',
  precedence: '如有多个源字形的 IDS 组合一致时，提交源「字形变体标识符」按 Unicode 码表内最先出现的源标识符为代表符。',
  ucv: '如果一个 IDS 组成的某些部件使用了某个 UCV 规则（下文称为「UCV」）下的其他变体，则该 IDS 组合的「字形变体标识符」就以 q （或p - 撇、x - 交叉、y - 其他）开头，后面接上该 UCV 的三位数序号（若序号的数字不足，用 0 补足），再接上该 UCV 中的某个字形的索引（若该 UCV 少过 10 个变体，索引为一位数从 1 开始，否则索引为二位数从 01 开始），最后还可以接上一个小写字母 x 或 y 表示其他异体。',
  imaginary: '当一个字通过类推/反推某个 UCV 的部件而创造出新的变体，则该 IDS 组合的「字形变体标识符」就以 qq开头，后面接上一个或多个 UCV 的三位数序号（若序号的数字不足，用 0 补足）。',
  qq2: '表示该 IDS 描述 ⿱攵.⺼. 的字中有一个部件（月）变成了 UCV #53 中的一个变体（⺼），还有一个部件（夂）变成了 UCV #194 中的一个变体（攵）。',
  alternate: '如果一个字存在笔画级别差异或部分部件的位置差异的变体，则该 IDS 组合的「字形变体标识符」就会以小写字母、点 . 及数字标示。',
  compose: '「字形变体标识符」的完整组合是对该字的全部部件，每个部件的笔画样式字符或使用的「字形变体标识符」，按部件顺序串联',
  feng: '表示「丰」的前两个部分不改变，而第三个部分中的一部分与撇相似的笔画变成撇',
  xun: '表示「勳」的某个部分（灬）往右移动一些',
  zi: '这表示即使子t（「孩」左）中间看起来是一个提#(T)，但是实际上是由「一」避让而来的一t',
  mirror: '表示镜像汉字或带有镜像部件的变体',
  similar: '表示该 IDS 组合出的字与原字相似（？）但不在 UCV 规则内',
  otherKinds: '以「j」「q」或数字开头表示其他种类的笔画差异，例：「(jss)」「(qy)」「(2t)」……',
  custom: '只要「字形变体标识符」的语法符合上述 EBNF 定义，并且能够清晰地区分某个汉字内不同字形变体的不同 IDS 组合，就是合法的「字形变体标识符」。',
  chainWhy: '有些字中有一些结构难以用一般 IDS 描述，或只能以自循环表述，如「乙」「亞」「凸」「一」……',
  chain: '「笔画链」里的笔画字符按顺序首尾相连，连贯地书写下去，所以称之为「链」。所有笔画忽略书写时的角度，只关注笔画的起点、终点和粗细变化。「笔画链」作为一个独体，当与其他部件穿插重叠时，仍然保持「笔画链」的笔画顺序和连接关系不变。',
  clockwise: '注：Q（圈）系曲线的书写方式依据顺时针。横竖不看角度，只看粗细方向。',
  modW: '只能在 SH 或 PH 之后使用，表示横的起始连接处更圆润，如：㇄ #(SHw)。注意不要将其与笔画字符「W」混淆。',
  modG: '表示这个笔画的末尾带钩，如：㇁ #(Wg)。只能在 H、S、P、N、W 之后使用；其也可与「w」连用，此时置于「w」之后，如：㇈ #(HSHwg)。',
  reverse: '用于单个笔画字符之前，表示这个笔画字符的组合方向方向要倒着写（指起点和终点反转）',
  cross: '用于单个笔画字符之后，在此控制字符之后要加上一个非负整数 n，表示这个笔画字符与其所在笔画链中的第 n 个笔画字符交叉（笔画字符的序号是从 0 开始数，而不是从 1 开始）。',
  break: '用于单个笔画字符之后，表示笔画强制中断，标准化时不可连接下一笔变成另一个笔画；但是下一笔起始点仍在当前笔画的末端位置。',
  nian: '表示「廿」的「凵」应当拆成三笔',
  closed: '用于单个笔画链的末尾，表示这个笔画链首尾相连',
  roles: '⿻字₁字₂中，字₁是纵向部件，字₂是横向部件。',
  slice: '垂直结构穿过水平结构的限制语法，在「穿过表达式」里为：前面一个正整数，后面一个（一般是负）整数，中间用冒号分隔。两个整数中可省略其中一者，但不能都省略。',
  sliceCount: '字₂ 的水平结构的序号从 1 开始、从上往下数；如果是负数，则从下往上数，-1 表示最后一个水平结构。',
  sliceTop: '若省略冒号 : 前面的数字（如 ⿻[:b]字₁字₂），则表示 字₁ 垂直结构的顶端往上凸出 字₂ 的第一个水平结构之上（垂直结构底端遵循 b）；其可视为触碰第 a = 0 个水平结构（即第一个水平结构再上面的一个「虚拟」横）。',
  sliceBottom: '若省略冒号 : 后面的数字（如 ⿻[a:]字₁字₂），则表示 字₁ 的底端往下凸出 字₂ 的最后一个水平结构之下（垂直结构顶端遵循 a）；其可视为触碰第 b = -0 个水平结构（即最后一个水平结构再下面的一个「虚拟」横）。',
  slicePython: '实际上横向部件计数的限制语法参考 Python 的切片语法；水平结构的计数方式从上到下，0 为第一横 … 而不是 §6.2〈重叠速成版：垂直结构穿过水平结构的限制语法〉说的「从 1 开始」。',
  sliceTouch: '⿻[a:b]字₁字₂（a、b 为正整数）表示 字₁ 里面的全部垂直结构的顶端在 字₂ 的第 a 个水平结构正下面接触（如「丅」形）；字₁ 垂直结构的底端在 字₂ 的第 b 个水平结构正上面接触（如「丄」形）。',
  sign: '冒号 : 前面的数字应当取尽量取正数 a，除非倒数时 -x 的 x 比正数时的 a 小（如数值 -1）；冒号 : 后面的数字应当尽量取负数 -y，除非正数时的值 b 比 y 小（如数值 1）。',
  you: '「⿻[:-1]丨日」只表示「由」，而不能表示「甲」「申」「甴」「曱」',
  cellSegments: '从上到下依序每段打 a、b、c...',
  cellDot: '否则如果字₁ 的第竖j 顶在字₂的第横i 上（丅形或丄形，可以不触碰），则矩阵横i竖j 元素为 .',
  cellUnder: '否则如果字₂ 的第横i 顶在字₁的第竖j 上（⺊形或┤形，可以不触碰），则矩阵横i竖j 元素为 _',
  segmentDefault: '其中⿻[a]字₁字₂ 和⿻[x]字₁字₂ 一样属于默认情况不写「穿过表达式」，⿻[a]㇉一应该简化成⿻㇉一。',
  qu: '如果没有变成 [:-1]，则错误地写成 [,,.]',
  yin: '「㇋」有两段竖（一个竖，一个撇），「乀」穿过 b 段（即撇）',
  zhao: '「弓z（最后一笔是竖折撇㇥）」有三段竖（𠃍的竖，㇥的竖，㇥的撇），「丶」穿过 c 段（即撇）',
  shen: '「冂」有一个竖、一个竖钩，「丿」在竖的下面（.）通过、然后穿过竖钩（x）',
  tiShape: '「〢」穿过第一横（扩展语法是空行）；「〢」的第一竖垂直触碰（丄形）下面的提（.）、然后下面的提从左边触碰（┤形）第二竖（_）',
  hookT: '𦉫T为右下角带勾',
  reverseMatrix: '[fr,on,t|ba,ck]，其中竖线 | 分隔了正向矩阵结构和反向矩阵结构。',
  hypothetical: '虚拟例子',
  curveCase: '因此这里方括号 [ ] 里面表示的不是矩阵穿过关系，而是单纯这个线段每个 Q 部分是在纵向部件的左边 l 还是右边 r。目前已知的特例只有这一个汉字。',
  index: '其中的 x 是一个正整数，表示字₂放置在字₁（即「日」）的第 x 个（从 0 数起）四方形全封闭空间内（中间从上到下，然后左边从上到下、最后右从上到下数）。如果 x 为 0（表示放在第一个全封闭空间）时，整个扩展语法 [0] 可以省略不写。',
  indexHalf: '比如「⿵⺵丶」的半包围 IDC 是「⿵」，包围方式是「上左右包围」（形似「冂」），因此能得知「⺵」共有 3 个「⿵」空间，从左到右分别是 [0]（默认省略）、[1] 和 [2]。',
  indexYi: '「㠯」共有两个全封闭空间，下划线的 IDS 将「一」填充在「㠯」上面的格内，外面的 [1] IDS则将「一」填充在「㠯」下面的格内。',
  subtract: '当使用减法「㇯」这个二元 IDS 符号时（如㇯字₁字₂），表示从字₁ 的结构中去掉字₂ 后剩下的部分；但是由于字₁ 里面可能有多个字₂部件，因此可以在「㇯」IDS 后面加上方括号 [ ] 来指定要去掉的字₂ 是第几个（从左到右、上到下数，起始为 0）。如果[ ] 里面的数字为 0，则表示去掉第一个字₂，此时 [0] 可以省略不写。',
  subtractSearch: '减法 IDS 并不会用在 IDS 数据库内，仅用于快速在字统网查询汉字。',
  subtractChain: '进行减法操作时，字₁ 里由「笔画链」组成的部件不可被计数、删除，因为删除「笔画链」的笔画一般会改变包围状态。例：㇯[1]日一是非法语句，因为「日」的外壳是「口」，而「口」是由「笔画链」所组成的（#(-丨𠃍-一z)），因此「口」里面的横不可被删除；但是㇯日一可得「口」。',
  sub0: '「王」去掉第0个「一」，即上面的「一」',
  sub1: '「王」去掉第1个「一」，即中间的「一」',
  sub2: '「王」去掉第2个「一」，即下面的「一」',
  sub3: '「品」去掉第0个「口」，即上面的「口」',
  sub4: '「品」去掉第1个「口」，即下左的「口」',
  unique: '为了保证每个 IDS 组合都可以反向唯一地映射到一个汉字，在 IDS 组合前面插入带有「抽象构型」的「唯一化分隔符」',
  uniqueRare: '「唯一化分隔符」不会添加在较常用字，而是添加在较生僻字；',
  uniqueStroke: '和中日韩笔画区段 (CJK Strokes) 有一样笔画链的汉字会添加「唯一化分隔符」。',
  uniqueQuestion: '与同字其他提交源有较大差异、且与另外码位撞形的 IDS 条目也会添加「唯一化分隔符」。此时在「与同字其他提交源有较大差异」的汉字前面加上问号（和一位数字）即 {?，数字?，汉字，}，如：{?字}、{?0字}，数字按出现重复的次数增加；',
  uniqueSource: '如果该 IDS 组合是针对特定提交源的，可在汉字后面加上提交源的「字形变体标识符」 … 如：{字T} 代表 T 源。',
  yue: '「{曰}⿴囗一」只表示「曰」，而不能表示「日」',
  oral: '这部分目前没有公开资料可参考，仅由字统网站长白易口头说明。',
  abstract: '「抽象构型」(abstract shape) 指的是汉字可以拥有不同的变体部件，但仍可辨识和区分汉字的意义。',
  replace: '其用法为「🔄︎字₁字₂字₃」表示字₁里面的字₂部件换成字₃部件 … 此 IDS 字符主要用于快速在字统网里面查询汉字，但不在字统网 IDS 数据库内使用。',
  lv0: 'ids_lv0.txt：笔画级区分',
  lv1: 'ids_lv1.txt：合并笔画级区分',
  lv2: 'ids_lv2.txt：依据 Unicode UCV 表合并部件',
  lv1Merge: '在 ids_lv1（即字统网使用的）中，所有可认同的笔画级别差异（即相同位置的相似笔画，如在同一位置上的「丶」和「乀」）都将被合并，并去掉部件的「字形变体标识符」。',
  lv2Merge: 'IDS 组合内的汉字部件将尽量替换成靠近 G 源常用字的形态；UCV 列表中被认为「必须归一」的部件也会被合并。',
  ebnf: '由 @NightFurySL2001 整理且仅供参考，并非正式定义',
  verify: '你可以对「白式 IDS 数据库」内的 .txt 文件运行该 Python 脚本文件 以验证该 EBNF 定义是否对应「白式 IDS 数据库」的条目。',
})

/** What the other documents say, word for word: the ⿿ proposal and the drafts. */
export const OTHER_QUOTES = /** @type {Record<string, string>} */ ({
  omit180: '（[180]可省略）',
  omitPm180: '（[±180]可省略）',
  tagAfter: '在一个汉字后的地区标识符表示这个汉字使用某个地区的字形。',
  tagEnd: '在一个IDS末尾的括号中的地区标识符表示这个IDS适用于某个地区的字形。',
  curveStart: '曲线起始点： - 非首尾相连曲线从顺时针端点开始 - 首尾相连曲线从最左下角曲线片段开始',
  curveReverse: '连接符对曲线也适用。',
  oldLetters: 'B = 扁 D = 点 G = 钩 H = 横 N = 捺 P = 撇 Q = 圈 S = 竖 T = 提 W = 弯 X = 斜 Z = 折。（不区分大小写）',
  oldConnector: '连接符用负号-表示，前面有连接符的笔画要倒着写。',
  firstLetters: 'H 代表横，S 代表竖，P 代表撇，w 代表弯，g 代表钩。',
  firstJoins: '将每个连接符放在每对汉字之间，然后根据序列绘出形状，其中>代表首尾相连，^代表首首相连，v 代表尾尾相连。',
  firstCurves: '如果曲线相交，则由 0 开始给每个曲线标上数字，然后在曲线 IDS 末端加入相交曲线对的编码。',
  oldMarks: '⿻[s]字¹字² s为特殊重叠标记(superimpose) 当字²超过一画时，格式为 ⿻[s,s,s…]字¹字² 中括号中共有(字²的笔画数-1)个逗号，第n个s对字²的第n画作用。',
})

/** The operators as of Unicode 16.0.0: character, code point, zi.tools shortcut, meaning (a
 * quotation key under `idc.`), and its example. */
export const OPERATORS = /** @type {const} */ ([
  ['⿰', '2FF0', 'LR', '左右结构', '从', '⿰人人'],
  ['⿱', '2FF1', 'UD', '上下结构', '仌', '⿱人人'],
  ['⿲', '2FF2', 'LL', '左中右结构', '衍', '⿲彳氵亍'],
  ['⿳', '2FF3', 'UU', '上中下结构', '佥', '⿳亼𭕄一'],
  ['⿴', '2FF4', 'OC', '全包围结构', '囚', '⿴囗人'],
  ['⿵', '2FF5', 'OD', '上包围结构', '冈', '⿵冂乂'],
  ['⿶', '2FF6', 'OU', '下包围结构', '凶', '⿶凵乂'],
  ['⿷', '2FF7', 'OR', '左包围结构', '区', '⿷匚乂'],
  ['⿸', '2FF8', 'RD', '左上包围结构', '仄', '⿸厂人'],
  ['⿹', '2FF9', 'LD', '右上包围结构', '寸', '⿹𬺰丶'],
  ['⿺', '2FFA', 'RU', '左下包围结构', '亾', '⿺𠃊人'],
  ['⿻', '2FFB', 'XX', '重叠', '巫', '⿻工从'],
  ['⿼', '2FFC', 'OL', '右包围结构', '㕚', '⿼叉丶'],
  ['⿽', '2FFD', 'LU', '右下包围结构', '斗', '⿽十⺀'],
  ['⿾', '2FFE', 'MI', '水平镜像', '𱤻', '⿾止'],
  ['⿿', '2FFF', 'RO', '旋转', '𠄔', '⿿予'],
  ['㇯', '31EF', 'SU', '删减', '丅', '㇯下丶'],
])

/** The ⿿ angle proposal of R101 and R102, which is no part of the notation: each form with the
 * slide of each deck that shows it. */
export const ANGLES = /** @type {const} */ ([
  ['⿿[90]足', 'slide 2', 'slide 2'],
  ['⿿[-90]足', 'slide 3', 'slide 3'],
  ['⿿[180]足', 'slide 4', ''],
  ['⿿[±180]足', '', 'slide 4'],
  ['⿱艹⿿[45d]⿻屮⿱⿻⿰コ匚一冂', 'slide 5', ''],
  ['⿱艹⿿[±45]⿻屮⿱⿻⿰コ匚一冂', '', 'slide 5'],
])

/** Source letters: identifier, IRG source, region as the guide prints it (or a quotation key). */
export const SOURCES = /** @type {const} */ ([
  ['B', 'UK', '英国'], ['G', 'G', '@sourceG'], ['H', 'H', '香港'], ['J', 'J', '日本'], ['K', 'K', '韩国'], ['M', 'M', '澳门'],
  ['P', 'KP', '朝鲜'], ['S', 'SAT', '大藏经文本数据库委员会'], ['T', 'T', '台湾'], ['U', 'UTC', '美国及 Unicode 技术委员会'],
  ['V', 'V', '越南'], ['Q', 'UCS2003', '@sourceQ'], ['.', '通配符', '@sourceAny'],
])

/** Stroke-style and position letters of a variant identifier, with the guide's gloss. */
export const STYLE_LETTERS = /** @type {const} */ ([
  ['.', '占位符、默认字形'], ['a b c', '未知'], ['d', '点'], ['g', '钩'], ['h', '横'], ['n', '捺'], ['p', '撇'], ['s', '竖'], ['t', '提'],
  ['w', '弯'], ['x', '更多交叉（x 为 cross 的缩写）'], ['y', '更少交叉'], ['z', '折'], ['u', '上（up）'], ['l', '左（left）'], ['r', '右（right）'],
])

/** Stroke letters of a chain: letter, the stroke it stands for, the guide's gloss. */
export const STROKE_LETTERS = /** @type {const} */ ([
  ['H', '一', '横（等粗）'], ['S', '丨', '竖（等粗）'], ['P', '丿', '撇（上粗下细）'], ['N', '乀', '捺（上细下粗）'], ['D', '丶', '点'], ['T', '㇀', '提（左粗右细）'], ['J', '㇝', '提捺'],
  ['Z', '←', '左（仅用于㇘ #(SZ) 兼容《康熙字典》形）'], ['Wg', '㇁', '弯钩（W不会单独出现，必须是 Wg）'],
  ['Qa', '◝', ''], ['Qb', '◞', ''], ['Qc', '◟', ''], ['Qd', '◜', ''],
])

/** The guide's table of compound strokes and some Han characters as chains (§5.3). */
export const COMPOUNDS = /** @type {const} */ ([
  ['⺄', '#(HNg)'], ['㇁', '#(Wg)'], ['㇂', '#(Ng)'], ['㇄', '#(SHw)'], ['㇅', '#(HSH)'], ['㇇', '#(HP)'], ['㇈', '#(HSHwg)'],
  ['㇉', '#(SHSg)'], ['㇊', '#(HST)'], ['㇋', '#(HSHP)'], ['㇌', '#(HPWg)'], ['㇍', '#(HSHw)'], ['㇎', '#(HSHS)'], ['乁', '#(HN)'],
  ['㇝', '#(J)'], ['㇢', '#(Pg)'], ['乙', '#(HPHwg)'], ['乚', '#(SHwg)'], ['乛', '#(Hg)'], ['亅', '#(Sg)'], ['𠃊', '#(SH)'],
  ['𠃋', '#(PH)'], ['𠃌', '#(HSg)'], ['𠃍', '#(HS)'], ['𠃑', '#(SHS)'], ['𠄌', '#(ST)'], ['𠄎', '#(HSHSg)'], ['〇', '#(◟◜◝◞z)'],
  ['𠂆', '#(丿丿)'], ['匚', '#(-一𠃊)'], ['𠤬', '#(-𠃊㇈)'], ['𱍫', '#(-𠃊㇎z)'], ['弓', '#(𠃍-一㇉)'], ['己', '#(𠃍-一乚)'], ['巳', '#(一-𠃍乚)'],
])

/** The quick slice for ⿻丨日: character, the written form, the equivalent forms the guide calls wrong. */
export const SLICES = /** @type {const} */ ([
  ['甴', '⿻[:-2]丨日', ['⿻[:2]丨日']],
  ['由', '⿻[:-1]丨日', ['⿻[:3]丨日']],
  ['申', '⿻丨日', ['⿻[:]丨日', '⿻[0:-0]丨日']],
  ['甲', '⿻[1:]丨日', ['⿻[-3:]丨日']],
  ['曱', '⿻[2:]丨日', ['⿻[-2:]丨日']],
  ['田', '⿴囗十', ['⿻[1:-1]丨日', '⿻[1:3]丨日', '⿻[-3:-1]丨日', '⿻[-3:3]丨日']],
])

/** The cells of a crossing matrix: the cell, and the quotation or message that says what it is. */
export const CELLS = /** @type {const} */ ([
  ['x', 'cell.x'], ['a b c …', '@cellSegments'], ['.', '@cellDot'], ['_', '@cellUnder'], ['l', 'cell.l'], ['r', 'cell.r'],
])

/** Subtraction (§6.7): the text, the character, the quotation that says which part goes. */
export const SUBTRACTIONS = /** @type {const} */ ([
  ['㇯王一', '土', 'sub0'], ['㇯[1]王一', '工', 'sub1'], ['㇯[2]王一', '干', 'sub2'], ['㇯品口', '吅', 'sub3'], ['㇯[1]品口', '吕', 'sub4'],
])

/** The examples of the notation, from the guide and the database. @type {Record<string, Example[]>} */
export const EXAMPLES = {
  row: [
    {
      char: '十', text: '⿻丨一.(.);⿻丨一t(.t)', at: row(0, 1346),
      forms: [
        { glyph: '十.', tag: '.', body: '⿻丨一.' },
        { glyph: '十.t', tag: '.t', body: '⿻丨一t' },
      ],
    },
    { char: '三', text: '⿱一.二.\t⿱二.一.', glyph: '三', at: row(0, 10) },
    { char: '滟', text: '⿰氵.艳.\t⿰沣.色.', glyph: '滟', quote: 'rowYan', at: ['I26', '§3.1'] },
    {
      char: '令',
      text: '⿱亽龴.(.);⿱亼.龴.(H);⿱人.𪜁(J);⿳人d丶.龴.(d..);⿱亼d龴.(dh.);⿱人d𪜁(dhs);⿱亽卩(hdx);⿱亼.卩(hsx)\t⿱亼.𰆊(J);⿱亼d𰆊(dhs)',
      wide: true,
      at: ['I26', '§4.2'],
      forms: [
        { glyph: '令.', tag: '.', body: '⿱亽龴.' },
        { glyph: '令H', tag: 'H', body: '⿱亼.龴.' },
        { glyph: '令J', tag: 'J', body: '⿱人.𪜁', alt: '⿱亼.𰆊' },
        { glyph: '令d..', tag: 'd..', body: '⿳人d丶.龴.' },
        { glyph: '令dh.', tag: 'dh.', body: '⿱亼d龴.' },
        { glyph: '令dhs', tag: 'dhs', body: '⿱人d𪜁', alt: '⿱亼d𰆊' },
        { tag: 'hdx', body: '⿱亽卩' },
        { tag: 'hsx', body: '⿱亼.卩' },
      ],
    },
  ],
  tags: [
    {
      char: '公', text: '⿱八T厶.(T)', at: row(0, 877),
      forms: [
        { glyph: '公.', tag: '.', reference: true },
        { glyph: '公T', tag: 'T' },
      ],
    },
    {
      char: '惠', text: '⿱叀y2002心', glyph: '惠', at: row(0, 4833),
      forms: [
        { glyph: '叀.', char: '叀', tag: '.', reference: true },
        { glyph: '叀y2002', char: '叀', tag: 'y2002', ucv: { entry: '200', position: 2 } },
      ],
    },
    {
      char: '冷', text: '⿰冫令.(.);⿰冫令H(H);⿰冫令J(J)', at: ['I26', '§4.2'],
      forms: [
        { glyph: '冷.', tag: '.', body: '⿰冫令.' },
        { glyph: '冷H', tag: 'H', body: '⿰冫令H' },
        { glyph: '冷J', tag: 'J', body: '⿰冫令J' },
      ],
    },
    {
      char: '刢', text: '⿰令d..刂(.);⿰令dhs刂(J);⿰令dh.刂(T)', at: ['I26', '§4.2'],
      forms: [
        { glyph: '刢.', tag: '.', body: '⿰令d..刂' },
        { glyph: '刢J', tag: 'J', body: '⿰令dhs刂' },
        { glyph: '刢T', tag: 'T', body: '⿰令dh.刂' },
      ],
    },
  ],
  lists: [
    {
      char: '斎', text: '⿵斉J小.(J,J)', at: row(0, 6031),
      forms: [
        { glyph: '斎.', tag: '.', reference: true },
        { glyph: '斎J', tag: 'J,J' },
      ],
    },
    {
      char: '七', text: '⿻乚.一.(.);⿻乚w一.(T);⿻乚t一.(t)', at: row(0, 4),
      forms: [
        { glyph: '七.', tag: '.', body: '⿻乚.一.' },
        { glyph: '七T', tag: 'T', body: '⿻乚w一.' },
        { glyph: '七t', tag: 't', body: '⿻乚t一.' },
      ],
    },
    { char: '丁', text: '⿱一.亅', glyph: '丁', at: row(0, 2) },
  ],
  katakana: [
    { char: '已', text: '⿹コ乚.(.)', glyph: '已', at: row(0, 4083) },
    { char: '归', text: '⿰リ𫜹(.)', glyph: '归', at: row(0, 4435) },
    { char: '丑', text: '⿼ユ.十.(.)', glyph: '丑', at: row(0, 18) },
    { char: '久', text: '⿸丿スn(.)', glyph: '久', at: row(0, 70) },
  ],
  precedence: [
    {
      char: '伨', text: '⿰亻匀.(.);⿰亻勻(H)', at: ['I26', '§4.3.1'],
      forms: [
        { glyph: '伨.', tag: '.', body: '⿰亻匀.' },
        { glyph: '伨H', tag: 'H', body: '⿰亻勻' },
      ],
    },
    {
      char: '𣂀', text: '⿰⿸厂.兆t斗(.);⿰𠩓斗(Q)', at: ['I26', '§4.3.1'],
      forms: [
        { glyph: '𣂀.', tag: '.', body: '⿰⿸厂.兆t斗' },
        { glyph: '𣂀Q', tag: 'Q', body: '⿰𠩓斗' },
      ],
    },
    {
      char: '睹', text: '⿰目者.(.);⿰目者K(J)', to: '⿰目者(.);⿰目者(J)', at: ['I26', '§4.3.1'],
      forms: [
        { glyph: '睹.', tag: '.', body: '⿰目者.' },
        { glyph: '睹J', tag: 'J', body: '⿰目者K' },
      ],
    },
  ],
  ucv: [
    {
      char: '口', text: '⿴〢二.(q3162)', label: 'UCV 316 · 2', at: row(0, 1508),
      forms: [
        { glyph: '口.', tag: '.', reference: true },
        { glyph: '口q3162', tag: 'q3162' },
      ],
    },
    {
      char: '烕', text: '⿵戌大.(q008a2)', label: 'UCV 008a · 2', at: ['I26', '§4.3.2'],
      forms: [
        { glyph: '烕.', tag: '.', reference: true },
        { glyph: '烕q008a2', tag: 'q008a2' },
      ],
    },
    {
      char: '龰', text: '⿱丷乀.(q3932)', label: 'UCV 393 · 2', at: ['I26', '§4.3.2'],
      forms: [
        { glyph: '龰.', tag: '.', reference: true },
        { glyph: '龰q3932', tag: 'q3932' },
      ],
    },
    {
      char: '滿', text: '⿰氵.⿱艹.⿵冂.干.(q454a17)', label: 'UCV 454a · 17', at: ['I26', '§4.3.2'],
      forms: [
        { glyph: '滿.', tag: '.', reference: true },
        { glyph: '滿q454a17', tag: 'q454a17' },
      ],
    },
  ],
  imaginary: [
    {
      char: '父', text: '⿱八d乂.(.); ⿱儿.乂.(qq222)', label: 'UCV 222', at: ['I26', '§4.3.2'],
      forms: [
        { glyph: '父.', tag: '.', body: '⿱八d乂.' },
        { glyph: '父qq222', tag: 'qq222', body: '⿱儿.乂.' },
      ],
    },
    {
      char: '𡕙', text: '⿱夂.月.(.); ⿱攵.⺼.(qq053194)', quote: 'qq2', label: 'UCV 053 · 194', at: ['I26', '§4.3.2'],
      forms: [
        { glyph: '𡕙.', tag: '.', body: '⿱夂.月.' },
        { glyph: '𡕙qq053194', tag: 'qq053194', body: '⿱攵.⺼.' },
      ],
    },
    {
      char: '卮', text: '⿸𠂋㔾.(.);⿸𠂋巳.(qq123)', label: 'UCV 123', at: row(0, 1391),
      forms: [
        { glyph: '卮.', tag: '.', body: '⿸𠂋㔾.' },
        { glyph: '卮qq123', tag: 'qq123', body: '⿸𠂋巳.' },
      ],
    },
  ],
  alternate: [
    {
      char: '丰', text: '⿻丿三(..p)', quote: 'feng', at: ['I26', '§4.3.3'],
      forms: [
        { glyph: '丰.', tag: '.', reference: true },
        { glyph: '丰..p', tag: '..p' },
      ],
    },
    { char: '邦', text: '⿰丰..p阝(.)', glyph: '邦.', at: ['I26', '§4.3.3'] },
    {
      char: '勳', text: '⿺熏力(r)', quote: 'xun', at: ['I26', '§4.3.3'],
      forms: [
        { glyph: '勳.', tag: '.', reference: true },
        { glyph: '勳r', tag: 'r' },
      ],
    },
    {
      char: '刍', text: '⿱⺈⺕(x)', at: ['I26', '§4.3.3'],
      forms: [
        { glyph: '刍.', tag: '.', reference: true },
        { glyph: '刍x', tag: 'x' },
      ],
    },
    {
      char: '务', text: '⿱攵力(y)', at: ['I26', '§4.3.3'],
      forms: [
        { glyph: '务.', tag: '.', reference: true },
        { glyph: '务y', tag: 'y' },
      ],
    },
    { char: '子', text: '⿻了.一.(.)', glyph: '子.', at: ['I26', '§4.3.3'] },
    { char: '子', text: '⿻了.一t(t)', glyph: '子t', quote: 'zi', at: ['I26', '§4.3.3'] },
    { char: '孑', text: '⿻了.㇀', glyph: '孑', at: ['I26', '§4.3.3'] },
  ],
  other: [
    { char: '𱤻', text: '⿾止.(m)', glyph: '𱤻m', quote: 'mirror', at: ['I26', '§4.3.4'] },
    { char: '𡴧', text: '⿳屮.⿰止.𱤻m⿱人.亡.(m)', glyph: '𡴧m', at: ['I26', '§4.3.4'] },
    { char: '𠪧', text: '⿰𠂬果.(e)', quote: 'similar', at: ['I26', '§4.3.4'] },
    {
      char: '𠁁', text: '⿱⿰⿸#(丿𠃊)#(丨-一𠃑)#(一-𠃍𠃑-一丨)一.(y2)', quote: 'otherKinds', at: ['I26', '§4.3.4'],
      forms: [
        { glyph: '𠁁.', tag: '.', reference: true },
        { glyph: '𠁁y2', tag: 'y2' },
      ],
    },
  ],
  modifiers: [
    { char: '㇄', text: '#(SHw)', glyph: '㇄', quote: 'modW', at: ['I26', '§5.3'] },
    { char: '㇈', text: '#(HSHwg)', glyph: '㇈', quote: 'modG', at: ['I26', '§5.3'] },
  ],
  reverse: [
    { char: '人', text: '#(-丿乀)(.)', glyph: '人', at: row(0, 187) },
    { char: '𠃎', text: '#(一-丨)', glyph: '𠃎', at: ['I26', '§5.3'] },
    { char: '匚', text: '#(-一𠃊)', glyph: '匚', at: ['I26', '§5.3'] },
    { char: '巳', text: '#(一-𠃍乚)', glyph: '巳', at: ['I26', '§5.3'] },
    { char: '乌', text: '⿱丿⿹#(-𠃌㇉)一.(.)', glyph: '乌', at: ['I26', '§5.3'] },
  ],
  cross: [
    { char: '母', text: '⿻⿴#(-𠃌𠃊x0)⺀一', glyph: '母', at: ['I26', '§5.3'] },
    { char: '又', text: '#(-乀x1㇇)', glyph: '又', at: ['I26', '§5.3'] },
    { char: '𡆢', text: '⿴囗#(◞x3◟◜◝-◟)', glyph: '𡆢', at: ['I26', '§5.3'] },
    { char: '𠇇', text: '⿰亻⿺⿻#(丨x3◞◟◜)二丶', glyph: '𠇇', at: ['I26', '§5.3'] },
    { char: '𠍋', text: '⿲亻⿱丶#(㇇◝x4◞◟◜)𧈧', glyph: '𠍋', at: ['I26', '§5.3'] },
  ],
  break: [
    {
      char: '凵', text: '#(丨b一-丨)(y)', at: ['I26', '§5.3'],
      forms: [
        { glyph: '凵.', tag: '.', reference: true },
        { glyph: '凵y', tag: 'y' },
      ],
    },
    { char: '廿', text: '⿻凵y一.', glyph: '廿', quote: 'nian', at: ['I26', '§5.3'] },
    {
      char: '凹', text: '#(一-𠃍丨b一-𠃍丨b一)(q4382)', at: row(0, 1018),
      forms: [
        { glyph: '凹.', tag: '.', reference: true },
        { glyph: '凹q4382', tag: 'q4382' },
      ],
    },
  ],
  closed: [
    { char: '口', text: '#(-丨𠃍-一z)', glyph: '口.', at: ['I26', '§5.3'] },
    { char: '〇', text: '#(◟◜◝◞z)', glyph: '〇', at: ['I26', '§5.3'] },
    { char: '𱍫', text: '#(-𠃊㇎z)', glyph: '𱍫', at: ['I26', '§5.3'] },
  ],
  segments: [
    {
      char: '𠀁', text: '⿻[a]㇉一', to: '⿻㇉一', quote: 'segmentDefault', at: ['I26', '§6.3'],
      forms: [
        { glyph: '𠀁', char: '𠀁', body: '⿻[a]㇉一', to: '⿻㇉一' },
        { glyph: '⿻[b]㇉一', char: '⿻[b]㇉一', body: '⿻[b]㇉一' },
      ],
    },
  ],
  matrix: [
    { char: '及', text: '⿻[l,b]㇋人.(.)', glyph: '及.', at: row(0, 1483) },
    { char: '包', text: '⿻[l,l,.]勹巳.(.)', glyph: '包.', at: row(0, 1286) },
    { char: '与', text: '⿺⿻[b]㇉一.一.(J)', glyph: '与J', at: row(0, 15) },
    { char: '廴', text: '⿻[b]㇋乀', glyph: '廴', quote: 'yin', at: ['I26', '§6.3'] },
    { char: '𤓷', text: '⿺爪⿻[c]弓z丶', glyph: '𤓷', quote: 'zhao', at: ['I26', '§6.3'] },
    { char: '𦫵', text: '⿻[bx]⿰𠃑丨一', glyph: '𦫵', at: ['I26', '§6.3'] },
    { char: '身', text: '⿱丿⿹⿴⿻[.x]冂丿二一', glyph: '身', quote: 'shen', at: ['I26', '§6.3'] },
    { char: '𠥻', text: '⿻[,._]〢二t', glyph: '𠥻', quote: 'tiShape', at: ['I26', '§6.3'] },
    { char: '𠂀', text: '⿴⿻[,.x]〢二丶', glyph: '𠂀', at: ['I26', '§6.3'] },
    { char: '𠕋', text: '⿻[_xx_,]𦉫T二', glyph: '𠕋', quote: 'hookT', at: ['I26', '§6.3'] },
  ],
  reverseMatrix: [
    { char: '𫠣', text: '⿻[1:|b]𠃌⿱⿻𠃊.一.八d', glyph: '𫠣', at: ['I26', '§6.4'] },
    { text: '⿻[xl,.l|r.,rx]口口', glyph: '⿻[xl,.l|r.,rx]口口', quote: 'hypothetical', at: ['I26', '§6.4'] },
  ],
  curveCase: [
    { char: '𢀓', text: '⿻[r,r,l,l]工.#(◝◞-◜-◟)', glyph: '𢀓', quote: 'curveCase', at: ['I26', '§6.5'] },
  ],
  index: [
    { char: '𫡆', text: '⿴[1]⿴㠯一一', glyph: '𫡆', quote: 'indexYi', at: ['I26', '§6.6'] },
    { char: '𢧟', text: '⿹戈⿴[2]⿴[1]⿴⿻[1:]丨#(𠃍-一𠃑-一丿)丶丶丶', glyph: '𢧟', at: ['I26', '§6.6'] },
    {
      char: '𦥮', text: '⿱⿷[1]#(-一𠃑-一𠃊)一.⿼[1]#(一-𠃑一-𠃍)一.(T)', at: row(0, 54587),
      forms: [
        { glyph: '𦥮.', tag: '.', reference: true },
        { glyph: '𦥮T', tag: 'T' },
      ],
    },
  ],
  replace: [
    { char: '嬴', text: '🔄赢贝女', glyph: '嬴', at: ['I26', '§3.2'] },
    { char: '輿', text: '🔄興同車', glyph: '輿', at: ['I26', '§3.2'] },
  ],
  merge: [
    {
      char: '𡕆', text: '⿰壴t咨.(.);⿰壴t咨J(J);⿰壴t咨T(T)', to: '⿰壴咨(.,T,J)', at: ['I26', '§7.2'],
      forms: [
        { glyph: '𡕆.', tag: '.', body: '⿰壴t咨.' },
        { glyph: '𡕆J', tag: 'J', body: '⿰壴t咨J' },
        { glyph: '𡕆T', tag: 'T', body: '⿰壴t咨T' },
      ],
    },
  ],
  levels: [
    {
      char: '伔', text: '⿰亻冗(.);⿰亻⿱冖儿(J)', to: '⿰亻冗(.,J)', label: 'UCV 119', at: ['I26', '§7.3'],
      forms: [
        { glyph: '伔.', tag: '.', body: '⿰亻冗' },
        { glyph: '伔J', tag: 'J', body: '⿰亻⿱冖儿' },
      ],
    },
  ],
}

/** Each column is a separate code point. The first entry in each column shares
 * its IDS body with the entry opposite it, apart from the uniqueness prefix.
 * Entries and line numbers are from DATABASE.commit, ids_lv0.txt.
 * @typedef {{char: string, line: number, entries: {glyph: string, text: string, reference?: {label: string, url: string}}[]}} PrefixColumn
 * @type {{columns: [PrefixColumn, PrefixColumn], quote?: string}[]}
 */
export const PREFIX_COMPARISONS = [
  { columns: [
    { char: '径', line: 4485, entries: [
      { glyph: '径T', text: '{?0径}⿰彳圣(T)' }, { glyph: '径.', text: '⿰彳𢀖.(.)' },
    ] },
    { char: '𮱻', line: 97217, entries: [{ glyph: '𮱻', text: '⿰彳圣' }] },
  ] },
  { columns: [
    { char: '曰', line: 6385, entries: [{ glyph: '曰', text: '{曰}⿴囗.一.' }] },
    { char: '日', line: 6118, entries: [{ glyph: '日', text: '⿴囗.一.' }] },
  ], quote: 'yue' },
  { columns: [
    { char: '士', line: 2796, entries: [{ glyph: '士', text: '{士}⿱十.一.(.)' }] },
    { char: '土', line: 2336, entries: [{ glyph: '土', text: '⿱十.一.(.)' }] },
  ] },
  { columns: [
    { char: '一', line: 1, entries: [
      { glyph: '一t', text: '{一}#(T)(t)' }, { glyph: '一.', text: '#(H)(.)' },
    ] },
    { char: '㇀', line: 102018, entries: [{ glyph: '一t', text: '#(T)' }] },
  ] },
  { columns: [
    { char: '叱', line: 1522, entries: [
      { glyph: '叱V', text: '{?叱}⿰口.七.(V)', reference: { label: 'U+20B9F', url: 'https://github.com/adobe-fonts/source-han-sans/blob/2.005R/Resources/AI0-SourceHanSans' } }, { glyph: '叱.', text: '⿰口.𠤎.(.)' },
    ] },
    { char: '𠮟', line: 30572, entries: [{ glyph: '𠮟', text: '⿰口.七.' }] },
  ] },
  { columns: [
    { char: '𡮂', line: 34639, entries: [
      { glyph: '𡮂J', text: '{𡮂J}⿱小.𤽄V(J)' }, { glyph: '𡮂T', text: '{𡮂T}⿱小s𤽄V(T)' },
    ] },
    { char: '𡭽', line: 34634, entries: [
      { glyph: '𡭽J', text: '⿱小.𤽄V(J)' }, { glyph: '𡭽.', text: '⿱小s𤽄V(.)' },
    ] },
  ], quote: 'oral' },
  { columns: [
    { char: '暅', line: 6278, entries: [
      { glyph: '𣈶T', text: '{?0暅}⿰日恆(P)', reference: { label: 'KP1-49AC', url: 'https://www.unicode.org/charts/PDF/U4E00.pdf#page=161' } }, { glyph: '暅.', text: '⿰日恒(.)' },
    ] },
    { char: '𣈶', line: 40451, entries: [{ glyph: '𣈶T', text: '⿰日恆(T)' }] },
  ] },
]

/** The crossing matrix of 曲 as ⿻〢日, step by step (§6.3). */
export const QU_STEPS = ['[(x,x), (x,x), (.,.)]', '["", "", (.,.)]', '["", "", "."]', '[:-1]']

/** Examples of the other documents, in notation the guide does not use: shown as printed.
 * @type {Record<string, Example[]>} */
export const OTHER_EXAMPLES = {
  firstChains: [
    { char: '臼', text: '⿶#(丿丨一𠃍>>v)⿰一一', at: ['J22', 'p.1'] },
    { char: '凸', text: '#(丨㇎一丨一^v>^,0v4)', at: ['J22', 'p.1'] },
    { char: '𠍋', text: '⿲亻⿱丶#(HPQaQbQcQd0205)𧈧', at: ['J22', 'pp.1–2'] },
  ],
  oldMarks: [
    { char: '包', text: '⿻[l,l,.]勹巳', at: ['D1', 'p.3'] },
    { char: '帆', text: '⿰巾⿻[_x]几一', at: ['D1', 'p.3'] },
    { char: '𠆥', text: '⿻[_b]人丿', at: ['D1', 'p.3'] },
    { char: '𠕋', text: '⿻[_xx_,]冊一', at: ['D1', 'p.3'] },
  ],
}

/** Where the other documents part from the guide, each with where it shows. */
export const CHANGES = /** @type {const} */ ([
  ['rotate', [['D1', 'p.1'], ['R101', 'slide 4'], ['I26', '§2.1']]],
  ['letters', [['D1', 'p.1'], ['I26', '§5.3']]],
  ['w', [['J22', 'p.1'], ['D1', 'p.1'], ['I26', '§5.3']]],
  ['joins', [['J22', 'p.1'], ['D1', 'p.2'], ['I26', '§5.3']]],
  ['curves', [['J22', 'pp.1–2'], ['D1', 'p.2'], ['I26', '§5.3']]],
  ['sources', [['D1', 'p.1'], ['A4', 'p.3'], ['I26', '§4.3.1']]],
  ['dot', [['D2', 'p.4'], ['I26', '§6.3']]],
  ['commas', [['D2', 'p.4'], ['I26', '§6.3']]],
])

/** The guide's grammar, as printed (§9). */
export const EBNF = `/* zi.tools IDS Database EBNF syntax */

IDS_Definition_Row ::= Ideograph_Char TAB IDS_Locale_Definition (TAB IDS_Alternative_Definition)?

/* 单个部件描述 */

IDS_Locale_Definition ::= IDS_Sequence | IDS_Locale_Sequence (";" IDS_Locale_Sequence)*
IDS_Alternative_Definition ::= (IDS_Sequence | IDS_Locale_Sequence)  (";" (IDS_Sequence | IDS_Locale_Sequence))*
IDS_Locale_Sequence ::= Unique_Sequence_Separator? IDS_Sequence Variant_Identifier_Definition?

IDS_Sequence ::= Stroke_Chain
  | IDS_UnaryOperator IDS_Component
  | IDS_BinaryOperator IDS_Component IDS_Component
  | IDS_BinaryOverlapOperator Overlap_Modifier IDS_Component IDS_Component
  | IDS_BinaryAmbiguousOperator Index_Modifier IDS_Component IDS_Component
  | IDS_TrinaryOperator IDS_Component IDS_Component IDS_Component

IDS_Component ::= IDS_Sequence | Stroke_Chain | Ideo_with_Variant_ID | Curves | [リ〢〣コ] 

/* 4. 汉字的字形变体 */
Ideo_with_Variant_ID ::= Ideograph_Char_with_Variant Variant_Identifier?
Variant_Identifier_Definition ::= "(" Variant_Identifier ("," Variant_Identifier)* ")"
Variant_Identifier ::= Wildcard_Source | Unicode_Sources | UCV_Full_Position | Imaginary_UCV | Alternate_Variants

Wildcard_Source ::= "."
Unicode_Sources ::= [BGHJKMPSTUVQ]
UCV_Full_Position ::= [qpxy] UCV_ID_Number UCV_Position_Number
UCV_ID_Number ::= Three_Digit_Number ([a-z] | z [a-z])?
UCV_Position_Number ::= (Positive_Numeral | Two_Digit_Number) [xy]?
Imaginary_UCV ::= "qq" UCV_ID_Number+
Alternate_Variants ::= [0-9a-z.]+

/* 5. 笔画之间的相接 */
Stroke_Chain ::= "#" "(" Stroke_Part+ "z"? ")"
Stroke_Part ::= StReversed_Indicator? (Ideograph_Char | Stroke_Letter) (StCrossing_Indicator | StBreak_Indicator)?
Stroke_Letter ::= [HSPN] [g]? | [SP] "Hw" [g]? | [DTJZ] | "Wg" | [Q][abcd]
StReversed_Indicator ::= "-"
StCrossing_Indicator ::= "x" Number
StBreak_Indicator ::= "b"

/* 6. 部件之间的重叠穿插 */
Overlap_Modifier ::= "[" Overlap_Matrix ("|" Overlap_Matrix)? "]"
Overlap_Matrix ::= Overlap_Horizontal_Indexing | Overlap_Rows | Overlap_Cell+
Overlap_Horizontal_Indexing ::= (Number | Negative_Number)? ":" (Number | Negative_Number)?
Overlap_Rows ::= Overlap_Row? ("," Overlap_Row?)+
Overlap_Row ::= Overlap_Cell*
Overlap_Cell ::= Overlap_Identity | Overlap_Crossing | Overlap_Non_Crossing
Overlap_Identity ::= "." |  "_"
Overlap_Crossing ::= [xabcd]
Overlap_Non_Crossing ::= [lr]
Index_Modifier ::= "[" Number "]"

/* 7. 唯一化及归一化 */
Unique_Sequence_Separator ::= "{" ("?"  One_Digit_Number?)? Ideograph_Char_with_Variant Unicode_Sources? "}"

/* 字符定义 */
Ideograph_Char ::= Ideograph_Char_with_Variant | Curves | [リ〢〣コ]
Ideograph_Char_with_Variant ::= Hanzi | CJK_Stroke | [ユス]
Hanzi ::= \\p{Ideographic=Y} | \\p{Radical=Y}
Curves ::= [◝◞◟◜]
CJK_Stroke ::= [#x31C0-#x31E5] // U+31E4 实际未收录进 zi.tools 笔画库
TAB ::= #x0009
IDS_UnaryOperator ::= [⿾⿿]
IDS_BinaryOperator ::= IDS_BinaryUnique | IDS_BinaryOverlap | IDS_BinaryAmbiguousWrapping
IDS_BinaryUniqueOperator ::= [⿰⿱⿸⿹⿺⿽]
IDS_BinaryOverlapOperator ::= "⿻"
IDS_BinaryAmbiguousOperator ::= [⿴⿵⿶⿷⿼㇯]
IDS_TrinaryOperator ::= [⿲⿳]

Positive_Numeral ::= [1-9]
One_Digit_Number ::= "0" | Positive_Numeral
Two_Digit_Number ::= One_Digit_Number One_Digit_Number
Three_Digit_Number ::= One_Digit_Number One_Digit_Number One_Digit_Number
Number ::= "0" | Positive_Numeral One_Digit_Number*
Negative_Number ::= "-" Positive_Numeral One_Digit_Number*`

/**
 * One description of a row: the text before its identifier, and the identifier. A chain's own
 * parentheses are not an identifier.
 * @param {string} text @returns {{ body: string, tag: string }}
 */
export function splitTag(text) {
  const match = /^(.*[^#\s])\(([^()]*)\)$/su.exec(text.trim())
  return match ? { body: match[1], tag: match[2] } : { body: text.trim(), tag: '' }
}

/** A printed text as groups (split at TAB) of descriptions (split at `;`). @param {string} text */
export const descriptionsOf = text => text.split('\t').map(group => group.split(';').map(splitTag))
