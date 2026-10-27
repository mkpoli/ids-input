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

## Notation and what reads it

The published table writes four kinds of text. A sequence may carry more than one.

| notation | written as | example |
| --- | --- | --- |
| plain description | operators and components | `⿰木木` |
| entry note | `{曰}` before, `(.,T)` after | `⿻乚一(.,T)`, `{士}⿱十一` |
| operator modifier | `[1]`, `[1:]`, `[.,x]` after ⿻, an enclosure or ㇯ | `⿻[1:]丨日` |
| stroke chain | `#(` strokes `)` | `#(-丨𠃍-一z)` |

On `main` (2026-10-28, 117,044 sequences in total): 69,390 read, 47,654 unread — all 47,240 sequences that
carry a note are unread, as are all 501 with a modifier and all 541 with a stroke chain (some
sequences carry two kinds).

Three open branches move these numbers:

| branch | read | unread |
| --- | --- | --- |
| `main` | 69,390 | 47,654 |
| entry notes (#184) | 116,063 | 981 |
| operator modifiers (#192) | 69,597 | 47,447 |
| stroke chains (#193) | 69,390 | 47,654 |
| all three | 116,503 | 541 |

The 541 which remain all carry a stroke chain. The chains the published grammar names (`#(H)` 一,
`#(Wg)` ㇁, `#(-丨𠃍-一z)` 口) read as their character, but a description written as one of those
chains alone is a lone component, which an ordinary description is not; inside another description
the table's chains are mostly ones the grammar does not name, so no published row gains from the
named ones.

## Sources

- Yi Bai's IDS dataset, <https://github.com/yi-bai/ids>, MIT: the table measured here, at
  `da1e9f8a09e2ec8faaf176bac99203f978282041`.
- NightFurySL2001, （白式）IDS 延展语法导论, <https://nightfurysl2001.github.io/bai-ids/>, MIT,
  updated 2026-09-30: the notation named above and the chains the grammar names.
- 字統网 (zi.tools), <https://zi.tools/?secondary=ids>: what its composer accepts.
