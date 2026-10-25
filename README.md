# ids-input

Type or build ideographic description sequences (IDS) such as `⿰亻⿱七木`. The package has three
layers, and an optional preview:

- **core**: framework-free JavaScript with types and no dependencies. It parses and writes
  sequences, edits them as trees (split, swap, unwrap, clear, undo), reads ASCII operator names
  (`LR` for ⿰), maps keys to operators, and steps through decomposition trees.
- **adapter**: the data the components ask for, supplied by the host application. A default
  adapter reads BabelStone IDS and the parts palette from two static files, so nothing needs a
  server.
- **svelte**: Svelte 5 components over one editor model: the sequence field, the operator palette,
  the tree, the chosen part's tools, the part pickers (a parts palette, a "Take parts from"
  decomposition browser, a search) and the preview, each placeable on its own or together as
  `IdsInput`, with message catalogues in English, Japanese, Simplified Chinese, Traditional Chinese
  and Korean.
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

`IdsInput` shows `IdsPreview` beside the field when the adapter has a `preview` or a `drawing`.

A host laying the editor out itself makes one editor and places its parts where it wants them; the
workshop in `demo/` does so:

```svelte
<script>
  import { IdsOperators, IdsPartTools, IdsPicker, IdsPreview, IdsSequence, IdsTree, createEditor } from 'ids-input/svelte'
  const editor = createEditor(() => ({ adapter, messages: ja, locale: 'ja' }))
  editor.reset('⿰亻⿱七木')
  let drawing = $state(null)   // the preview's drawing, for export (drawingSvg in the core)
</script>

<svelte:window onkeydown={event => editor.keydown(event, { root: document.body })} />
<IdsSequence {editor} />
<IdsOperators {editor} />
<IdsTree {editor} />
<IdsPartTools {editor} />
<IdsPicker {editor} pickers={['parts', 'from', 'find']} />
<IdsPreview {adapter} tree={editor.tree} chosen={editor.chosen} bind:drawing />
```

The editor holds the tree, the chosen part and a history of named steps (`editor.steps`, "Split ⬚
with ⿰", "Put 木"): `operator`, `put`, `take`, `empty`, `remove`, `open`, `undo`, `redo`, `travel`
and `keydown` change it, `change` names the last change and whether it threw something away, and
`listen(fn)` hears each new text. In the tree, a click chooses a part, a part dragged from the
palette, the decomposition tree, a search or the swaps is put where it is dropped, and the context
menu (right click, the Menu key or `Shift+F10`) splits or swaps with any operator, clears, removes a
level or copies that part's sequence. "Take parts from" reads a character dropped on it.
`IdsParts` (`adapter`, `onpick(part)`) and `IdsFrom` (`adapter`, `ontake(text)`, bindable `text`)
also work without an editor. The components take colours from CSS custom properties with light and dark defaults
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
optional variation selector. In a draft, `⬚` (or a part missing at the end) is an empty slot; a pasted `＋`, as earlier drafts and links have it, reads as one too, and is written back as `⬚`.

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

## Search

`createSearch(table, { forms })` in the core finds characters by what their descriptions hold, and
`babelStoneAdapter` answers it as `findByIds(query, { limit })` over its table. `IdsSearch` lists the
hits; the workshop puts it beside the output and asks it for the tree being edited.

- A term starting with an operator (or its ASCII name) is a structure, matched wherever its shape
  stands in a character's description, at any depth, components opened into their own descriptions
  as needed: `⿱木⿰木木` finds 森 (`⿱木林`, 林 being `⿰木木`).
- An empty slot (`⬚`, or a pasted `＋`) or `？` in a structure matches any part, a component or a
  whole subtree.
- Any other term is a run of components the character must hold, at any depth, counted: `木木`
  finds 林 and 森 but not 本.
- Terms apart by spaces must all match: `⿰？？ 氵` finds characters split left and right that hold 氵.
- Components match across their radical and positional forms (⺡, 氵 and 水 are one), from
  `data/component-forms.tsv`; ⿻ matches its parts in either order.
- Hits come closest first: the whole description matched exactly, then by how deep the match lies,
  how many components had to be opened to reach it, how many of a run's components stand in the
  description itself, how many parts the description has, and the common ideographs before the
  rarer blocks. Each hit carries the description it matched in, opened where the match needed it,
  and the spans the terms matched, which `IdsSearch` marks.

`findByIds` builds its index once in a Web Worker, which fetches the table and the forms itself. On
the full table (97,680 characters) under Bun 1.3.14 on an AMD Ryzen 7 9800X3D, building it took
1.4 to 2.1 s and 55 to 65 MB of heap over several runs. A query naming components answers in
1 to 35 ms (`⿱木⿰木木` 15 to 33 ms, `日月` 8 ms, `⿰⺡木` 17 to 35 ms); the broadest wildcard queries
take longer (`⿰？木` 0.2 to 0.3 s, `⿴囗？` 0.4 to 0.5 s, `⿰？？`, which matches 91,193 characters,
0.6 to 1 s). In the workshop under headless Chromium, a fresh page showed its first results 3.4 to
3.7 s after navigation over three runs, the table's download and parsing included. Without a Worker (Bun, tests) the search runs on the caller's thread.

## Preview

`ids-input/composer` draws sequences with han-compose (<https://github.com/mkpoli/han-compose>,
MIT), ported to the browser. It reads the static files han-compose's `export-web` writes (format 4):
a manifest, the learned layout, and the records of every character and the host lists of every
(place, operand), packed into gzipped shards by the first three hex digits of their SHA-256
(`g/<hhh>.json`, `p/<hhh>.json`), so a sequence loads only the shards its parts fall in. Drawing runs in a Web Worker,
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

The demo draws from `https://glyphatlas.org/atlas/composer/bd0829bc6fbf-compose-layout-v4-f4/`;
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
| `Menu`, `Shift+F10` | the chosen part's context menu |
| any other character | goes to the part field; `Enter` puts it in the slot |

The operator palette groups the operators by how many parts they take (1: ⿾ ⿿ 〾; 2: ⿰ ⿱ ⿴ ⿵
⿶ ⿷ ⿼ ⿸ ⿹ ⿺ ⿽ ⿻ ㇯; 3: ⿲ ⿳, `OPERATOR_GROUPS` in the core), each button showing its key (`shortcut()` writes keys as the platform does: ⌘⇧Z on Apple systems,
Ctrl+Shift+Z elsewhere).

An operator on a slot splits it, the old part first (⿰ on 失 gives ⿰失⬚); on an operator it takes
its place and keeps its parts, refusing to drop a filled one. In the sequence field, ASCII names in
either case become operators: LR ⿰, UD ⿱, LL ⿲, UU ⿳, OC ⿴, OD ⿵, OU ⿶, OR ⿷, RD ⿸, LD ⿹, RU ⿺,
XX ⿻, OL ⿼, LU ⿽, MI ⿾, RO ⿿, SU ㇯. In "Take parts from", the arrow keys move through the tree,
`ArrowRight` opens a part and reaches its swaps, and `Enter` takes a part or a whole node.

## Licences

- Code: MIT (`LICENSE`).
- `data/babelstone-ids.tsv.gz`: BabelStone IDS, public domain (777 KB).
- `data/component-forms.tsv`: radical and positional forms, from han-compose's
  `data/vocab/han-component-forms.tsv`, drawn from Unicode's EquivalentUnifiedIdeograph.txt (Unicode
  License v3) and cjkvi-variants' `radical-variants.txt` (public domain); its header names both (26 KB).
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
  export format 4 (`export-web`): the composer `src/composer/` ports. Its export draws on Noto Sans
  CJK JP and Plangothic (SIL OFL 1.1), BabelStone IDS, hfhchan/ids (MIT) and KanjiVG (CC BY-SA 3.0),
  as its `docs/licensing.md` states.
- Unicode EquivalentUnifiedIdeograph.txt 18.0.0, Unicode, Inc., Unicode License v3, and
  cjkvi-variants `radical-variants.txt` (at e4f1da2), Kawabata Taichi (川幡太一), public domain,
  <https://github.com/cjkvi/cjkvi-variants>: the radical and positional forms the search folds, by
  way of han-compose's table.
- qrcode-generator 1.4.4, Kazuhiko Arase, MIT, <https://github.com/kazuhikoarase/qrcode-generator>:
  the workshop's QR codes (a development dependency, bundled into the demo only).
- 字統网 (zi.tools), IDS search, <https://zi.tools/?secondary=ids>: the ASCII operator names, read from
  its page script (`action_abbr_map`) on 2026-10-24, and ideas for typing sequences.
- 字海网 (yedict.com), IDS search, <http://www.yedict.com/search/ids>: ideas for searching by parts.
- Mojidata Web App, Ryusei Yamaguchi (mandel59), <https://mojidata.ryusei.dev/about>: prior art,
  below.

## The workshop

The demo is a full-width workshop: the sequence, the operators and the part pickers at the start,
the tree in a square panel in the middle, and at the end the drawing in a square panel, the sequence
with the encoded character it describes (`adapter.encoded`) and its code points, and export as SVG or
PNG (256 to 2048 px) on a transparent, white, black or chosen background, in an ink that suits it or
a chosen one, with a margin, empty slots left out unless asked for. The toolbar holds Undo and Redo
with the history of named steps, saved drafts (also read from and written to a text file), examples,
a share link with its QR code, the language, a system, light or dark theme, preferences (key hints on
buttons, where the preview draws from) and the sources. The address carries the sequence
(`#⿰亻哥`, or `?ids=`), so a link opens it. Settings, drafts and the theme stay in the browser's
`localStorage` under `ids-input:`.

## Inspired by

Ideas the editor takes, each traced to the tool's own page as seen on 2026-10-25:

- 字統网 zi.tools, <https://zi.tools/?secondary=ids>: an interactive editor with operator buttons
  beside direct input, a palette of hard-to-type components, and the ASCII operator names.
- 字海网 yedict, <http://www.yedict.com/search/ids>: choosing a cell and then an operator splits it,
  an operator on an operator swaps it with its parts kept, × backs out one level, and a list of
  hard-to-type components fills the chosen cell; the editor's split, swap and unwrap follow it.
- Mojidata IDS Finder, Ryusei Yamaguchi (mandel59), <https://mojidata.ryusei.dev/idsfind>: searching
  by several sequences at once, by a whole pattern with `？` as a wildcard, and by other query terms.
- CHISE IDS 漢字検索, MORIOKA Tomohiko, <https://www.chise.org/ids-find>: listing the characters
  that contain every component given.

The data the editor runs on is listed under [Sources](#sources) with its licences.

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

- In its IDS Finder (<https://mojidata.ryusei.dev/idsfind>): a whole-character mode (`§…§`),
  variables (`x` matching the same subtree each time it appears, `⿱x⿰xx`), a count suffix (`耳*3`),
  and query terms beyond structure, such as a code point, readings, stroke counts and other
  properties (in `mojidata-web-app`'s `src/search/parseQuery.ts`), read from its source on
  2026-10-25. This package's search (see [Search](#search)) takes from it several sequences at once,
  all to match, `？` as a wildcard for a component or a subtree, and ⿻ matching its parts in either
  order; it ranks its hits and marks the match, which Mojidata's finder does not do as far as its
  source shows. No Mojidata data or code is used.
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
