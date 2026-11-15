# Open stroke orders

The stroke order of Han characters, from three sources, with orders induced or borrowed for the
characters a source lacks. Every row names where it comes from; an induced or borrowed row is never
mixed into a source's file.

The format is `ids-input/open-strokes`, version 3.

## Files

| File | Rows | |
| --- | ---: | --- |
| `cns11643.tsv.gz` | 76,282 | Taiwan's standard order, from CNS 全字庫: `char`, `codepoint`, `orders`, `cns` (the CNS plane-codes mapped to the character). Open Government Data License 1.0. |
| `rime-stroke.tsv.gz` | 102,582 | Rime's five-stroke dictionary: `char`, `codepoint`, `orders`. LGPL-3.0. |
| `kanjivg.tsv.gz` | 6,728 | Japanese order, from KanjiVG: `char`, `codepoint`, `orders`, `strokes` (KanjiVG's type of each stroke, as it writes them). CC BY-SA 3.0. |
| `induced.tsv.gz` | 124,452 | Induced and borrowed orders: `char`, `codepoint`, `orders`, `basis`, `from`, `source`, `ids`, `lent`. Each row keeps the terms of its `source` and of the sources in `lent`. |
| `entered.tsv` | 22 | Orders entered by hand: `char`, `codepoint`, `orders`, `basis`, `by`, `source`, `date`. CC0 1.0. |
| `wanted.tsv` | 0 | Characters and components no source has an order for: `char`, `codepoint`, `source`, `blocks`, `alone`, `examples`. CC0 1.0. |
| `within.tsv` | 183 | What each `within` row of `induced.tsv.gz` rests on: `char`, `codepoint`, `source`, `named`, `shape`, `found`, `read`, `within`, `lent`. Each row keeps the terms of the source whose characters were read. |
| `manifest.json` | | Sources with checksums, licences, coverage and the tables below. |
| `LICENSE-rime-stroke-LGPL-3.0.txt`, `LICENSE-GPL-3.0.txt`, `AUTHORS-rime-stroke.txt` | | The terms and authors of the Rime dictionary. |
| `LICENSE-kanjivg-CC-BY-SA-3.0.txt` | | The terms of KanjiVG. |
| `LICENSE-yi-bai-ids-MIT.txt` | | The terms of Yi Bai's descriptions. |

The data files are UTF-8 TSV with a header row, gzipped where the name ends in `.gz`. `orders` holds one code per way of writing
the character, separated by a space, in the source's order.

## Strokes

A code is one symbol per stroke in writing order, in the five classes. Each file keeps its source's
symbols.

| Class | `cns11643` | `rime-stroke` | `kanjivg` |
| --- | --- | --- | --- |
| 横 horizontal | `1` | `h` | `1` |
| 豎 vertical | `2` | `s` | `2` |
| 撇 left-falling | `3` | `p` | `3` |
| 點 dot | `4` | `n` | `4` |
| 折 turning | `5` | `z` | `5` |

KanjiVG names each stroke's type with a CJK stroke character (㇐, ㇑a, ㇔/㇏), and `strokes` keeps
those as written. Its `orders` code is this project's reading of them, not KanjiVG's: each type
takes the class `data/ids-parts.json` gives its stroke character (a rising ㇀ is 横, a hooked ㇚
is 豎, a falling ㇏ is 點), the first where KanjiVG offers two. CNS classes some of the same strokes
otherwise, so a code from one source is not comparable stroke for stroke with another's.

KanjiVG writes 辶 with four strokes and the ⻌ of the jōyō kanji with three. BabelStone's J-source
descriptions name 辶 throughout, so a row induced from `kanjivg` through it carries the four-stroke
form, also where a jōyō-style ⻌ would be written.

No source here gives stroke paths, or mainland or Korean standard order.

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
  unified ideograph it normalizes to (NFKC). The row repeats that character's orders: the recorded
  ones, or where the source does not record it the ones induced or borrowed for it here, with the
  lenders in `lent`.
  722 rows from `cns11643`, 681 from `rime-stroke`, 1,126 from `kanjivg`.
- `ids`: `from` is the character's description and the order joins the recorded orders of
  its components. The description is BabelStone's (the sequence its T source gives, or its J
  source for `kanjivg`, else the first) or, where BabelStone has none, Yi Bai's. The `ids` column names the dataset of the
  character's description, then that of any component read by its own description.
  25,031 rows from `cns11643` (4,439 of them through one of Yi Bai's descriptions), 3 from `rime-stroke`, 91,746 from `kanjivg`. Up to 8 ways are kept.
- `borrowed`: the source has no order for the character and none can be written from its
  components, and `from` is the other source whose order the row repeats, in this source's
  symbols. 1,239 rows in `cns11643`, 25 in `rime-stroke`, 3,696 in `kanjivg`.

- `within`: the character is a form of the CJK Radicals Supplement that no source records,
  `from` is the component the descriptions write it as, and the order is what most of the
  source's characters write that component as: each character whose description names it, with the
  other parts' orders taken off the front and the back of its own. `lent` names the source whose
  characters were read where the row's own has none. 61 rows in `cns11643`, 61 in
  `rime-stroke`, 61 in `kanjivg`. `within.tsv` gives what each rests on.

A source borrows from the nearest convention first: `cns11643` from `rime-stroke` then
`kanjivg`, `rime-stroke` from `cns11643` then `kanjivg`, `kanjivg` from `cns11643` then
`rime-stroke`; an order entered for the lender counts as its own. A component is borrowed before
a whole character, so a character is written from its source's own components wherever they
exist. `lent` names the sources a row borrows from: the lender of a `borrowed` row, and for an
`ids` row the lenders of the components it is written with (21,778 rows). A borrowed order follows
its lender's convention, which can differ from the borrowing source's.

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
90% or more. `cns11643` teaches 62 places, `rime-stroke` 107 and `kanjivg` 12; `manifest.json` lists them
under `induction.learned`. An enclosure without a learned place takes its operator's usual one:
`inner-first` for ⿶ and for ⿺ with 辶 or 廴 in any of their encoded forms (辶 廴 辵 ⻌ ⻍ ⻎), `before-last` for ⿴, `after-1` for ⿷, `outer-first` otherwise.

⿹ and ⿻ have no usual place that holds, so they are induced through only for the enclosures with a
learned one. In `cns11643`: ⿹气 outer-first (58 of 62), ⿹戈 after-1 (31 of 34), ⿹弓 outer-first (6 of 6), ⿻一 outer-first (13 of 14), ⿻大 after-1 (13 of 14), ⿻十 outer-first (5 of 5).

⿰ ⿱ ⿲ ⿳ ⿴ ⿵ ⿶ ⿷ ⿸ ⿺ are induced through at every level of the description. A component the source
does not record is read by its own description in turn, and one of BabelStone's numbered components
by the fragment its note 6 writes it out as; `from` keeps the description as its dataset spells
it. A description BabelStone marks 〾 is not used.

### How often the rules agree with a source

Each recorded character with a description was written by the same rules from the same source and
compared with its recorded orders, with the places learned from the other half of the characters
(split by code point parity), so none scores a place it taught. Only the enclosures the induced
rows are written through are scored; one too rare to be learned in a half is scored at its
operator's usual place, and not at all under ⿹ and ⿻. "Written" counts the characters the
rules write; "Agree" those where one written order is a recorded one. Rows are the description's
outer operator; "Induced" says whether it is induced through always, only where a place was
learned, or never.

`cns11643`:

| Operator | Described | Written | Agree | | Induced |
| --- | ---: | ---: | ---: | ---: | --- |
| ⿰ | 49,032 | 46,876 | 42,823 | 91.4% | always |
| ⿱ | 16,869 | 15,883 | 13,681 | 86.1% | always |
| ⿺ | 2,788 | 2,708 | 2,342 | 86.5% | always |
| ⿸ | 2,466 | 2,352 | 2,183 | 92.8% | always |
| ⿳ | 1,397 | 1,185 | 916 | 77.3% | always |
| ⿵ | 738 | 700 | 640 | 91.4% | always |
| ⿲ | 509 | 462 | 395 | 85.5% | always |
| ⿹ | 330 | 83 | 76 | 91.6% | learned |
| ⿻ | 285 | 12 | 10 | 83.3% | learned |
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
| ⿰ | 66,176 | 65,101 | 64,106 | 98.5% | always |
| ⿱ | 22,769 | 21,991 | 20,953 | 95.3% | always |
| ⿺ | 3,729 | 3,643 | 3,574 | 98.1% | always |
| ⿸ | 3,110 | 3,006 | 2,968 | 98.7% | always |
| ⿳ | 1,810 | 1,635 | 1,472 | 90.0% | always |
| ⿵ | 974 | 952 | 934 | 98.1% | always |
| ⿲ | 710 | 677 | 657 | 97.0% | always |
| ⿹ | 470 | 338 | 333 | 98.5% | learned |
| ⿻ | 378 | 17 | 15 | 88.2% | learned |
| ⿴ | 354 | 352 | 331 | 94.0% | always |
| ⿷ | 189 | 180 | 155 | 86.1% | always |
| ⿶ | 54 | 51 | 47 | 92.2% | always |
| ⿽ | 15 | 0 | 0 |  | never |
| ㇯ | 9 | 0 | 0 |  | never |
| ⿾ | 4 | 0 | 0 |  | never |
| ⿼ | 3 | 0 | 0 |  | never |
| ⿿ | 3 | 0 | 0 |  | never |

`kanjivg`:

| Operator | Described | Written | Agree | | Induced |
| --- | ---: | ---: | ---: | ---: | --- |
| ⿰ | 3,991 | 3,173 | 2,927 | 92.2% | always |
| ⿱ | 1,636 | 1,196 | 1,039 | 86.9% | always |
| ⿸ | 243 | 195 | 183 | 93.8% | always |
| ⿺ | 179 | 154 | 103 | 66.9% | always |
| ⿻ | 101 | 2 | 2 | 100.0% | learned |
| ⿵ | 81 | 60 | 49 | 81.7% | always |
| ⿳ | 77 | 36 | 29 | 80.6% | always |
| ⿹ | 42 | 4 | 4 | 100.0% | learned |
| ⿲ | 37 | 31 | 26 | 83.9% | always |
| ⿴ | 36 | 34 | 29 | 85.3% | always |
| ⿷ | 16 | 12 | 12 | 100.0% | always |
| ⿽ | 5 | 0 | 0 |  | never |
| ⿶ | 5 | 2 | 1 | 50.0% | always |

An induced row is a prediction, not a record. Over everything they write, the rules agree with CNS
on 89.7% of the characters CNS records. The rows induced from CNS cannot be checked against the
Rime file: Rime records 24,731 of those characters and 12,169 agree, since Rime's
additions do not all follow CNS order.

## Entered orders

`entered.tsv` holds orders entered by hand for characters and components a source does not
record, in that source's symbols. `basis` gives the citation or the reasoning behind one where it was noted, `by`
who entered it. An entered order is this project's reading and never enters a source's file; it
writes its own character and lets the characters it is a component of be induced.

`wanted.tsv` lists, per source, what is left to enter: the characters that end without an
order and the components that keep characters from being written, none of which any source
records or any recorded character is written with. `blocks` counts the characters a component keeps back and `alone` the ones it is the
only obstacle to, most first.
To add an order, append a row to `data/stroke-orders-entered.tsv` in the repository and rebuild.

## Orders read inside characters

`within.tsv` holds the evidence of each `within` row. `found` counts the characters whose
description names the component, down to three descriptions deep, where the operators on the way
to it are ⿰ ⿱ ⿲ ⿳ and every other part has an order: taking those off the front and the back of
the character's own order leaves the component's. `read` gives up to three such orders, each
with the number of characters that leave it (`1521×73 1512×11`); the row takes the first.
`within` lists up to eight of the characters and `lent` the source they are from where it is
not the row's own.

`named` is the component the form was read under. The descriptions never name a form of the
CJK Radicals Supplement itself: they name the unified ideograph Unicode's
`EquivalentUnifiedIdeograph.txt` pairs it with (旡 for ⺛). Where that pair is not the shape the
form is drawn as, `data/stroke-form-names.tsv` in the repository names the component that is:
⺫ is paired with 目 and read under 罒. `shape` repeats that file's verdict: `same` where the
form has the component's outline, `variant` where it is only drawn close to it.

A `within` row is a reading, not a record. One read from few characters, from characters that
disagree, or under a `variant` shape is weaker than the rest, and `within.tsv` says which.

## Coverage

| Source | Recorded | Entered | By equivalence | From IDS | Borrowed | Read in characters | Without an order |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `cns11643` | 76,282 | 22 | 722 | 25,031 | 1,239 | 61 | 0 |
| `rime-stroke` | 102,582 | 0 | 681 | 3 | 25 | 61 | 0 |
| `kanjivg` | 6,728 | 0 | 1,126 | 91,746 | 3,696 | 61 | 0 |

"Without an order" counts the Han characters the workshop's composer draws or either IDS source
describes that end with no row for that source, borrowed ones included. Why, for each:

| Source | No description | Unreadable description | Operator not induced through | Component without an order |
| --- | ---: | ---: | ---: | ---: |
| `cns11643` | 0 | 0 | 0 | 0 |
| `rime-stroke` | 0 | 0 | 0 | 0 |
| `kanjivg` | 0 | 0 | 0 | 0 |

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
- KanjiVG, <https://kanjivg.tagaini.net>, revision `610091ce618cf757ed1357a8954cd65283e015d6` of
  <https://github.com/KanjiVG/kanjivg>, Copyright (C) 2009/2010/2011 Ulrich Apel, CC BY-SA 3.0,
  <https://creativecommons.org/licenses/by-sa/3.0/>; the licence note is beside this file.
  `kanjivg.tsv.gz` and the rows induced from it are adapted from KanjiVG and carry the same
  licence: the kanji files reduced to their stroke types, with this project's five-class code.
- A row of `induced.tsv.gz` that names a source in `lent` is adapted from that source as well and
  carries its terms beside those of its own `source`.
- BabelStone IDS, `IDS.TXT`, Andrew West (魏安), <https://www.babelstone.co.uk/CJK/IDS.TXT>, public
  domain: the descriptions induced rows are written from.
- Unicode Character Database 18.0.0, `EquivalentUnifiedIdeograph.txt`,
  <https://www.unicode.org/Public/18.0.0/ucd/EquivalentUnifiedIdeograph.txt>, Unicode License v3,
  Copyright Unicode, Inc.: the ideograph a wanted radical form is searched under in `wanted.tsv`,
  read from `data/component-forms.tsv`.

- Yi Bai IDS, level 1, <https://github.com/yi-bai/ids>, MIT, Copyright (c) 2021 Yi Bai: the
  descriptions used where BabelStone has none. The licence text is beside this file.

## Rebuild

`bun scripts/build_open_strokes.mjs` fetches the sources and writes the files, this one included.
