# ids-input

Type or build ideographic description sequences (IDS) such as `⿰亻⿱七木`. The package has three
layers, and an optional preview:

- **core**: framework-free JavaScript with types and no dependencies. It parses and writes
  sequences, edits them as trees (split, swap, unwrap, clear, undo), reads ASCII operator names
  (`LR` for ⿰), maps keys to operators, and steps through decomposition trees.
- **adapter**: the data the components ask for, supplied by the host application. A default
  adapter reads BabelStone IDS and the parts palette from two static files, so nothing needs a
  server.
- **svelte**: Svelte 5 components for the editor, a parts palette and a "Take parts from"
  decomposition browser, with message catalogues in English, Japanese, Simplified Chinese,
  Traditional Chinese and Korean.
- **composer** (optional): a preview that draws a sequence, empty slots included, with
  [han-compose](https://github.com/mkpoli/han-compose) in a Web Worker.

Demo: <https://mkpoli.github.io/ids-input/>

## Install

```sh
bun add ids-input      # or npm install ids-input
```

The Svelte components need `svelte` 5. The core and the adapter run anywhere.

## Usage

### Svelte

```svelte
<script>
  import { IdsInput } from 'ids-input/svelte'
  import { babelStoneAdapter } from 'ids-input/adapter'
  import ja from 'ids-input/messages/ja.json'
  import 'ids-input/fonts.css'
  // Vite: serve the data files as assets and pass their URLs.
  import ids from 'ids-input/data/babelstone-ids.tsv.gz?url'
  import parts from 'ids-input/data/ids-parts.json?url'

  const adapter = babelStoneAdapter({ ids, parts })
  let value = $state('')
</script>

<IdsInput {adapter} char="疑" bind:value messages={ja} locale="ja"
  onuse={sequence => console.log(sequence)} />
```

`IdsInput` props:

| prop | | |
| --- | --- | --- |
| `adapter` | required | see [Adapters](#adapters) |
| `value` | bindable | the text in the field, `⬚` for each empty slot |
| `char` | | start from this character's first description when `value` is not a sequence |
| `onuse(sequence)` | | called with a whole sequence; the Use button shows only when given |
| `onchange(text, whole)` | | every change, and whether the sequence is whole |
| `messages`, `locale` | | a catalogue from `messages/` (English fills any key it lacks) and its locale |
| `pickers` | `['find', 'parts', 'from']` | the part picker's tabs; a tab the adapter cannot answer is left out |
| `recentKey` | `'ids-input.recentParts'` | `localStorage` key of the palette's recent parts; `null` keeps none |
| `keyHints` | `true` | show each operator's key in a corner of its button |
| `preview` | snippet | `(sequence, whole)`, drawn beside the field in place of `IdsPreview` |
| `disabled` | | |

`IdsParts` (`adapter`, `onpick(part)`), `IdsFrom` (`adapter`, `ontake(text)`) and `IdsPreview`
(`adapter`, `tree`, `chosen`) also work on their own. `IdsInput` shows `IdsPreview` beside the field
when the adapter has a `preview` or a `drawing`. The components take colours from CSS custom properties with light and dark defaults
(`--ids-ink`, `--ids-muted`, `--ids-line`, `--ids-surface`, `--ids-accent`, `--ids-fault`,
`--ids-font` and others; see the top of each component's style). The defaults use `light-dark()`,
so the page needs `color-scheme: light dark` for its dark scheme.

### Core

```js
import { parse, write, applyOperator, unwrap, unalias, commandFor, createHistory } from 'ids-input'

parse('⿰亻⿱七木').tree        // { op: '⿰', parts: ['亻', { op: '⿱', parts: ['七', '木'] }] }
parse('⿰亻').problem           // 'missing'
parse('⿰亻', { open: true })   // a draft: { tree: { op: '⿰', parts: ['亻', null] } }
write(applyOperator(parse('⿰亻失').tree, [1], '⿱').tree)  // '⿰亻⿱失⬚'
unalias('lr亻ud匕失')           // '⿰亻⿱匕失'
commandFor({ key: '&', code: 'Digit1' })  // { command: 'operator', op: '⿰' }, on any layout
```

A component is an ideograph, a radical, a stroke, a katakana letter standing for a component of
that shape (コ, マ), a private-use character or `？` for a part no character names, with an
optional variation selector. In a draft, `⬚` (or a part missing at the end) is an empty slot.

## Adapters

```ts
interface IdsAdapter {
  structure(char, options?): Promise<{ text: string, regions?: string }[]>   // required
  variants?(part, options?): Promise<{ char: string, count?: number }[]>
  search?(query, options?): Promise<{ char: string, label?: string }[]>
  containing?(parts, options?): Promise<{ items: string[], more?: boolean }>
  parts?(options?): Promise<PalettePart[]>
  drawing?(sequence, options?): Promise<string | null>   // a final image's URL
  preview?(sequence, options?): Promise<Drawing>          // rejects when it cannot draw
}

interface Drawing {          // in a 1000-unit box, y down
  d: string                  // the ink as an SVG path, nonzero fill
  cut?: string               // what ㇯ takes away
  slots?: { index: number, box: [x, y, width, height] }[]   // each empty slot (⬚), in reading order
  stroke?: [number, number] | null                          // stroke widths placeholders follow
  approximate?: string[]     // operators drawn by an approximation
  kanjivg?: boolean          // a part was cut along KanjiVG's groups (CC BY-SA 3.0)
}
```

`options` carries an `AbortSignal` (`signal`) and a `limit`. `structure` answers a character's
descriptions with the source regions each describes (`GHTJKPV`), and `[]` for a character with no
smaller parts. `variants` answers components that can stand in a part's place (コ for 龴).
`containing` answers the characters built from every part in its query, counted (`木木` asks for
two). `preview` draws a sequence that may hold empty slots (`⬚`); its options also carry
`onSketch(leaves)`, which hears where each part goes before the drawing is done. It rejects with an
Error named `TooLargeError` for a sequence larger than it draws, `UnavailableError` when its data
cannot be read at all, and any other Error when it cannot draw. `IdsPreview` shows placeholders in the layout's boxes until a drawing arrives, a badge
(Preview, Approximate, Final, Could not compose, Too large), and the adapter's `drawing` in place of
the preview when there is one. While the data is unavailable, the placeholders stand with no badge.

`babelStoneAdapter({ ids, parts })` answers `structure`, `search` (a character, `U+6728` or bare
hex), `containing` and `parts` from the two files in `data/`. Its component search builds an index
in memory on first use: under Bun, about half a second for the most frequent components and
150 MB of heap with the table loaded; a host with a server can answer `containing` there instead. It has
no `variants`, `drawing` or `preview`, and no table of component forms, so `⺡` and `氵` are
different components to it.

## Preview

`ids-input/composer` draws sequences with han-compose (<https://github.com/mkpoli/han-compose>,
MIT), ported to the browser. It reads the static files han-compose's `export-web` writes (format 3):
a manifest, the learned layout, and per character and per (place, operand) gzipped records, each
named by its SHA-256, so a sequence loads only the records it names. Drawing runs in a Web Worker,
one sequence at a time; a newer sequence ends the drawing before it.

```js
import { composerPreview } from 'ids-input/composer'

const adapter = { ...babelStoneAdapter({ ids, parts }),
  preview: composerPreview({ base: 'https://example.org/composer/<version>/' }) }
```

`base` is the folder holding the export's `manifest.json`. The host serving it must allow the page's
origin by CORS. Without it the preview keeps its placeholders and shows no badge; when the export
loads but a part has no drawing, its badge reads "Could not compose". Sequences over 12 operators or 4 levels are not drawn. Under
Vite, keep the package out of dependency pre-bundling (`optimizeDeps: { exclude: ['ids-input'] }`)
so the worker's URL resolves; `composerPreview({ base, worker })` takes a function making the Worker
for other bundlers.

The demo draws from `https://glyphatlas.org/atlas/composer/bd0829bc6fbf-compose-layout-v4-f3/`;
`?composer=<url>` or `VITE_COMPOSER_BASE` points it at another copy of the export.

## Keyboard

On the tree (outside text fields), keys go by where they sit, so every layout has them:

| keys | |
| --- | --- |
| `1`–`9`, `0`, `-`, `=` | ⿰ ⿱ ⿲ ⿳ ⿴ ⿵ ⿶ ⿷ ⿸ ⿹ ⿺ ⿻ |
| `q` `w` `e` `r` `t` `y` | ⿼ ⿽ ⿾ ⿿ ㇯ 〾 |
| `Tab`, `Shift+Tab` | the next and previous part |
| `Backspace`, `Delete` | empty the chosen part |
| `Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z`, `Ctrl/⌘+Y` | undo, redo |
| any other character | goes to the part field; `Enter` puts it in the slot |

The operator palette groups the operators by how many parts they take (1: ⿾ ⿿ 〾; 2: ⿰ ⿱ ⿴ ⿵
⿶ ⿷ ⿼ ⿸ ⿹ ⿺ ⿽ ⿻ ㇯; 3: ⿲ ⿳, `OPERATOR_GROUPS` in the core), each button showing its key.

An operator on a slot splits it, the old part first (⿰ on 失 gives ⿰失⬚); on an operator it takes
its place and keeps its parts, refusing to drop a filled one. In the sequence field, ASCII names in
either case become operators: LR ⿰, UD ⿱, LL ⿲, UU ⿳, OC ⿴, OD ⿵, OU ⿶, OR ⿷, RD ⿸, LD ⿹, RU ⿺,
XX ⿻, OL ⿼, LU ⿽, MI ⿾, RO ⿿, SU ㇯. In "Take parts from", the arrow keys move through the tree,
`ArrowRight` opens a part and reaches its swaps, and `Enter` takes a part or a whole node.

## Licences

- Code: MIT (`LICENSE`).
- `data/babelstone-ids.tsv.gz`: BabelStone IDS, public domain (777 KB).
- `data/ids-parts.json`: CC BY-SA 3.0 as a whole, since its first-stroke column adapts KanjiVG;
  anything made from that column must be shared alike (42 KB).
- `fonts/`: Plangothic and Noto Sans CJK JP subsets, SIL Open Font License 1.1 (58 KB together).
- `src/composer/`: a port of han-compose's composer, MIT. It bundles no data. The drawings it makes
  are built from the export's outlines of Noto Sans CJK JP and Plangothic (SIL OFL 1.1, texts in
  `fonts/OFL-NotoSansCJK.txt` and `fonts/OFL-Plangothic.txt`); a drawing with a part cut along
  KanjiVG's component groups (`drawn.kanjivg`) adapts KanjiVG and is shared alike under CC BY-SA 3.0.

`data/README.md` and `fonts/README.md` give versions, checksums and build notes.
`scripts/build_ids_data.py` and `scripts/build_ids_parts.py` (`uv run scripts/…`) rebuild them.

## Sources

- BabelStone IDS, Andrew West (魏安), <https://www.babelstone.co.uk/CJK/IDS.TXT>, File Date
  2025-06-27. Public domain by its own header; it draws on Kawabata Taichi's IDS data
  (<https://github.com/kawabata/ids>) and IRG submissions.
- hfhchan/ids v1.0.2, Henry Chan, MIT, <https://github.com/hfhchan/ids>: which components the
  palette leaves undecomposed.
- Unihan 18.0.0, Unicode, Inc., Unicode License v3, <https://www.unicode.org/reports/tr38/>: stroke
  counts, the common set, and the IRG source regions named in the decomposition tree.
- KanjiVG r20260714, Ulrich Apel, CC BY-SA 3.0, <https://kanjivg.tagaini.net/>: first strokes
  (share-alike, see above).
- Noto Sans CJK JP 2.004, Adobe, and Plangothic V2.9.5795, Fitzgerald P. Köeingsegg, both SIL OFL
  1.1.
- han-compose, mkpoli, MIT, <https://github.com/mkpoli/han-compose>, composer at commit bd0829b,
  export format 3 (`export-web`): the composer `src/composer/` ports. Its export draws on Noto Sans
  CJK JP and Plangothic (SIL OFL 1.1), BabelStone IDS, hfhchan/ids (MIT) and KanjiVG (CC BY-SA 3.0),
  as its `docs/licensing.md` states.
- 字統网 (zi.tools), IDS search, <https://zi.tools/?secondary=ids>: the ASCII operator names, read from
  its page script (`action_abbr_map`) on 2026-10-24, and ideas for typing sequences.
- 字海网 (yedict.com), IDS search, <http://www.yedict.com/search/ids>: ideas for searching by parts.
- Mojidata Web App, Ryusei Yamaguchi (mandel59), <https://mojidata.ryusei.dev/about>: prior art,
  below.

## Prior art

Mojidata is "an open-source collection of Chinese character information databases", and the
Mojidata Web App searches and displays them (<https://mojidata.ryusei.dev/about>). Its code is at
<https://github.com/mandel59/mojidata>, <https://github.com/mandel59/mojidata-api> and
<https://github.com/mandel59/mojidata-web-app>, by Ryusei Yamaguchi. The web app's source is MIT
(its `LICENSE.md`, "Copyright (c) 2023-2024 Ryusei Yamaguchi"), as is `mojidata-api`; the
`@mandel59/mojidata` database package declares `MIT AND BSD-3-Clause AND CC-BY-SA-2.1-JP AND
Unicode-3.0 AND CC0-1.0` for its bundled data. Like this package, it takes its character structures
from BabelStone IDS. Read on 2026-10-25.

What Mojidata offers that this package does not:

- An IDS Finder (<https://mojidata.ryusei.dev/idsfind>) that searches by several sequences at once,
  by a whole-character pattern with `？` as a wildcard (`⿰？月`), and by a query syntax (`：日`).
- Many character databases beyond IDS, shown together, with Moji_Joho, regional and Adobe-Japan1
  glyphs and glyph images from GlyphWiki.
- Search backends on SQLite (sql.js, SQLite wasm, better-sqlite3, node:sqlite, Cloudflare D1), and a
  library for structure manipulation (`@mandel59/idstool`, "Manipurate CJK ideograph structures").

What this package offers that Mojidata, as far as its pages and repositories show, does not:

- A sequence editor: a tree of boxes laid out as the operators place their parts, operator keys
  by key position, split, swap and unwrap, undo and redo, and ASCII operator names.
- A parts palette of hard-to-type components by stroke count and first stroke, with font subsets for
  the parts few fonts draw.
- A keyboard-driven decomposition tree from which any part or node is taken into the editor.
- Embeddable components behind an adapter interface, so a host keeps its own data and search.

## Development

```sh
bun install
bun test tests          # core, adapter, composer and catalogue tests
COMPOSER_EXPORT=DIR bun test tests/composer-parity.test.js   # the port against han-compose's own drawings
bun run check           # tsc and svelte-check
bun run dev             # the demo on a dev server
bun run build:demo      # the demo into dist/
bun demo/check.js --shots shots [--chromium PATH]   # the built demo in Chromium, with screenshots
```
