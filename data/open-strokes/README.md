# Open stroke orders

The stroke order of Han characters, from two sources, with orders induced for the characters a
source lacks. Every row names where it comes from; an induced row is never mixed into a source's
file.

The format is `ids-input/open-strokes`, version 1.

## Files

| File | Rows | |
| --- | ---: | --- |
| `cns11643.tsv.gz` | 76,282 | Taiwan's standard order, from CNS 全字庫: `char`, `codepoint`, `orders`, `cns` (the CNS plane-codes mapped to the character). Open Government Data License 1.0. |
| `rime-stroke.tsv.gz` | 102,582 | Rime's five-stroke dictionary: `char`, `codepoint`, `orders`. LGPL-3.0. |
| `induced.tsv.gz` | 21,541 | Induced orders: `char`, `codepoint`, `orders`, `basis`, `from`, `source`. Each row keeps the terms of its `source`. |
| `manifest.json` | | Sources with checksums, licences, coverage and the tables below. |
| `LICENSE-rime-stroke-LGPL-3.0.txt`, `LICENSE-GPL-3.0.txt`, `AUTHORS-rime-stroke.txt` | | The terms and authors of the Rime dictionary. |

The data files are gzipped UTF-8 TSV with a header row. `orders` holds one code per way of writing
the character, separated by a space, in the source's order.

## Strokes

A code is one symbol per stroke in writing order, in the five classes. Each file keeps its source's
symbols.

| Class | `cns11643` | `rime-stroke` |
| --- | --- | --- |
| 横 horizontal | `1` | `h` |
| 豎 vertical | `2` | `s` |
| 撇 left-falling | `3` | `p` |
| 點 dot | `4` | `n` |
| 折 turning | `5` | `z` |

Neither source gives stroke paths, and neither gives mainland, Japanese or Korean standard order.

## The two sources are not two styles

The Rime dictionary states that its main table comes from CNS 全字庫 and that its data beyond
Extension D was added by its authors. The files bear that out: of the 76,278 characters both
record, 75,579 have an order in common, and the agreement drops where the CNS-derived part ends.

| Block | In both | Same order |
| --- | ---: | ---: |
| URO and earlier | 27,498 | 27,479 |
| Extension B | 42,704 | 42,663 |
| Extension C | 4,101 | 4,099 |
| Extension D | 195 | 184 |
| Extension E | 1,263 | 654 |
| Extension F and later | 517 | 500 |

Through Extension D the Rime file is CNS order with added alternatives. In Extension E about half
of the shared characters differ (the 馬 component begins `hs` in Rime's rows there and `21` in
CNS), so Rime's own additions do not all follow CNS order. This project has not identified the
convention they follow.

## Induced rows

`basis` says how the order was written.

- `equivalent`: the character is a compatibility ideograph or a radical form, and `from` is the
  unified ideograph it normalizes to (NFKC). The row repeats that character's recorded orders.
  719 rows from `cns11643`, 681 from `rime-stroke`.
- `ids`: `from` is the character's description in BabelStone IDS (the sequence its T source gives,
  else the first), and the order joins the recorded orders of its components.
  20,141 rows from `cns11643`, 0 from `rime-stroke`. Up to 8 ways are kept.

The components are joined in the order the description names them, except:

- ⿺ with 辶 or 廴 as the enclosure, and ⿶: what is held is written first.
- ⿴: the enclosure without its last stroke, then what it holds, then that stroke.
- ⿷: the enclosure's first stroke, then what it holds, then the rest.

An order is induced only through ⿰ ⿱ ⿲ ⿳ ⿴ ⿵ ⿶ ⿷ ⿸ ⿺, at every level of the description. A
component the source does not record is read by its own description in turn, and one of
BabelStone's numbered components by the fragment its note 6 writes it out as; `from` keeps the
description as BabelStone spells it. A description BabelStone marks 〾 is not used.

### How often the rules agree with a source

Each recorded character with a description was written by the same rules from the same source and
compared with its recorded orders. "Written" counts the characters whose components all have orders;
"Agree" those where one written order is a recorded one. Rows are the description's outer operator.

`cns11643`:

| Operator | Described | Written | Agree | | Induced |
| --- | ---: | ---: | ---: | ---: | --- |
| ⿰ | 49,027 | 47,228 | 42,958 | 91.0% | yes |
| ⿱ | 16,869 | 16,234 | 13,853 | 85.3% | yes |
| ⿺ | 2,788 | 2,730 | 2,347 | 86.0% | yes |
| ⿸ | 2,466 | 2,396 | 2,201 | 91.9% | yes |
| ⿳ | 1,397 | 1,231 | 936 | 76.0% | yes |
| ⿵ | 738 | 711 | 626 | 88.0% | yes |
| ⿲ | 509 | 472 | 399 | 84.5% | yes |
| ⿹ | 330 | 219 | 81 | 37.0% | no |
| ⿻ | 285 | 223 | 120 | 53.8% | no |
| ⿴ | 256 | 253 | 224 | 88.5% | yes |
| ⿷ | 143 | 137 | 109 | 79.6% | yes |
| ⿶ | 48 | 46 | 37 | 80.4% | yes |
| ⿽ | 15 | 11 | 2 | 18.2% | no |
| ㇯ | 5 | 4 | 0 | 0.0% | no |
| ⿾ | 3 | 3 | 1 | 33.3% | no |
| ⿿ | 3 | 3 | 1 | 33.3% | no |
| ⿼ | 2 | 2 | 1 | 50.0% | no |

`rime-stroke`:

| Operator | Described | Written | Agree | | Induced |
| --- | ---: | ---: | ---: | ---: | --- |
| ⿰ | 63,278 | 62,882 | 61,695 | 98.1% | yes |
| ⿱ | 21,770 | 21,521 | 20,351 | 94.6% | yes |
| ⿺ | 3,572 | 3,536 | 3,426 | 96.9% | yes |
| ⿸ | 3,022 | 2,986 | 2,921 | 97.8% | yes |
| ⿳ | 1,793 | 1,717 | 1,525 | 88.8% | yes |
| ⿵ | 941 | 935 | 888 | 95.0% | yes |
| ⿲ | 697 | 680 | 657 | 96.6% | yes |
| ⿹ | 438 | 421 | 242 | 57.5% | no |
| ⿻ | 370 | 330 | 195 | 59.1% | no |
| ⿴ | 321 | 319 | 299 | 93.7% | yes |
| ⿷ | 188 | 185 | 156 | 84.3% | yes |
| ⿶ | 54 | 53 | 49 | 92.5% | yes |
| ⿽ | 15 | 13 | 2 | 15.4% | no |
| ㇯ | 9 | 6 | 0 | 0.0% | no |
| ⿾ | 4 | 4 | 2 | 50.0% | no |
| ⿼ | 3 | 3 | 2 | 66.7% | no |
| ⿿ | 3 | 3 | 2 | 66.7% | no |

An induced row is a prediction, not a record. Over the operators induced through, the rules agree
with CNS on 89.2% of the characters CNS records. The rows induced from CNS cannot be checked against the
Rime file: Rime records 20,141 of those characters and 9,959 agree, since Rime's
additions do not all follow CNS order.

## Coverage

| Source | Recorded | By equivalence | From IDS | Without an order |
| --- | ---: | ---: | ---: | ---: |
| `cns11643` | 76,282 | 719 | 20,141 | 6,210 |
| `rime-stroke` | 102,582 | 681 | 0 | 89 |

"Without an order" counts the Han characters the workshop's composer draws or BabelStone IDS
describes that end with no row from that source.

## Sources and terms

- CNS11643 中文標準交換碼全字庫, `CNS_strokes_sequence.txt` in `Properties.zip` and the Unicode
  tables in `MapingTables.zip`, <https://www.cns11643.gov.tw/>. 政府資料開放授權條款-第1版 (Open
  Government Data License, version 1.0), <https://data.gov.tw/license>. Attribution:
  數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw。 The archives carry no
  version; `manifest.json` records the SHA-256 of the copies read. Private Use code points are left out.
- Rime five-stroke dictionary, `stroke.dict.yaml`, revision
  `1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48`, <https://github.com/rime/rime-stroke>. Authors: 四季的風, 雪齋,
  Kunki Chou and 宋天; the table credits CNS11643, 北大中文論壇 and 宋天's extension data.
  LGPL-3.0; the licence texts are beside this file. `rime-stroke.tsv.gz` is a modified form of the
  dictionary: reduced to the Han characters with a complete five-class code, one row per
  character, in code point order.
- BabelStone IDS, `IDS.TXT`, Andrew West (魏安), <https://www.babelstone.co.uk/CJK/IDS.TXT>, public
  domain: the descriptions induced rows are written from.

## Rebuild

`bun scripts/build_open_strokes.mjs` fetches the sources and writes the files, this one included.
