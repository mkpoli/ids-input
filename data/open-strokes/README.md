# Open stroke orders

The stroke order of Han characters, from two sources, with orders induced for the characters a
source lacks. Every row names where it comes from; an induced row is never mixed into a source's
file.

The format is `ids-input/open-strokes`, version 2.

## Files

| File | Rows | |
| --- | ---: | --- |
| `cns11643.tsv.gz` | 76,282 | Taiwan's standard order, from CNS 全字庫: `char`, `codepoint`, `orders`, `cns` (the CNS plane-codes mapped to the character). Open Government Data License 1.0. |
| `rime-stroke.tsv.gz` | 102,582 | Rime's five-stroke dictionary: `char`, `codepoint`, `orders`. LGPL-3.0. |
| `induced.tsv.gz` | 26,070 | Induced orders: `char`, `codepoint`, `orders`, `basis`, `from`, `source`, `ids`. Each row keeps the terms of its `source`. |
| `entered.tsv` | 1 | Orders entered by hand: `char`, `codepoint`, `orders`, `basis`, `by`, `source`, `date`. CC0 1.0. |
| `wanted.tsv` | 83 | Components without an order that keep characters from being written: `char`, `codepoint`, `source`, `blocks`, `alone`, `examples`. CC0 1.0. |
| `manifest.json` | | Sources with checksums, licences, coverage and the tables below. |
| `LICENSE-rime-stroke-LGPL-3.0.txt`, `LICENSE-GPL-3.0.txt`, `AUTHORS-rime-stroke.txt` | | The terms and authors of the Rime dictionary. |
| `LICENSE-yi-bai-ids-MIT.txt` | | The terms of Yi Bai's descriptions. |

The data files are UTF-8 TSV with a header row, gzipped where the name ends in `.gz`. `orders` holds one code per way of writing
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
- `ids`: `from` is the character's description and the order joins the recorded orders of
  its components. The description is BabelStone's (the sequence its T source gives, else the
  first) or, where BabelStone has none, Yi Bai's; the `ids` column names which.
  24,667 rows from `cns11643` (4,187 of them by Yi Bai's descriptions), 3 from `rime-stroke`. Up to 8 ways are kept.

The components of ⿰ ⿱ ⿲ ⿳ are joined in the order the description names them. In the other
operators the first component encloses, crosses or carries the second, and the second is written at
a place among the first's strokes:

| Place | The held part is written |
| --- | --- |
| `outer-first` | after the whole enclosure |
| `inner-first` | before the enclosure |
| `after-1`, `after-2`, `after-3` | after the enclosure's first one, two or three strokes |
| `before-last`, `before-last-2` | before the enclosure's last one or two strokes |

The place is learned per enclosure from the characters the source records: an enclosure with at
least 5 such characters takes the place that writes the most of them as recorded, if that is
90% or more. `cns11643` teaches 56 places and `rime-stroke` 106; `manifest.json` lists them
under `induction.learned`. An enclosure without a learned place takes its operator's usual one:
`inner-first` for ⿶ and for ⿺ with 辶 or 廴, `before-last` for ⿴, `after-1` for ⿷, `outer-first` otherwise.

⿹ and ⿻ have no usual place that holds, so they are induced through only for the enclosures with a
learned one. In `cns11643`: ⿹气 outer-first (58 of 62), ⿹弓 outer-first (6 of 6), ⿻一 outer-first (13 of 14), ⿻大 after-1 (13 of 14), ⿻十 outer-first (5 of 5).

⿰ ⿱ ⿲ ⿳ ⿴ ⿵ ⿶ ⿷ ⿸ ⿺ are induced through at every level of the description. A component the source
does not record is read by its own description in turn, and one of BabelStone's numbered components
by the fragment its note 6 writes it out as; `from` keeps the description as its dataset spells
it. A description BabelStone marks 〾 is not used.

### How often the rules agree with a source

Each recorded character with a description was written by the same rules from the same source and
compared with its recorded orders, with the places learned from the other half of the characters
(split by code point parity), so none scores a place it taught. "Written" counts the characters the
rules write; "Agree" those where one written order is a recorded one. Rows are the description's
outer operator; "Induced" says whether it is induced through always, only where a place was
learned, or never.

`cns11643`:

| Operator | Described | Written | Agree | | Induced |
| --- | ---: | ---: | ---: | ---: | --- |
| ⿰ | 49,032 | 46,889 | 42,834 | 91.4% | always |
| ⿱ | 16,869 | 15,886 | 13,683 | 86.1% | always |
| ⿺ | 2,788 | 2,708 | 2,342 | 86.5% | always |
| ⿸ | 2,466 | 2,352 | 2,183 | 92.8% | always |
| ⿳ | 1,397 | 1,191 | 922 | 77.4% | always |
| ⿵ | 738 | 700 | 640 | 91.4% | always |
| ⿲ | 509 | 462 | 395 | 85.5% | always |
| ⿹ | 330 | 110 | 98 | 89.1% | learned |
| ⿻ | 285 | 15 | 12 | 80.0% | learned |
| ⿴ | 256 | 254 | 224 | 88.2% | always |
| ⿷ | 143 | 136 | 110 | 80.9% | always |
| ⿶ | 48 | 45 | 36 | 80.0% | always |
| ⿽ | 15 | 0 | 0 |  | never |
| ㇯ | 5 | 0 | 0 |  | never |
| ⿾ | 3 | 0 | 0 |  | never |
| ⿿ | 3 | 0 | 0 |  | never |
| ⿼ | 2 | 0 | 0 |  | never |

`rime-stroke`:

| Operator | Described | Written | Agree | | Induced |
| --- | ---: | ---: | ---: | ---: | --- |
| ⿰ | 66,176 | 65,116 | 64,134 | 98.5% | always |
| ⿱ | 22,769 | 21,997 | 20,964 | 95.3% | always |
| ⿺ | 3,729 | 3,644 | 3,578 | 98.2% | always |
| ⿸ | 3,110 | 3,006 | 2,968 | 98.7% | always |
| ⿳ | 1,810 | 1,642 | 1,479 | 90.1% | always |
| ⿵ | 974 | 952 | 934 | 98.1% | always |
| ⿲ | 710 | 677 | 658 | 97.2% | always |
| ⿹ | 470 | 341 | 336 | 98.5% | learned |
| ⿻ | 378 | 20 | 17 | 85.0% | learned |
| ⿴ | 354 | 352 | 331 | 94.0% | always |
| ⿷ | 189 | 180 | 155 | 86.1% | always |
| ⿶ | 54 | 51 | 47 | 92.2% | always |
| ⿽ | 15 | 0 | 0 |  | never |
| ㇯ | 9 | 0 | 0 |  | never |
| ⿾ | 4 | 0 | 0 |  | never |
| ⿼ | 3 | 0 | 0 |  | never |
| ⿿ | 3 | 0 | 0 |  | never |

An induced row is a prediction, not a record. Over everything they write, the rules agree with CNS
on 89.7% of the characters CNS records. The rows induced from CNS cannot be checked against the
Rime file: Rime records 24,664 of those characters and 12,148 agree, since Rime's
additions do not all follow CNS order.

## Entered orders

`entered.tsv` holds orders entered by hand for characters and components a source does not
record, in that source's symbols. `basis` gives the citation or the reasoning behind each, `by`
who entered it. An entered order is this project's reading and never enters a source's file; it
writes its own character and lets the characters it is a component of be induced.

`wanted.tsv` lists, per source, the components that keep characters from being written:
`blocks` counts those characters and `alone` the ones it is the only obstacle to, most first.
To add an order, append a row to `data/stroke-orders-entered.tsv` in the repository and rebuild.

## Coverage

| Source | Recorded | Entered | By equivalence | From IDS | Without an order |
| --- | ---: | ---: | ---: | ---: | ---: |
| `cns11643` | 76,282 | 1 | 719 | 24,667 | 1,684 |
| `rime-stroke` | 102,582 | 0 | 681 | 3 | 86 |

"Without an order" counts the Han characters the workshop's composer draws or either IDS source
describes that end with no row from that source. Why, for each:

| Source | No description | Unreadable description | Operator not induced through | Component without an order |
| --- | ---: | ---: | ---: | ---: |
| `cns11643` | 164 | 316 | 680 | 524 |
| `rime-stroke` | 86 | 0 | 0 | 0 |

An unreadable description is a single component, carries 〾 or an operator modifier, or names a
numbered component BabelStone gives no fragment for.

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

- Yi Bai IDS, level 1, <https://github.com/yi-bai/ids>, MIT, Copyright (c) 2021 Yi Bai: the
  descriptions used where BabelStone has none. The licence text is beside this file.

## Rebuild

`bun scripts/build_open_strokes.mjs` fetches the sources and writes the files, this one included.
