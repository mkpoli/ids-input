# Open stroke orders

The stroke order of Han characters by writing style: mainland order from Rime's five-stroke
dictionary, Taiwan order from CNS 全字庫, and orders induced for characters a source lacks. Every row
names where it comes from; an induced row is never mixed into a source's file.

The format is `ids-input/open-strokes`, version 1.

## Files

| File | Rows | |
| --- | ---: | --- |
| `rime-stroke.tsv.gz` | 110,125 | Mainland order: `char`, `codepoint`, `orders`. LGPL-3.0. |
| `cns11643.tsv.gz` | 76,282 | Taiwan order: `char`, `codepoint`, `orders`, `cns` (the CNS plane-codes mapped to the character). Open Government Data License 1.0. |
| `induced.tsv.gz` | 20,729 | Induced orders: `char`, `codepoint`, `style`, `orders`, `basis`, `from`, `source`. Each row keeps the terms of its `source`. |
| `manifest.json` | | Sources with checksums, licences, coverage and the validation tables below. |

The files are gzipped UTF-8 TSV with a header row. `orders` holds one code per way of writing the
character, separated by a space, in the source's order.

## Strokes

A code is one symbol per stroke in writing order, in the five classes. Each file keeps its source's
symbols.

| Class | `rime-stroke` | `cns11643` |
| --- | --- | --- |
| 横 horizontal | `h` | `1` |
| 豎 vertical | `s` | `2` |
| 撇 left-falling | `p` | `3` |
| 點 dot | `n` | `4` |
| 折 turning | `z` | `5` |

The sources class a stroke by their own conventions, which differ: CNS writes the hook 亅 as `5`.
Neither gives stroke paths, and neither gives Japanese or Korean order.

## Induced rows

`basis` says how the order was written.

- `equivalent`: the character is a compatibility ideograph or a radical form, and `from` is the
  unified ideograph it normalizes to (NFKC). The row repeats that character's recorded orders.
  681 mainland rows, 719 Taiwan rows.
- `ids`: `from` is the character's description in BabelStone IDS (the sequence its G or T source
  gives, else the first), and the order joins the recorded orders of its components.
  0 mainland rows, 19,329 Taiwan rows. Up to 8 ways are kept.

The components are joined in the order the description names them, except:

- ⿺ with 辶 or 廴 as the enclosure, and ⿶: what is held is written first.
- ⿴: the enclosure without its last stroke, then what it holds, then that stroke.
- ⿷: the enclosure's first stroke, then what it holds, then the rest.

An order is induced only through ⿰ ⿱ ⿲ ⿳ ⿴ ⿵ ⿶ ⿷ ⿸ ⿺, at every level of the
description, and only when every component has a recorded order in the same source. Nothing is
induced from another induced row.

### How often the rules agree with the sources

Each recorded character with a description was written by the same rules and compared with its
recorded orders. "Written" counts the characters whose components all have orders; "Agree" those
where one written order is a recorded one. Rows are the description's outer operator.

Mainland (`rime-stroke`):

| Operator | Described | Written | Agree | | Induced |
| --- | ---: | ---: | ---: | ---: | --- |
| ⿰ | 65,838 | 65,661 | 64,503 | 98.2% | yes |
| ⿱ | 22,732 | 22,583 | 21,367 | 94.6% | yes |
| ⿺ | 3,513 | 3,498 | 3,387 | 96.8% | yes |
| ⿸ | 3,036 | 3,026 | 2,968 | 98.1% | yes |
| ⿲ | 2,357 | 2,345 | 2,250 | 95.9% | yes |
| ⿳ | 1,672 | 1,630 | 1,448 | 88.8% | yes |
| ⿵ | 949 | 947 | 898 | 94.8% | yes |
| ⿹ | 420 | 410 | 239 | 58.3% | no |
| ⿻ | 343 | 322 | 193 | 59.9% | no |
| ⿴ | 317 | 317 | 298 | 94.0% | yes |
| ⿷ | 186 | 185 | 156 | 84.3% | yes |
| ⿶ | 53 | 53 | 49 | 92.5% | yes |
| ⿽ | 14 | 12 | 2 | 16.7% | no |
| ㇯ | 10 | 8 | 0 | 0.0% | no |
| ⿾ | 5 | 5 | 2 | 40.0% | no |
| ⿼ | 3 | 3 | 2 | 66.7% | no |
| ⿿ | 3 | 3 | 2 | 66.7% | no |

Taiwan (`cns11643`):

| Operator | Described | Written | Agree | | Induced |
| --- | ---: | ---: | ---: | ---: | --- |
| ⿰ | 48,674 | 46,405 | 42,327 | 91.2% | yes |
| ⿱ | 16,606 | 15,549 | 13,327 | 85.7% | yes |
| ⿺ | 2,765 | 2,689 | 2,317 | 86.2% | yes |
| ⿸ | 2,436 | 2,336 | 2,154 | 92.2% | yes |
| ⿳ | 1,272 | 958 | 730 | 76.2% | yes |
| ⿵ | 737 | 695 | 612 | 88.1% | yes |
| ⿲ | 504 | 452 | 387 | 85.6% | yes |
| ⿹ | 319 | 207 | 80 | 38.6% | no |
| ⿻ | 266 | 210 | 113 | 53.8% | no |
| ⿴ | 254 | 248 | 220 | 88.7% | yes |
| ⿷ | 143 | 137 | 109 | 79.6% | yes |
| ⿶ | 47 | 45 | 37 | 82.2% | yes |
| ⿽ | 15 | 10 | 2 | 20.0% | no |
| ㇯ | 5 | 4 | 0 | 0.0% | no |
| ⿾ | 3 | 3 | 1 | 33.3% | no |
| ⿿ | 3 | 3 | 1 | 33.3% | no |
| ⿼ | 2 | 2 | 1 | 50.0% | no |

An induced row is a prediction at these rates, not a record. The mainland figures may flatter the
rules: part of the Rime table for the extension blocks could itself have been compiled from
components, which this project has not verified.

## Coverage

| Style | Recorded | By equivalence | From IDS | Without an order |
| --- | ---: | ---: | ---: | ---: |
| Mainland | 110,125 | 681 | 0 | 89 |
| Taiwan | 76,282 | 719 | 19,329 | 13,167 |

"Without an order" counts the Han characters the workshop's composer draws or BabelStone IDS
describes that end with no row in that style.

## Sources and terms

- Rime five-stroke dictionary, `stroke.dict.yaml`, revision
  `1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48`, <https://github.com/rime/rime-stroke>. Authors: 四季的風, 雪齋,
  Kunki Chou and 宋天; the table credits CNS11643, 北大中文論壇 and 宋天's extension data.
  LGPL-3.0, <https://www.gnu.org/licenses/lgpl-3.0.html>.
- CNS11643 中文標準交換碼全字庫, `CNS_strokes_sequence.txt` in `Properties.zip` and the Unicode
  tables in `MapingTables.zip`, <https://www.cns11643.gov.tw/>. 政府資料開放授權條款-第1版 (Open
  Government Data License, version 1.0), <https://data.gov.tw/license>. Attribution:
  數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw。 The archives carry no
  version; `manifest.json` records the SHA-256 of the copies read. Private Use code points are left out.
- BabelStone IDS, `IDS.TXT`, Andrew West (魏安), <https://www.babelstone.co.uk/CJK/IDS.TXT>, public
  domain: the descriptions induced rows are written from.

## Rebuild

`bun scripts/build_open_strokes.mjs` fetches the sources and writes the files.
