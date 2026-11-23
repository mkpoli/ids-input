# IDS of the Ideographic Variation Database

An ideographic description sequence for each of the 29,642 sequences the Ideographic Variation
Database (IVD 2026-08-03) registers, read from three independent drawings of the sequence. The
format is `ids-input/ivd-ids`, version 1, and the descriptions, statuses and relations are released
under CC0 1.0.

No source states an IDS for a variation sequence. Every description here is this project's reading
of a drawing, and each reading names the drawing and the method it came from.

## Witnesses

| Witness | Drawing | Sequences |
| --- | --- | ---: |
| `glyphwiki` | GlyphWiki's glyph for the sequence, after its aliases. Jigmo draws the same glyphs, so it is not a second witness. | 29,642 |
| `noto` | The glyph Noto Sans CJK and Noto Serif CJK map the sequence to. Both collections share one glyph table across their regional faces. | 14,718 |
| `ipamj` | The glyph IPAmj明朝 maps the sequence to. | 11,385 |

A witness reads a sequence in two ways:

- `same-glyph`: the witness draws the sequence with the glyph it draws for an encoded character in a
  region's form. BabelStone's IDS for that character and region then describes the sequence. Noto
  draws 臭 E0101 with the glyph its Korean face draws for 臭 U+81ED, which BabelStone gives as ⿱自犬
  for K.
- `components`: GlyphWiki builds the glyph from other glyphs, and their characters and places give
  the IDS. A component GlyphWiki draws as a variation sequence keeps its selector (⿰丰󠄁阝).

## Status

| Status | Meaning |
| --- | --- |
| `agreed` | Two witnesses give one IDS. |
| `single` | One witness gives an IDS. |
| `conflict` | The witnesses disagree; `ids` is empty and the readings stay in `readings.tsv.gz`. |
| `unread` | No witness gives an IDS: GlyphWiki draws the glyph from strokes and no font draws it as an encoded character. |

Two readings agree when they are the same after compatibility ideographs are read as their unified
ones, selectors inside the description are dropped and every part is written out to the end of
BabelStone's descriptions. `manifest.json` counts each status.

## Files

`sequences.tsv.gz`, one row per sequence:

| Column | |
| --- | --- |
| `sequence` | Base and selector in hex, `81ED E0103`. |
| `text` | The sequence as text. |
| `registrations` | Each collection that registers it, with its identifier, `Moji_Joho:MJ030291`. |
| `ids` | The description, empty for `conflict` and `unread`. |
| `finer` | GlyphWiki's description where it writes a component as a variation sequence and otherwise agrees. |
| `status` | As above. |
| `witnesses` | The witnesses that gave an IDS. |
| `undistinguished` | Sequences of the same base with the same description that a witness draws with another glyph, separated by `;`. Their difference lies inside a component. |

`readings.tsv.gz` holds each reading: `sequence`, `witness`, `glyph` (the GlyphWiki name or the font
file and glyph), `method`, `anchor` (the encoded character and region of a `same-glyph` reading) and
`ids`.

`relations.tsv.gz` holds `same-glyph` relations: two sequences, or a sequence and an encoded character
with its region, that one witness draws with one glyph. 臭 E0103 and 臭 U+FA5C share a glyph in
IPAmj明朝; 臭 E0102 and 𦤀 U+26900 share one in GlyphWiki. A relation holds in its witness only.

## Build

```sh
uv run --with fonttools python scripts/build_ivd_ids.py IVD_Sequences.txt \
  dump_newest_only.txt IDS.TXT NotoSansCJK-Regular.ttc NotoSerifCJK-Regular.ttc ipamjm.ttf
```

`manifest.json` records the SHA-256 of every input.

## Sources

| Source | Version | Terms | Use |
| --- | --- | --- | --- |
| [IVD_Sequences.txt](https://www.unicode.org/ivd/data/2026-08-03/IVD_Sequences.txt) | 2026-08-03 | Unicode License v3 (`../../LICENSE-Unicode.txt`) | The sequences and their registrations |
| [GlyphWiki](https://glyphwiki.org/) | `dump_newest_only.txt` of 2026-11-15 | Free to use, modify and redistribute ([licence](https://glyphwiki.org/wiki/GlyphWiki:データ・記事のライセンス)) | Glyphs, aliases and components |
| [BabelStone IDS](https://www.babelstone.co.uk/CJK/IDS.TXT) | File Date 2025-06-27 | Public domain | Regional IDS of encoded characters |
| [Noto Sans CJK](https://github.com/notofonts/noto-cjk) | 2.004 Super OTC | SIL OFL 1.1 | Which glyph each sequence and character maps to |
| [Noto Serif CJK](https://github.com/notofonts/noto-cjk) | 2.003 Super OTC | SIL OFL 1.1 | Same |
| [IPAmj明朝](https://moji.or.jp/mojikiban/font/) | Ver.006.01 | IPA Font License v1.0 | Same |

The release holds no outline from any font, only which glyph a font maps a sequence or character to.
The registrations repeat the IVD's collection identifiers under the Unicode licence.

## Limits

- 11,453 sequences share their description with a sibling drawn otherwise. In a sample of these
  pairs drawn in Jigmo, the median overlap of the two glyphs was 0.70: the difference is a
  component's form (交's sweep, the 半 of 叛), which a component-level IDS does not write.
- GlyphWiki's drawings are edited by its users; where GlyphWiki is the only witness the status is
  `single`.
- Noto Sans and Noto Serif are one witness: both follow Adobe-Japan1.
- BabelStone describes a character's form in a region, which a font's glyph for that region need not
  follow.
