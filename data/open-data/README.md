# Open IDS descriptions

The ideographic description sequences IDS Input transcribed or read, with the source behind each
one. The release holds 599 descriptions in 20 groups. 130 of them
name a character with no code point. It is released under CC0 1.0.

The format is `ids-input/open-ids`, version 1.

## Scope

The records are the workshop's curated examples, not a complete IDS corpus. A row whose `ids` is a
character alone is not a description and is left out: 74 such rows stay in the workshop's examples,
including the single-character Geba forms and their abbreviations.

The 8 Small Seal descriptions come from CHISE's GPL-2.0-or-later data. They stay in
`data/small-seal.json.gz` and `data/ids-corpus.json.gz` and are not part of this release.

## Files

| File | |
| --- | --- |
| `descriptions.json` | The dataset: metadata, sources, records and numbered components. |
| `descriptions.tsv` | The records as a table, one row per description. |
| `components.tsv` | BabelStone's 121 numbered components, with the fragment that writes each out. |
| `manifest.json` | Counts and file sizes, read by the site page. |

## Records

| Field | |
| --- | --- |
| `ids` | The description, as the source writes it. |
| `char` | The character it describes, empty when it has no code point. |
| `codepoint` | `char` written `U+XXXX`. |
| `group` | The section the description appears in, listed below. |
| `reading` | The reading given for the character or form: Hangul for gukja, romanization for Nôm and Jurchen, kana for kokuji. |
| `modern` | The modern Han character a Shuishu form corresponds to. |
| `abbreviates` | The standard character a Geba form stands for. |
| `editorial` | `true` where no source states the decomposition and the project read it from the form; the sources still name the form. |
| `sources` | Keys into the `sources` table. |

A description is a source's account of one form, not an absolute glyph. The same character can carry
several descriptions, each with the regions or reading that account belongs to.

## Groups

| Group | Key | Descriptions | No code point |
| --- | --- | ---: | ---: |
| Basic structures | `basic` | 24 | 11 |
| Complex structures | `complex` | 13 | 5 |
| Repeated components | `repeated` | 44 | 4 |
| Enclosures | `enclosures` | 11 | 4 |
| Mixed scripts | `mixed` | 19 | 14 |
| Station sign forms | `sign` | 5 | 0 |
| Erjian forms | `erjian` | 31 | 15 |
| Geba-ji | `geba` | 33 | 31 |
| Navy characters | `navy` | 5 | 5 |
| Word ligatures | `ligature` | 14 | 14 |
| Created characters | `created` | 4 | 4 |
| Korean gukja | `korean` | 116 | 21 |
| Hangul ligatures | `hangul` | 2 | 2 |
| Korean gugyeol | `gugyeol` | 13 | 0 |
| Japanese kokuji | `kokuji` | 156 | 0 |
| Ghost kanji | `ghost` | 12 | 0 |
| Vietnamese Nôm | `nom` | 12 | 0 |
| Jurchen | `jurchen` | 44 | 0 |
| Shuishu logograms | `shuishu` | 18 | 0 |
| Tangut | `tangut` | 23 | 0 |

## Sources

Each record cites the works behind it, and `descriptions.json` keeps a note on what each work
gives. `checked` marks a source read directly, `reported` one known from a second-hand
statement, and `personal` a personal communication.

Two records, ⿰言⿱⿰幺幺⿰幺幺 and ⿱車🚗, carry no recorded source; their `sources` lists are empty.

| Key | Work | Author | Date | Terms | Status | URL |
| --- | --- | --- | --- | --- | --- | --- |
| `babelstone` | BabelStone IDS | Andrew West | 2025-06-27 | Public Domain | checked | <https://www.babelstone.co.uk/CJK/IDS.TXT> |
| `n2572` | Proposal to encode five new Ideographic Description Characters | Ken Lunde, John Jenkins, Andrew West | 2022-08-24 | — | checked | <https://unicode.org/irg/docs/n2572-NewIDCs.pdf#page=2> |
| `erjian` | 二简字 (Erjian) table | Andrew West | — | — | checked | <https://www.babelstone.co.uk/Fonts/Erjian.html> |
| `jyutnet` | Unencoded characters | Jyutnet | — | — | checked | <https://jyutnet.github.io/unencoded-characters/> |
| `chii-duang` | 成龍 duang | — | 2017-02-17 | — | reported | <https://chii.in/group/topic/342213> |
| `adobe-kr` | Adobe-KR special notes | — | — | — | checked | <https://github.com/adobe-type-tools/Adobe-KR#special-notes> |
| `cns-fiao` | CNS11643 字號 149313 | — | — | — | checked | <https://www.cns11643.gov.tw/wordView.jsp?ID=149313> |
| `x-sarasvati` | ⿱艹堀 in Kagoshima place names | @sarasvati635 | 2026-05-12 | — | checked | <https://x.com/sarasvati635/status/2054123491889488005> |
| `x-uteta-toushi` | 投+石 read なげ and いしなとり | @Utetamutete | 2026-10-16 | — | checked | <https://x.com/Utetamutete/status/2111106301044699557> |
| `x-kadisco` | Oracle-bone ⿲𠂤日千 | @ka_disco | 2026-01-29 | — | checked | <https://x.com/ka_disco/status/2016902923863937473> |
| `x-kygna` | 園 written ⿴囗⿱エン | @kygna | 2024-02-03 | — | checked | <https://x.com/kygna/status/1753641413831758312> |
| `x-jianhuazi` | 二簡字 of 德 as ⿱一心 | @jianhuazi_bot2 | 2021-03-21 | — | checked | <https://x.com/jianhuazi_bot2/status/1373547010536706048> |
| `x-umihotarus` | 舘暲’s ヴァーチャル characters | @Umihotarus | 2019-03-15 | — | checked | <https://x.com/Umihotarus/status/1106526920378740736> |
| `x-zoenshiueh` | ⿱⿰◇ㅏㄴ | @zoenshiueh_lieu | 2026-10-26 | — | reported | <https://x.com/zoenshiueh_lieu> |
| `script-hybrid` | Script-Hybrid CJK Ideographs (SCRIPT-HYBRID v19) | Gen Kojitani | 2026-10-16 | — | reported | <https://sites.google.com/dhii.asia/biangbiangcon/program> |
| `l2-24-201` | Proposal to add a new Script-Hybrid CJK Ideographs block | Gen Kojitani | 2024-08-05 | — | checked | <https://www.unicode.org/L2/L2024/24201-script-hybrid-cjk-block.pdf> |
| `ndl-jmtt` | Japanese Military and Technical Terms, p. 217 | — | 1945-07 | — | checked | <https://dl.ndl.go.jp/pid/13695517/1/228> |
| `irg-n2744` | Reply to N2741 | Gen Kojitani | 2024-10-20 | — | checked | <https://www.unicode.org/irg/docs/n2744-IRGN2741Response.pdf> |
| `irg-n2637` | Script-hybrid and abbreviated CJK letters | Gen Kojitani | 2023-06-23 | — | checked | <https://www.unicode.org/irg/docs/n2637-HybridIdeographs.pdf#page=2> |
| `geba-wp` | 全学联汉字 | — | — | CC BY-SA 4.0 | checked | <https://zh.wikipedia.org/wiki/全学联汉字> |
| `l2-24-125` | Proposal to add a new CJK Abbreviations block | Gen Kojitani | 2024-04-24 | — | checked | <https://www.unicode.org/L2/L2024/24125-cjk-abbrev-block.pdf> |
| `ja-wp-geba` | ゲバ字 | — | — | CC BY-SA 4.0 | checked | <https://ja.wikipedia.org/wiki/ゲバ字> |
| `x-cincpac-images` | Images of 通船 and 掌機長 | @xWcvlUaljn96009 | 2026-10 | — | reported | — |
| `x-hado` | ⿴口도 as a variant of 圖 used in Korea | @hado_study | 2026-10 | — | checked | <https://x.com/hado_study/status/2115668238181056746> |
| `x-umanoyui` | ⿶む子 | @umanoyui | 2026-10 | — | checked | <https://x.com/umanoyui/status/2115029672669102194> |
| `personal` | mkpoli, personal communication | — | 2026-10-27 | — | personal | — |
| `tangut-ids` | BabelStone Tangut IDS | Andrew West | — | Public Domain | checked | <https://www.babelstone.co.uk/Tangut/TangutIDS.txt> |
| `x-uteta` | 月 above 朋, read さやけし | @Utetamutete | 2026-10 | — | checked | <https://x.com/Utetamutete/status/2115621598799770015> |
| `ko-wp-gukja` | 국자의 음역자와 구결자 | — | 2026-08-28 | CC BY-SA 4.0 | checked | <https://ko.wikipedia.org/w/index.php?title=국자의_음역자와_구결자&oldid=42393816> |
| `x-kechilee` | 壹圓 written ⿴囗⿱エン | @kechilee | 2022-01-25 | — | checked | <https://x.com/kechilee/status/1485909692249690113> |
| `x-ryakjiten` | ⿴囗⿱エン noticed | @ryakjiten | 2024-04-07 | — | checked | <https://x.com/ryakjiten/status/1776877162689376525> |
| `x-kingko` | 園の略字 ⿴囗⿱エン | @king_ko_roro | 2024-10-05 | — | checked | <https://x.com/king_ko_roro/status/1842415160600010928> |
| `x-sc2rm` | A variant of 園, ⿴囗⿱エン | @sc2rm | 2017-01-14 | — | checked | <https://x.com/sc2rm/status/820172370186944512> |
| `x-vivanon` | Nursery 園 as 囗 with エン | @vivanon_iemoto | 2022-07-25 | — | checked | <https://x.com/vivanon_iemoto/status/1551420018248003584> |
| `x-privjj` | 囗ｴﾝ and the simplified 囗元 | @priv_jj1xaw | 2022-11-02 | — | checked | <https://x.com/priv_jj1xaw/status/1587731956372238337> |
| `x-dodan` | ⿰忄実 for バーチャル | @Dodan_Tu_Tu_Ji | 2025-02-12 | — | checked | <https://x.com/Dodan_Tu_Tu_Ji/status/1889694369923334606> |
| `x-miho` | Abbreviations 广+マ, 言+ギ, 囗+エン | @miho_kivi | 2022-11-04 | — | checked | <https://x.com/miho_kivi/status/1588333225583071232> |
| `x-uteta-pinzi-ri-mo` | 品字様 of 里 and 莫 | @Utetamutete | 2026-08-01 | — | checked | <https://x.com/Utetamutete/status/2083503199319912453> |
| `x-uteta-pinzi-ten-chi` | 品字様 of 天 and 地 | @Utetamutete | 2026-08-04 | — | checked | <https://x.com/Utetamutete/status/2084625411980530020> |
| `l2-12-032` | Proposal to Add a Character to the UTR #45 | John H. Jenkins, Richard Cook, Ken Lunde | 2012-01-26 | — | checked | <https://www.unicode.org/L2/L2012/12032-one-add-utr45.pdf> |
| `utr45` | U-source ideographs (UTR #45) | — | 2026-07-30 | Unicode License v3 | checked | <https://www.unicode.org/Public/UCD/latest/ucd/USourceData.txt> |
| `zh-yue-hetizi` | 合成字 | — | 2026-01-03 | CC BY-SA 4.0 | checked | <https://zh-yue.wikipedia.org/w/index.php?title=合成字&oldid=2365560> |
| `myriadrevery-jouji` | 畳字 | にぅま | 2026-06-28 | — | checked | <https://wikiwiki.jp/myriadrevery/畳字> |
| `irg-ws2021-uk-20565` | IRG Working Set 2021 record UK-20565 | — | — | — | checked | <https://hc.jsecs.org/irg/ws2021/app/index.php?find=UK-20565> |
| `uhk-hetizi` | 揮春上的合體字　你看懂幾多？ (新春篇) | UHK 港生活 | 2015-02-12 | — | checked | <https://hk.ulifestyle.com.hk/topic/detail/200474/> |
| `en-wp-kokuji` | Kokuji | — | — | CC BY-SA 4.0 | checked | <https://en.wikipedia.org/wiki/Kokuji> |
| `en-wp-nom` | Chữ Nôm | — | — | CC BY-SA 4.0 | checked | <https://en.wikipedia.org/wiki/Ch%E1%BB%AF_N%C3%B4m> |
| `zi-tools-kongmeng` | 學好孔孟 | 字統网 (zi.tools) | — | — | checked | <https://zi.tools/api/lookup/lookup/%E5%AD%B8%E5%A5%BD%E5%AD%94%E5%AD%9F> |
| `fznews-jixiang` | 楹联高手首创“吉祥如意”合体字 | 陈坚 | 2011-01-12 | — | checked | <https://news.fznews.com.cn/kjww/2011-1-12/2011112ql7wk9qCih23027.shtml> |
| `gmw-zuhezi` | 组合字的内外乾坤 | 吴国升 | 2024-04-21 | — | checked | <https://epaper.gmw.cn/gmrb/html/2024-04/21/nw.D110000gmrb_20240421_2-05.htm> |
| `shuishu` | BabelStone Shuishu index and the Amendment 2.2 charts | Andrew West; ISO/IEC JTC 1/SC 2/WG 2 | — | — | checked | <https://www.babelstone.co.uk/Shuishu/Shuishu.xlsx> |
| `shuishu-db` | 水族水书文字数据库 (Shui script character database) | 孙治弘, 谢雨霏, 刘凌, 叶晨 (数字人文研究 2026, 6(01): 94–109) | 2026-10-29 | — | checked | <https://shuishu.ihanzi.net/shuishu> |
| `sanseido-ghost` | 第83回 漢字の音義の一人歩き | 笹原宏之 | 2011-02-15 | — | checked | <https://dictionary.sanseido-publ.co.jp/column/kanji_genzai083> |
| `kanken-ghost` | 新聞漢字あれこれ91　幽霊漢字があやうく紙面に | 小林肇 | 2022-04-06 | — | checked | <https://www.kanjicafe.jp/detail/10128.html> |
| `wdic-ghost` | 幽霊文字 | WDIC Creators club | 2010-04-24 | — | checked | <https://www.wdic.org/w/WDIC/幽霊文字> |
| `ja-wp-ghost` | 幽霊文字 | Wikipedia contributors | 2026-08-11 | CC BY-SA 4.0 | checked | <https://ja.wikipedia.org/w/index.php?title=幽霊文字&oldid=110601177> |
| `sljfaq-kokuji` | A list of kokuji (国字) | — | — | — | checked | <http://www.sljfaq.org/afaq/kokuji-list.html> |
| `x-eonway-sign` | The 建 of a 1959 Beijing station sign written ⿺廴占 | @Eonway_Ying | 2026-11-01 | — | reported | <https://x.com/Eonway_Ying/status/2116736749665734758> |
| `erjian-draft-1977` | 第二次汉字简化方案（草案） | 中国文字改革委员会 | 1977-12-20 | — | checked | <https://zh.wikisource.org/wiki/第二次汉字简化方案（草案）> |
| `irg-ws2024-01372` | IRG Working Set 2024 character 01372 | — | — | — | checked | <https://hc.jsecs.org/irg/ws2024/app/index.php?id=01372> |
| `stitutes-short-forms` | Long Story of Short Forms: Simplified Chinese characters from A to Z | Roar Bökset | 2021-11-12 | — | reported | <https://books.google.com/books?isbn=9789188763228> |
| `cjkvi-variants-ids` | cjkvi-ids ids.txt | Kawabata Taichi and the CJKVI Database | — | GPL-2.0-or-later | checked | <https://github.com/cjkvi/cjkvi-ids/blob/master/ids.txt> |
| `x-sebansios-blocks` | Old Korean syllable blocks in a Buddhist manuscript | @sebansios | 2026-07-27 | — | reported | <https://x.com/sebansios/status/2081836550078570820> |
| `jurchen-numeric` | JurchenSources.txt, Unicode 18.0 | Unicode, Inc. | — | Unicode License v3 | checked | <https://www.unicode.org/Public/18.0.0/ucd/JurchenSources.txt> |
| `jurchen-ids` | Editorial Jurchen descriptions | IDS Workshop | — | — | checked | <https://github.com/mkpoli/ids-input/blob/main/data/jurchen/ids.json> |
| `yixiwu-jianhuaziyuan` | 《簡化字原》 | 易熙吾 | 1955 | — | reported | — |
| `chenguangyao-jianzipu` | 《常用簡字普》 | 陳光垚 | 1955 | — | reported | — |
| `zh-wp-jianhua-fangfa` | 简化字的简化方法 | — | — | CC BY-SA 4.0 | checked | <https://zh.wikipedia.org/w/index.php?title=简化字的简化方法&oldid=93222926> |
| `x-jumanjikyo` | ⿲意情意, read 의정의, in 韓国漢字字典 | @JUMANJIKYO (竹澤雅文) | 2026-01-01 | — | checked | <https://x.com/JUMANJIKYO/status/2006719620993204370> |
| `x-egasmb` | 不想上班那就別上 set as four characters | @egasmb (Egas Moniz Bandeira) | 2026-02-03 | — | checked | <https://x.com/egasmb/status/2018647780752003221> |
| `jsccc8-navy` | 旧日本海軍における位相文字の研究 | 鈴木健心 | 2025-12-07 | — | checked | <https://jsccc.org/files/uploads/convention/convention2_11.pdf> |
| `note-kaigun-kamome` | 漢字「艏」と日本海軍の「海軍漢字」 | 海鳥水兵 | 2026-05-02 | — | checked | <https://note.com/kamome_96009/n/nb7e22672e531> |
| `x-kaigun-kikanju` | ⿲木十木 as 機関銃, likely an Army form | @xWcvlUa1jn96009 (海鳥水兵) | 2026-01-24 | — | checked | <https://x.com/xWcvlUa1jn96009/status/2015033333382783274> |
| `x-kaigun-truck` | ⿰車ト as トラック, used by the Army too | @xWcvlUa1jn96009 (海鳥水兵) | 2026-01-24 | — | checked | <https://x.com/xWcvlUa1jn96009/status/2015033911018230040> |
| `x-kaigun-hayashi` | ⿰米林 as ハヤシライス | @xWcvlUa1jn96009 (海鳥水兵) | 2026-01-24 | — | checked | <https://x.com/xWcvlUa1jn96009/status/2015034147686006914> |
| `x-mkpoli-u820e` | ⿰甫舎 as a variant of 舗 | @mkpoli | 2019-10-18 | — | checked | <https://x.com/mkpoli/status/1185227140452667392> |
| `x-monkey-hikaru` | 光 beside the 冖 of 軍, on a driving-school poster | @monkey0026 | 2024-10-22 | — | checked | <https://x.com/monkey0026/status/1848683062114324849> |

## Licence

[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). This project's selection, arrangement, source notes
and editorial readings are dedicated to the public domain.

The records are short factual descriptions and readings. A source record names a licence where the
project records one: BabelStone IDS and its Tangut file are public domain, the Wikipedia lists are
CC BY-SA 4.0, and the Unicode data files use the Unicode License v3. Where a source states its own
terms, those terms apply to material taken from it.

## Rebuild

`bun scripts/build_open_ids.mjs` rewrites these files. Add `--check` to fail when a committed
file differs.

The source data is `demo/lib/examples.js`, `demo/lib/example-sources.js` and
`data/ids-components.tsv`.

## Cite

IDS Input. Open IDS descriptions, version 1. <https://ids.mkpo.li/open-data>
