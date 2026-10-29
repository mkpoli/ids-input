# zi.tools IDS coverage

How much of 字統网 (zi.tools) IDS notation this package reads, measured against the data zi.tools
publishes, and what still needs work.

## Measuring

```sh
bun scripts/audit_zi_ids.mjs
```

The script fetches `ids_lv1.txt` from Yi Bai's dataset at the revision the bundled table uses
(`da1e9f8a09e2ec8faaf176bac99203f978282041`), checks its SHA-256, splits every description out of
both description columns, and asks `parse` for a tree. It reports the readable count per notation;
`--json` prints the same numbers for a script.

## Cross-checking against zi.tools

```sh
bun scripts/check_zi_parity.mjs
```

The measurement above says what this package reads; this check says whether it answers the same
character zi.tools does. It fetches the same pinned table, samples descriptions of every notation
(`--sample N`, six by default), resolves each the way the workshop does — a stroke chain through
`data/zi-tools-chains.tsv.gz`, anything else through the adapter's `encoded` — and asks
`zi.tools/api/ids/lookupidsasync` for the character the service names. It exits non-zero when an
answered description disagrees.

Two limits are worth knowing. The service needs the network, so this check is run by hand, not in
the test suite. And it resolves no note-bearing text: `⿻乚一(.,T)` comes back without a level-1
entry, so those samples count as unanswered rather than disagreeing; this package resolves them by
dropping the note. On 2026-10-29 at revision `da1e9f8a…`, 18 of 18 answered descriptions agreed and
14 were unanswered.

## Notation and what reads it

The published table writes four kinds of text. A sequence may carry more than one.

| notation | written as | example |
| --- | --- | --- |
| plain description | operators and components | `⿰木木` |
| entry note | `{曰}` before, `(.,T)` after | `⿻乚一(.,T)`, `{士}⿱十一` |
| operator modifier | `[1]`, `[1:]`, `[.,x]` after ⿻, an enclosure or ㇯ | `⿻[1:]丨日` |
| stroke chain | `#(` strokes `)` | `#(-丨𠃍-一z)` |

On `main` (2026-10-29, 117,044 sequences in total): 116,503 read, 541 unread — every sequence
carrying a note or a modifier reads, and the 541 that remain all carry a stroke chain (187 chain
alone, 293 note and chain, 20 modifier and chain, 41 all three).

The two branches behind those numbers are merged:

| state | read | unread |
| --- | --- | --- |
| `main` before 2026-10-29 | 69,390 | 47,654 |
| entry notes (#184, merged) | 116,063 | 981 |
| `main` with #184 and operator modifiers (#192, merged) | 116,503 | 541 |

The chains the published grammar names (`#(H)` 一, `#(Wg)` ㇁, `#(-丨𠃍-一z)` 口) read as their
character in #193, but a description written as one of those chains alone is a lone component,
which an ordinary description is not; inside another description the table's chains are mostly ones
the grammar does not name, so no published row gains from the named ones.

Two more branches use the unread rows without reading them:

- #195 keeps the descriptions that carry an operator modifier in the bundled table (207 of them), so
  a tagged description still names its character when the search or `encoded` asks: `⿻[1:]丨日`
  answers 甲 rather than 申. The table drops notes and chains, whose meanings the editor cannot yet
  keep.
- #197 ships the descriptions that carry a stroke chain, and the character each names (837
  spellings, with and without the trailing note), so a pasted one resolves to its character: 乌 for
  `⿱丿⿹#(-𠃌㇉)一`. Nothing is drawn from the chain.

## What happens to each kind

| kind | read | kept in a description | drawn |
| --- | --- | --- | --- |
| plain description | yes | yes | composed from the parts |
| entry note | yes (#184) | yes, the note rides on its node | the note selects nothing yet |
| operator modifier | yes (#192) | yes | approximate: the layout ignores the crossing |
| stroke chain, named | yes (#193) | yes | approximate: the chain reads as its character |
| stroke chain, unnamed | no | resolved to the character instead (#197) | the character's glyph |
| region variant | in the note | dropped from the bundled table | nothing; the package has no variant glyphs |

## What still needs work

- **Crossing alignment.** All 208 modifier occurrences in the bundled table sit on ⿻: 87 `:-1`, 80
  `1:`, 2 `2:`, 2 `1:-1`, 1 `:-2`, 1 `1`, and a tail of `,`/`_`/`x`/`b`/`r` forms. The composer
  draws ⿻ with the parts overlapping where they collide; the modifier says which crossing of the
  outer part the inner one takes (甲 counts the vertical crossing the upper horizontal, 申 the
  middle).
- **Chain drawing.** 541 published sequences are chains without a character this package can use;
  drawing them needs stroke geometry the package does not ship.
- **Region variants.** `(.,T)` notes select a regional glyph shape; the package has one glyph per
  character and drops the note when it builds the table.

## Sources

- Yi Bai's IDS dataset, <https://github.com/yi-bai/ids>, MIT: the table measured here, at
  `da1e9f8a09e2ec8faaf176bac99203f978282041`.
- NightFurySL2001, （白式）IDS 延展语法导论, <https://nightfurysl2001.github.io/bai-ids/>, MIT,
  updated 2026-09-30: the notation named above and the chains the grammar names.
- 字統网 (zi.tools), <https://zi.tools/?secondary=ids>: what its composer accepts.
