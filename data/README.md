# Data

Each file keeps its own licence; the MIT licence of the code does not cover them.

## `yi-bai-ids.tsv.gz`

Unannotated standard IDS descriptions from Yi Bai's level-1 IDS dataset at commit
`da1e9f8a09e2ec8faaf176bac99203f978282041`, <https://github.com/yi-bai/ids>.
The source file's SHA-256 is `51f78d7d84f52fd73e5bc155c2239b737c58ce627d446894a809f1a36547ae18`.
The compiled table contains 63,905 entries, in the same format as `babelstone-ids.tsv.gz` but
without region tags. Rebuild it with `bun scripts/build_yi_bai_ids.mjs`.

Descriptions containing extended syntax or variant annotations are excluded entirely: their
meaning cannot yet be represented by the editor. Both primary and alternative unannotated
descriptions are retained. The workshop adds them after BabelStone's descriptions, keeping
existing descriptions and their region tags when the two sources agree.

Licence: MIT, Copyright (c) 2021 Yi Bai; see `data/licences/yi-bai-ids-MIT.txt`.

## `babelstone-ids.tsv.gz`

BabelStone IDS (Ideographic Description Sequences for CJK Unified Ideographs) by Andrew West (魏安),
<https://www.babelstone.co.uk/CJK/IDS.TXT>, File Date 2025-06-27 (Unicode 16.0 edition), SHA-256
`cc2a0a97e6a51ed6ebe59870ef2af66e83f3c3c27387d79b4441bb2d791d78b1`. 97,680 ideographs, 777 KB
gzipped, 2.2 MB as text.

- Licence: public domain. Note 2 of the file's header states that IDS sequences are facts not
  eligible for copyright and that "anyone is free to make use of the IDS data provided in this file
  for personal or commercial purposes without asking permission or providing attribution". It is
  credited all the same.
- Format: one line per ideograph, `char<TAB>sequences`, every alternative the file gives,
  space-separated, each with the source regions it describes (`⿰氵骨(GHTJKPV)`). The maintainer's `*`
  notes are left out. `{n}` is BabelStone's unencoded component n and `？` an unrepresentable one.
- The header warns that a sequence describes a character's form in the regions tagged, not an
  absolute glyph; every alternative is kept with its regions.
- The file draws on Kawabata Taichi's IDS data (<https://github.com/kawabata/ids>), itself descended
  from CHISE, and on IRG submissions, edited by its maintainer. This table is built from BabelStone's file.
- Built by `scripts/build_ids_data.py`.

## `ids-parts.json`

The parts palette (難輸入部件): the components of BabelStone IDS that a writer picks whole, with how
many ideographs use each, its stroke count, the class of its first stroke, and whether it is common,
hard to type or a CJK stroke. 1,713 Han entries (708 common, 967 hard to type, 38 strokes),
plus 768 Tangut components; 65 KB, 14 KB gzipped. Built by `scripts/build_ids_parts.py` followed by `bun run build:subtrees`; see the rules below.

- Licence: **LGPL-3.0** for the Rime-derived `first` column. The source authors and the LGPL/GPL
  texts are in `data/licences/`. The other columns use public-domain sequences, MIT-licensed
  decomposition choices, Unicode data and explicit radical counts.
- Format: `columns` `[part, uses, strokes, derived, first, kind]` and one row per part, most used
  first; `kind` is `c` (common), `d` (hard to type) or `s` (CJK stroke).

Sources:

- BabelStone IDS, as above: which components the sequences use, how many ideographs use each, and
  which split only into strokes.
- hfhchan/ids v1.0.2, `ids-20240112.txt`, Copyright (c) 2021 Henry Chan, MIT licence
  (<https://github.com/hfhchan/ids>, SHA-256
  `7466c8bd9151f1db5ef247fcbf84d7de4b36a6ec741e793c54972aa3dcbc0af4`): which components are left
  undecomposed (王 is not ⿱一土).
- Unihan 18.0.0 (Unicode Han Database, UAX #38), Copyright Unicode, Inc., Unicode License v3
  (<https://www.unicode.org/license.txt>, `Unihan.zip` SHA-256
  `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`): stroke counts
  (`kTotalStrokes`), the one-stroke ideographs counted as strokes, and the common set (`kJoyoKanji`
  for 常用漢字; `kTGH` positions 1–3500 for the first level of the 通用规范汉字表).
- Rime five-stroke dictionary, revision `1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48`,
  LGPL-3.0, <https://github.com/rime/rime-stroke>. Authors: 四季的風, 雪齋, Kunki Chou and 宋天.
  The table credits CNS11643, 北大中文論壇 and 宋天's extension data.
  SHA-256: `b3e93dce89c185f45c3d6e189b86b3a8626913352cc85e1094c786579a665791`.

Notes on the columns:

- Rime codes supply the first-stroke class: h/s/p/n/z → 横/豎/撇/點/折.
  The first listed code is used unless the alternatives start only with s and z; those entries
  use 豎 so vertical hooks in 小 and 水 agree with the palette's CJK stroke table.
  Unicode equivalents of individual CJK strokes use that table directly, including
  亅 → 豎, 乀 → 點 and 𠃍/𠃎 → 折. The equivalents come from `component-forms.tsv` below.
  Other stroke-order differences follow the first Rime code and can differ from Japanese order.
  All 1,641 Han components have a first-stroke class. ⻀, the four-stroke grass radical, starts 横.
  Circular ㇣ appears under “Other stroke”.
- A stroke count is Unihan's first `kTotalStrokes` value, which Unihan gives for the zh-Hans form
  where forms differ. The radical forms absent from Unihan have explicit counts:
  ⺊ 2, ⺌ 3, ⺗ 4, ⺼ 4, ⺈ 2, ⺶ 6, ⺄ 1, ⺝ 4, ⺀ 2, ⺆ 2, ⺻ 5, ⻀ 4.
  A CJK stroke counts 1 and is marked derived; other missing counts use the sum over the leaves
  of the first fully counted decomposition. All Han palette entries have a count.

## component-forms.tsv

Component forms that stand for another character (⺡ for 氵, 氵 for 水), which the description search
folds together. Copied from han-compose (<https://github.com/mkpoli/han-compose>, MIT)
`data/vocab/han-component-forms.tsv` at commit efb5acb, its first header line changed to say so;
SHA-256 of this copy `7e12d79da41b18f5fbf8fb0eae2adc31aa9f57e6e2eabe79836804c072008c38`. Its rows come from Unicode's EquivalentUnifiedIdeograph.txt 18.0.0
(Unicode License v3, <https://www.unicode.org/license.txt>; 348 rows) and cjkvi-variants'
`radical-variants.txt` at e4f1da2 (public domain, <https://github.com/cjkvi/cjkvi-variants>; 219
rows), each row naming its source.

## component-names.tsv

The names, words and readings people use for components, for the parts finder's search: 絞絲 and
绞丝 for 糸, ノ文 and のぶん for 攵, ノ木 and のぎ for 禾, 宝盖 and 寶蓋 for 宀, 倒八 for 丷,
卷字头 for 龹, and water, silk, みず, shui, mizu, jiaosipang, 수, thủy, Bộ Thủy, Kangxi radical 120
for the same components. 6,642 rows, 298 KB (58 KB gzipped), built by
`scripts/build_component_names.py`. Format: `name`, `char`, `source`, `detail`, one name for one
component per row; comments start with `#`.

The search folds a query and a name (NFKC, katakana as hiragana, Latin accents off, spaces and
punctuation out, Chinese scripts through `component-name-folds.tsv`) and takes a name that is the
whole query, then one it starts, then one it stands inside; a Latin query matches whole words and
their starts, and a word of five letters or more may stand inside a longer name. The adapter opens
the component a name found into its forms from `component-forms.tsv`, keeping the forms the palette
holds, so 絞絲 offers 纟, 糹 and 糸.

- Licence: **CC BY-SA 4.0** for the file as a whole, because its KANJIDIC2 and Wikipedia rows are
  (<https://creativecommons.org/licenses/by-sa/4.0/>). The code stays MIT; the file's header carries
  every notice.

Sources:

- anzumura/kanji-tools `data/radicals.txt` at c3e52cb (`https://github.com/anzumura/kanji-tools`),
  MIT, Copyright (c) 2022 Dan H: the Japanese names and readings of the 214 radicals (のぎ, のぶん,
  うかんむり).
- KANJIDIC2, file version 4, database version 2026-299, created 2026-10-26
  (`https://www.edrdg.org/kanjidic/kanjidic2.xml.gz`), CC BY-SA 4.0, Electronic Dictionary Research
  and Development Group: further Japanese radical names (`rad_name`), and the English meanings,
  Japanese, Korean and Vietnamese readings and pinyin of the radicals (みず, 수, thủy).
- The redirects to the Japanese Wikipedia articles on the 214 radicals, read 2026-10-26, CC BY-SA
  4.0 (`https://ja.wikipedia.org/`): ノ文 and のぶん to 攴部, ノ木偏 to 禾部, 草冠 to 艸部.
- catusf/tudien `dict/radical_name.txt` at a214ee3 (`https://github.com/catusf/tudien`), CC0 1.0: the
  Chinese names of the radicals (宝盖头, 绞丝旁, 反文旁).
- amzxyz/rime-wanxiang `lua/data/others.txt` at 275c61b (`https://github.com/amzxyz/rime-wanxiang`),
  CC BY 4.0, by amzxyz: its radical-nickname block (宝盖, 绞丝, 秃宝盖) and the names it gives
  non-radical parts (倒八, 卷字头, 石字头, 仓字底).
- Mararsh/MyBox `docs/data2d/ChineseRadicals_example_zh.csv` at 107ddc3
  (`https://github.com/Mararsh/MyBox`), Apache 2.0: one Chinese name for each radical (鱼字旁,
  鸟字旁, 门字框, 骨字旁).
- The article titles and redirects to the Chinese Wikipedia articles on the 214 radicals, read
  2026-10-26, CC BY-SA 4.0 (`https://zh.wikipedia.org/`): 絞絲旁, 三點水, 寶蓋頭.
- Unihan 18.0.0 (`https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip`, Unicode License v3,
  Copyright Unicode, Inc.; SHA-256 `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`):
  kDefinition, kMandarin, kJapaneseOn, kJapaneseKun, kHangul and kVietnamese of each radical
  (water, silk, shui, sui, mizu, 수, thủy).
- Wikidata labels and aliases for the 214 radicals, read 2026-10-27, CC0 1.0
  (`https://www.wikidata.org/`): English (Kangxi radical 120), Japanese (いとがしら), Chinese,
  Korean (실사) and Vietnamese (Bộ Thủy) names. The exact values are kept in
  `data/component-name-wikidata.json`; Latin aliases in other languages are left out.
- pypinyin 0.55.0 (`https://github.com/mozillazg/python-pinyin`), MIT: the pinyin of each Chinese
  name (baogaitou, jiaosipang, sandianshui), derived from the name.
- A Hepburn and Kunrei table in the build script, after the kana names and readings: nobun, sanzui,
  ukanmuri, nogihen, and the Kunrei spellings si, ti, tu, hu. These rows are romanizations, not
  another dictionary's names.
- OpenCC 1.4.2 (`https://github.com/BYVoid/OpenCC`), Apache 2.0, by BYVoid: the traditional
  or simplified spelling of a Chinese name where it differs, marked in `detail`. Characters that are
  radicals in their own right (几, 厂, 干, 尸, 里, 凶, 虫, 斗, 鬥) are kept as they are, since 几
  must not become 幾 and 斗 must not become 鬥. A redirect naming another radical than the article
  it points to (男部 to 女部, 鳥偏 to 酉部) is left out.

The kanji-tools, tudien, rime-wanxiang, MyBox, KANJIDIC2 and Unihan files are pinned by revision or
SHA-256 in the script. The exact Wikipedia redirects used are kept in
`data/component-name-redirects.json`, read 2026-10-26 (CC BY-SA 4.0), and Wikidata's labels and
aliases in `data/component-name-wikidata.json`, read 2026-10-27 (CC0 1.0); `--refresh` fetches both
again and rewrites them, and also rebuilds the folds.

## component-name-wikidata.json

The labels and aliases of the 214 radicals' Wikidata items, in English, Japanese, Chinese (all three
variants), Korean and Vietnamese, read 2026-10-27. The build keeps a value when it is a name of the
radical: an English `Kangxi radical N`, a Japanese or Chinese spelling, a Korean radical name
(실사, 사람인) or a Vietnamese `Bộ …` name. Values that are only the radical character, namespace
page paths, Latin aliases in other languages and values over 40 characters are left out. CC0 1.0,
214 items, 131 KB.

## component-name-folds.tsv

The characters folded together before a component name is compared: the traditional and simplified
spellings of a character, the positional forms of a component, and the Japanese shinjitai forms the
other tables leave apart. 593 folds, 15 KB, built by `scripts/build_component_names.py`. Format:
`form`, `char`, `source`; comments start with `#`.

- Source `component-forms`: `component-forms.tsv`, so 氵, 氺 and 水 fold together, as do 糹 and 纟
  with 糸, and 阝 with both 阜 and 邑.
- Source `opencc`: OpenCC 1.4.2, Apache 2.0, by BYVoid, for the traditional and simplified spellings
  (寶 to 宝, 龍 to 龙).
- Source `ja-variants`: the Japanese shinjitai forms 竜, 亀, 斉 and 歯, read with the forms they
  stand for (龍, 龜, 齊, 齒).
- Licence: **CC BY-SA 4.0** for the file as a whole
  (<https://creativecommons.org/licenses/by-sa/4.0/>); the component forms and OpenCC rows keep their
  own notices.

## character-vocabulary.tsv.gz

The readings and meanings of the common characters, for the Characters tab: water, shui, mizu, みず,
수 and thủy for 水; person for 人; silk for 糸. 102,456 rows, 831 KB gzipped. Format: `name`, `char`,
`source`, `detail`, `rank`, one name for one character per row; comments start with `#`.

The characters are the 9,810 Unihan `kIICore` characters that also have an IDS description, so a
result can be opened in the workshop. `rank` is lower for more common characters: KANJIDIC2's
newspaper frequency where it has one, otherwise 3000 plus Unihan's `kGradeLevel`. It orders equally
close names in the character search.

- Unihan 18.0.0 (`https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip`, Unicode License v3,
  Copyright Unicode, Inc.; SHA-256 `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`):
  kDefinition, kMandarin, kJapaneseOn, kJapaneseKun, kHangul and kVietnamese, and kIICore for the
  character set.
- KANJIDIC2, file version 4, database version 2026-299, created 2026-10-26
  (`https://www.edrdg.org/kanjidic/kanjidic2.xml.gz`), CC BY-SA 4.0, Electronic Dictionary Research
  and Development Group: English meanings, Japanese kana readings, pinyin, Korean and Vietnamese
  readings, nanori and frequency.
- Licence: **CC BY-SA 4.0** for the file as a whole, because its KANJIDIC2 rows are
  (<https://creativecommons.org/licenses/by-sa/4.0/>); the Unihan rows keep Unicode License v3.

## Tangut

The same IDS table also includes 6,145 records from Andrew West's
[BabelStone Tangut IDS](https://www.babelstone.co.uk/Tangut/TangutIDS.txt).
The pinned source digest is recorded in the table header and `scripts/tangut.py`.
These factual decompositions carry no regional tags. Eight malformed source sequences
are preserved verbatim (𗆽 𗈫 𗈬 𗌜 𗓜 𗱋 𗽉 𗽧); they cannot be loaded as complete editor trees.
Single-component descriptions are also preserved.

The palette adds 768 Tangut components (U+18800–U+18AFF), ordered by code point,
with `kind: "t"` and usage counts from those records. Stroke counts and first-stroke
classes are unknown. Components Supplement is accepted by the parser but is absent
from this source edition and the palette. Both data builders include Tangut through
`scripts/tangut.py`; the Han totals above describe the Han portion only.

## `tangut-outlines.json.gz`

Noto Serif Tangut 2.168 outlines, exported from the bundled WOFF2 by
`uv run scripts/build_tangut_outlines.py`. The file records the font checksum and
licence (SIL OFL 1.1; see `fonts/OFL-NotoSerifTangut.txt`). It includes the font's Tangut
characters and components, plus exact-description mappings from the IDS table.
Malformed descriptions and descriptions naming missing glyphs are excluded from those mappings.

Tangut previews load these outlines locally. Exact descriptions use the corresponding
character's glyph; edited descriptions use the composition engine's geometric layout.
Mixed Han–Tangut descriptions also load the host's Han export. The shared layout
constants in `src/composer/constants.json` come from han-compose at bd0829b (MIT),
previously used by the composer's test fixture. Tangut Components Supplement glyphs
are absent from this font version and report a missing glyph.

## Bopomofo outlines

`bopomofo-outlines.json.gz` holds U+3105–U+312F and U+31A0–U+31BF (75 letters).
Noto Sans CJK JP 2.004 at weight 400 supplies 71 glyphs; Plangothic P1 V2.9.5795
supplies U+31BC–U+31BF. Both are SIL OFL 1.1; licence texts are in `fonts/`.
The compressed document records each source URL and SHA-256. Rebuild with
`uv run scripts/build_bopomofo_outlines.py FONT_DIR`, using the pinned fonts
listed in `fonts/README.md`. Outlines use the same packed records as Tangut.

## Subtree frequencies and compound palette entries

Run `bun run build:subtrees` after rebuilding `ids-parts.json` or the bundled IDS
corpus. This reads the shipped corpus without downloading a newer edition and
writes `ids-subtrees.json.gz` plus the compound entries in `ids-parts.json`.

The frequency report contains every exact subtree, including leaves, complete
roots, numbered unknown components and variation selectors. Its columns are
`[part, uses, occurrences, nestedUses, strokes]`: `uses` counts distinct source
characters, `occurrences` counts tree positions across distinct IDS alternatives,
and `nestedUses` counts characters using the tree below the root. Palette usage
counts are refreshed from `uses` for single-character entries too. Identical
regional alternatives count once. Characters are not recursively expanded and
variant glyphs are not merged. The report records malformed sequences under
`rejected`; the current corpus has eight, all Tangut.

Common also shows hard-to-type components used by at least 50 characters
(285 in this corpus), while keeping them available in their stroke groups.
Compound IDS use a lower cutoff of 30 distinct characters below the root. The
current corpus supplies 28 frequent trees: sixteen remain as compound shortcuts
and twelve normalize to ten encoded characters. The fifteen manual entries
bring the compound total to thirty-one. Exact regional spellings remain searchable aliases
and appear in hover text. An encoded entry counts each source character once
across its literal spelling and all selected IDS aliases; the raw report retains
separate exact counts. Single-character promotion keeps its existing cutoff of 50.

The manual shortcut `⿰冫⿱丿丶` is included with
113 corpus uses and an estimated four strokes. BabelStone’s source component
`{11}` (bottom of 軣, `⿰⿱丶㇀⿱㇒丶`) supplies those uses; its exact source
spelling remains in the raw report. The shortcut count deduplicates characters
across the source placeholder and literal spelling. Its dedicated four-dot outline
also renders the equivalent spelling `⿰冫⿾冫`, both alone and inside larger IDS.
The Sans form uses the four detached contours of Noto Sans CJK JP 氺; the Serif
form takes the dots from Noto Serif CJK JP 塁, detaching the upper-right stroke
from 田. Both retain an open centre without the central hook. The outlines are
under SIL OFL 1.1 (see `fonts/OFL-NotoSansCJK.txt` and `fonts/OFL-NotoSerifCJK.txt`). Compound cells show a rendered
icon with an `IDS` marker; hovering reveals the sequence and stroke count.
Picking or dragging one inserts its complete tree. Stroke counts are searchable
with the existing numeric filter. The dotted `⿻者丶` is explicitly counted as nine strokes to avoid counting
the regional dot twice. Other counts are additive estimates from the existing palette's
stroke metadata, recursively resolving other leaves where possible. They are
marked `derived` and displayed with `≈`; overlapping strokes can make the true
count differ. Subtraction, unresolved leaves and cycles retain an unknown count.
The generated report uses the same stroke calculation for every subtree.

The report derives from the public-domain BabelStone Han and Tangut IDS and the
stroke-count sources listed above. It contains no Rime stroke-order column.

`src/composer/component-forms.json` contains selected Noto CJK JP outlines in
Sans 2.004 and Serif 2.002. `scripts/build_component_forms.py` verifies the source
TTC hashes recorded in the JSON before exporting them. Rebuild with
`uv run scripts/build_component_forms.py <sans-ttc> <serif-ttc>`.
Detached forms retain their source position in the native em instead of being
enlarged to fill the cell, preserving their stroke thickness and spacing. Palette icons share the surrounding
text’s em size. The six-stroke `⿳士冖一` has a dedicated two-level layout:
the intact `⿱士冖` crown from 壱 above the short 一 from 壹. The line moves
vertically without scaling its strokes. `⿱⿱士冖一` uses the same layout. `⿻者丶` uses the glyph shared by
者 + U+E0101 and U+FA5B, verified in both fonts' variation tables.
Exact 塁 and 疂 descriptions use their complete native JP glyphs.
`⿱宀儿` uses 宂 (U+5B82), whose source regions are HTKP; `⿻三丨` uses
丰 (U+4E30), whose exact source regions are GJKPV. Explicit IDS typed in the
editor remain unchanged; palette selection inserts the encoded counterparts.
Bundled styles affect only these selected forms; other composed outlines still
come from the configured Han export. Whole glyphs fall back to their operands
in adjustment mode when the export supplies them.

The 35–49 usage band adds `⿻日丿` (49), `⿴𦥑同` (41), `⿱丶丶` (39),
`⿱甶儿` (37), and `⿻口丿` (35). New aliases normalize to 𦭝, 犮, 敖, 蒦,
丰, 辱 and 包; both 艹/卝 spellings of 𦭝 contribute to one union count.
The specialized `⿴𦥑同` outlines preserve 興's native upper component in both
fonts, omitting 一八 below it. The outer 𦥑 is cropped at y=222 (Sans) or
y=197 (Serif), with 同's contours unchanged and two editable operands retained.
The Serif bottom stroke's rising terminal is removed before cropping.

The 30–34 usage band adds `⿰丿丨` (33), `⿱左⺝` (33), `⿸耳又` (33),
`⿱㇒⿻日丿` (32), `⿰二二` (30), and `⿸⿻口丿乚` (30).
`⿱⿱㇒⿻日丿十` and `⿻九丶` normalize to existing 卑 and 丸 entries,
with union counts of 122 and 125.
The upper-卑 shortcut uses Noto's connected-stroke U+FA35 glyph with 十 removed:
Sans retains the four counters and reconstructs the outer contour above the
bottom 十; Serif omits its separate 十 contour. It floats at native em size.
`⿰二二` places two native 二 columns side by side, contracting horizontal
length only and translating the bars vertically to retain their stroke thickness.
Both forms have Sans/Serif outlines. The four-bar form keeps two editable columns;
the atomic upper-卑 drawing falls back to individual operands in adjustment mode
when the configured export supplies them.

The shared enclosures of 彥/產 and 彦/産 are manual literal shortcuts:
`⿳亠㐅厂` (also rendered/searched as `⿱文厂`) and `⿳亠丷厂`.
Both have an estimated six strokes and appear in Common and Stroke count.
The latter deliberately remains IDS despite its encoded equivalent 产 (`U+4EA7`),
so selecting it preserves the component spelling. Its 29 direct corpus uses
combine the literal IDS and 产; the former has zero exact subtree matches
because descriptions such as `⿳亠㐅⿸厂彡` distribute its strokes across nodes.
This count does not assert that the visible component is absent from 彥 or 產.
The traditional outline is extracted from Noto 產 with 生 removed; the other
uses Noto 产. Both preserve the native em, stroke weight and long 厂 stroke,
with separate Sans/Serif outlines. The traditional enclosure with 彡 or 生
uses the complete native 彥 or 產 glyph, respectively. Other enclosed operands
are placed within a font-specific opening based on the native 產 proportions;
the 产 opening is shorter to leave space below its lower crossbar. These are atomic native previews;
adjustment mode uses operand outlines when available. Native compound previews use
outline-based layout rather than extrapolating the learned glyph layout model;
Kaisho keeps its export layout. Source aliases remain
searchable and visible in tooltips, without changing the inserted IDS.
When 儿 begins the enclosed vertical stack, its native 元-derived legs meet the
enclosure bar; their stroke weight is adjusted continuously as the available
height changes. The remaining operand is laid out below. A neighbouring left 朱
uses its full-height cut from 鴸 in both Sans and Serif, with the spacing of a
native side-by-side character. For 昌 or ⿱日日 below 儿, the preview uses the
native 昌 cut from 菖 in either face, keeping their displayed proportions consistent.
Its counters and gaps are shortened more than its horizontal bars so that the
strokes remain visible in the compact placement. The 朱 spacing is checked for
collisions against the actual right-hand outline.

These curated components were suggested by परवद💙💛
([@zoenshiueh_lieu](https://x.com/zoenshiueh_lieu)). The zi.tools stroke-chain
and overlap notation is recorded as a search alias; selected items insert the
standard Unicode IDS shown below, without adding a second parser dialect.

| Shortcut | Direct source uses | Estimated strokes | Host examples |
| --- | ---: | ---: | --- |
| `⿻𢆶戈` | 9 | 10 | 幾、畿 |
| `⿸尸彳` | 0 | 6 | 屐、履 |
| `㇯鹿比` | 27 | 7 | 鹿、慶 |
| `㇯馬灬` | 13 | 6 | 馬、𩡧 |
| `㇯鳥灬` | 25 | 7 | 鳥、島 |
| `⿳亠口冖` | 28 | 7 | 亭、亮 |
| `⿸尸氺` | 1 | 8 | 犀、𣺳 |
| `⿳𰀉冖木` | 0 | 11 | 橐、櫜 |
| `⿳卝罒冖` | 2 | 11 | 夢、𮒽 |
| `⿱丿乚` | 5 | 2 | 𦨊、𠝉 |

The three zi.tools spellings correspond to the outside of 鹿, 馬 without 灬,
and 鳥 without 灬, as confirmed by the host entries in
[Yi Bai's IDS data](https://github.com/yi-bai/ids/blob/da1e9f8a09e2ec8faaf176bac99203f978282041/ids_lv0.txt):
`⿸广⿻[:-1]〢コ`, `⿷#(-一丨b𠃌)𰀁`, and
`⿱丿⿷⿴#(一-𠃍丨b𠃌)一一`. Their original strings remain searchable.
BabelStone placeholders `{29}`, `{55}`, `{51}`, `{47}`, and `{87}` supply
counts for the corresponding native forms. `{29}` names the outside of 幾/畿;
its approximate replacement uses 弋, while this requested drawing preserves 戈.
The three reviewed subtractions have explicit stroke estimates. Other
subtractions still have unknown stroke counts.

Nine previews use pinned Noto native host outlines: 畿 without 田, 屐 without
支, 鹿 without 比, 馬/鳥 without 灬, 亭 without 丁, 犀 without 牛, 橐 without
石, and 夢 without 夕. The TC font face supplies 氺 in 犀 and the separated
four-stroke 卝 in 夢. The Serif 夢 preview combines its crown with the native
冖 from 亭, translated down 70 font units. Removed connected outlines are
reconstructed at existing path points; remaining strokes keep native thickness
and placement. `⿱丿乚` and its source alias `⿱㇒乚` share a dedicated
Sans/Serif drawing made from 毛's shallow sweep and hooked stem, with the two
intervening horizontal strokes removed. The retained strokes meet at their
native junction and remain two editable groups. The five direct source
occurrences are 𠝉 (T), 𡜞 (G), 𥟯 (G), 𦨊 (GT), and 𩣛 (GT).

Frequency alone cannot select every useful visual part. The raw report counts
exact written subtrees, not recursive expansions through encoded characters,
regroupings across node boundaries, or all Unicode-equivalent spellings.
For example, 履 is recorded as `⿸尸復`; 橐 uses `{38}` above 䂞; and 夢's
crown is usually split across a ternary root. The current automatic cutoff is
30 distinct characters below the root. Curated entries and reviewed aliases
therefore supplement that ranking. The counts above are direct corpus counts,
not estimates of how often the visible shapes occur after expansion. The raw
frequency report and automatic cutoff are unchanged.

## Small Seal

`small-seal.json.gz` contains the Jiguge (汲古閣) edition's IDS from
[CHISE-IDS](https://gitlab.chise.org/CHISE/ids), maintained by MORIOKA Tomohiko and
contributors. It is GPL-2.0-or-later; see `COPYING-small-seal.txt`. The complete input
IDS and the 540 Shuowen mapping files are in `small-seal-sources.tar.gz`.

| Coverage | Count |
| --- | ---: |
| Source character records | 11,114 |
| Explicit, unambiguous entity-to-Unicode mappings | 816 |
| Editor-ready descriptions / head characters | 49 |
| Seal components used by those descriptions | 31 |
| Drawable palette forms | 1,334 |
| Selected basic parts | 138 |
| Compound forms | 1,172 |
| Other / unclassified forms | 24 |
| Empty descriptions | 337 |
| Descriptions with an unmapped head character | 10,010 |
| Descriptions with unresolved component identifiers | 747 |

There are 29 additional apparent-form descriptions, so the description statuses total
11,143. An empty field does not distinguish an atomic character from unfinished data.
The editor's 49 descriptions are machine-validated imports, without a separate
palaeographic review.

Sources, pinned in `scripts/build_small_seal.py` and the output's `sources` field:

- [`IDS-SW-JIGUGE.txt`](https://gitlab.chise.org/CHISE/ids/-/blob/ac35413635608512f5e10187812cfab3b6ea47c1/IDS-SW-JIGUGE.txt),
  CHISE-IDS revision `ac35413635608512f5e10187812cfab3b6ea47c1`.
- [`ShuoWen-SR001.el` through `ShuoWen-SR540.el`](https://gitlab.chise.org/CHISE/xemacs-chise/-/tree/0dc65c74293d3b74eda1a9861273675a5b26fd99/lisp/utf-2000),
  XEmacs CHISE revision `0dc65c74293d3b74eda1a9861273675a5b26fd99`.

The importer reads Lisp as data. A seal code point must occur as a direct `=ucs`
property on the same record as the exact `=shuowen-jiguge` identifier (or an explicitly
named edition identifier). Nested properties, glyph inheritance, modern Han equivalents,
and ambiguous mappings cannot establish identity. Unresolved references remain literal
`&…;` strings. Only complete, supported Unicode IDS enters `table`.

The palette is independent of the 49 complete descriptions. It includes mapped
CHISE heads and the Unicode Shuowen radical heads for which a pinned SVG exists.
`seal-sources.txt.gz` preserves the pinned Unicode mapping from the Kaiyuan source
archive; its license is in `COPYING-seal-sources.txt`. `paletteSources` records the
Unicode digest, the BabelStone IDS digest, and the reference for the 𠙵/口 lookup alias.

`parts` entries carry `modern` lookup names, `sealGroup`, and `sealBasis`:

- `basic` / `selected`: an editorial starter selection of familiar radical heads.
  Membership does not establish historical indivisibility.
- `compound` / `seal-ids`: the source has a structural or apparent IDS, including
  unresolved operands and extended operators.
- `compound` / `cjk-ids`: a modern equivalent has a compound IDS. Its `modernIds`
  are retained for inspection and the UI marks the grouping with `≈`.
- `other` / `unknown`: no classification is established. An empty source field
  never establishes that a character is atomic.

Modern IDS inference affects palette grouping only. It never supplies a seal
`table` entry or changes exact encoding lookup. Palette usage counts include mapped
components in unresolved source descriptions, counted once per source head.

Rebuild the palette offline with `python3 scripts/build_small_seal_palette.py`.
To refresh the bundled SVG subset from the same pinned Kaiyuan revision, pass
`--upstream path/to/kaiyuan.tar.gz`; its SHA-256 is checked before extraction.
Rebuild the font and outlines afterward with `uv run scripts/build_small_seal_font.py`.

JSON format 1 has `table` (seal character to descriptions), `parts`, `modern` (search
labels), `sources`, `license`, and `records`. Each source record has its ID, mapped
character or null, original structural description, and a `descriptions` list. Each
description preserves `original`, `kind` (`structural` or `apparent`), resolved `text`,
`status`, and any `unresolved` identifiers. `unsupported` covers resolved expressions
that the editor cannot parse. These audit records remain available even when the
character has no usable description.

Rebuild with `python3 scripts/build_small_seal.py`; downloads are cached and checked
against pinned SHA-256 digests. `--cache` and `--out` select their locations. The source
archive is written beside the output. Test mapping safeguards with
`python3 -m unittest discover -s scripts -p test_small_seal.py`.

`small-seal-outlines.json.gz` holds the supported glyphs and unambiguous exact-description
mappings. The glyph sources depict the Chen Changzhi edition; they are a rendering aid
for the Jiguge descriptions. See [the font notes](../fonts/README.md#ids-seal) for source
quality, licensing and rebuilding.

## Unicode fallback outlines

`unicode-outlines/*.json.gz` contains 40,221 glyph outlines in 196 chunks, each covering at most
256 code points. The full set is 11,357,016 compressed bytes; the composer fetches only chunks
needed for glyphs missing from the selected export. An export's own glyphs retain priority.
`unicode-coverage.json` lists exact covered ranges; `unicode-outlines.json` records chunk hashes,
counts, source fonts, source digests and copyright notices.

Sources are Noto Sans CJK JP 2.004 and the regular Noto fonts from Ubuntu's
`fonts-noto-core` and `fonts-noto-extra` 20201225-2 packages, under SIL OFL 1.1.
The pinned file names, SHA-256s and source URLs are in [`unicode-fonts.json`](unicode-fonts.json).
Full copyright notices and the license are in [`OFL-NotoUnicode.txt`](../fonts/OFL-NotoUnicode.txt).
[Noto](https://github.com/notofonts/noto-fonts) supplies the script-specific designs;
[Noto CJK](https://github.com/notofonts/noto-cjk/tree/Sans2.004) supplies the CJK marks and kana.

Rebuild with `uv run scripts/build_unicode_outlines.py FONT_DIR [FONT_DIR ...]`, using the extracted
package font directories and Noto CJK font. The builder checks every source digest, selects the first
available glyph in the lock file's order, and normalizes coordinates to 1000 units per em.
[FontTools Cu2QuPen](https://fonttools.readthedocs.io/en/latest/pens/cu2quPen.html) converts cubic
curves with a maximum error of 0.5 normalized units; packed coordinates use quarter-unit precision.
Unicode acceptance uses pinned Bun 1.3.14, matching the editor's rules. The gzip OS header is
normalized so supported Python versions produce the same shard bytes.

These are individual monochrome glyphs, without contextual shaping or color-emoji layers.
A variation selector needs an explicit glyph in the selected export; it is not silently dropped.
Unassigned and private-use characters without a source outline remain unavailable.

## Pyramid glyph catalog

`src/composer/pyramid-glyphs.json` contains all 146 one-over-two repeated-component
characters found in the pinned BabelStone data above (147 attested descriptions).
Run `python3 scripts/build_pyramid_glyphs.py` to regenerate it, or add `--check`
to verify it. The generator accepts an explicit lower pair or an encoded pair
such as 林 in 森 and 𱋁 in 麤. Only the positional equivalents 牜/牛 and 釒/金
are folded, retaining 犇 and 鑫. Approximate IDS are excluded.

Each entry records its character, repeated part, source description and lower
pair. The composer recognizes the source description, its expanded pair, and
its three equal full components. Missing or excluded glyphs retain component
composition. This catalog covers the pinned Unicode 16.0 source, rather than
claiming coverage of unencoded characters or later Unicode additions.

### Gongche notation components

Suggested by परवद💙💛 ([@zoenshiueh_lieu](https://x.com/zoenshiueh_lieu)):

| Literal IDS | Strokes | Direct corpus uses |
|---|---:|---:|
| `⿰氵氵` | 6 | 0 |
| `⿱𰀪亻` | 4 | 0 |

Both are curated shortcuts in Common and their stroke-count groups. Counts are
additive (3 + 3 and 2 + 2). Neither sequence occurs in the pinned BabelStone
corpus, so these entries retain zero usage counts and their literal IDS.
The `⿱𰀪亻` preview uses native Noto Sans/Serif 彳 outlines with an extra
upper sweep; the sweeps retain their original stroke weight. Its two IDS leaves
remain editable. This supplies the form even when the Serif export lacks 𰀪.
The `⿰氵氵` drawing repeats the same native water-radical outline by translation,
so both columns have matching proportions and remain separated in either style.
