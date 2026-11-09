# Visual design

Use the workshop's color and typography tokens in `demo/app.css` for share cards and other workshop surfaces.

SVG IDC icons are for buttons only. Render ideographic description characters as actual font glyphs in sequences, captions, previews, exports, and other text. Ensure the chosen font covers the IDC characters; never substitute button icons for missing glyphs.

# The composer's boundary

The drawing engine lives in han-compose (https://github.com/mkpoli/han-compose). Kept here: the
editor interface, interaction, and data sourcing. A change to how a sequence draws belongs in
han-compose, in its JavaScript package.

| Change | Where |
|---|---|
| A sequence draws differently (notes, rooms, turns, slots, pyramids, rewriting) | han-compose |
| The export's files, format or packing | han-compose, `web_export.py` |
| Loading the export, the Worker, caching | han-compose's JavaScript package |
| Parsing and writing the tree, ⬚, ASCII names, editor keys, tokens, Emoji | han-compose's package, beside the rules they serve |
| The editor's document: layers, transforms, saving | here, `src/core/`, `src/document/` |
| Badges, placeholders, focus, fade, export as a file | here, `src/svelte/` and `src/core/preview.js` |
| Data: BabelStone IDS, parts palette, component forms, Unihan | here, `src/adapter/`, `data/` |

- A sequence is the only thing that crosses. An editor tree reaches the composer as text, its slots
  as `⬚`. Composer code does not read a `{op, parts}` tree, and the editor's tree does not learn the
  composer's. A layered preview hands over the document, which `documentView` reads by its `root`.
- The engine writes, this package reads. `composerPreview({ base })` reads the export's current
  format only; a manifest of another format is a failed load.
- Everything that decides a drawing is checked in han-compose. `tests/composer-preview.test.js` here
  checks what an editor gets back — a drawing, its slots, a sketch, a refused sequence — never how
  the notes, rooms or turns are chosen.
- The engine is the dependency `@han-compose/composer`, read from `node_modules/` and nowhere else,
  declarations included. Nothing in this package draws: fix a drawing in han-compose, and its tests
  there find it.
- Only draw with the export's own operator set. An operator the export does not draw is refused with
  its drawing, so the badge can say which ones.

```sh
bun test tests      # the editor; every drawing it shows is the engine's, tested there
bun run verify      # tests, the type checks and the message catalogues
```

The engine's own tests, its parity run against the Python composer's drawings, and its examples
live in han-compose. A change here that makes a drawing look different means the engine changed:
bump the dependency, not a copy of it.

# Open data

Read the release at <https://ids.mkpo.li/open-data>: start with `manifest.json` and its JSON/TSV
files. Use them instead of scraping the workshop's rendered pages for descriptions, components or
equivalences.
