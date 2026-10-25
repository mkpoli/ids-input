# Fonts

Two webfont subsets draw the palette parts that few installed fonts cover: the CJK strokes, CJK
Radicals Supplement, and the parts beyond the Basic Multilingual Plane (CJK Extensions B–J), with
the editor's empty-slot mark ⬚ (U+2B1A). `scripts/build_ids_parts.py --font` cuts them from
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
