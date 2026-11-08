# Unencoded components

A design for one merged catalogue of components and descriptions, fusing BabelStone IDS, CHISE, the
zi.tools forms and this project's own rows, so that a character can be built from parts that no
Unicode block names.

Status: the artifact, its build script and the adapter option exist (`data/ids-corpus.json.gz`,
`scripts/build_ids_corpus.mjs`, `babelStoneAdapter({ chise })`), and the workshop loads it so its
CHISE rows sit beside BabelStone's with their source. What is built is the first increment:
BabelStone and the CHISE UCS files, with every CHISE entity still unresolved.

## Why

Three gaps motivate it.

- **5,319 ideographs have no description.** BabelStone describes 97,680 of the 102,999 assigned in
  Unicode 18.0's unified and compatibility ideograph blocks. CHISE describes 5,214 of the remainder;
  105 stay undescribed by either.
- **Some sources name parts that have no code point.** CHISE writes `⿸虍&GT-K01666;`: the field over
  男 is a glyph of the CHISE ontology, not a character. Nothing in the current data can hold it.
- **Scripts with whole characters and no named parts.** Small Seal and Shuishu have outlines for
  their characters but no component vocabulary, so they cannot be composed from parts at all.

Wikisource transcribers meet these gaps in practice: a printed character nobody encoded, which they
need a description to render in place of. Fish bowl's English Wikisource
[user page](https://en.wikisource.org/wiki/User:Fish_bowl) keeps their running list of the places
they met: a state cell such as `unify (39)`, `?unify?`, `error` or `accepted`, or none, the character
the place should show, the IDS with the doubtful part marked where one is doubtful, the page or book
needing it, and where a case is decided a GlyphWiki form. A draft template there would take the IDS,
the character and a UCV number or a `moe=`, `ws=` or `img=` code, filed as similar to
[Template:Sinogram](https://en.wikisource.org/wiki/Template:Sinogram) and
[Template:參](https://zh.wikisource.org/wiki/Template:%E5%8F%82) (now
[Template:另2](https://zh.wikisource.org/wiki/Template:%E5%8F%A62)).

## Licence, first

The artifact is **GPL-2.0-or-later**, because CHISE's IDS rows are inside it and CHISE-IDS is GPL.
The package stays MIT: the corpus is an optional artifact a host loads the way it already loads
`small-seal.json.gz`, and a host that cannot take GPL does not pass it. Every row carries provenance
and the file states the terms, so a GPL row is never mistaken for one of this project's own.

This is a real consequence, not a formality. It is the decision that gates the rest.

## Identity

Three levels.

- **Form.** One Unicode scalar. IDS trees, the document model and the composer already hold this.
- **Identity (`cid`).** One component form under every name the sources give it: `ucs:F936`,
  `chise:GT-K01666`, `gwx:u7537-01`, `bsp:22`, `ids:<fingerprint>`.
- **Equivalence.** Distinct cids that may substitute for one another in search and glyph fallback.
  Equivalence never rewrites a description; the tree keeps the component the source named. The
  `bsp:n` cids are BabelStone's 121 numbered parts; where CHISE names one `&name;`, the two are one
  component under two names, and the `equivalences` table records the pair.

Precedence when a cid is first assigned is `ucs` > `chise` > `gwx` > `bsp` > `ids`. A ledger freezes
each cid, so a later encoding adds a `ucs` alias rather than renumbering anything.

An unencoded form gets a scalar in plane 15 private use, allocated from that ledger: it parses and
round-trips today, so the composer needs no new syntax. In the artifact it is written `&cid;` and
materialized with `String.fromCodePoint` at load.

A CHISE name resolves through the pinned ontology, never by parsing its prefix. `GT-K01666` and
`J0-4B5E` are opaque; the ontology record says whether the name has a `=ucs`, its own
`ideographic-structure`, a `<-denotational` target, or is an extended IDC operator.

## Records

One artifact, `data/ids-corpus.json.gz`, with columnar tables in the shape `ids-parts.json` already
uses: `components`, `aliases`, `equivalences`, `merges`, `descriptions`, plus `sources`, `provenance`,
`pua` and `counts`. Outlines stay where they already live, so the corpus carries no `glyphs` table.

An `equivalences` row names two cids, a `basis` (`alignment`), a `status` (`verified` where two or more
characters attest the pair, `candidate` where one does), the provenance indexes of the descriptions
that carry it, and a note listing the characters. Three kinds are recorded: a BabelStone number
against a CHISE entity (`bsp:7` / `chise:CDP-8BD0`), a number against a Unicode character (`bsp:7` /
`ucs:53C0`, 叀), and a CHISE entity against a character. Two characters that differ between the
sources are variants or slips in a description, not two names of one component, and are left out. The
table is inferred, not asserted by either source: it never merges the two cids, and a description
keeps the notation its source wrote.

Every description row carries `subject` (a cid), the source's `text`, a `resolved` form in which
unencoded leaves are `&cid;`, the provenance indexes of every attestation, region tags, a `role`
(all of them `source` today; `alternative`, `apparent`, `derived` and `editorial` are the rest of
the vocabulary) and a `status` (ready, unresolved, unsupported, empty). A row is never invented: an
unresolved designator stays unresolved rather than becoming `？`, and an IDS a source gives stays in
`text` while its unencoded leaves are tokenised in `resolved`, since both are what a transcriber
renders. BabelStone lines without a region tag are the exception: the parse skips them, and with them
any subject they alone describe.

## Merge

Twelve steps, in order: parse each source verbatim; index the ontology; mint an anchor per
designator; exact unions by scalar and by ontology `=ucs`; alignment where two sources describe one
subject with trees differing in one leaf; shape fingerprints as candidates; curated overrides;
a conflict check that fails the build; cid assignment off the ledger; materialization and parse;
dedup by resolved tree with merged provenance; and a write that refuses a duplicate cid, an unknown
provenance index or a `ready` row that does not parse.

Only tiers A and the narrow alignment case auto-merge. Shape is always a candidate, because distinct
glyphs share decompositions often enough that auto-merging would be wrong more than right.

## Worked example

`IDS-UCS-Compat.txt` has `U+F936 虜 ⿸虍&GT-K01666;`. The ontology gives that name a structure of
`⿱毌力`, seven strokes, and a `<-denotational` link to 男. BabelStone describes 虜 twice:
`⿸虍男` for GHTJKPV and `⿸虍⿱毌力` for TK.

So `chise:GT-K01666` becomes its own cid with a private-use char, equivalent-by-denotation to
`ucs:7537` and not merged with it, because the field really is drawn differently. `U+F936` resolves
to `⿸虍` plus that cid, and where no outline exists the composer draws `⿱毌力`.

The alignment is built, not curated: for every character both sources describe, the build compares
their descriptions operator by operator and keeps the operand positions where the two differ. It finds
605 pairs, 206 seen on two or more characters and `verified`: 102 number against entity, 50 number
against character, 453 entity against character. BabelStone's `{7}` is CHISE's `CDP-8BD0` on eight
characters (惠 `⿱{7}心` / `⿱&CDP-8BD0;心`, 專, 䦄 and five more) and the character 叀 on nine.

## First increment

Built: `data/ids-corpus.json.gz` from BabelStone and the eighteen CHISE files (102,894 CHISE rows
beside 108,425 BabelStone ones), with 1,517 components (1396 CHISE entities and 121 BabelStone
numbers) and 605 equivalences between them; `data/chise-sources.json` as the pinned-source manifest,
`data/ids-corpus-sources.tar.gz` as the offered source, `data/COPYING-chise-ids.txt`, and a check
that every `ready` row parses and that `bun scripts/build_ids_corpus.mjs --check` reproduces the
committed bytes.

Out of scope for it: outlines, the webfont, the palette and adapter wiring.
