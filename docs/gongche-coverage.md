# 工尺譜 input coverage

The panel contains 72 selectable entries. Its inventory is
[`data/gongche-parts.json`](../data/gongche-parts.json); each group records its
sources. Encoded forms insert Unicode characters, while unencoded compounds
insert editable IDS. Hover labels show code points or the literal IDS.

## Source coverage

| Source inventory | Available input |
|---|---|
| [Chan et al., Kunqu proposal, Table 1](https://www.unicode.org/L2/L2018/18245-n4967-gongche.pdf#page=3) | All ten base notes, seven hooked notes, seven single-person forms and seven double-person forms |
| [CCLI 2022/03, Annex II, Figure 1](https://www.ccli.gov.hk/doc/wgcliac2022-03.pdf#page=8) | Cantonese base/register forms and all eight illustrated staccato forms |
| [Chiu Huo-Jung / Chiu Chao-Wen, Beiguan tutorial (2000)](https://tcmb.culture.tw/zh-tw/detail?id=245144&indexCode=Culture_Media) | 𪜧, the 亻 form of 乂 |
| [Taiwan Historica, entry 2045](https://dict.th.gov.tw/detailPage.aspx?Ca=163&ID=2045) | Nanguan notes 乂/工/六/士/一, the 甲 and 下 forms, and the grass-head component 艹 for composition |
| [Hong Kong Music Miniatures](https://hkmusicminiatures.com/notes-on-traditional-mnemonic-notation-and-gongche-notation/) | Note characters, long-note/repeat signs, shared rhythm marks and breath/connection/prolongation punctuation |
| [Toru Kato, Seiraku notation (2012)](https://www.isc.meiji.ac.jp/~katotoru/singaku-20.html) | ○, ×, 、 and 。; their musical use depends on the score |
| [Shi De-Yu, 論說崑曲工尺譜, printed p. 269](https://lib.ntua.edu.tw/wSite/public/Data/f1717039599418.pdf#page=273) | 勺, the rest sign in the 夕陽簫鼓 example; the scanned page was checked because searchable OCR misidentifies it |
| [Ministry of Culture, 陕西百名农民进京演绎盛唐古乐 (2005-06-16)](https://www.mct.gov.cn/whzx/whyw/201112/t20111201_707074.htm) | 勾, included in the article's note inventory |

The component shortcuts ⿰氵氵 and ⿱𰀪亻 were suggested by
परवद💙💛 ([@zoenshiueh_lieu](https://x.com/zoenshiueh_lieu)). No score citation
accompanied those suggestions; they remain attributed component shortcuts.

## Encoded compound forms

Search either the character or its IDS. The button inserts the encoded form.
Names identify component shapes: 亻 and 彳 do not have the same register meaning
in all traditions.

| Form | Code point | Searchable IDS |
|---|---|---|
| 仩 | U+4EE9 | ⿰亻上 |
| 伬 | U+4F2C | ⿰亻尺 |
| 仜 | U+4EDC | ⿰亻工 |
| 𠆩 | U+201A9 | ⿰亻凡 |
| 𠆾 | U+201BE | ⿰亻六 |
| 伍 | U+4F0D | ⿰亻五 |
| 亿 | U+4EBF | ⿰亻乙 |
| 佮 | U+4F6E | ⿰亻合 |
| 仕 | U+4ED5 | ⿰亻士 |
| 仮 | U+4EEE | ⿰亻反 |
| 𪜧 | U+2A727 | ⿰亻乂 |
| 𱝫 | U+3176B | ⿰彳上 |
| 鿈 | U+9FC8 | ⿰彳尺 |
| 𢓁 | U+224C1 | ⿰彳工 |
| 𱝬 | U+3176C | ⿰彳凡 |
| 𢓌 | U+224CC | ⿰彳六 |
| 鿉 | U+9FC9 | ⿰彳五 |
| 𢒼 | U+224BC | ⿰彳乙 |
| 𢓉 | U+224C9 | ⿰彳反 |
| 洽 | U+6D3D | ⿰氵合 |
| 㲸 | U+3CB8 | ⿰氵乙 |
| 𰛈 | U+306C8 | ⿰氵上 |
| 沢 | U+6CA2 | ⿰氵尺 |
| 江 | U+6C5F | ⿰氵工 |
| 汳 | U+6C73 | ⿰氵反 |

The proposal's UTC-02976 and UTC-02977 are now 𱝫 U+3176B and 𱝬 U+3176C,
confirmed by Unihan's `kIRG_USource`. Its proposed U+19BF0 allocation was not
adopted: the seven hooked notes are U+2A6D7–U+2A6DD.

Two illustrated staccato forms remain IDS: **⿰氵士** (six strokes) and
**⿰氵六** (seven strokes). 汢 has 土, so it is not a substitute for ⿰氵士.
The eight staccato shortcuts follow the published example's order:
洽, ⿰氵士, 㲸, 𰛈, 沢, 江, 汳, ⿰氵六.

## Composition and limits

The important inventories in the table above are covered. Further combinations
can be entered with ⿰ and the person/water components, or ⿱ and 艹; CCLI explicitly
notes that 氵 may combine with other notes. These productive combinations do not
need separate batches of buttons. A notation sign such as 『 or 』 inserts one
literal component; score layout and pairing remain the writer's responsibility.

This is an IDS/component input panel. It does not arrange scores, assign pitches,
interpret rhythm, or encode every manuscript's ornament and calligraphic form.
In particular:

- The proposal treats the seven characters written with two downward slashes
  (合 四 一 上 尺 工 凡) as uncommon and theoretical; they remain unencoded and
  outside this catalogue.
- Cursive 四 is not Japanese の. Hooked 一 is not 乛 or ㇖. These lookalikes are
  excluded as substitutes.
- Repeated ellipses and longer held-note lines are built from the available marks;
  the panel does not infer their length or duration.
- Score-specific ornament drawings, instrument fingerings, drum syllables and
  prose directions remain outside this catalogue. The source-linked input guide
  and component editor remain available for transcription.

The font builder reads supplementary characters directly from the catalogue.
Coverage tests check the register/staccato inventories, aliases, literal input,
source records and composer outlines. Browser checks exercise every entry in
both themes and confirm the supplementary glyphs use the bundled font.
