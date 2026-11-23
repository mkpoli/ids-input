# IDS of the Ideographic Variation Database

An ideographic description sequence for each of the 29,642 sequences the Ideographic Variation
Database (IVD 2026-08-03) registers, read from up to three drawings of the sequence. The format is
`ids-input/ivd-ids`, version 1. The descriptions, statuses and relations are released under CC0 1.0;
the `registrations` column repeats the IVD's identifiers under the Unicode License v3
(`../../LICENSE-Unicode.txt`).

No source states an IDS for a variation sequence. Every description here is this project's reading
of a drawing, and each reading names the drawing and the method it came from.

## Witnesses

| Witness | Drawing | Sequences |
| --- | --- | ---: |
| `glyphwiki` | GlyphWiki's glyph for the sequence, after its aliases. Jigmo draws the same glyphs, so it is not a second witness. | 29,642 |
| `noto` | The glyph Noto Sans CJK maps the sequence to. Its regional faces share one glyph table. | 14,718 |
| `ipamj` | The glyph IPAmj明朝 maps the sequence to. | 11,385 |

A witness reads a sequence in two ways:

- `same-glyph`: the witness draws the sequence with the glyph it draws for an encoded character in a
  region's form. BabelStone's IDS for that character and region then describes the sequence. Noto
  draws 臭 E0101 with the glyph its Korean face draws for 臭 U+81ED, which BabelStone gives as ⿱自犬
  for K.
- `components`: GlyphWiki builds the glyph from other glyphs, and their characters and places give
  the IDS. A component GlyphWiki draws as a variation sequence keeps its selector (聾 E0103 as
  ⿱龍󠄂耳). A part around another takes the operator BabelStone writes for that part (冂 ⿵, 勹 ⿹);
  a glyph whose parts fit no operator gives no reading.
- `component-forms`: the components reading with each component written as the registered sequence
  of its character that GlyphWiki draws with the component's own glyph. GlyphWiki names a component
  by its character, region and place (`u968a-k`, `u97cb-t02`); the glyph of that character and region
  alone (`u968a-k`, `u97cb-t`) is its form. The 隊 of 墜 E0101 is `u968a-k`, the glyph of 隊 E0101.
  A placed variant (`u534a-01-var-001`) has no form alone, since a variant number belongs to one
  name. A compatibility ideograph is written by its unified character's sequence.

A witness gives its `same-glyph` reading. Where it draws forms that BabelStone describes apart with
one glyph, it gives the one its components agree with, or nothing.

## Status

| Status | Meaning |
| --- | --- |
| `agreed` | Two witnesses give one IDS. |
| `single` | One witness gives an IDS. |
| `conflict` | The witnesses disagree; `ids` is empty and the readings stay in `readings.tsv.gz`. |
| `unread` | No witness gives an IDS. |

Two readings agree when they are the same written out to the ends of BabelStone's descriptions,
without the selectors inside them, and with ⿳ABC, ⿱A⿱BC and ⿱⿱ABC read alike. Where two witnesses
reach one encoded form, they agree that the sequence is drawn as that form; the description is still
BabelStone's one entry for it. `manifest.json` counts each status.

## Files

`sequences.tsv.gz`, one row per sequence:

| Column | |
| --- | --- |
| `sequence` | Base and selector in hex, `81ED E0103`. |
| `text` | The sequence as text. |
| `registrations` | Each collection that registers it, with its identifier, `Moji_Joho:MJ030291`. |
| `ids` | The description, in BabelStone's wording where a witness reached it; empty for `conflict` and `unread`. |
| `finer` | The description with a component written as the variation sequence it is drawn as, where it otherwise agrees: 膐 E0100 is ⿱旅肉, finer ⿱旅󠄁肉. It is given where GlyphWiki draws the component with a sequence's glyph, and where the forms of a component tell siblings apart (墜 E0100 ⿱隊󠄀土, 墜 E0101 ⿱隊󠄁土). |
| `status` | As above. |
| `witnesses` | The witnesses that gave an IDS. |
| `undistinguished` | Sequences of the same base, separated by `;`, that a witness draws with another glyph though their descriptions, `finer` included, are the same. |

`readings.tsv.gz` holds each reading: `sequence`, `witness`, `glyph` (the GlyphWiki name or the font
file and glyph), `method`, `anchor` (the encoded character and region of a `same-glyph` reading) and
`ids`.

`relations.tsv.gz` holds `same-glyph` relations: two sequences, or a sequence and an encoded character
with its region, that one witness draws with one glyph. 臭 E0103 and 臭 U+FA5C share a glyph in
IPAmj明朝; 臭 E0102 and 𦤀 U+26900 share one in GlyphWiki. A relation holds in its witness only.

A description can hold one of BabelStone's numbered components, such as `{73}` for the top of 具;
`../components.tsv` writes each out. It can hold a compatibility ideograph where the drawing uses
one, as 者 U+FA5B has a dot that 者 U+8005 lacks in some regions, so normalizing the text to NFC
changes it.

## Build

```sh
uv run --with fonttools python scripts/build_ivd_ids.py IVD_Sequences.txt \
  dump_newest_only.txt IDS.TXT NotoSansCJK-Regular.ttc ipamjm.ttf
```

`manifest.json` records the SHA-256 of every input.

## Sources

| Source | Version | Terms | Use |
| --- | --- | --- | --- |
| [IVD_Sequences.txt](https://www.unicode.org/ivd/data/2026-08-03/IVD_Sequences.txt) | 2026-08-03 | Unicode License v3 | The sequences and their registrations |
| [GlyphWiki](https://glyphwiki.org/) | `dump_newest_only.txt` of 2026-11-15 | Free to use, modify and redistribute ([licence](https://glyphwiki.org/wiki/GlyphWiki:データ・記事のライセンス)) | Glyphs, aliases and components |
| [BabelStone IDS](https://www.babelstone.co.uk/CJK/IDS.TXT) | File Date 2025-06-27 | Public domain | Regional IDS of encoded characters, and the operator of each enclosing part |
| [Noto Sans CJK](https://github.com/notofonts/noto-cjk) | 2.004 Super OTC | SIL OFL 1.1 | Which glyph each sequence and character maps to |
| [IPAmj明朝](https://moji.or.jp/mojikiban/font/) | Ver.006.01 | IPA Font License v1.0 | Same |

The release holds no outline from any font, only which glyph a font maps a sequence or character to.

## Limits

- 5,102 sequences share their description, `finer` included, with a sibling a witness draws otherwise. Their glyphs
  differ, often in a component's form (the 半 of 叛, the 交 of 騃), which a component-level IDS does
  not write; some may be readings the components reader got wrong.
- GlyphWiki's drawings are edited by its users; where GlyphWiki is the only witness the status is
  `single`. A component's form in `finer` rests on GlyphWiki alone, and a placed component is taken
  to be the form of the glyph its name gives alone.
- BabelStone describes a character's form in a region, which a font's glyph for that region need not
  follow.
- The components reader is checked against BabelStone on the regional glyphs of encoded characters,
  not on variation sequences, for which no source states an IDS.
