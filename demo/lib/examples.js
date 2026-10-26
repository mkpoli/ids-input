// Starter sequences. Encoded characters use BabelStone IDS or the cited alternative description;
// the remaining entries have no encoded character assigned here.
//
// Sources for the forms with no code point, X posts seen on 2026-10-26 (JST): ⿱艹堀 (@JUMANJIKYO, a
// Kagoshima place-name character read ホキ), ⿱投石 (@dmnefkt, 逆{⿱投石}橋 in Ōzu, Ehime, read
// さかなげ), ⿲𠂤日千 (@ka_disco, an oracle-bone form), ⿴囗⿱エン (@qvarie, a dialect abbreviation
// of 園), ⿱一心 (@jianhuazi_bot2, the 二簡字 of 德) and ⿰忄実 (@Umihotarus, 舘暲's character for
// ヴァーチャル).
//
// Hybrid examples from SCRIPT-HYBRID (BiangBiangCon v19, slide dated 2026-10-16; supplied
// 2026-10-26). The encoded forms use BabelStone IDS. The forms with no code point: ⿴口도 is the
// slide's proposed 図; ⿰艦ラ, ⿰艦ツ and ⿰掌キ are after CINCPAC-CINCPOA Bulletin 18-45 and
// Japanese Military and Technical Terms (1945-07-30) p.217, L2/24-201 Fig.44, with images from
// @xWcvlUaljn96009; ⿰门T is after N2744 Fig.8 and N2741 p.10 (唐蘭『古文字学導論』p.134).
// ⿰𛂦方 describes 𭤪 (U+2D92A): Gen Kojitani, Reply to N2741, IRG N2744 (2024-10-20), p.7.
// https://www.unicode.org/irg/docs/n2744-IRGN2741Response.pdf#page=7
// BabelStone retains ⿰？方, so this example supplies the explicit hentaigana component.
// ⿰亻A uses ASCII A for the full-width Ａ in Kojitani's IRG N2637 (2023-06-23), Table 1, no.1 / Fig.1.
// https://www.unicode.org/irg/docs/n2637-HybridIdeographs.pdf#page=2
// ⿰扌3 is a shape approximation to the Sawndip form in N2744 Fig.7 (p.8), whose pictographic
// right component also has a dot. ASCII 3 here specifies a drawing shape, not that component's origin.
// ⿰木き, ⿰木⿳ㄙㄨㄙ and ⿰木⿱ㄅㄞ: attested forms reported by mkpoli, personal
// communication, 2026-10-27. No published source is recorded here.
export const EXAMPLE_GROUPS = [
  { key: 'basic', examples: [
    { sequence: '⿰𠤕⿱龴疋', char: '疑' },
    { sequence: '⿱艹堀', char: '' },
    { sequence: '⿱投石', char: '' },
    { sequence: '⿲𠂤日千', char: '' },
    { sequence: '⿱一心', char: '' },
    { sequence: '⿰忄実', char: '' },
    { sequence: '⿱𘠀⿰𘢰𘠆', char: '𗀀' },
    { sequence: '⿲𘫺𘢅𘫱', char: '𗐃' },
  ] },
  { key: 'complex', examples: [
    { sequence: '⿳⿲木缶木冖⿰鬯彡', char: '鬱' },
    { sequence: '⿺辶⿳穴⿰月⿰⿲⿱幺長⿱言馬⿱幺長刂心', char: '𰻞' },
    { sequence: '⿱䨺龘', char: '𱁬' },
    { sequence: '⿰鼻囊', char: '齉' },
    { sequence: '⿱⿱⿴𦥑同冖𤍾', char: '爨' },
    { sequence: '⿰氵鬱', char: '灪' },
    { sequence: '⿰𘧥⿱𘧉⿰𘢤𘢱', char: '𘔉' },
    { sequence: '⿱𘣘⿰𘧨⿱𘡊⿰𘠳𘠢', char: '𗷖' },
    { sequence: '⿰⿱𘡎⿰𘠡𘪧𘣹', char: '𘟷' },
  ] },
  { key: 'repeated', examples: [
    { sequence: '⿱木林', char: '森' },
    { sequence: '⿱龖龖', char: '𪚥' },
    { sequence: '⿱龍龖', char: '龘' },
    { sequence: '⿱⿰雷雷⿰雷雷', char: '䨻' },
    { sequence: '⿱馬騳', char: '驫' },
    { sequence: '⿱鹿𱋁', char: '麤' },
    { sequence: '⿱雷⿰雷雷', char: '靐' },
    { sequence: '⿱⿰鏡鏡⿰鏡鏡', char: '𰽔' },
    { sequence: '⿰言⿱⿰幺幺⿰幺幺', char: '' },
    { sequence: '⿰𘫿𘫿', char: '𘴅' },
    { sequence: '⿳𘠛𘠛⿲𘠐𘧤𘦗', char: '𗰮' },
    { sequence: '⿱𘡊⿰𘢌⿱𘠀⿲𘠁𘢌𘠁', char: '𗓟' },
    { sequence: '⿱𘡩⿰𘢌⿳𘡊⿰𘠗𘠗𘥷', char: '𗟕' },
  ] },
  { key: 'enclosures', examples: [
    { sequence: '⿴囗或', char: '國' },
    { sequence: '⿴囗書', char: '圕' },
    { sequence: '⿱𘡍⿰𘤧⿺𘢍𘡹', char: '𗕉' },
    { sequence: '⿰𘠣⿸𘡋⿱𘫽𘣗', char: '𗌣' },
    { sequence: '⿳𘠛𘠛⿵𘠒⿲𘡃𘠁𘡃', char: '𗰭' },
  ] },
  { key: 'mixed', examples: [
    { sequence: '⿱⿰力田𠂇', char: '𫦫' },
    { sequence: '⿳宀𭕄木', char: '𫳍' },
    { sequence: '⿰車卜', char: '𨊣' },
    { sequence: '⿰舟力', char: '𬜑' },
    { sequence: '⿱加㇣', char: '㔔' },
    { sequence: '⿱加𠃍', char: '㔖' },
    { sequence: '⿱者𠃍', char: '䎞' },
    { sequence: '⿴口도', char: '' },
    { sequence: '⿰艦ラ', char: '' },
    { sequence: '⿰艦ツ', char: '' },
    { sequence: '⿰掌キ', char: '' },
    { sequence: '⿰门T', char: '' },
    { sequence: '⿰𛂦方', char: '𭤪', source: 'https://www.unicode.org/irg/docs/n2744-IRGN2741Response.pdf#page=7' },
    { sequence: '⿰亻A', char: '' },
    { sequence: '⿰扌3', char: '' },
    { sequence: '⿰木⿳ㄙㄨㄙ', char: '' },
    { sequence: '⿰木⿱ㄅㄞ', char: '' },
    { sequence: '⿰木き', char: '' },
    { sequence: '⿴囗⿱エン', char: '' },
  ] },
]
export const EXAMPLES = EXAMPLE_GROUPS.flatMap(group => group.examples)
