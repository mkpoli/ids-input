# Fonts

Two webfont subsets draw the palette parts that few installed fonts cover: the CJK strokes, CJK
Radicals Supplement, and the parts beyond the Basic Multilingual Plane (CJK Extensions B–J), with
the editor's empty-slot mark ⬚ (U+2B1A). Kureedo and GenZui Sans supply the optional Kaisho face.

`scripts/build_ids_parts.py --font` cuts them from
`data/ids-parts.json`, so they are rebuilt with the palette. `fonts.css` names them `IDS Strokes`
(U+2B1A, U+31C0–U+31E3) and `IDS Parts` (U+2E80–U+2EFF, U+31E4–U+31EF, U+20000–U+3FFFF), with ranges
that do not overlap. The rest of the Basic Multilingual
Plane, Extension A included, comes from the reader's own CJK font.

- `NotoSansCJKjp-ids-strokes.woff2` (3.4 KB, 37 characters): Noto Sans CJK JP 2.004
  (<https://github.com/notofonts/noto-cjk>, tag `Sans2.004`, the variable font instanced at weight
  400, SHA-256 `240c9b83bf7b386edbae39995ae7e068ed4583f484d92e4a74c34158b5f27b1a`), © 2014-2021
  Adobe, SIL Open Font License 1.1 (`OFL-NotoSansCJK.txt`). The Reserved Font Name is `Source`, which
  the family name does not use.
- `Plangothic-ids-parts.woff2` (55 KB, 501 characters): Plangothic (遍黑体) P1 and P2 V2.9.5795 by
  Fitzgerald P. Köeingsegg
  (<https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project>), merged into one
  subset, SIL Open Font License 1.1 (`OFL-Plangothic.txt`). The font declares no Reserved Font Name.
  Source SHA-256s: P1 `550b5d0775b15405946b18f4843df439a51e69508d7e6778d94c1f7a53dc5ad6`, P2
  `681933370adfe0fc7253f77735275a82fea09fe4f8adba907bdeb46c110daf8f`.

`Kureedo-Regular.woff2` (2.8 MB) supplies the optional `Kureedo` Kaisho face. Kureedo v0.4.3, Copyright The Klee Project Authors, SIL Open Font License 1.1 (`OFL-Kureedo.txt`), from [mkpoli/kureedo](https://github.com/mkpoli/kureedo); this woff2 SHA-256 `678769b18123201d292436e854121de9b636162ca595e5e9fb71684636ead430`.

`GenZuiSans-Regular.woff2` (2.3 MB) supplies the characters Kureedo lacks. GenZui Sans 0.105, SIL Open Font License 1.1 (`OFL-GenZuiSans.txt`), from [mkpoli/GenZui](https://github.com/mkpoli/GenZui); woff2 SHA-256 `efb3b0bf65f178b52ede78a552cf7d642d1c9bbd47c3fbddf860d70ec92d7f7a`.

`NotoSerifTangut-Regular.woff2` supplies the `IDS Tangut` face for the editor,
examples, palette and search results. Noto Serif Tangut 2.168, Copyright 2021 Google
LLC, SIL Open Font License 1.1 (`OFL-NotoSerifTangut.txt`), from
[notofonts/noto-fonts](https://github.com/notofonts/noto-fonts/tree/main/unhinted/ttf/NotoSerifTangut).
It covers all 768 original Tangut components. Rebuild with
`uv run scripts/build_tangut_font.py`; the script pins the source SHA-256.
Its outlines are also exported by `scripts/build_tangut_outlines.py` for composition
and SVG/PNG export, under the same font licence.

## IDS Seal

`IDSSeal-Regular.woff2` is a 76-glyph derivative of
[Kaiyuan Small Seal](https://github.com/frankslin/kaiyuan-small-seal-font) at revision
`97433695858330ec9fdb7de9c4604da2f635eba6`, by Kaiyuan Small Seal Font Contributors.
It covers the head characters and seal components used by the bundled CHISE subset.
Other Small Seal code points need another installed font.

The SVGs are traced from the Chen Changzhi edition of 說文解字. Upstream describes the
font as under review; these outlines have not received a separate glyph-by-glyph
review here. They can differ from the Jiguge shapes described by CHISE. Upstream marks 74 of the
76 selected glyphs `approved`; U+3D320 and U+3D32F are only `aligned`. The outline
metadata retains each glyph's full review record.
`IDSSeal-sources.tar.gz` includes the original SVGs with crop references, upstream
provenance and approval tables, and the original license. File digests and the pinned
revision are in `small-seal-sources.json`.

The font uses the verbatim [Kaiyuan font license](LICENSE-IDSSeal.txt). Although its
header calls it SIL OFL 1.1, its conditions differ from the standard SIL license.
The derivative family is named IDS Seal and retains Kaiyuan Small Seal in the
Compatible Fullname field. The license and copyright notice are embedded in the font.

Build the webfont and `data/small-seal-outlines.json.gz` with
`uv run scripts/build_small_seal_font.py`. This uses the bundled SVG sources, checks
their digests, converts cubic curves to quadratic curves with a 0.5-unit error bound,
and writes deterministic font and outline files. Exact-description mappings in the
outline data come from CHISE and retain its GPL-2.0-or-later license.
