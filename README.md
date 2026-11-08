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
  the tree, the chosen part's tools, the part pickers (a parts palette, structure templates, a
  "Take parts from" decomposition browser, a search over components and characters, and a pad to
  find a part by drawing it) and the preview, each placeable on its own
  or together as `IdsInput`, with message catalogues in English, Japanese, Simplified Chinese,
  Traditional Chinese, Korean and Vietnamese.
- **composer** (optional): a preview that draws a sequence, empty slots included, with
  [han-compose](https://github.com/mkpoli/han-compose) in a Web Worker.

The bundled data holds BabelStone's Han and Tangut decompositions and unannotated descriptions
from Yi Bai's IDS dataset, and the palette has a Tangut
tab. Bopomofo outlines are bundled for preview and SVG/PNG export. Import `fonts.css` for Tangut
and New Korean text. Tangut outlines are bundled for previews and SVG/PNG
export; mixed Han–Tangut descriptions also use the host's han-compose dataset.
The Hangul tab has Jamo, Compose and Syllable views. Compose is one jamo keyboard of modern and
historical forms, grouped by consonants, vowels and finals: click an initial consonant, a vowel and
an optional final, and Insert puts the precomposed syllable or the Old Hangul jamo run into the
editor. A tone row above the keyboard marks the syllable with a Middle Korean
[bangjeom](https://encykorea.aks.ac.kr/Article/E0021781): one dot for the high tone, two for the
rising one, the low tone unmarked. The mark stays on its syllable when the syllable goes into a
description. Syllable
searches the 11,172 modern syllables by character, jamo,
[Revised Romanization](https://www.korean.go.kr/front_eng/roman/roman_01.do) (or normalized
[McCune-Reischauer](https://en.wikipedia.org/wiki/McCune%E2%80%93Reischauer) initials and breves) or
code point; the romanization is a syllable spelling without the assimilation rules that cross
syllable boundaries.

The Shuishu tab holds the 486 characters and 47 radicals of the proposed block, at its tentative
allocations U+1B300–U+1B4E5 and U+1B500–U+1B52E. Unicode 18.0.0 leaves them unassigned too; the
outlines are the glyphs of the amendment's own code charts, bundled for previews and export with the
`IDS Shuishu` face, and the tab filters them by name, reading, meaning, code point and description.
Its groups follow the dictionary the index comes from: the characters that dictionary numbers, the
rest, and the radicals. Eighteen of the characters carry an editorial IDS, printed on the tile and
in their title; a description finds its character, a typed part lists the characters written with
it, and the structure panel treats the decomposition as the character's parts. The tab says the
decompositions are ours, since no source gives them.

The Jurchen tab holds Unicode 18.0's 914 characters and 51 radicals and Alari's 537 variant
sequences, with outlines from
[Alari Xuwasun Jurchen](https://dorontu.com/#/cloud) bundled for previews and export with the
`IDS Jurchen` face. Narrow the characters by radical, or filter them by Alari's stroke code, the
reading in Unicode's records, numeric value or code point. Forty-four of the characters carry an
editorial IDS, printed on the tile and in their title, and the tab says these are ours, since no
source gives them.

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
  import layers from 'ids-input/data/tangut-layers.json.gz?url'
  import zitools from 'ids-input/data/yi-bai-ids.tsv.gz?url'
  import corpus from 'ids-input/data/ids-corpus.json.gz?url'
  import projectIds from 'ids-input/data/ids-project.tsv.gz?url' 
  import components from 'ids-input/data/ids-components.tsv?url'
  import parts from 'ids-input/data/ids-parts.json?url'
  import forms from 'ids-input/data/component-forms.tsv?url'
  import names from 'ids-input/data/component-names.tsv?url'
  import folds from 'ids-input/data/component-name-folds.tsv?url'
  import characters from 'ids-input/data/character-vocabulary.tsv.gz?url'

  const adapter = babelStoneAdapter({ ids, zitools, chise: corpus, project: projectIds, layers, components, parts, forms, names, folds, characters })
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
| `pickers` | `['find', 'parts', 'from', 'templates']` | the part picker's tabs; a tab the adapter cannot answer is left out; `templates` offers editable two- to four-part layouts and repeated rows |
| `recentKey` | `'ids-input.recentParts'` | `localStorage` key of the palette's recent parts; `null` keeps none |
| `keyHints` | `true` | show each operator's key in a corner of its button |
| `preview` | snippet | `(sequence, whole)`, drawn beside the field in place of `IdsPreview` |
| `tintMode` | `"hover"` | branch tints: `"hover"`, `"on"`, or `"off"`; also accepted by `createEditor` |
| `disabled` | | |

`IdsInput` shows `IdsPreview` beside the field when the adapter has a `preview` or a `drawing`.

The Templates picker groups layouts by component count and orders each group by the number of characters using it in the bundled BabelStone and Yi Bai IDS datasets. `scripts/build_structure_templates.mjs` adds layouts found in at least 50 distinct characters, preserving the original shortcuts. The Hangul layout `⿱⿽⬚⬚⬚` is included separately as a curated template; its tooltip identifies the layout rather than showing a Han-corpus count. The two mirrored pairs `⿰⬚⿾⬚` and `⿰⿾⬚⬚` are curated for the 対称 arrangement ([畳字](https://wikiwiki.jp/myriadrevery/畳字)), where the frequency pass leaves unary transforms out. Counts use supplied whole-character descriptions with two to four components, merge equivalent axis arrangements, and count each character once per layout. Source versions, counts and examples are recorded in `src/core/structure-templates.json`; these are dictionary coverage counts, not usage frequencies.

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
with ⿰", "Put 木"): `operator`, `put`, `merge`, `take`, `empty`, `remove`, `open`, `undo`, `redo`,
`travel` and `keydown` change it, `change` names the last change and whether it threw something away,
and `listen(fn)` hears each new text. `merges` lists the characters the chosen node encodes and
`merge(char)` puts one in its place (⿱一口 as 𠮛), one more named step. `snapshot()` returns that
state and history; `restore(state)` puts them back, for a host switching between documents. In the
tree, a click chooses a part, a part dragged from the palette, the decomposition tree, a search or
the swaps is put where it is dropped, and a part of the tree, or a whole group grabbed by its frame,
dropped beside a sibling moves there while one dropped on any other part switches places with it.
A finger drags the same way on a touch screen, where the browser starts no drag of its own, and
`Alt` with an arrow key reorders siblings without a pointer. `Space` lifts the focused box, a part
or a group by its operator button, and `Space` on another box places it; `Escape` lets it go, and in
the indented Tree view the arrows move the focus between rows while a box is lifted. The context
menu (right click, the Menu key or `Shift+F10`) splits or swaps with any operator, clears, removes a
level or copies that part's sequence. "Take parts from" reads a character dropped on it.

The sequence field accepts zi.tools replacement expressions with three single components, such as
`🔄林木火` or `RP林木火`. It opens the source character's descriptions and converts the expression
to an editable IDS (`⿰木火`). The lookup opens as few components as possible, then replaces the
shallowest occurrence; where several are equally shallow, the last is used. If the target cannot be found in the available descriptions, the entered text
remains in the field. Resolution is bounded to eight opened components and 128 candidate trees.

`IdsParts` (`adapter`, `onpick(part)`) and `IdsFrom` (`adapter`, `ontake(text)`, bindable `text`)
also work without an editor. A pick that returns `false` was not placed, so the Hangul compose
keyboard keeps its letters. `IdsSketch` (`adapter`, `onpick(part)`, `onclose()`) is the Find tab's
drawing pad; it asks the adapter for the palette and takes its glyph shapes from the page's
`--ids-font`. The Components panel shows the most used parts first, then every Han
component of one stroke count, including compound IDS, grouped by first stroke. Palette text can be selected and copied;
compound cells show their sequence and expose the stroke count on hover. `adapter.icon` supplies their outlines;
without it, the cells use a font-based layout. Icon rendering must accept concurrent
requests independently of the main preview. The components take colours from CSS custom properties with light and dark defaults
(`--ids-ink`, `--ids-muted`, `--ids-line`, `--ids-control-border`, `--ids-surface`, `--ids-accent`, `--ids-fault`,
`--ids-font`, `--ids-glyph-fallback` and others; see the top of each component's style). The defaults
use `light-dark()`, so the page needs `color-scheme: light dark` for its dark scheme. The workshop
maps these tokens onto the `--ui-*` tokens of its design system, below.

### Design system

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/design-dark.png">
  <img src="docs/images/design-light.png" alt="The design system page: the palette with measured contrast ratios in the light scheme">
</picture>

The workshop's colours, states and form controls live in `design/` and are published with the
package as `ids-input/design.css`:

- **Tokens** — semantic colours as `light-dark()` pairs, the type scale, spacing, radii, control
  heights, focus ring, motion and layers.
- **Controls** — native checkbox, radio, switch, text field, select, textarea, range and colour
  input, with buttons, a segmented control, a swatch group and cards. The browser keeps the
  semantics and keyboard behaviour; one stylesheet draws every state.
- **Checks** — `demo/check-design.js` verifies accessible names, keyboard operation, focus rings,
  contrast, 24 px targets, reduced motion and forced colours in Chromium.

The reference page is built to `design.html` (on the workshop site, <https://ids.mkpo.li/design.html>), and the rules for choosing and applying a
control are in [design/README.md](design/README.md).

### Core

```js
import { parse, write, applyOperator, unwrap, unalias, commandFor, createHistory, enclosedRepeatSequence, pyramidOnBase, pyramidRows, pyramidSequence, repeatSequence } from 'ids-input'

parse('⿰亻⿱七木').tree        // { op: '⿰', parts: ['亻', { op: '⿱', parts: ['七', '木'] }] }
parse('⿰亻').problem           // 'missing'
parse('⿰亻', { open: true })   // a draft: { tree: { op: '⿰', parts: ['亻', null] } }
write(applyOperator(parse('⿰亻失').tree, [1], '⿱').tree)  // '⿰亻⿱失⬚'
unalias('lr亻ud匕失')           // '⿰亻⿱匕失'
commandFor({ key: '&', code: 'Digit1' })  // { command: 'operator', op: '⿰' }, on any layout

pyramidSequence('口', 4)       // '⿱⿱口⿰口口⿱⿲口口口⿰⿰口口⿰口口'
pyramidSequence('口', 3, { direction: 'left' })  // '⿲口⿱口口⿳口口口'
pyramidRows(parse(pyramidSequence('口', 4)).tree)  // { cell: '口', layers: 4, count: 10, direction: 'top' }
pyramidOnBase(parse('⿳口⿰口口木').tree)  // { cell: '口', layers: 2, base: '木' }
pyramidSequence('⿱众⿰众众', 2) // '⿱⿱众⿰众众⿰⿱众⿰众众⿱众⿰众众', a description repeated
pyramidSequence('', 3)         // '⿳⬚⿰⬚⬚⿲⬚⬚⬚', empty slots to fill
repeatSequence('口', [2, 3])   // '⿱⿰口口⿲口口口'
repeatSequence('口', [2, 1, 2])  // '⿳⿰口口口⿰口口'
enclosedRepeatSequence('囗', '口')  // '⿴囗⿱⿰口口⿰口口'
repeatSequence('屮', [3, 3], { bottom: '刀' })  // '⿱⿲屮屮屮⿲刀刀刀'
```

A component is a graphic Unicode code point (letter, mark, number, punctuation or symbol) or a
private-use character, with an optional variation selector. A run of conjoining Hangul jamo that
forms one syllable is one component; the Hangul palette writes modern combinations as a precomposed
syllable and Old Hangul as the jamo run that fonts shape as one syllable. This includes 〇, Greek and Cyrillic
letters from every block, and scripts beyond CJK. Operators, empty-slot markers, whitespace,
controls, default-ignorable characters, surrogates and unassigned code points are excluded, except for the bundled Small Seal
allocation U+3D000–U+3FC3F, the New Korean Orthography code points U+A97D–A97F, U+D7C7 and U+D7FC–D7FE,
and the proposed Shuishu block U+1B300–U+1B4E5 and U+1B500–U+1B52E.
A combining mark fills an operand slot when one is due, and trails the whole description when the
description is complete; only a variation selector attaches to the preceding component. Acceptance follows bundled Unicode 18.0.0 property tables and is independent of
preview font coverage. The composer supplements missing export glyphs with 56,651 bundled font
outlines, including 〇, 〆, Greek, Cyrillic and other scripts. `fonts.css` offers the same outlines
to text as the `IDS Fallback` webfont, placed after the reader's fonts, so a character no installed
font draws appears in its shape rather than a missing-glyph box. Characters absent from both sources
still have no preview; private-use characters need an outline supplied by the host.
`isLetter` identifies alphabetic/syllabic letters and decimal digits, excluding ideographs and radicals.
The seven code points above are the positions OBAYASHI Muneaki proposed for the four letters the
New Korean Orthography added to Hangul in [L2/19-230R](https://www.unicode.org/L2/L2019/19230r-six-hangul-letters.pdf)
(2019-06-24); Unicode 18.0.0 leaves them unassigned. The Hangul palette names them, `fonts.css`
supplies the `IDS New Korean` face, and their outlines are bundled for previews and export.
The [Unicode IDS grammar](https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-18/)
supplies the ideographic operands; the other graphic categories are this editor's extension. In a draft, `⬚` (or a part missing at the end) is an empty slot; a pasted `＋`, as earlier drafts and links have it, reads as one too, and is written back as `⬚`.

### Cells

A description of eight or more leaves (an empty slot counts as one) is drawn **in cells** when no
character spells it as a whole, it uses only alignment and exact enclosure operators, and every leaf
has a glyph. Each part takes its own cell in the tree's reading order, so no two parts overlap. The
cell layout gives a single top part less than a third of the height and lets it fill the width,
shares an alignment axis below the top by the ink of its parts (one holding an empty slot keeps leaf shares), insets a side-split enclosure's inner part and a three-row middle,
and fits each glyph by its ink. A dense description then reads as one character rather than a list
of parts. The 108-stroke created character 「ぼんのう」 by しょかき is
such a description; its [reference drawing](https://wikiwiki.jp/sosakukanji/%E3%81%BC%E3%82%93%E3%81%AE%E3%81%86%28%E3%81%97%E3%82%87%E3%81%8B%E3%81%8D%29)
puts 苦 above, 耳/舌/鼻 left, 平/惡/意/眼 centre, 淨/染 below and 女/子/身 right.

The preview badges a cell drawing **Cells**. `compose(source, sequence, { layout: 'composed' })`
forces the composer, and `'cells'` forces cells and rejects loose marks and modified operators; the default, `'auto'`, uses
cells only for such dense descriptions. A description that is itself a pyramid, a grouped form or
an excluded character, or that carries loose marks or approximate operators, keeps the composer.

### Pyramids

`pyramidSequence(part, layers)` writes one part in groups of 1, 2, 3, …; the part is a component,
any description or ⬚. `direction` points the pyramid `top` (default), `bottom`, `left` or `right`:
top and bottom stack rows of 1…`layers` cells, left and right stand columns of 1…`layers` cells side
by side. `pyramidRows` reads an equivalent tree back, whichever way its groups use `⿰`/`⿲` and its
cross axis uses `⿱`/`⿳`, and answers the repeated part in `cell` and the way it points in
`direction`. The composer draws a pyramid of three or more layers, or of two layers whose cell is a
description, as equal square cells in the chosen direction, so the 4-layer spellings given for `口`
above draw alike, and deeper triangles keep the same cell size; a cell that is a description is
composed inside its cell. A two-layer pyramid of one part follows the composer's designed forms
instead (品, 森). `pyramidOnBase` reads a pyramid standing on one more part, ⿳口⿰口口木 and
⿱⿱口⿰口口木 alike, as `{ cell, layers, base }`; the composer spreads the rows over the full width
above the base, each cell wider than it is tall, draws the base as a cell in the row below, and
draws the spellings alike. A whole description may run past the ordinary 64-code-point length as a pyramid
of two or more layers, its cells any part; a draft may be longer still. The composer draws up to
64 layers (2,080 cells). The workshop's Templates tab inserts one-click pyramids of 2 to 24
layers, its sizes in a scrollable row, and its four-icon switch points the pyramid up, down, left
or right. The shared Part field above the generators starts with the selected part or 口; an empty
Part lays out empty slots, drawn in the pyramid's cells, and a typed value is kept for all three.
Enter a part, then choose a preset or a custom layer count. Sideways pyramids keep every part
upright. `pyramidSequence(part, layers, { direction: 'bottom' })` writes a pyramid from its widest
row down to one; `'left'` and `'right'` write the sideways arrangements.

### Repeats

`repeatSequence(part, rows, { bottom })` writes two or three rows of repeated parts, with one to
four copies in a row; a part is a component, any description or ⬚. The first rows hold `part`; the
last holds the second part, which defaults to `part`. Rows of three use `⿲`, a row of four splits in half, and the rows stack with
`⿱`. `repeatSequence('口', [2, 1, 2])` writes 2·1·2 as `⿳⿰口口口⿰口口`. `enclosedRepeatSequence(host, part)` puts four
copies in a 2×2 grid inside an enclosure.

The Templates tab inserts the 2+3, 3+3, 2+4 and 4+4 patterns with the shared Part field. A second
field, Bottom row, takes another part and falls back to the first when empty. A Rows
field takes two or three counts from 1 to 4, such as `3 4` or `2 1 2`. The Five block adds 2·1·2 and 1 + 2 × 2; its Host field is the enclosure. These cover the
五同, 六同, 八同 and 二組 arrangements of [畳字](https://wikiwiki.jp/myriadrevery/畳字).

### Loose marks

A description may end with a run of loose marks: combining marks, modifier letters, tone marks,
kana voicing marks or superscripts that annotate the whole character instead of taking an operand's
place. They are ordinary Unicode characters, not operators.

| written | drawn |
| --- | --- |
| `⿰亻木ˊ` | 休 with an acute tone mark |
| `⿰ㄅㄚˇ` | a Bopomofo syllable with the third tone |
| `⿰ㄅㄚ˙` | the same with the neutral tone dot |
| `⿰氵青゛` | 清 with a voicing dot (U+309B) |
| `⿰氵青゙` | the same with the combining U+3099 |
| `⿰亻木́` | an accent combining over the composed character |
| `⿰ㄅㄚ〮` | a Hangul single dot tone mark at the left |
| `⿸广⿰KO¹` | the 慶應 ligature with a superscript numeral |
| `⿰亻木˥˧` | tone letters after the character |

`isMark` names the characters that may trail a description: every Unicode mark (Mn, Mc, Me), every
modifier letter (Lm), the modifier symbols for accents and tone letters (Sk: `˙ ˪ ˫ ˥–˩`, `꜀–꜇`,
`゛ ゜` and the like), and superscript or subscript digits (No). `parse` keeps them on the root, as a
node's `marks` or the tail of a component's text, and `write` puts them back; `splitDescription(text)`
answers `{ base, marks }`. A mark written where an operand is still due fills that operand, as it
always could, so `⿰ㄅˊ` stays a two-operand description. The marks belong to the whole description:
an edit that would leave them inside the tree moves them back to the root (`normalizeMarks`).

Type or paste the marks after a complete description in the sequence field, or pick one from the
Marks tab of the parts palette; the Bopomofo and Hangul tabs keep their tone marks. Loose marks are
not part of an IDS shape, so search ignores them: `⿰亻木ˊ` finds what `⿰亻木` finds. In a
`.ids.json` document they are `marks` on an operator or the end of a component's `char`, at the end
of the projection.

The preview draws marks into the same 1000-unit box:

- a combining mark sits over or under the composed drawing, centered, and a run stacks; it may
  overlap the ink, as a combining mark does over its base;
- a mark that sits beside the drawing takes a margin: kana voicing marks, spacing accents, tone
  letters and superscripts at the upper right in a row, Hangul tone marks at the left. The composed
  drawing shrinks toward the opposite corner so the mark stands outside its strokes, and the row or
  stack is fitted to its corner of the box;
- everything stays inside the box. A mark whose outline is in neither the host export nor the
  bundled Unicode outlines is left out of the drawing.

Marks are separate parts of the drawing (`origins` holds `mark ˊ`), so they export with the SVG and
PNG. The test suite draws them from the bundled Bopomofo and Unicode outlines.

A zi.tools entry reads as its description: the unique separator before it (`{士}⿱十一`) and the
glyph-variant definition after it (`⿻乚一(.,T)`) say which glyph the entry is for, so `parse`
leaves them out and `write` does not put them back; this package draws one glyph per character and
carries no variant data. A modifier after an operator (`⿻[1:]丨日`, `⿴[1]囗人`, `㇯[2]王一`)
stays with that operator and is written back with it: overlays, the enclosures and subtraction take
one, other operators keep a bracket as a component, and its matrix or index narrows where a part
sits or which occurrence an operator acts on. The layout draws the description as it does without
one, so previewing such a description is approximate. Stroke chains (`#(H)`) are not read yet.

A zi.tools stroke chain that names a stroke or a character reads as that character: `#(H)` is 一,
`#(Wg)` is ㇁, and `#(-丨𠃍-一z)` is 口. Chains that name no character the published grammar lists
stay in the text, to be read as their parts or rejected as usual.

A zi.tools description that carries a stroke chain this package cannot draw resolves to the
character the published table gives it: pasting `⿱丿⿹#(-𠃌㇉)一` gives 乌. The host supplies that
table as `chains` (the workshop's `data/zi-tools-chains.tsv.gz`); without it the text stays.



### Small Seal (小篆)

The optional `smallSealAdapter` provides CHISE's 汲古閣本《說文解字》 decompositions.
Its current Unicode mapping supports **49 character descriptions and 1,383 drawable palette forms**.
The workshop includes these in its searches and Small Seal palette. Searching for `玨`
finds its seal counterpart, U+3D10C; its description is `⿰𽁭𽁭`. Searching for
`𽄌` or `U+3D10C` returns its modern correspondences, 玨 and 珏. Character lookup
uses 1,402 mapped seal forms; some have no resolved decomposition or bundled glyph.

The Small Seal palette opens on 138 selected basic parts. Compound parts and
unclassified forms have separate groups. Type a modern character such as 木 or 口
to filter the seal palette. An `≈` marks grouping inferred from modern CJK IDS;
these estimates do not enter the seal decomposition table.

Dataset maintainers can generate an offline comparison gallery and validation
report with `node scripts/check_small_seal.mjs OUTPUT_DIRECTORY`. See the
[provider audit guide](docs/small-seal-candidates.md).

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
provenance and rebuilding. CHISE data, whose IDS is maintained by MORIOKA Tomohiko and
contributors, is GPL-2.0-or-later; the font has separate terms.

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
missing geometry or unsupported transforms. `renderScopes` keeps component cuts and operator children
apart; `scopesSvg` writes that tree with scoped masks, including ㇯ subtraction.

`createDocumentSession(document)` holds a document, the chosen layer ID and an allocator that never
reuses an ID. Its edits (`replace`, `decompose`, `wrap`, `unwrap`, `changeOperator`, `remove`,
`clear`, `setTransform`) keep the selected identity, and `undo`/`redo`, `snapshot`/`restore` work over
whole documents. `sync(tree)` reconciles an editor tree without clearing history when the tree is
unchanged; a structural change updates the document and clears the session history because the
editor owns structural undo. `setTransform` accepts a coalesce key, so one drag is one step.
`session.document` returns a detached copy; use session edits to change it.
`listen` tells a host when to redraw; a throwing listener is reported through
`onListenerError` (or `reportError`) and does not undo the committed edit.

`sessionRecord(session)` and `writeSession(session)` keep the document, chosen layer and every issued
ID for a tab; `readSession(text)` restores them. The record omits undo history. The document
itself is the `.ids.json` file, written by `writeDocument` and read by `readDocument`.

`syncDocument(document, tree, { allocator })` reconciles the editor's positional tree into the
document at the same paths, keeping each layer's ID, name and transform through replacements and
structural edits. Pass the long-lived session allocator so removed IDs do not return.
`treeFromDocument` and `documentFromTree` convert between the two projections; `layerAtPath` and
`pathOfLayer` move between editor paths and layer IDs. `layerFrames(document, source, sketch)` gives
each layer's box, depth and four frames: the box-to-canvas frame of its geometry (`canvas`), the
same frame without ancestor transforms (`base`), its own 1000-unit frame before its authored
transform (`place`) and after it (`full`). The workshop
keeps a session with each tab, so the document survives reloads. The preview,
Adjust layout and export use that document, and a share link carries what the sequence cannot.

`documentSource(document, drawing, sketch)` turns a separated composer drawing into the geometry and
placement source the document renderer takes. `composeDocumentSource(document, preview)` draws and
builds it in one call; the preview must use `separate: true`. `documentView(document, drawing, sketch)`
adds the scoped drawing, frames and combined issues in one pass, for a preview that needs both the
picture and its handles. When the composer omits leaf ownership, the source infers it only from one
non-cut part per component in reading order; anything else leaves the source incomplete. Session
records live in [`src/document/store.js`](src/document/store.js); file bindings live in
[`demo/lib/documents.js`](demo/lib/documents.js).

## Adapters

```ts
interface IdsAdapter {
  structure(char, options?): Promise<{ text: string, regions?: string }[]>   // required
  variants?(part, options?): Promise<{ char: string, count?: number }[]>
  search?(query, options?): Promise<{ char: string, label?: string }[]>
  containing?(parts, options?): Promise<{ items: string[], more?: boolean }>
  parts?(options?): Promise<PalettePart[]>
  sketchTemplates?(options?): Promise<SketchTemplate[]>   // glyph shapes for the drawing search
  recognizeDrawing?(strokes: { x: number, y: number }[][], options?): Promise<string[]>  // whole characters, in percentage coordinates
  drawing?(sequence, options?): Promise<string | null>   // a final image's URL
  icon?(sequence, options?): Promise<Drawing | null>    // concurrent palette icons, separate from preview
  preview?(sequence, options?): Promise<Drawing>          // rejects when it cannot draw
}

interface SketchTemplate {   // a palette part as the drawing search sees it
  part: string
  strokes: number | null
  uses: number
  shapes: Shape[]            // the glyph stretched and at its own proportions
}

interface Shape {            // 40×40; see src/core/sketch.js
  mask: Uint8Array
  distance: Uint8Array       // distance from each cell to the ink
  gradient: Float32Array     // 5×5 cells of 8 stroke directions
  ink: number
  points: Uint16Array        // the ink cells
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

`IdsPreview` takes a tab `document` and `session` for direct layer editing, and binds `scopes` for
export. Drag a part, or the selected layer's outline, to move it; drag an edge to scale one axis,
a corner to scale both, or the circle to turn it, and hold Shift to keep both scales equal. Each
gesture writes one coalesced document transform. The outline follows the layer's painted bounds,
so a glyph that paints outside its layout cell still gets a box around what is drawn. A part inside
an enclosing one keeps its own grab area, so the small part can be chosen and moved without going
through the layer list. Use
`composerPreview({ base, separate: true })` so each operand arrives as its own part. When the
document source is incomplete the preview falls back to the merged drawing, and editing is
unavailable.

A separated drawing also feeds a document renderer: `documentSource(document, drawing, sketch)` keeps
each leaf's box as its local frame, or `composeDocumentSource(document, preview)` draws and builds the
source together. The composer's leaf ownership is used when present; without it, one non-cut part per
component in reading order is inferred. Other drawings report themselves incomplete.

`babelStoneAdapter({ ids, zitools, chise, project, layers, overwrite, components, parts, forms, names, folds, characters, sketches })` answers
`structure`, `search` (a character, `U+6728` or bare hex, a name such as 絞絲, or a word or reading
such as water or のぶん when `names` is given, and the whole characters those names belong to when
`characters` is given), `containing`, `parts` and `sketchTemplates` from the files in `data/`.
`sketches` is the URL of `data/sketch-parts.json.gz` (or its decoded document), the prepared masks
the Find tab's drawing search uses. `components` writes
out BabelStone's numbered components (`{12}`, the
right of 龍, as `⿷己三`), so 龍's description reads `⿰𦚏⿷己三` and its parts can be taken
individually; `{82}`, the top of 書, writes out as the encoded 聿, so 書 reads `⿱聿日` and 畫 and 晝
reach the same 聿 that 建 and 律 use, through 𤱪 and 書. The parts palette lists all 121 numbered
components by number; the 52 with a fragment draw it and insert it, and the 69 the note leaves `？`
draw BabelStone Han PUA's glyph for the PUA code point it gives and insert that character. They sit
in the unknown-stroke group because BabelStone gives them no stroke count. `zitools` adds the
descriptions zi.tools publishes (`data/yi-bai-ids.tsv.gz`), `project` this project's own
(`data/ids-project.tsv.gz`, currently empty; 𳑳, U+33473, is a 獨體字 and is not described), and
`chise` the CHISE rows of `data/ids-corpus.json.gz`, the GPL-2.0-or-later catalogue in
[`docs/ids-corpus.md`](docs/ids-corpus.md); a host that cannot take GPL leaves `chise` out. Every
description names the sources that give it in `sources`, and one description two sources agree on is
listed once with both. `overwrite` maps a
whole description to the encoded character it draws as (`⿰𦚏𳑳` as 龍). `forms` folds the
description search's components and opens a named component into the forms that stand for it;
`folds` folds Chinese scripts and positional forms together before names are compared. Without them
`⺡` and `氵` are different components and a name finds only the form and the script the table
records. The containing search builds an index in memory on first use: under Bun, about half a
second for the most frequent components and 150 MB of heap with the table loaded; a host with a
server can answer `containing` there instead. It has no `variants`, `drawing` or `preview`.

`layers` supplies a character-first Tangut description: the largest proper subtrees that spell another
Tangut character whole become those characters, and components that spell a one-component character
become it. 𗀃 reads `⿱𘠀𗸡`; opening 𗸡 reaches `⿰𘣣𘠐`, reconstructing BabelStone's description.
The tree marks the computed reading *Split by characters*. Characters without a computed description
keep their source description; malformed descriptions stay as source text. Both the computed and
source descriptions remain searchable. The computed reading follows shapes and does not assert a
recorded segmentation or historical descent.

The three tables beside BabelStone's add descriptions without replacing them. The workshop passes
all three: `data/yi-bai-ids.tsv.gz`, the unannotated standard subset zi.tools publishes; its own
`data/ids-project.tsv.gz` for characters newer than BabelStone's (empty at present; the newer
character 𳑳 is a 獨體字); and `data/ids-corpus.json.gz`, whose CHISE rows are optional because that
file is GPL-2.0-or-later. Each description's `sources` says which of `babelstone`, `zitools`,
`chise` and `project` give it. Extended expressions and variant annotations are not included.

## Search

`IdsStructuralSearch` provides whole-character structural search with examples for pyramids,
four-part grids, repeated pairs and triples, the larger repeats, mirrored pairs, matching
outer parts, enclosures and overlays.
The demo offers it beside the existing character search below the editor. Selecting a preset
runs the search; the pattern can then be edited. Results open in the editor, and **Copy all
characters** copies the complete result, including hits beyond the visible page.

**Similar structures** lists the characters whose description has the current description's
operator and at least one of its operands in the same place, the other operand free:
`⿱木口` (杏) finds 森 for `⿱木？` and 占 for `⿱？口`. The character the description already
names stays out. It reads the adapter's `findSimilar`, which asks the same index once for each
operand; a description without an operator has none.

```js
import { createStructuralSearch, readStructuralForms } from 'ids-input'
const structuralForms = readStructuralForms(formsText)
const patterns = createStructuralSearch(table, { forms: structuralForms })
patterns.search('⿱A⿰AA')          // 品, 森, 麤, …; A must be the same component
patterns.search('⿱⿰AA⿰AA | ⿰⿱AA⿱AA') // both four-part grid orientations
patterns.search('⿲ABA')           // matching outer parts, such as 弼
patterns.search('⿸⬚⬚')           // any upper-left enclosure
```

A–Z bind components or subtrees; repeated letters must have a common compatible decomposition.
Different letters may match the same part. Structural forms accept Unicode equivalent ideographs and explicitly positional forms.
Broad radical variants stay distinct: 𡿨, 巜 and 巛 have different multiplicities,
and 丿/乀 and 𠄌/亅 differ in direction. `createSearch` accepts a separate
`structuralForms` map (strict equality by default); ordinary component search
continues to use its broader `forms` map.
`⬚` and `？` match any part; `|` separates up to eight alternative patterns. Each pattern must
be a complete IDS of at most 64 code points. Matching starts at the character's whole description
and opens encoded components up to six levels, considering source alternatives. It does not find
a pattern merely contained somewhere inside an unrelated outer structure. Approximation marks
remain explicit operators. Coverage depends on the supplied descriptions and forms.

`babelStoneAdapter.findByStructure(query, { limit, signal })` runs this search in the same worker
as description search. It returns `{ hits, total, characters, problem? }`: `characters` contains
all matching characters without separators, while `hits` is limited for display. Invalid patterns
return `problem: 'pattern'`. Results put common unified ideographs first, then Extension A, then
other characters, with code-point ordering within each group.

**Unknown structure** reads a pattern's top-level operands, or the components of a run, as
elements to find anywhere in a character. `木口` finds 杏 (`⿱木口`), 呆 (`⿱口木`) and every other
character holding 木 and 口, at any depth and in any arrangement; `⿰⿰木木口` asks for a `⿰木木`
subtree and a 口. `⿰木口` asks for the same as `木口`: the operator only groups the elements and is
not matched. Repeated elements are counted: repeated identical elements need separate occurrences,
and a component is opened where an element stands inside it, so the hit can mark it. Distinct
elements may share an occurrence, so a compound and one of its own parts can both be found in the
same place. A `⬚` or `？` operand adds no requirement; a pattern of only those asks for nothing.
A–Z variables belong to whole-character search and are refused here. `|` separates up to eight
alternatives.

```js
const search = createSearch(table, { forms })
search.unknownStructure('木口')         // 杏, 呆, …
search.unknownStructure('⿰木口')       // the same as 木口
search.unknownStructure('⿰⿰木木口')    // characters holding a ⿰木木 subtree and 口
```

`babelStoneAdapter.findByUnknownStructure(query, { limit, signal })` runs this search in the same
worker and returns the same shape as structural search.

`createSearch(table, { forms })` in the core finds characters by what their descriptions hold, and
`babelStoneAdapter` answers it as `findByIds(query, { limit })` over its table. `IdsSearch` lists the
hits as square character cards, the code point shown on hover; the workshop puts it under the tree and
searches for the selected part, or the whole tree when nothing is selected. Each operator frame
shows its subsequence in muted text. Selecting an empty slot clears the search, except when one
side of a `㇯` expression names a component, in which case the whole expression is searched.

To find characters containing 木, use `㇯⬚木`; to list the components of 森, use `㇯森⬚`.
The empty slot works as a wildcard in both searches. The zi.tools spellings `㇯？木` and `㇯森？`
also work, and `SU` can be used in place of `㇯`. These searches use the adapter's own data;
components hidden inside a subtraction are omitted because the data does not establish which survive.
For a structural search of a subtraction with a wildcard, use the structural-search mode, or pass
`{ componentLookup: false }` to `createSearch().search()` or `adapter.findByIds()`; the latter
also finds matching subtrees inside a character.

IDS queries accept visual substitutes. The kana families follow the encoded
components in the [葦手入力 correspondence table](https://ashide.otodo.net/setumei/ziboziso.html)
and its [learning guide](https://ashide.otodo.net/setumei/tebiki.html).
All 46 basic kana are covered; the table below lists their search alternatives.

| Kana | Components | Kana | Components |
|---|---|---|---|
| ア | 了 ㇌ 卩 刀 丫 | イ | 亻 𠂆 人 入 㐄 井 |
| ウ | 宀 | エ | 工 |
| オ | 才 扌 | カ | 力 尸 |
| キ | 十 弋 | ク | 𠂊 勹 |
| ケ | 亼 个 | コ | 凵 囗 〇 |
| サ | 卄 廾 艹 䒑 | シ | 氵 辶 辶 丨 |
| ス | 大 丌 | セ | 七 土 士 廿 |
| ソ | 丷 | タ | 夕 月 |
| チ | 千 干 | ツ | 灬 小 川 巛 𫶧 |
| テ | 亍 于 | ト | 卜 ⺊ 𠂉 |
| ナ | 𠂇 | ニ | 二 |
| ヌ | 又 | ネ | 礻 |
| ノ | 丿 ㇢ 亅 | ハ | 八 |
| ヒ | 匕 匚 匸 | フ | 乛 丆 厂 |
| ヘ | 乀 乁 一 ㇀ | ホ | 木 朩 𣎳 |
| マ | 龴 丅 丁 | ミ | 三 彡 |
| ム | 厶 | メ | 乂 |
| モ | 乇 王 壬 | ヤ | 巾 㔾 |
| ユ | 丄 亠 | ヨ | 彐 ⺕ 日 |
| ラ | 广 | リ | 刂 |
| ル | 儿 几 𠘧 | レ | 𠄌 ㇗ ㇄ 乚 𡿨 乙 |
| ロ | 口 | ワ | 冖 冂 |
| ヲ | 丩 丬 山 屮 | ン | 冫 丶 |

`ヰ` also searches for `井`. Hangul aliases remain available:
`ㅅ → 人`, `ㅆ → 从`, `스 → 亼`, `ㅁ → 口`, `ㅇ → 〇`,
`ㅣ → 丨`, `ㅡ → 一`, `ㄱ → 𠃍`, `ㄴ → 𠃊`, and `ㄷ → 匚`.
Conjoining jamo and corresponding halfwidth forms work too; decomposed `스`
searches like `스`. Attached variation selectors are preserved. Kana followed
by a voicing mark keep their literal search behavior.

Each shape requests one of its alternatives. For example, `⿰イ木` can match
`⿰亻木` or `⿰井木`; `イイ` needs two matching components, and `イ人` cannot
reuse one `人` for both requests. Literal Han queries retain their distinctions.
The original IDS and result descriptions remain unchanged.

This is component and structural search using Ashide's shape families. Its
five-keystroke selection rules and unencoded stroke fragments are outside this
search table. Direct insertion, name lookup, rendering, and exact `encoded`
lookup retain their existing behavior.

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
components; `radical 120` and `Kangxi radical 120` lead to 糸. A single ideograph typed on its own
stays the character it is; a lone kana also searches names, so き finds 生, as does a lone Hangul
syllable, so 수 finds 水. Without `names` the search takes characters and code points only.

With `characters` (`data/character-vocabulary.tsv.gz`, every IDS character with a Unihan or
KANJIDIC2 name: 48,966 characters, 214,533 readings, pinyin, romanizations, Korean, Vietnamese and
English meanings), the same search also offers whole characters after the components and the
characters the relations already know: roof finds 宀 and then 屋, silk finds 丝, 絲 and 糸 and then
絹, and thuy finds 水 and then 始. Among equally close names the more common character comes first,
by KANJIDIC2's newspaper frequency or Unihan's school grade.

### Drawing a part or character

The Find tab has a pen beside its field. Draw a part or character in the box, and the tab lists the
characters the adapter recognizes and the palette parts whose shapes are closest; picking one puts
it in the chosen slot, like a typed find. The parts are compared with the 11,417 parts in the
prepared sketch file and the CJK strokes it covers, each fitted to a square twice.

`babelStoneAdapter({ sketches })` takes `data/sketch-parts.json.gz` (or its decoded document), and
the workshop passes it: the pad opens from 1.8 MB of prepared 40×40 masks, independent of which
fonts the page has loaded. Without `sketches`, the same shapes are drawn from the page's
`--ids-font` when the pad opens, which needs its CJK faces loaded; a part a font draws as its
missing-glyph box is left out either way. Nothing is sent anywhere.

Parts within one stroke of the drawing's count, or two when the drawing has one or two strokes,
come before the rest; within that, the closest shapes come first by how far each shape's ink lies
from the other's and by a coarse histogram of stroke directions. The match is approximate: it looks at outlines, not stroke order, so simple
parts such as 口, 木 and 氵 work best, and a part drawn with unusual proportions may rank below a
similar one. `IdsSketch` is the pad; `shapesOf` and `rank` in the core do the comparison,
`readSketchTemplates` decodes the prepared file, and `sketchTemplates` in the Svelte layer draws
the fallback from the page's fonts. Tangut parts are listed in their own group after the Han parts,
so they do not push Han components down.

`adapter.recognizeDrawing(strokes)` optionally names whole characters, closest first,
from strokes in percentage coordinates. The workshop combines two classifiers in every locale:
DaKanji's 6,507-class model (2.2 MB; MIT; trained on ETL and KanjiVG) supplies Japanese kanji and
kana, and GlyphWeave's 7,247-class model (15.4 MB int8; MIT; trained on CASIA-HWDB and EMNIST)
supplies its 7,185 Han classes including simplified forms, plus digits and Latin letters. Both run
with ONNX Runtime Web's 12 MB WebAssembly runtime and load on the first drawing; sources and hashes
are in `demo/model/`.

On the 20 synthetic stroke drawings in `demo/model/benchmark.json`, both models put 19 targets in
the top 24; DaKanji puts 18 in the top 10. GlyphWeave's release reports 96.0% top-1 and 97.6%
macro-average on its 870,895-sample test split. A host without `recognizeDrawing` gets the parts alone, and a failed or empty
recognition falls back to them.

## Preview

`ids-input/composer` draws sequences with han-compose (<https://github.com/mkpoli/han-compose>,
MIT), ported to the browser. Tangut, Bopomofo, Small Seal and Unicode fallback outlines are
bundled and loaded on demand. Han and mixed descriptions also read the static files han-compose's `export-web` writes (format 5):
a manifest, the learned layout, and the records of every character and the host lists of every
(place, operand), packed into gzipped shards by the first three hex digits of their SHA-256
(`g/<hhh>.json`, `p/<hhh>.json`), so a sequence loads only the shards its parts fall in. An export that
carries no host list has no part to cut; its descriptions are laid out by the composer's plain shares
instead of the learned boxes, which are where cut parts go. Drawing runs in a Web Worker,
one sequence at a time; a newer sequence ends the drawing before it.

```js
import { composerPreview } from 'ids-input/composer'

const adapter = { ...babelStoneAdapter({ ids, parts }),
  preview: composerPreview({ base: 'https://example.org/composer/<version>/' }) }
```

`base` is the folder holding the export's `manifest.json`. The host serving it must allow the page's
origin by CORS. If the export is unavailable, descriptions whose parts all have bundled outlines
can still render. Other previews keep their placeholders. When the export loads but a part has
no outline in either source, its badge reads
"Could not compose". Sequences over 24 operators or 8 levels are not drawn, except pyramids of up
to 64 rows, which are laid out as equal cells. Under
Vite, keep the package out of dependency pre-bundling (`optimizeDeps: { exclude: ['ids-input'] }`)
so the worker's URL resolves; `composerPreview({ base, worker })` takes a function making the Worker
for other bundlers.

`fromUrl(base)` uses a selected export's own glyphs first, then loads bundled fallback glyphs for
missing components. `unicodeSource()` supplies only bundled Unicode glyphs with geometric layout.
For Node, pass `unicodeSource({ load })`, where `load('unicode/030')` returns the parsed records
from `data/unicode-outlines/030.json.gz`; Node's fetch does not read local file URLs.
`hasUnicodeGlyph(component)` reports exact bundled coverage. Fallback glyphs are monochrome,
with the source font's design; they do not imitate a selected serif or handwritten face.

The demo draws Sans from `https://glyphatlas.org/atlas/composer/bd0829bc6fbf-sans-compose-layout-v4-f5/`,
Serif from the serif export, Fangsong from the Zhuque Fangsong export, and Kaisho from the Kureedo export; `?composer=<url>` or
`VITE_COMPOSER_BASE` points every face at another copy of one export. A face that cannot draw a
description draws the encoded character it names in that face, else the Sans export's drawing.

## Keyboard

On the tree (outside text fields), keys go by where they sit, so every layout has them:

| keys | |
| --- | --- |
| `1`–`9`, `0`, `-`, `=` | ⿰ ⿱ ⿲ ⿳ ⿴ ⿵ ⿶ ⿷ ⿸ ⿹ ⿺ ⿻ |
| `q` `w` `e` `r` `t` `y` | ⿼ ⿽ ⿾ ⿿ ㇯ 〾 |
| `Tab`, `Shift+Tab` | the next and previous part |
| `Backspace`, `Delete`, `?` | empty the chosen part |
| `Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z`, `Ctrl/⌘+Y` | undo, redo |
| `Menu`, `Shift+F10` | the chosen part's context menu |
| any other character | goes to the part field; `Enter` puts it in the slot |

Elsewhere, `Ctrl/⌘+,` opens settings. Toolbar buttons show their keys
on hover. Outside text fields, `Ctrl/⌘+X`, `Ctrl/⌘+C` and `Ctrl/⌘+V` cut, copy and paste the selected
part (the whole sequence when none is selected); `Ctrl/⌘+A` selects the whole tree. File and Edit
menus support arrow keys, Home/End and Escape; `Right` opens a submenu on its first item, `Left`
closes it, and Escape closes the submenu before the menu.

The operator palette groups the operators by how many parts they take (1: ⿾ ⿿ 〾; 2: ⿰ ⿱ ⿴ ⿵
⿶ ⿷ ⿼ ⿸ ⿹ ⿺ ⿽ ⿻ ㇯; 3: ⿲ ⿳, `OPERATOR_GROUPS` in the core), each button showing its key (`shortcut()` writes keys as the platform does: ⌘⇧Z on Apple systems,
Ctrl+Shift+Z elsewhere). After them a ⬚ button empties the chosen part, as the part tools' Clear part does, and shows `?`.

An operator on a slot splits it, the old part first (⿰ on 失 gives ⿰失⬚); on an operator it takes
its place and keeps its parts, refusing to drop a filled one. In the sequence field, ASCII names in
either case become operators: LR ⿰, UD ⿱, LL ⿲, UU ⿳, OC ⿴, OD ⿵, OU ⿶, OR ⿷, RD ⿸, LD ⿹, RU ⿺,
XX ⿻, OL ⿼, LU ⿽, MI ⿾, RO ⿿, SU ㇯. Two capitals that spell a name are read as that operator, so
letters such as L and R side by side go in from the part field, one slot at a time. In "Take parts from", the arrow keys move through the tree,
`ArrowRight` opens a part and reaches its swaps, and `Enter` takes a part or a whole node.

## Licences

- Code: MIT (`LICENSE`). The data files carry their own terms, below; a file built from
  several sources carries all of theirs.
- `data/small-seal.json.gz` and `data/small-seal-sources.tar.gz`: CHISE, GPL-2.0-or-later
  (`data/COPYING-chise-ids.txt`).
- `data/ids-corpus.json.gz` and its sources `data/ids-corpus-sources.tar.gz`: GPL-2.0-or-later as
  a whole, because 102,894 of its 211,319 descriptions are CHISE's (`data/COPYING-chise-ids.txt`,
  source record `data/chise-sources.json`); the other 108,425 are public-domain BabelStone rows and
  each row says which it is. Code stays MIT.
- `data/seal-sources.txt.gz`: Unicode SealSources, Unicode-3.0
  (`data/COPYING-seal-sources.txt`).
- `fonts/IDSSeal*` and `data/small-seal-outlines.json.gz`: derived Kaiyuan glyphs under
  the [Kaiyuan font license](fonts/LICENSE-IDSSeal.txt); the outline file also contains
  exact-description mappings from CHISE (GPL-2.0-or-later).
- `data/character-info.json.gz`: Unihan 18.0.0 definitions (Unicode License v3) and Open Tangut
  meanings, reconstructions and sound glosses for the Tangut ideographs (MIT for Open Tangut's
  compilation; Wiktionary rows CC BY-SA 4.0; CCAMC rows no licence stated; 750 KB gzipped);
  built by `scripts/build_character_info.py`.
- `data/babelstone-ids.tsv.gz`: BabelStone IDS, public domain, with the 6,145 records of BabelStone
  Tangut IDS, factual decompositions (798 KB).
- `data/tangut-layers.json.gz`: the largest character split of 2,408 Tangut descriptions, computed
  from those public-domain decompositions (16 KB); it adds no source and records no descent.
- `data/ids-components.tsv`: BabelStone IDS.TXT note 6's numbered components and the IDS fragments
  that write them out, `{12}`, the right of 龍, as `⿷己三` and `{82}`, the top of 書, as 聿 (5 KB);
  the adapter reads descriptions by it, and the parts palette lists all 121 by number.
- `data/numbered-pua-outlines.json.gz` and `fonts/IDSNumbered.woff2`: BabelStone Han PUA 1.472
  outlines for the 69 numbered components with no fragment, Arphic Public License
  (`fonts/LICENSE-BabelStoneHanPUA.txt`), 31 KB and 38 KB; the PUA code points are tied to that
  version, which the outline document records with its digest.
- `data/ids-project.tsv.gz`: this project's descriptions for characters newer than BabelStone's
  Unicode 16.0 edition, built from `data/ids-project.tsv` by `scripts/build_ids_project.py`;
  currently empty, as 𳳳 (U+33473) is a 獨體字 (0.2 KB gzipped).
- `data/ids-characters.tsv`: characters this project draws from their own outline, 𳳳 (U+33473)
  from Plangothic P2; the outline and font builders read it.
- `data/ids-overwrites.tsv`: descriptions drawn as an encoded character instead of a composition,
  `⿰𦚏𳳳` as 龍 and `⿷⿺己一三` as 𳳳 (JYutnet JYN00025; zi.tools); the adapter reads it with
  `overwrite`.
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
  4.0 as a whole, from Unihan 18.0.0 (Unicode License v3) and KANJIDIC2 (CC BY-SA 4.0); 214,533
  rows, 1.7 MB gzipped.
- `data/ids-parts.json`: its first-stroke column adapts Rime’s five-stroke dictionary (LGPL-3.0);
  source notices and licence texts are in `data/licences/`.
- `fonts/`: Plangothic, Noto Sans CJK JP and BabelStone Han PUA subsets (about 490 KB together),
  Noto Serif Tangut (1 MB), Zhuque Fangsong (4.8 MB), Zhuque Label (10 KB), Kureedo (2.8 MB), Kureedo
  Label (23 KB) and GenZui Sans (2.3 MB); the
  BabelStone subset is under the Arphic Public License, the rest SIL Open Font License 1.1.
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

The sources the project reads, draws on, compares with or cites are catalogued at
<https://ids.mkpo.li/sources>: data, fonts, code, references, prior work and the records behind the
examples, with each source’s author, licence, dates, category and tags. The example records keep
their notes and citation numbers.

## The workshop

The demo is a full-width workshop with one tab for each description being edited, in a strip below
the toolbar. A tab is the description's composed drawing at a small size, and a dot while its text
differs from the text it was saved with; the sequence itself is the tab's tooltip and accessible
name, not written in it. The active tab has an accent line along its top, and the + button opens an empty tab.
Every panel follows the chosen tab: the sequence, its code points, the operators and the part pickers
at the start; the Shape or indented Tree view and the search under it; and at the end
the drawing in a square panel with export as SVG or PNG (256 to 2048 px) on a transparent, white, black or chosen
background, in an ink that suits it or a chosen one, with a margin, empty slots left out unless asked
for. The output shows the drawing's component count and stroke total beside the code points, using the character's recorded count when it has one and marking a sum from the components with `≈`. Export can include empty slots on request, including through the scoped document drawing. An incomplete drawing blocks normal export until the partial checkbox is set. File → Document title sets the title saved in `.ids.json` and embedded in SVG/PNG exports; the page title follows it. Exported SVG and PNG files carry the editable document, so Open document restores the tree, IDs and transforms. Dropping one or more `.ids.json`, SVG or PNG files anywhere on the app opens each as a tab; a drop target shows while files are over the window. Adjust layout moves, scales and turns document layers without changing the sequence; arrow keys
nudge, `+` and `-` scale evenly, `[` and `]` turn, and `0` resets. An edge handle scales one axis,
a corner handle scales both, and Shift makes a corner even. The changes stay with their tab and export
through the scoped drawing. The Layers dialog edits the same layer
document, including a six-coefficient matrix mode for shears and reflections. Rows in the Tree view select parts, expand
with the arrow keys, accept drops, and can be dragged onto another row to move beside a sibling or
switch places. A click, the arrow keys, Home/End or, where the browser leaves
them to the page, `Ctrl+Tab`, `Ctrl+Shift+Tab` and `Ctrl+PageUp`/`Ctrl+PageDown` move between tabs. ×,
middle click, Delete or the tab's menu closes a tab (Undo brings it back; the last tab stays).
`Ctrl+Shift+T` where the browser leaves it to the page, File → Reopen closed tab, the tab's menu
or the starter's Recently closed list opens a tab or group closed earlier; that history lasts for
the page session. The tree and search
panels in the middle column are divided by a draggable splitter, the tree starting larger; the
arrow keys move it and a double-click restores the default. Vertical dividers resize the columns by
dragging or with Left/Right; a double-click resets their widths. Toolbar buttons show their keys on
hover. File groups documents, Recent, tab actions, sharing and export; Recent lists the
sequences opened in this browser, newest first. The Edit menu holds the editing commands. The
Templates tab includes one-click pyramids of 3–24 rows. File → Duplicate tab copies the active
document. Right-clicking a tab, or pressing Shift+F10 on it, opens its menu: reopen the tab or
group closed last, duplicate it, close it, close the other tabs, the tabs on either side, or close
all tabs. Close all asks first, and Undo after a group close restores the tabs in their old places
with the tab that was being edited. Duplicate opens the copy beside its source with its selection,
undo history and layer transforms, which can then be edited independently.
The toolbar holds Undo and Redo with the history of named steps, consuming the document session’s
transform steps before the editor’s structural steps, examples, a share link with its QR code, the
language, settings and the sources. The tab strip’s + opens a blank tab, and the chevron beside it
opens a starter dialog in three tabs. Templates is the same full catalogue the input pane offers
(structures, pyramids, repeats and five-copy layouts). Examples lists every starter sequence with
its character and code point, an abbreviated character, or a mark when it has none, opening as cards
or a list with its filters and folding. Recently closed lists each tab closed this session, newest
first, with its drawing; choosing a row opens that tab back where it was. A template or an example
opens a tab.
Settings hold the system, light and dark
themes, key hints, the preview data source; they open beside the toolbar button on desktop and in a
bottom drawer on mobile. The address carries the active sequence as its path (`/⿰亻哥`), so a link opens it;
the older `#⿰亻哥` and `?ids=⿰亻哥` forms still open. Text holding `.` or `/`, or text the parser
rejects, stays in `?ids=`. A path that names no sequence answers 404 with a link that opens it as a
draft; text built from a sequence's letters goes on to the editor first. A document that holds more
than its sequence rides along as `?doc=`, so copying the location keeps a placement and opening such
a link keeps the token. Tabs use
`sessionStorage` to keep each browser window's working set separate through reloads, and
`localStorage` to seed a new window. The toolbar’s Sans/Serif/Kaisho switch
chooses the face for Han text and Sans/Serif bundled component forms. Other composed outlines use
the configured export’s font. Settings, the recent sequences, the theme and font choice stay
in `localStorage`; the keys use the `ids-input:` prefix.

### Share cards

A share link at `/<sequence>` carries preview tags for its sequence, matching character and
Unicode code point. Sequences containing a dot or slash use `/?ids=<sequence>`. A link carrying a
document keeps its title and token in those tags, and its image draws the document's layers where
the editor put them when they can be scoped; otherwise it draws the separated sequence. The
preview image at `/og/<sequence>.png` is 1200×630, with a framed drawing, the ideographic
description sequence and a separate Unicode caption. A titled document card sets the title there in
place of the caption. Text size follows the sequence length; longer sequences wrap to at most three
lines, with an ellipsis once they exceed the card's readable capacity. A document card says it is a
shared document and sets its title when it has one. IDC characters use glyphs from the bundled
GenZui Sans font.

The Cloudflare Worker serves preview pages and images alongside the workshop's static assets, and
forwards `/api/report` to the report intake.
Cards use the editor's composition source, `@cf-wasm/resvg` and a one-day cache.
An unavailable drawing reads `Preview unavailable`; an unmatched sequence reads `No Unicode match`.
Rendering failures return an uncached 500. `/og/default.png` supplies the home page's example.
Preview hosts send `X-Robots-Tag: noindex`; canonical metadata points to `https://ids.mkpo.li`.

`bun run build:site` builds the workshop, prepares the card fonts and outlines with
`scripts/og-assets.mjs`, and bundles the Worker and WASM into `dist-worker/`, outside the static
assets in `dist/`. Noto Sans CJK JP and Plangothic P1 are fetched at pinned releases and checked
by SHA-256; font assets ship with their license notices. Run `node tests/worker-og-runtime.mjs`
after the build to test the bundled handler and PNG renderer. `bun run dev:worker` runs
`wrangler dev` to serve the Worker and built assets locally.

### Reporting a problem

A Report a problem button under the drawing in the output panel opens a report dialog, as do
File → Report a problem, the same entry in the More sheet, and `?report=1`.
It asks what happened and, if the reporter wants an answer, how to reach them; the drawing goes
along as a 1024 px PNG unless the checkbox is cleared, and the dialog lists the rest in plain text.
The request is `multipart/form-data` to `/api/report` on the site's own origin, which the worker
hands over the `REPORT` binding to the `ids-reports` service (`?endpoint=` points it elsewhere from
a local host, which the published site ignores so a shared link cannot collect reports of its own).
It carries the active sequence, its share link, the workspace as JSON (every tab with its layer
transforms, the active tab, the view, face, theme, language and panel widths) and a context
document: the version and build commit (`__APP_VERSION__` and `__BUILD_COMMIT__`, the commit the CI
built), the route without its query, the viewport, pixel ratio, user agent, loaded font families,
the preview's step and label, and the last twenty console warnings, errors and failed requests
collected by the ring `demo/main.js` installs before the app mounts. Anything naming the reporter's
own machine — a local address, a `file:` URL, a `/@fs/` or home path, wherever it appears, including
inside a logged line — is taken out before the report leaves, and the share link is rebuilt on the
published site with only the parameters that open the sequence. The answer replaces the form with
the issue it became; a report matching an open issue says so and links to it, and a refused or
timed-out one keeps the text and offers another try.

### Desktop app

`desktop/` wraps the workshop in a [Tauri](https://tauri.app/) window for Windows, macOS and Linux.
The installers are on the [releases page](https://github.com/mkpoli/ids-input/releases). The app
carries a copy of the Sans composer export (`COMPOSER_BASE`, about 135 MB) and serves it under its
own `atlas` scheme, so the workshop draws in Sans with no connection. Serif and Kaisho still load
from glyphatlas.org. Share links name <https://ids.mkpo.li/>, reports go to its `/api/report`, the
context of a report carries `desktop: true`, and any address outside the app opens in the system's
browser. A download lands in the Downloads folder, which then opens on it.
For Windows there is also a portable zip. Its folder holds `IDS Workshop.exe`, the export and an
empty `portable` file, which makes the app keep its settings and tabs in a `data` folder beside the
program rather than in the user's profile.
A release tag names the version in `package.json`: `desktop-v0.1.0` for 0.1.0.

The page is the workshop built with `VITE_DESKTOP=1` (`bun run build:desktop-page`). To build the
app, install Rust and the [Tauri prerequisites](https://tauri.app/start/prerequisites/), then:

```sh
bun run desktop:atlas   # copy the Sans export into desktop/atlas/
bun run desktop:dev     # the app over the dev server
bun run desktop:build   # installers in desktop/target/release/bundle/
```

The Desktop workflow builds the installers on every `desktop-v*` tag and publishes them as a release
on that tag. A pull request that changes `desktop/`, or a manual run, builds them as workflow artifacts without a release.

### Comparison with KAGE

`/compare.html` puts the workshop's drawing beside KAGE's composition of the same IDS in three
sets: 168 unencoded headword sequences taken from the HDIC KRM database, 20 common-use kanji, and
27 review characters from earlier han-compose review sheets. Each card gives the ink overlap (IoU),
the geometry at a 4 px tolerance (F1@4) and the 3×3 layout distance, and links the sequence to the
workshop and to zi.tools. The unencoded and review characters are composed by both sides (some are
reused as whole glyphs); 17 of the common kanji are whole glyphs on both sides; three (海, 急, 曜) are
composed by this site, so their scores include composition. The rest compare type style and
variant choice. The page explains how the three numbers are measured and why the heavier
typeface lowers the first two. The gallery shows 48 cards at a time, with Show more for the rest,
and filters by set and structure. The drawings are a snapshot of the 2026-10-29 run in
`demo/lib/comparison.json`; after a composer change, rebuild it with
`bun scripts/build_comparison.mjs`. GlyphWiki's glyph data is free to use and the KAGE engine is
GPL-3.0. The About dialog links the page.

### Engine comparison

`/engines.html` is a feature table for the engines this project is compared with: the workshop
itself, KAGE, GlyphWiki, zi.tools, yedict, Mojidata, MetaHan and CHISE. It covers what each reads
and writes, how it composes, which controls it has, coverage, deployment, measured cost and
licences, with sources for every claim. Cells say "—" where no public source documents a value.
The About dialog and the comparison page link it.

## Inspired by

The editor's operator palette, split, swap and unwrap follow 字統网 (zi.tools) and 字海网 (yedict);
its search follows Mojidata and CHISE. The catalogue records each tool, what it supplied and where
the editor uses it: <https://ids.mkpo.li/sources#group-prior>.

## Prior art

KAGE and GlyphWiki are the shared stroke-and-part system the composer is compared with; Mojidata is
the nearest prior IDS search and database. Their entries, licences and what this project takes from
each are in the same catalogue: <https://ids.mkpo.li/sources#group-prior>.

## Acknowledgments

Thanks to:

- [परवद💙💛 (@zoenshiueh_lieu)](https://x.com/zoenshiueh_lieu) for feedback on enclosure
  rendering and decompositions, and suggestions for component shortcuts, loose marks (濁點,
  諺文聲調), small-seal decomposition, the New Korean Orthography letters and Shuishu.
- [Fn (@integuraru_P)](https://x.com/integuraru_P) for reporting that 〇 was rejected as a kanji
  component: 「｢〇｣が漢字扱いされていないです。採用お願いします。」
- [なきは (@nakiha_kanji)](https://x.com/nakiha_kanji) for reporting difficulty saving SVGs on a phone.
- [馬のゆい (@umanoyui)](https://x.com/umanoyui) for asking about kana support, prompting a review
  of support for components from other writing systems.

## Sponsor

I build ids-input on my own, with no funding behind it, and it's free for everyone. If it's useful to you, a tip on [Ko-fi](https://ko-fi.com/mkpoli) gives me time to keep improving it. Companies interested in sponsoring can write to mkpoli@mkpo.li.

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/mkpoli)

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
bun run check           # tsrs and svelte-check
bun run verify          # tests, tsrs and svelte-check, and the i18n check; run before pushing
bun run dev             # the demo on a dev server
bun run build:demo      # the demo into dist/
bun run build:site      # assets into dist/, share-card Worker into dist-worker/
bun run dev:worker      # the worker and dist/ locally, on port 8787
bun run build:example-drawings   # the examples' drawings, after COMPOSER_BASE changes
bun run build:sketch-parts       # the drawing search's glyph masks, after a font change
```

`x18n check` reads `t('…')` calls, so a message the code names in a data table — a source's
`summaryKey` in `demo/lib/sources.js`, a Hangul group's `label` in `src/svelte/IdsParts.svelte` —
looks unused. Those keys go in `usage.keysInUse` of `x18n.config.json`, and
`tests/messages.test.js` fails if one of them stops being named by the data.

CI runs verification and builds the workshop and share-card Worker. Production deployment is
gated to `main` through `.github/workflows/deploy.yml`.

The workshop's bug report form posts to `ids-reports`, a Cloudflare Worker in `workers/reports/`
that turns a report into an issue on this repository. `workers/reports/README.md` has the endpoint's
fields, the secrets it needs and how to run and deploy it.

### The demo's browser checks

`demo/check-*.js` drives the workshop in a headless Chromium, one file per feature. It needs a dev
server, because the checks open `/fixtures/` pages that `vite build` leaves out of `dist/`:

```sh
bun run dev &                                     # or your own dev server
IDS_URL=http://localhost:5173 \
CHROMIUM_PATH="$HOME/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome" \
  bun demo/check-similar.js
```

`CHROMIUM_PATH` is the browser the checks launch; `bunx playwright-core install chromium` puts one
in the Playwright cache. Without `IDS_URL` a check uses `http://localhost:5186`. Each file prints
`PASS` and exits non-zero on a failure. `demo/check-report.js` also takes `IDS_COMPOSER`, a
composer export to draw from, so it need not wait on the live one.

`bun run check:demo` does all of that itself: it starts the dev server on 5186, warms it with one
page load, runs every `demo/check-*.js` against it two at a time, and stops the server and its
children again. Its flags:

- `--only <text>` — only checks whose file name contains it.
- `--skip a,b` — leave those out, e.g. the six-minute `check-gongche`.
- `--port <n>` — the port to try first; Vite takes the next free one.
- `--jobs <n>` — how many checks run at once (two by default; `1` runs them one after another).
- `--retries <n>` — attempts per check (one retry by default), so a check that only lost a race
  with the dev server does not fail the run.
- `--limit <s>` — stop a check after that long (900 seconds by default); a check that outlives it
  is reported as a failure with the output it managed. The longest check, `check-gongche`, takes
  about eight minutes with two running at once.
- `--timeout <s>` — the page timeout each check gets (120 by default; `0` keeps the check file's
  own). A busy machine can take longer than Playwright's 30-second default to serve a page, and a
  check that fails for that reason says nothing about the app.
- `--watchdog <min>` — stop the run when no check has finished for that long. By default it is a
  minute past every attempt at one check, so 32 minutes with the defaults above.

The checks see the raised timeout through `scripts/check-demo-preload.mjs`, which `bun --preload`
loads before each check; the check files themselves keep Playwright's defaults.

The demo deploys as a Cloudflare Worker with static assets from every push to `main`, through
`.github/workflows/deploy.yml`; pull requests build test artifacts. Deployment needs
the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. The worker in `worker/`
reads the sequence out of the path, writes the tags a link preview needs, and leaves every other
request to the assets.

The prepared drawings in `demo/lib/example-drawings.json` are composed once from the export at
`demo/lib/composer.js`'s `COMPOSER_BASE`; `bun run build:example-drawings` rebuilds them, and
`tests/example-drawings.test.js` fails while the file and the export disagree.

`data/sketch-parts.json.gz` is built by `scripts/build_sketch_parts.py` from the bundled faces and
the system Noto Sans CJK JP (`NOTO_SANS_CJK` overrides its path). `tests/sketch-data.test.js` reads
it, checks its format, and looks up drawings of 日, 木 and 口.

### Character information

`babelStoneAdapter({ characterInfo: url, ... })` accepts the bundled
`data/character-info.json.gz`, or its decoded document. The optional
`adapter.characterInfo(char, { signal })` returns English glosses, a Tangut character's
Japanese and Chinese meanings, the reconstructions and sound glosses it records (up to
eight and two), cited component associations, editorial Han translations and emoji
mnemonics, and direct Small Seal correspondences when Small Seal data is supplied.
[Data coverage and sources](data/README.md#character-information-panels) describe the
limits of each relationship.

With `characterInfo`, `search` accepts English glosses,
emoji, Han, Tangut, and Small Seal characters, and a Tangut reconstruction in the systems
its record carries (up to eight), with or without diacritics and tone. A reading shared by
several characters lists them together. Recorded correspondences work in both directions,
alongside existing names, readings, and component forms. Results keep
dictionary qualifiers; component occurrences and lookup aliases have separate labels.
Meaning paths retain their matched sense and follow at most two links. Component
usage is a terminal link, so shared components do not connect unrelated words.

`IdsInput` shows these details on character hover, on keyboard focus, and on a click or
tap. A click keeps the card in place while the pointer travels to it, so the parts in it
can be used; Esc, its × or a click elsewhere dismisses it, and a click on the card's own
surface reaches whatever it covers. Press F1 to move into the card. Related characters
and emoji insert into the chosen slot, or replace the inspected character in the tree or
sequence field. Custom layouts can place `<IdsCharacterInfo {root} {adapter} {messages} {locale} onpick={(part, path) => editor.take(part, path)} />` beside
their editor, where `root` is the containing element. The parts, search, sequence and
tree components expose `data-character` targets; custom character controls can use
the same attribute. Optional `data-path` identifies a tree position; without it, the
host chooses the insertion target. `disabled` prevents insertion. Sources remain in
the adapter records and the data documentation; the line ends with the character's page
on 字統网 (zi.tools). The card keeps clear of surfaces marked
`data-character-info-avoid` inside `root`, such as a shape canvas, and takes the nearest
place outside them while the window has room. Hosts without `characterInfo` retain
their existing titles.
