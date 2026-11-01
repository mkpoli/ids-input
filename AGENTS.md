# Visual design

Use the workshop's color and typography tokens in `demo/app.css` for share cards and other workshop surfaces.

SVG IDC icons are for buttons only. Render ideographic description characters as actual font glyphs in sequences, captions, previews, exports, and other text. Ensure the chosen font covers the IDC characters; never substitute button icons for missing glyphs.

# The composer's boundary

The drawing engine lives in han-compose (https://github.com/mkpoli/han-compose). Kept here: the
editor interface, interaction, and data sourcing. A change to how a sequence draws belongs in
han-compose, not in `src/composer/`.

| Change | Where |
|---|---|
| A sequence draws differently (notes, rooms, turns, slots, pyramids, rewriting) | han-compose |
| The export's files, format or packing | han-compose, `web_export.py` |
| Loading the export, the Worker, caching | han-compose's JavaScript package |
| Parsing and writing the tree, ⬚, ASCII names, editor keys | here, `src/core/` |
| Badges, placeholders, focus, fade, export as a file | here, `src/svelte/` and `src/core/preview.js` |
| Data: BabelStone IDS, parts palette, component forms, Unihan | here, `src/adapter/`, `data/` |

- A sequence is the only thing that crosses. An editor tree reaches the composer as text, its slots
  as `⬚`. Composer code does not read a `{op, parts}` tree, and the editor's tree does not learn the
  composer's.
- The engine writes, this package reads. `composerPreview({ base })` reads the export's current
  format only; a manifest of another format is a failed load.
- Everything that decides a drawing is checked in han-compose. `tests/composer.test.js` here checks
  what an editor gets back — a drawing, its slots, a sketch, a refused sequence — never how the
  notes, rooms or turns are chosen.
- `src/composer/` is a copy of han-compose's JavaScript package while that package is unpublished.
  Fix a drawing in han-compose, then update the copy byte for byte; a difference between them is a
  bug, and the parity run finds one.
- Only draw with the export's own operator set. An operator the export does not draw is refused with
  its drawing, so the badge can say which ones.

```sh
bun test tests
COMPOSER_EXPORT=<export-web folder> bun test tests/composer-parity.test.js
```

Until han-compose publishes the package, a change to `src/composer/` without the parity run is
unverified. Today the copy draws ⿾ ⿿ 〾 ㇯ ⿼ ⿽ by rooms and turns of its own, marks such a drawing
approximate, and lays out empty slots that the Python composer has no rule for; all of it belongs
in han-compose.
