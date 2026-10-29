// Numbered records for the starter examples. A citation number is the record's position in this
// array plus one, and `refs` in examples.js holds those numbers.
//
// `checked` marks a record whose form was read in the source itself; `reported` marks one whose
// form is known only from a second-hand statement.

/** @typedef {{ id: string, title: string, author?: string, date?: string, url?: string, note: string, status: 'checked' | 'reported' | 'personal' }} ExampleSource */

/** @type {ExampleSource[]} */
export const EXAMPLE_SOURCES = [
  { id: 'babelstone', title: 'BabelStone IDS', author: 'Andrew West', date: '2025-06-27', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT', status: 'checked', note: 'The description of each encoded character, also bundled as data/babelstone-ids.tsv.gz. 皶 keeps the GKP form ⿰查皮; the TJ record is ⿰査皮.' },
  { id: 'n2572', title: 'Proposal to encode five new Ideographic Description Characters', author: 'Ken Lunde, John Jenkins, Andrew West', date: '2022-08-24', url: 'https://unicode.org/irg/docs/n2572-NewIDCs.pdf#page=2', status: 'checked', note: 'Page 2 lists 㕚 as ⿼叉丶, 氷 as ⿽水丶, 𣥄 as ⿾正 and 𠄔 as ⿿予.' },
  { id: 'erjian', title: '二简字 (Erjian) table', author: 'Andrew West', url: 'https://www.babelstone.co.uk/Fonts/Erjian.html', status: 'checked', note: 'Entry 2.2:003 has 瓣 as ⿱艹半; entry 2.2:007 has 避 as ⿺辶比.' },
  { id: 'jyutnet', title: 'Unencoded characters', author: 'Jyutnet', url: 'https://jyutnet.github.io/unencoded-characters/', status: 'checked', note: 'JYN00001 (與 variant), JYN00003 (寫 variant), JYN00010 (擔 variant), JYN00013 (⿵門覃), JYN00017 (⿰舟邊) and JYN00025 (龍 variant). Each record links its dictionary evidence.' },
  { id: 'chii-duang', title: '成龍 duang', date: '2017-02-17', url: 'https://chii.in/group/topic/342213', status: 'reported', note: 'The thread that records ⿱成龙 for duang.' },
  { id: 'adobe-kr', title: 'Adobe-KR special notes', url: 'https://github.com/adobe-type-tools/Adobe-KR#special-notes', status: 'checked', note: 'Records 𰜩 (U+30729) as ⿰氵恩.' },
  { id: 'cns-fiao', title: 'CNS11643 字號 149313', url: 'https://www.cns11643.gov.tw/wordView.jsp?ID=149313', status: 'checked', note: 'Records 覅 as ⿰要勿.' },
  { id: 'x-jumanjikyo', title: '⿱艹堀, a Kagoshima place-name character', author: '@JUMANJIKYO', date: '2026-10-26', url: 'https://x.com/JUMANJIKYO', status: 'reported', note: 'Read ホキ. The post URL was not recorded when the example was added; this is the account.' },
  { id: 'x-dmnefkt', title: '⿱投石 in 逆{⿱投石}橋, Ōzu', author: '@dmnefkt', date: '2026-10-26', url: 'https://x.com/dmnefkt', status: 'reported', note: 'Read さかなげ. The post URL was not recorded; this is the account.' },
  { id: 'x-kadisco', title: 'Oracle-bone form ⿲𠂤日千', author: '@ka_disco', date: '2026-10-26', url: 'https://x.com/ka_disco', status: 'reported', note: 'The post URL was not recorded; this is the account.' },
  { id: 'x-qvarie', title: 'Dialect abbreviation of 園 as ⿴囗⿱エン', author: '@qvarie', date: '2026-10-26', url: 'https://x.com/qvarie', status: 'reported', note: 'The post URL was not recorded; this is the account.' },
  { id: 'x-jianhuazi', title: '二簡字 of 德 as ⿱一心', author: '@jianhuazi_bot2', date: '2026-10-26', url: 'https://x.com/jianhuazi_bot2', status: 'reported', note: 'The post URL was not recorded; this is the account.' },
  { id: 'x-umihotarus', title: '舘暲’s character for ヴァーチャル, ⿰忄実', author: '@Umihotarus', date: '2026-10-26', url: 'https://x.com/Umihotarus', status: 'reported', note: 'The post URL was not recorded; this is the account.' },
  { id: 'x-zoenshiueh', title: '⿱⿰◇ㅏㄴ', author: '@zoenshiueh_lieu', date: '2026-10-26', url: 'https://x.com/zoenshiueh_lieu', status: 'reported', note: 'Hangul initial left as ◇ because the initial is unencoded. The post URL was not recorded; this is the account.' },
  { id: 'script-hybrid', title: 'Script-Hybrid CJK Ideographs (SCRIPT-HYBRID v19)', author: 'Gen Kojitani', date: '2026-10-16', url: 'https://sites.google.com/dhii.asia/biangbiangcon/program', status: 'reported', note: 'BiangBiangCon slides. They give ⿴口도 as a proposed 図, and the 艦ラ, 艦ツ and 掌キ forms. The slide writes the hybrid part as part of a whole character; the glyphs are drawn from the components the sources below show.' },
  { id: 'l2-24-201', title: 'Proposal to add a new Script-Hybrid CJK Ideographs block', author: 'Gen Kojitani', date: '2024-08-05', url: 'https://www.unicode.org/L2/L2024/24201-script-hybrid-cjk-block.pdf', status: 'checked', note: 'Fig. 44 (p. 36) reproduces p. 217 of the 1945 glossary and its launch entry.' },
  { id: 'ndl-jmtt', title: 'Japanese Military and Technical Terms, p. 217', date: '1945-07', url: 'https://dl.ndl.go.jp/pid/13695517/1/228', status: 'checked', note: 'CINCPAC-CINCPOA Bulletin 18-45. The launch entry (RANCHI) draws 舟 with ラ to its right, and gives （ランチ）. The page carries no ツ or キ form.' },
  { id: 'irg-n2744', title: 'Reply to N2741', author: 'Gen Kojitani', date: '2024-10-20', url: 'https://www.unicode.org/irg/docs/n2744-IRGN2741Response.pdf', status: 'checked', note: 'P. 7 gives 𭤪 (U+2D92A) as hentaigana 𛂦 (U+1B0A6) beside 方; BabelStone keeps ⿰？方. P. 8 writes the hybrid as ⿵门 T and Fig. 8 shows 门 over T. Fig. 7 has the Sawndip form behind ⿰扌3, whose right component also carries a dot.' },
  { id: 'irg-n2637', title: 'Script-hybrid and abbreviated CJK letters', author: 'Gen Kojitani', date: '2023-06-23', url: 'https://www.unicode.org/irg/docs/n2637-HybridIdeographs.pdf#page=2', status: 'checked', note: 'Table 1 no. 1 and Fig. 1 write the component as full-width Ａ; the example uses ASCII A.' },
  { id: 'geba-wp', title: '全学联汉字', url: 'https://zh.wikipedia.org/wiki/全学联汉字', status: 'checked', note: 'Read 2026-10-28. The Geba-ji tables under 西文字母, 假名声旁, 通假, 楷化, 记号, 字形省去, 隶定, 训读 and 声旁. The tables write the letters full width (Ｒ, Ｋ); the examples use ASCII.' },
  { id: 'l2-24-125', title: 'Proposal to add a new CJK Abbreviations block', author: 'Gen Kojitani', date: '2024-04-24', url: 'https://www.unicode.org/L2/L2024/24125-cjk-abbrev-block.pdf', status: 'checked', note: 'The HAN-LATIN entries the letter forms follow. Fig. 11 reproduces 蜂矢真郷「一九六五～一九七五年度頃の略字」, 『国語文字史の研究』8, which shows 宀+R for 寮.' },
  { id: 'ja-wp-geba', title: 'ゲバ字', url: 'https://ja.wikipedia.org/wiki/ゲバ字', status: 'checked', note: 'Gives the same 宀+R form for 寮.' },
  { id: 'x-cincpac-images', title: 'Images of 通船 and 掌機長', author: '@xWcvlUaljn96009', date: '2026-10', status: 'reported', note: 'The slide’s images for 艦ツ and 掌キ. The account no longer resolves (404), and the images were not re-checked against a scan, so the two forms stay as the slide writes them.' },
  { id: 'x-hado', title: '⿴口도 as a variant of 圖 used in Korea', author: '@hado_study', date: '2026-10', url: 'https://x.com/hado_study/status/2115668238181056746', status: 'checked', note: 'The post reads 참고로 저 그림에서 (⿴口도)는 圖의 변형으로 과거에 가끔 한국에서 진짜 쓰였단 사실…, over a newspaper page whose 鳥瞰圖 is drawn with 도 inside 口.' },
  { id: 'x-umanoyui', title: '⿶む子', author: '@umanoyui', date: '2026-10', url: 'https://x.com/umanoyui/status/2115029672669102194', status: 'checked', note: 'A manuscript photograph with む written around 子.' },
  { id: 'personal', title: 'mkpoli, personal communication', date: '2026-10-27', status: 'personal', note: '⿰木き, ⿰木⿳ㄙㄨㄥ, ⿰木⿱ㄅㄞ, ⿺辶說, ⿱龹幸, ⿶む子 and 〾⿱⿰大⿱七六⿵勹五. No published source is recorded for these exact forms. The last is a Jianzipu-style transcription, and 〾 marks its approximate shape; a related notation with 四 in place of 五 is in 謝俊仁, 音樂展覽 – 古琴篇, https://www2.lcsd.gov.hk/tc/mo/activities/communityprogrammes/roving_exhibition_guqin.html.' },
  { id: 'small-seal', title: 'CHISE Jiguge small-seal records', url: 'https://www.chise.org/', status: 'reported', note: 'Read from data/small-seal.json.gz; the modern labels are correspondences.' },
  { id: 'tangut-ids', title: 'BabelStone Tangut IDS', author: 'Andrew West', url: 'https://www.babelstone.co.uk/Tangut/TangutIDS.txt', status: 'checked', note: 'The Tangut descriptions, also bundled as data/babelstone-ids.tsv.gz.' },
]

/** The citation number of a source id, or 0 when the id is unknown. @param {string} id */
export function sourceNumber(id) {
  return EXAMPLE_SOURCES.findIndex(source => source.id === id) + 1
}

