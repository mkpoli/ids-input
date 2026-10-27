# ids-input

ids-input is a JavaScript library and a set of Svelte components for writing ideographic
description sequences (IDS), strings such as `⿰亻⿱七木` that describe a character by its parts.
Use it to write down a character that has no code point, to find characters by their parts, or to
put an IDS editor in a web page. It reads Han characters, those of Chữ Nôm included (𡨸 `⿰宁字`),
and Tangut characters and components.

Demo: the IDS Workshop, <https://ids.mkpo.li/>

<a href="https://ids.mkpo.li/"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/workshop-dark.png">
  <img src="docs/images/workshop-light.png" alt="The IDS Workshop: the sequence ⿰𠤕⿱龴疋 with the operator palette and parts on the left, its tree in the middle above the characters that contain it, and its drawing with export settings on the right">
</picture></a>

The package has four layers, and an optional preview:

- **core**: framework-free JavaScript with types and no dependencies. It parses and writes
  sequences, edits them as trees (split, swap, unwrap, clear, undo), reads ASCII operator names
  (`LR` for ⿰), maps keys to operators, steps through decomposition trees, and finds components by
  the names, words and readings people use for them (絞絲, ノ文, 宝盖, water, のぎ), and a
  character by its readings or meanings.
- **document**: the layer model behind `.ids.json` documents: stable layer IDs, transforms, IDS
  import and projection, and identity-preserving edits. The editor does not use it yet.
- **adapter**: the data the components ask for, supplied by the host application. A default
  adapter reads BabelStone IDS, the parts palette, component forms, names, script folds and the
  character readings from static files, so nothing needs a server.
- **svelte**: Svelte 5 components over one editor model: the sequence field, the operator palette,
  the tree, the chosen part's tools, the part pickers (a parts palette, a "Take parts from"
  decomposition browser, a search, a character search) and the preview, each placeable on its own
  or together as `IdsInput`, with message catalogues in English, Japanese, Simplified Chinese,
  Traditional Chinese, Korean and Vietnamese.
- **composer** (optional): a preview that draws a sequence, empty slots included, with
  [han-compose](https://github.com/mkpoli/han-compose) in a Web Worker.

The bundled data holds BabelStone's Han and Tangut decompositions, and the palette has a Tangut
tab. Bopomofo outlines are bundled for preview and SVG/PNG export. Import `fonts.css` for Tangut text. Tangut outlines are bundled for previews and SVG/PNG
export; mixed Han–Tangut descriptions also use the host's han-compose dataset.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/phone-dark.png">
  <img src="docs/images/phone-light.png" width="260" alt="The workshop at phone width: the sequence field, the operator palette and the parts palette in one column">
</picture>

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
  import forms from 'ids-input/data/component-forms.tsv?url'
  import names from 'ids-input/data/component-names.tsv?url'
  import folds from 'ids-input/data/component-name-folds.tsv?url'
  import characters from 'ids-input/data/character-vocabulary.tsv.gz?url'

  const adapter = babelStoneAdapter({ ids, parts, forms, names, folds, characters })
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
| `tintMode` | `"hover"` | branch tints: `"hover"`, `"on"`, or `"off"`; also accepted by `createEditor` |
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
`listen(fn)` hears each new text. `snapshot()` returns that state and history; `restore(state)` puts
them back, for a host switching between documents. In the tree, a click chooses a part, a part
dragged from the palette, the decomposition tree, a search or the swaps is put where it is dropped,
and the context menu (right click, the Menu key or `Shift+F10`) splits or swaps with any operator,
clears, removes a level or copies that part's sequence. "Take parts from" reads a character dropped
on it.
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

A component is an ideograph, a radical, a stroke, a letter or digit, a private-use character or
`？` for a part no character names, with an optional variation selector. The letters and digits are
those of Latin, IPA, Greek, Cyrillic, hiragana, katakana (コ, マ standing for a component of that
shape), Bopomofo, Hangul syllables and jamo, the full- and half-width forms and the kana supplements that the
preview's fonts draw (Noto Sans CJK JP and Plangothic), so a ligature such as 慶應's `⿸广⿰KO` can be
written and drawn. `isLetter` tells them apart. In a draft, `⬚` (or a part missing at the end) is an empty slot; a pasted `＋`, as earlier drafts and links have it, reads as one too, and is written back as `⬚`.

### Small Seal (小篆)

The optional `smallSealAdapter` provides CHISE's 汲古閣本《說文解字》 decompositions.
Its current Unicode mapping supports **49 character descriptions and 31 seal components**.
The workshop includes these in its searches and Small Seal palette. Searching for `玨`
finds its seal counterpart, U+3D10C; its description is `⿰𽁭𽁭`. Searching for
`𽄌` or `U+3D10C` returns its modern correspondences, 玨 and 珏. Character lookup
uses all 816 mapped seal forms; some have no resolved decomposition or bundled glyph.

```js
import { smallSealAdapter } from 'ids-input/adapter'
import sealData from 'ids-input/data/small-seal.json.gz?url'

const adapter = smallSealAdapter({
  data: sealData,
  ids, parts, forms, names,
})
```

`data` accepts a URL or the decoded JSON document. The remaining options are those of
`babelStoneAdapter`; omit them to use Small Seal alone. All descriptions share one search index.
Component and IDS searches match mapped seal and modern forms in either direction:
`玉玉`, `𽁭𽁭`, and `⿰玉𽁭` can find the seal 玨. Mappings join the existing radical-form
groups; a seal form with several modern spellings makes those spellings match one
another too. Repeated components are counted across the group. These groups concern
glyph correspondence; modern spellings can differ in meaning.
Each script keeps its own decompositions, result glyphs, and exact `encoded()` lookup. Import `fonts.css` to display the supported
seal characters. Their bundled outlines support previews and SVG/PNG export; mixed
Han–seal compositions also need the host's Han export.

The source has 11,114 records. Unresolved identifiers, extended operators and missing
mappings remain in the downloadable data with their original text and status. They are
excluded from decomposition lookup. See [the data notes](data/README.md#small-seal) for coverage,
provenance and rebuilding. CHISE data is GPL-2.0-or-later; the font has separate terms.

### Documents

`ids-input/document` is the model behind the [document format](docs/document-format.md): a tree whose
layers have stable IDs, transforms and a rendering recipe, saved as `.ids.json`.

```js
import { fromSequence, toSequence, replaceWithSequence, writeDocument, readDocument } from 'ids-input/document'

const document = fromSequence('⿰木口')
toSequence(document.root)                       // '⿰木口'
const mouth = document.root.children[1]
const replaced = replaceWithSequence(document, mouth.id, '水')
document.root.children[1].char                    // '口'; the input document is unchanged
const file = writeDocument(replaced)
readDocument(file).root.id                       // 'root'
```

`fromSequence` gives every layer a fresh opaque ID; repeated characters get different IDs. The edit
functions (`replaceNode`, `replaceWithSequence`, `decompose`, `wrapNode`, `unwrapNode`,
`changeOperator`, `deleteLayer`) keep the selected layer's ID, name and transform. Pass one
allocator across a session (`allocatorFor(document, retainedIds)`) so a removed ID is not reused.

The model reads and writes the document shape and validates its structure and transforms. The
transform engine evaluates affine, projective and Möbius chains on paths: affine chains stay exact,
a nonlinear chain is flattened within a tolerance and its pole is checked against the path's control
hull. `renderLayers(document, source)` walks the tree with a host that supplies each component's
local geometry and each operator child's placement, applies the nested layer transforms, and reports
missing geometry or unsupported transforms. Compositing (including ㇯), storage and the editor binding
are not part of these modules yet.

## Adapters

```ts
interface IdsAdapter {
  structure(char, options?): Promise<{ text: string, regions?: string }[]>   // required
  variants?(part, options?): Promise<{ char: string, count?: number }[]>
  search?(query, options?): Promise<{ char: string, label?: string }[]>
  searchCharacters?(query, options?): Promise<{ char: string, label?: string }[]>
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

`IdsPreview` supports manual drawing adjustments through `editable`, `bind:adjustments` and
`onchoose(path)`. Drag a part to move it, its corner square to scale it, or its circle to turn it.
Arrow keys nudge; `+` and `-` scale; `[` and `]` turn; `0` resets the chosen part. Adjustments are
keyed by leaf path. Use `composerPreview({ base, separate: true })` to draw each operand separately
for adjustment. A drawing made with ㇯ keeps its cut mask and cannot be adjusted.

`babelStoneAdapter({ ids, parts, forms, names, folds, characters })` answers `structure`, `search`
(a character, `U+6728` or bare hex, a name such as 絞絲, or a word or reading such as water or のぶん
when `names` is given), `searchCharacters` (a character by a reading or meaning when `characters` is
given), `containing` and `parts` from the files in `data/`. `forms` folds the description search's
components and opens a named component into the forms that stand for it; `folds` folds Chinese
scripts and positional forms together before names are compared. Without them `⺡` and `氵` are
different components and a name finds only the form and the script the table records. The containing
search builds an index in memory on first use: under Bun, about half a second for the most frequent
components and 150 MB of heap with the table loaded; a host with a server can answer `containing`
there instead. It has no `variants`, `drawing` or `preview`.

## Search

`createSearch(table, { forms })` in the core finds characters by what their descriptions hold, and
`babelStoneAdapter` answers it as `findByIds(query, { limit })` over its table. `IdsSearch` lists the
hits as square character cards, the code point shown on hover; the workshop puts it under the tree and
searches for the selected part, or the whole tree when nothing is selected. Each operator frame
shows its subsequence in muted text. Selecting an empty slot clears the search.

IDS queries accept these visual substitutes, including halfwidth forms where available:

| Shapes typed | Component searched |
|---|---|
| `ㅅ` | `人` |
| `ㅆ` | `从` |
| `스` | `亼` |
| `ㅁ`, `ロ` | `口` |
| `ㅇ` | `〇` |
| `ㅣ`, `ㅡ` | `丨`, `一` respectively |
| `ㄱ`, `ㄴ`, `ㄷ` | `𠃍`, `𠃊`, `匚` respectively |
| `エ`, `カ`, `タ`, `ト` | `工`, `力`, `夕`, `卜` respectively |
| `ニ`, `ハ`, `ヌ`, `ノ` | `二`, `八`, `又`, `丿` respectively |
| `ム`, `ヒ`, `ヨ` | `厶`, `匕`, `彐` respectively |

The corresponding conjoining Hangul jamo also work. Decomposed `스` searches
like `스`; other complete syllables keep their identity. Attached variation
selectors are preserved. For example, `⿰ㅅ木` finds `休` through the existing
`人`/`亻` component forms, and `⿰カロ` finds `加`.
These are approximate visual aliases for IDS search. Entered text, stored
descriptions, rendering, exact `encoded` lookup, and Korean or Japanese name
searches retain their spelling.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/search-dark.png">
  <img src="docs/images/search-light.png" width="600" alt="Search results for the part 疋: 定, 旋, 是, 楚 and other characters, each with its description below and the matched 疋 marked">
</picture>

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
5 s after navigation over three runs, the table's download and parsing included. Without a Worker (Bun, tests) the search runs on the caller's thread.

### Names and vocabulary

The parts finder's Find tab asks the adapter's `search`; with `names` it takes a character, a code
point, a name, a word or a reading (`data/component-names.tsv`, 6,642 names, words and readings
from Japanese and Chinese radical dictionaries and Wikidata, with English glosses, pinyin, Hepburn
and Kunrei romaji, and Korean and Vietnamese readings). A query and every name are folded alike:
NFKC, katakana as hiragana, Latin accents off, spaces and punctuation out, and Chinese scripts
through `data/component-name-folds.tsv`. A name that is the whole query comes first, then one the
query starts, then one it stands inside, so 宝盖 finds 宝盖 and 宝盖头, and 絞絲 finds 絞絲旁. A Latin
query matches whole words and their starts, and a word of five letters or more may stand inside a
longer name.

The component a name finds is opened into its other forms through `component-forms.tsv`, keeping
those the parts palette holds: 絞絲 and 绞丝 offer 纟, 糹 and 糸; ノ文, ノブン and のぶん offer 攵
and 攴; ノ木, の木, ノギ and のぎ offer 禾; 宝盖 and 寶蓋 offer 宀; 倒八 offers 丷, 卷字头 offers
龹, and 石字头 offers 丆. Either Chinese script finds either: 寶蓋, 宝盖, 寶盖 and 宝蓋 all give 宀,
and 龍部, 龙部 and 竜部 all give the forms of 龍. Readings, pinyin, romaji, Korean, Vietnamese and
English senses work the same way: water, silk, roof, thread, person, みず, mizu, sui, shui,
jiaosipang, baogaitou, sandianshui, nobun, nogi, ukanmuri, 수, thủy and Bộ Thủy lead to their
components; `radical 120` and `Kangxi radical 120` lead to 糸. A single ideograph or kana typed on
its own stays the character it is; a lone Hangul syllable also searches names, so 수 finds 水. Without `names` the search takes
characters and code points only.

### Characters

The Characters tab asks `searchCharacters`, over `data/character-vocabulary.tsv.gz`: the common
characters Unicode marks with `kIICore` (9,810, all with an IDS description), with 102,456 readings,
pinyin, romanizations, Korean, Vietnamese and English meanings. water, shui, mizu, みず, 수 and
thủy find 水; person finds 人; silk finds 糸. Results are characters, not the forms the Find tab
opens; among equally close names the more common character comes first, by KANJIDIC2's newspaper
frequency or Unihan's school grade. Without `characters` the tab is not shown.

## Preview

`ids-input/composer` draws sequences with han-compose (<https://github.com/mkpoli/han-compose>,
MIT), ported to the browser. Tangut outlines are bundled and loaded on demand. Han and mixed
Han–Tangut descriptions also read the static files han-compose's `export-web` writes (format 5):
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
origin by CORS. Without it Han previews keep their placeholders and show no badge; Tangut previews
use the bundled outlines. When the export loads but a part has no drawing, its badge reads
"Could not compose". Sequences over 24 operators or 8 levels are not drawn. Under
Vite, keep the package out of dependency pre-bundling (`optimizeDeps: { exclude: ['ids-input'] }`)
so the worker's URL resolves; `composerPreview({ base, worker })` takes a function making the Worker
for other bundlers.

The demo draws from `https://glyphatlas.org/atlas/composer/bd0829bc6fbf-sans-compose-layout-v4-f5/`;
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

Elsewhere, `Ctrl/⌘+S` saves a draft and `Ctrl/⌘+,` opens settings. Toolbar buttons show their keys
on hover. Outside text fields, `Ctrl/⌘+X`, `Ctrl/⌘+C` and `Ctrl/⌘+V` cut, copy and paste the selected
part (the whole sequence when none is selected); `Ctrl/⌘+A` selects the whole tree. File and Edit
menus support arrow keys, Home/End and Escape.

The operator palette groups the operators by how many parts they take (1: ⿾ ⿿ 〾; 2: ⿰ ⿱ ⿴ ⿵
⿶ ⿷ ⿼ ⿸ ⿹ ⿺ ⿽ ⿻ ㇯; 3: ⿲ ⿳, `OPERATOR_GROUPS` in the core), each button showing its key (`shortcut()` writes keys as the platform does: ⌘⇧Z on Apple systems,
Ctrl+Shift+Z elsewhere).

An operator on a slot splits it, the old part first (⿰ on 失 gives ⿰失⬚); on an operator it takes
its place and keeps its parts, refusing to drop a filled one. In the sequence field, ASCII names in
either case become operators: LR ⿰, UD ⿱, LL ⿲, UU ⿳, OC ⿴, OD ⿵, OU ⿶, OR ⿷, RD ⿸, LD ⿹, RU ⿺,
XX ⿻, OL ⿼, LU ⿽, MI ⿾, RO ⿿, SU ㇯. Two capitals that spell a name are read as that operator, so
letters such as L and R side by side go in from the part field, one slot at a time. In "Take parts from", the arrow keys move through the tree,
`ArrowRight` opens a part and reaches its swaps, and `Enter` takes a part or a whole node.

## Licences

- Code: MIT (`LICENSE`).
- `data/small-seal.json.gz` and `data/small-seal-sources.tar.gz`: CHISE, GPL-2.0-or-later
  (`data/COPYING-small-seal.txt`).
- `fonts/IDSSeal*` and `data/small-seal-outlines.json.gz`: derived Kaiyuan glyphs under
  the [Kaiyuan font license](fonts/LICENSE-IDSSeal.txt); the outline file also contains
  exact-description mappings from CHISE (GPL-2.0-or-later).
- `data/babelstone-ids.tsv.gz`: BabelStone IDS, public domain, with the 6,145 records of BabelStone
  Tangut IDS, factual decompositions (798 KB).
- `data/component-forms.tsv`: radical and positional forms, from han-compose's
  `data/vocab/han-component-forms.tsv`, drawn from Unicode's EquivalentUnifiedIdeograph.txt (Unicode
  License v3) and cjkvi-variants' `radical-variants.txt` (public domain); its header names both (26 KB).
- `data/component-names.tsv`: the names, words and readings people use for components, CC BY-SA 4.0
  as a whole (<https://creativecommons.org/licenses/by-sa/4.0/>), from kanji-tools (MIT), KANJIDIC2
  and Wikipedia (CC BY-SA 4.0), tudien (CC0 1.0), rime-wanxiang (CC BY 4.0), MyBox and OpenCC
  (Apache 2.0), Unihan 18.0.0 (Unicode License v3), pypinyin (MIT) and Wikidata (CC0 1.0); its
  header names each (298 KB). Its Wikipedia redirects are kept in
  `data/component-name-redirects.json`.
- `data/component-name-wikidata.json`: the Wikidata labels and aliases for the 214 radicals, CC0 1.0
  (<https://creativecommons.org/publicdomain/zero/1.0/>), 131 KB.
- `data/component-name-folds.tsv`: the Chinese scripts, component forms and Japanese shinjitai forms
  folded together for the name search, CC BY-SA 4.0 as a whole, from `component-forms.tsv`, OpenCC
  (Apache 2.0) and an editorial table of 竜, 亀, 斉 and 歯 (15 KB).
- `data/character-vocabulary.tsv.gz`: the readings and meanings of the common characters, CC BY-SA
  4.0 as a whole, from Unihan 18.0.0 (Unicode License v3) and KANJIDIC2 (CC BY-SA 4.0); 102,456
  rows, 831 KB gzipped.
- `data/ids-parts.json`: its first-stroke column adapts Rime’s five-stroke dictionary (LGPL-3.0);
  source notices and licence texts are in `data/licences/`.
- `fonts/`: Plangothic and Noto Sans CJK JP subsets (58 KB together), Noto Serif Tangut (1 MB) and
  Klee One (2.8 MB), SIL Open Font License 1.1.
- `data/tangut-outlines.json.gz`: Noto Serif Tangut outlines, SIL OFL 1.1
  (`fonts/OFL-NotoSerifTangut.txt`), with exact-description mappings from BabelStone Tangut IDS.
- `src/composer/`: a port of han-compose's composer, MIT. Han drawings use the host export's
  outlines of Noto Sans CJK JP and Plangothic (SIL OFL 1.1, texts in
  `fonts/OFL-NotoSansCJK.txt` and `fonts/OFL-Plangothic.txt`); a drawing with a part cut along
  KanjiVG's component groups (`drawn.kanjivg`) adapts KanjiVG and is shared alike under CC BY-SA 3.0.

`data/README.md` and `fonts/README.md` give versions, checksums and build notes.
`scripts/build_ids_data.py`, `scripts/build_ids_parts.py`, `scripts/build_component_names.py` and
`scripts/build_character_vocabulary.py` (`uv run scripts/…`) rebuild them.

## Sources

- BabelStone IDS, Andrew West (魏安), <https://www.babelstone.co.uk/CJK/IDS.TXT>, File Date
  2025-06-27. Public domain by its own header; it draws on Kawabata Taichi's IDS data
  (<https://github.com/kawabata/ids>) and IRG submissions.
- BabelStone Tangut IDS, Andrew West, <https://www.babelstone.co.uk/Tangut/TangutIDS.txt>, pinned
  by SHA-256 in `scripts/tangut.py`: the Tangut decompositions and the Tangut palette's usage counts.
- hfhchan/ids v1.0.2, Henry Chan, MIT, <https://github.com/hfhchan/ids>: which components the
  palette leaves undecomposed.
- Unihan 18.0.0, Unicode, Inc., Unicode License v3, <https://www.unicode.org/reports/tr38/>: stroke
  counts, the common set, the IRG source regions named in the decomposition tree, and the
  definitions, Mandarin, Japanese, Korean and Vietnamese readings of the component and character
  names.
- KANJIDIC2, Electronic Dictionary Research and Development Group, CC BY-SA 4.0,
  <https://www.edrdg.org/kanjidic/kanjidic2.xml.gz>: radical names, meanings, readings and pinyin of
  the component names.
- Wikidata, CC0 1.0, <https://www.wikidata.org/>: labels and aliases for the 214 radical items, in
  English, Japanese, Chinese, Korean and Vietnamese.
- pypinyin 0.55.0, mozillazg, MIT, <https://github.com/mozillazg/python-pinyin>: the pinyin of
  Chinese component names.
- OpenCC 1.4.2, BYVoid, Apache 2.0, <https://github.com/BYVoid/OpenCC>: traditional and simplified
  spellings of component names and their folds.
- Rime five-stroke dictionary, LGPL-3.0, <https://github.com/rime/rime-stroke>: first-stroke classes.
- KanjiVG r20260714, Ulrich Apel, CC BY-SA 3.0, <https://kanjivg.tagaini.net/>: component cuts
  used by the composer.
- Noto Sans CJK JP 2.004, Adobe, and Plangothic V2.9.5795, Fitzgerald P. Köeingsegg, both SIL OFL
  1.1.
- Noto Serif Tangut 2.168, Google LLC, SIL OFL 1.1,
  <https://github.com/notofonts/noto-fonts/tree/main/unhinted/ttf/NotoSerifTangut>: Tangut text.
- Klee One Regular, Copyright 2020 The Klee Project Authors, SIL OFL 1.1,
  <https://github.com/google/fonts/tree/main/ofl/kleeone>: the Klee One glyph face.
- han-compose, mkpoli, MIT, <https://github.com/mkpoli/han-compose>, composer at commit bd0829b,
  export format 5 (`export-web`): the composer `src/composer/` ports. Its export draws on Noto Sans
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
- X posts seen on 2026-10-26 (JST), for the forms in `demo/lib/examples.js` with no code point:
  @JUMANJIKYO (⿱艹堀, ホキ), @dmnefkt (⿱投石, さかなげ), @ka_disco (⿲𠂤日千), @qvarie
  (⿴囗⿱エン), @jianhuazi_bot2 (⿱一心) and @Umihotarus (⿰忄実, 舘暲's character for ヴァーチャル).
- SCRIPT-HYBRID (BiangBiangCon v19), slides dated 2026-10-16 (JST), supplied 2026-10-26, for the
  hybrid examples. ⿴口도 is the slide's proposed 図. ⿰艦ラ, ⿰艦ツ and ⿰掌キ follow
  CINCPAC-CINCPOA Bulletin 18-45 and Japanese Military and Technical Terms (1945-07-30) p.217,
  L2/24-201 Fig.44; the 通船 and 掌機長 images are from @xWcvlUaljn96009. ⿰门T follows N2744 Fig.8
  and N2741 p.10 (唐蘭『古文字学導論』p.134). The encoded hybrid characters are U+2B9AB, U+2BCCD,
  U+282A3, U+2C711, U+3514, U+3516 and U+439E, with IDS from BabelStone.
- Gen Kojitani, [Reply to N2741, IRG N2744](https://www.unicode.org/irg/docs/n2744-IRGN2741Response.pdf),
  2024-10-20, p.7: 𭤪 (U+2D92A) contains hentaigana 𛂦 (U+1B0A6), represented in the examples as
  `⿰𛂦方`. BabelStone currently records `⿰？方`. The digit form `⿰扌3` approximates the Sawndip
  form in Fig.7 (p.8); its pictographic right component also has a dot in the source.
- Gen Kojitani, [Script-hybrid and abbreviated CJK letters, IRG N2637](https://www.unicode.org/irg/docs/n2637-HybridIdeographs.pdf),
  2023-06-23, Table 1 no.1 and Fig.1: the Bouyei form `⿰亻Ａ`, from 《布依方塊古文字》p.64.
  The example `⿰亻A` uses ASCII A.
- mkpoli, personal communication, 2026-10-27: attested forms `⿰木き`, `⿰木⿳ㄙㄨㄙ` and
  `⿰木⿱ㄅㄞ`. No published source is recorded here.
- Mojidata Web App, Ryusei Yamaguchi (mandel59), <https://mojidata.ryusei.dev/about>: prior art,
  below.

## The workshop

The demo is a full-width workshop with one tab for each description being edited, in a strip below
the toolbar. A tab is the description's composed drawing at a small size, and a dot while its text
differs from the text it was saved with; the sequence itself is the tab's tooltip and accessible
name, not written in it. The active tab has an accent line along its top, and the + button opens an empty tab.
Every panel follows the chosen tab: the sequence, its code points, the operators and the part pickers
at the start; the Shape or indented Tree view and the search under it; and at the end
the drawing in a square panel with export as SVG or PNG (256 to 2048 px) on a transparent, white, black or chosen
background, in an ink that suits it or a chosen one, with a margin, empty slots left out unless asked
for. Adjust layout moves, scales and turns drawing parts before export without changing the sequence;
those adjustments stay with their tab while it is open. Rows in the Tree view select parts, expand
with the arrow keys and accept drops. A click, the
arrow keys, Home/End or, where the browser leaves them to the page, `Ctrl+Tab`,
`Ctrl+Shift+Tab` and `Ctrl+PageUp`/`Ctrl+PageDown` move between tabs. ×, middle click or Delete
closes a tab (Undo brings it back; the last tab stays). The tree and search panels in the middle
column are divided by a draggable splitter, the tree starting
larger; the arrow keys move it and a double-click restores the default. Vertical dividers resize the
columns by dragging or with Left/Right; a double-click resets their widths. Toolbar buttons show their
keys on hover. File and Edit menus provide new tabs, saved drafts, sharing, image export, and editing
commands. File → Duplicate tab copies the active document; right-clicking a tab or pressing
Shift+F10 on it offers the same action for that tab. The copy opens beside its source with its
selection, undo history and drawing adjustments, which can then be edited independently.
The toolbar holds Undo and Redo with the history of named steps, examples (each with its
character and code point, or marked when it has none), a share link with its QR code, the language,
settings and the sources. Settings hold the system, light and dark themes, key hints, and the
preview data source; they open beside the toolbar button on desktop and in a bottom drawer on mobile. An example opens a
tab. The address carries the active sequence (`#⿰亻哥`, or `?ids=`), so a link opens it. Tabs use
`sessionStorage` to keep each browser window's working set separate through reloads, and
`localStorage` to seed a new window. The toolbar’s Sans/Serif/Kaisho switch chooses the face for Han text. Settings, drafts, the theme and font choice stay in `localStorage`; the keys
use the `ids-input:` prefix.

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

## Licenses

The code is licensed under [MIT](LICENSE). Data is provided under Creative Commons
or the terms of its original sources; see the [data notices](data/README.md) for
each dataset's license and attribution.

Generated items are subject to the applicable terms of the original fonts; see the
[font notices](fonts/README.md). The IDS Workshop imposes no additional restrictions
on their use.

## Development

```sh
bun install
bun test tests          # core, adapter, composer and catalogue tests
COMPOSER_EXPORT=DIR bun test tests/composer-parity.test.js   # the port against han-compose's own drawings
bun run check           # tsc and svelte-check
bun run dev             # the demo on a dev server
bun run build:demo      # the demo into dist/
bun run build:example-drawings   # the examples' drawings, after COMPOSER_BASE changes
bun demo/check.js --shots shots [--chromium PATH]   # the built demo in Chromium, with screenshots
```

The prepared drawings in `demo/lib/example-drawings.json` are composed once from the export at
`demo/lib/composer.js`'s `COMPOSER_BASE`; `bun run build:example-drawings` rebuilds them, and
`tests/example-drawings.test.js` fails while the file and the export disagree.
