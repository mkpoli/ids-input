# Data

Each file keeps its own licence; the MIT licence of the code does not cover them.

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
  from CHISE, and on IRG submissions, edited by its maintainer. Only BabelStone's file is read here.
- Built by `scripts/build_ids_data.py`.

## `ids-parts.json`

The parts palette (難輸入部件): the components of BabelStone IDS that a writer picks whole, with how
many ideographs use each, its stroke count, the class of its first stroke, and whether it is common,
hard to type or a CJK stroke. 1,679 Han entries (674 common, 967 hard to type, 38 strokes),
plus 768 Tangut components; 65 KB, 14 KB gzipped. Built by `scripts/build_ids_parts.py`, whose docstring gives the rules.

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
