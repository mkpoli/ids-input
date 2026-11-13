# Custom IDS notation

Three IDS tables extend Unicode's description syntax, each in its own way. This note lists what
each writes, and describes `data/custom-components.json.gz`: the components among them, and what
each is in the other tables' notation.

Two kinds of thing are written. A **component** stands where a character could: it is one part of a
description. A **modifier** adds to the part or operator before it, or to the whole entry, and is
no part itself.

## BabelStone IDS

Andrew West, <https://www.babelstone.co.uk/CJK/IDS.TXT>, notes 4 to 10.

| written | kind | meaning |
| --- | --- | --- |
| `{53}` | component | Numbered unencoded component; note 6 says where each occurs and, for some, a fragment that writes it out. `{1}` to `{122}`. |
| `？` | component | A part that cannot be represented. |
| `〾` | modifier | Before a description: one or more parts differ slightly from the shape given. |
| `㇯` | operator | Subtraction: `㇯東㇒` is 𬻌. |
| `^` … `$` | entry | Start and end of one description. |
| `(GHT)` | entry | The sources whose glyph the description is for: G H M T J K P V U S B, `UCS2003`, `X` for a description of no source, `Z` for an ambiguous one. |
| `[K]` in the tags | entry | A virtual form: how the character is written as a part of that source's other characters. |
| `*` … | entry | A note: `U+5AB2=U+2180C` same glyph, `≠` same shape but not cognate, `≡` unifiable. |

## CHISE IDS

MORIOKA Tomohiko and contributors, <https://gitlab.chise.org/CHISE/ids>.

| written | kind | meaning |
| --- | --- | --- |
| `&CDP-8BD0;` | component | An entity reference: a glyph of the CHISE character ontology. The name is opaque; its prefix says which set the glyph comes from. |

Prefixes in the UCS files, by how many entities carry them: `CDP` (Academia Sinica's component set,
2,782 uses), `GT` and `GT-K` (GT 書体), `U-i…+XXXX` and `A-U-i…` (a variant of the character at that
code point), `AJ1` (Adobe-Japan1 CID), `MJ` (文字情報基盤), `C1` to `C7` (CNS planes), `JSP`,
`JX1`, `JX2`, `M` (大漢和), `HD-…`, `HZK…`. 1,387
distinct entities describe characters in the eighteen files read here.

## zi.tools (白式 IDS)

Yi Bai's tables, <https://github.com/yi-bai/ids>; grammar in NightFurySL2001, （白式）IDS 延展语法导论,
<https://nightfurysl2001.github.io/bai-ids/> and its `yiids.ebnf`.

| written | kind | meaning |
| --- | --- | --- |
| `#(-𠃌㇉)` | component | Stroke chain: strokes in writing order, each starting where the last ended. |
| `リ` `〢` `〣` `コ` `ユ` `ス` `◝` `◞` `◟` `◜` | component | Shapes borrowed from other blocks; the four arcs are quarter circles, clockwise from the top right. |
| `令H`, `一.`, `丰..p` | modifier | Variant identifier after a component, in `ids_lv0.txt`: which form of that component is meant. |
| `[1:]`, `[:-1]`, `[_x,_x]`, `[1:\|b]` | modifier | After ⿻: which horizontals of the second part the verticals of the first cross. A slice counts the second part's horizontals; a matrix has a row per horizontal and a cell per vertical (`x` crosses, `.` vertical stops at the horizontal, `_` horizontal stops at the vertical, `a` `b` `c` which segment of a bent vertical, `l` `r` beside all verticals); `\|` adds the matrix with the roles swapped. |
| `[1]` | modifier | After ⿴ ⿵ ⿶ ⿷ ⿼: which enclosed space, from 0. After ㇯: which occurrence to remove, from 0. |
| `{曰}`, `{?0丗}`, `{𡮂J}` | entry | Unique separator before a description: the abstract shape it draws, where two characters would otherwise share a description. |
| `(.,T)`, `(q008a2)`, `(qq222)` | entry | Variant identifiers after a description: the forms of the character it is for. |
| `;` and a second column | entry | Further forms, and alternative ways to split the character. |
| `🔄赢贝女` | search only | Replacement: 赢 with 贝 changed to 女. |

A variant identifier is one of: `.` (default); a source letter `B G H J K M P S T U V Q`;
a UCV position, `q` `p` `x` or `y`, three digits of the IRG UCV number with an optional letter,
then the form's position (`q008a2`, the second form of UCV #8a); `qq` and one or more UCV numbers
for a form made by analogy; or lower-case letters, digits and dots, one per part of the character
(`d` dot, `g` hook, `h` horizontal, `n` right-falling, `p` left-falling, `s` vertical, `t` rising,
`w` bend, `x` more crossings, `y` fewer, `z` turn, `u` `l` `r` moved up, left, right, `m`
mirrored, `e` similar).

Inside a chain: a stroke is a character or a letter (`H` 一, `S` 丨, `P` 丿, `N` 乀, `D` 丶, `T` ㇀,
`J` ㇝, `Z` leftward, `Wg` ㇁, `Qa` ◝, `Qb` ◞, `Qc` ◟, `Qd` ◜); `g` after a stroke adds a hook and
`w` rounds the join after `SH` or `PH`; `-` before a stroke writes it backwards; `b` after one
breaks the line there; `xN` crosses stroke N of the chain, from 0; a final `z` joins the end to the
start. `strokeLetters` in the data file gives the chain for each CJK stroke, from the grammar and
from 黒丿乀's table (<https://note.com/midzchi_/n/n21737ee18736>), whose author warns that it
contains mistakes.

## Earlier and proposed notation

Four documents on zi.tools' notation predate or extend the grammar above. None of what they add
occurs in the published tables (`ids_lv0.txt` to `ids_lv2.txt`, revision `2597437`), so the parser
does not read it; it is recorded here for text copied from older posts.

- **Connector chains.** 解读特殊IDS (2022-12-18) lists a chain's strokes first and how they join
  after: `>` tail to head, `^` head to head, `v` tail to tail, as in 臼 `⿶#(丿丨一𠃍>>v)⿰一一`.
  A closed shape numbers its strokes from 0 and names the closing pair (`,0v4`). Curves are `Qa`
  to `Qd` and `Qw` to `Qz`, with crossing pairs as four digits (`0205`). Today's chains write a
  reversed stroke with `-` and a crossing with `xN`.
- **Stroke letters.** IDS说明文档 3.0 beta (Losketch, 2024-06-04) gives `B` 扁, `D` 点, `G` 钩,
  `H` 横, `N` 捺, `P` 撇, `Q` 圈, `S` 竖, `T` 提, `W` 弯, `X` 斜, `Z` 折, in either case. The current
  grammar keeps `H S P N D T J Z Wg Q`, with `Z` only as the leftward stroke of `#(SZ)`; `B` and
  `X` are gone from it. 黒丿乀's table suggests `BNg` for ㇃, which is the older `B`.
- **Rotation by an angle.** 对于⿿这一IDS的补充 1.0.1 and 1.0.2 (鹏鹏喵) propose `⿿[90]`,
  `⿿[-90]` and `⿿[±45]`, with `[±180]` the default that may be left out.
- **Selector names.** 更为细致的IDS介绍 α-Ⅳ (ml-UFOp-W.S.-ahcvsh-qnb, 2024-07-03) names the
  variant identifiers (提交源选择器, 可统一组件变体规则选择器, 部分可统一组件变体规则选择器,
  镜像选择器), counts UCV entries against IRGN2476, and says over two hundred further identifiers
  have no stated meaning.

These were read as files a reader supplied; they carry no licence and are not in the repository.

## What reads them

`parse` reads the three components as one part each (`customKind`), keeps an operator's modifier
on its node and a variant identifier on its component (`variantOf`, `variantIdentifier`), and
reads a zi.tools or BabelStone entry as its description; `entryNotes` answers the separator,
variants, sources and virtual forms left out.

`babelStoneAdapter({ custom })` takes the data file below and answers `drawable(text)`: the
description with each custom component written as its `draw`, and which component each part of
that text draws. The preview and the part icons ask the composer for that text and number the
answer's parts by the description's own components, and the shape view shows a custom part as its drawing over its name.

## `data/custom-components.json.gz`

Built by `bun scripts/build_custom_components.mjs` from the bundled BabelStone and CHISE files and
zi.tools' `ids_lv1.txt` at the pinned revision. GPL-2.0-or-later, since CHISE's rows inform it.

- `components`: one row per custom component — `text`, `kind`, `source`, BabelStone's
  `description` and `fragment`, `uses` (characters described with it), `examples`, `usedIn` (all
  of those characters, as one string), `subtractions`
  (the component as a character less one part, `㇯凫几`), `draw` and `equivalents`.
- `draw`: what a composer draws in the component's place — BabelStone's fragment, the private-use
  glyph of BabelStone Han PUA, or the best equivalent made of characters only. 972 have one.
- `subtractions`: the component as a character less its other parts, `㇯馬灬` for `{51}`,
  `㇯㇯𠙖冫几` where two are taken. Every character one of the form's sources describes with the
  component beside one or two characters gives one; a spelling two forms would both claim is
  dropped. `createCustomComponents(data).normalize(text)` writes such a subtraction as the form's
  identifier, and `drawable` draws it as the form.
- `equivalents`: what the component is in another table, `{ in, text, count, characters, status,
  basis, id, arrangements }`; `id` is the form the text is, and `arrangements` the same parts
  bracketed another way, each a form of its own. A component carries its form's `id` and `char`,
  and a character row the `ids` of the forms it names. `difference` rows are solved; `inverse` rows turn a solved row round.
  `verified` means two or more characters give the same spelling, `candidate` that none does;
  `count` is the characters that give the same parts in any arrangement.
- `characters`: a description of a character reached from another table's, `{ char, text, in,
  from, basis, of, status, ids, attested }`. `attested` is set where the table named by `in` writes
  that description itself; the rest are in a notation whose table did not write them.
- `forms`: one row per form, `{ id, char, names }`; `retired` lists numbers no longer given out.
- `strokeLetters`, `chainNames`, `sources`, `counts`.

### Identifiers

A form is one thing drawn one way, and has one identifier, `X-00053`, minted once and recorded in
`data/custom-ids.tsv`. Written `&X-00053;` it reads as a component in any description, and its
private-use character is U+F0000 plus the number. The number says nothing about the form.

Every custom component is a form, and so is each expression found for one that nothing confirms and
each other arrangement of the same parts. Two names are one form only where the tables confirm it:
one is the other on two or more characters, or both have the same confirmed expression. Two names
of one source are never joined. What a form resembles, what it is less a part, or which UCV entry
it belongs to is a relation between identifiers and never changes one.

The ledger is append-only. A form keeps the number its first name was given. Two numbers found to
be one form keep the lower, and the other is retired with `merged into`; a form split in two keeps
its number on the side with its first name; a number whose first name is gone is `withdrawn`. A
retired number is not given out again. 2,054 forms: 1,588 with a source's name, 466 without.

Every row is derived. No source states these equalities, and each row names the characters behind it.

### Method

Each table is read down to its smallest parts: a character is replaced by its first description
until none is left to replace. For a character two tables describe, where one description names a
single unsolved custom component, the component is the other table's parts of the character without
the parts of everything else that description names:

```
BabelStone  鸟 = ⿹{53}一
zi.tools    鸟 = ⿴乌丶    乌 = ⿱丿⿹#(-𠃌㇉)一
{53}        = ⿴⿱丿#(-𠃌㇉)丶
```

A part is taken out only where it stands exactly as often as it is removed. Spellings with the same
parts count as one shape, and the commoner bracketing is kept. A component two or more characters
solve counts as its parts in later rounds; a row derived from it is `verified` only where that
expression is.

`substitution` rows replace each custom component of a description by its equivalent.
`subtraction` rows start from a table that describes one character as another beside further
parts (鸟 = ⿴乌丶, so 乌 = ㇯鸟丶), take the other table's description of the larger one (⿹{53}一) and
write the subtraction on the part that holds what is removed: 乌 = ⿹㇯{53}丶一. A character that
stands twice in the larger one, or that the result would still name, gives no row.

### Limits

- The first description of a character stands for it, whatever source it is for; a regional
  difference between two tables shows up as a `candidate` that no second character confirms.
- A description with ⿾, ⿿ or ㇯ is one opaque part.
- 3 of 121 numbered components, 638 of 1,387 entities and 58 of 164 chains have no equivalent yet.
