# Unencoded components

A design for one merged catalogue of components and descriptions, fusing BabelStone IDS, CHISE, the
zi.tools forms and this project's own rows, so that a character can be built from parts that no
Unicode block names.

Status: built. `data/ids-corpus.json.gz` merges BabelStone IDS, the CHISE UCS files, Yi Bai's zi.tools
rows at all three levels, ids-input's own descriptions (`ids-project.tsv`, the descriptions in
`custom-ids.tsv`, the Tangut layers) and class-member rows. The workshop loads it so its CHISE rows
sit beside BabelStone's with their source. Every CHISE entity is still unresolved.

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

The build also writes `data/ids-equivalences.json`, the same table with each side's display character and
BabelStone's description, for the components page at `/unencoded`.

An `equivalences` row names two cids, a `kind`, a `basis`, a `place`, a `tier`, a `status`, the
provenance indexes of its sources and a note. Two kinds are recorded.

`alignment` rows pair a BabelStone number with a CHISE entity, `verified` where two or more
characters attest the pair and `candidate` where one does, the note listing the characters (`bsp:7` / `chise:CDP-8BD0`). A component is not equated with a Unicode character: the
part BabelStone numbers `{7}` looks like 叀, but a part is not the character 叀, and the alignment
cannot tell a shared shape from an identity.

Two characters that differ between the sources are
variants or slips in a description, and are left out. A number with a known note 6 fragment is
compared as that fragment, so a composite such as `{2}` (`⿱⺈𫩏`) cannot be taken for a leaf it
contains. The table is inferred, not asserted by either source: it never merges the two cids, and a
description keeps the notation its source wrote.

`class-member` rows say that a character, the member, is another character drawn another way (⺭ is
礻, and 礻 at the left is 示). The bases are `radical-form` (Unicode's EquivalentUnifiedIdeograph),
`positional-form` (cjkvi-variants' radical variants, at the place the row names; a row with no place
folds nothing), `unifiable-variant` (the IRG's UCV list at level 1, read as the first form an entry
names, and two characters of an entry only where Unihan's variants or the radical variants also give
them as variants; a positional form is never a placeless member) and `radical-index` (Unihan
`kRSUnicode` with no residual strokes, only for a member with the radical's stroke count and no
definition of its own, so 曱 is no form of 田). The radical variants overrule it for a form they list,
compatibility ideographs included. A row with a `place` holds there only; `source` rows are stated by a
table and `derived` rows inferred. `data/ids-class-conflicts.tsv` lists the rows that disagree:
members that lead back to themselves or to two canonical members, a pair one table gives at a place
and another everywhere, and Unihan's radical rows that the radical variants overrule.

Every description row carries `subject` (a cid; `x:X-nnnnn` for a form of `custom-ids.tsv`), the source's `text`, a `resolved` form in which
unencoded leaves are `&cid;`, the provenance indexes of every attestation, region tags, a `role`
(`source`, `editorial` for the project's curated descriptions and `derived` for the Tangut layers;
`alternative` and `apparent` are the rest of the vocabulary) and a `status` (ready, unresolved, unsupported, empty). A row is never invented: an
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
their descriptions operator by operator and keeps the operand positions where a number and an entity
differ. It finds 62 pairs, 48 seen on two or more characters and `verified`. BabelStone's `{7}` is
CHISE's `CDP-8BD0` on eight characters: 惠 `⿱{7}心` / `⿱&CDP-8BD0;心`, 專, 䦄 and five more.

## Build

`bun scripts/build_ids_corpus.mjs` reads BabelStone, the eighteen CHISE files, `zi-tools-rows.tsv.gz`,
`ids-project.tsv`, `custom-ids.tsv`, `tangut-layers.json.gz`, `component-forms.tsv`, `ucv.json` and
Unihan 18.0.0, each pinned by digest. It writes the corpus, `data/ids-corpus-sources.tar.gz`,
`ids-equivalences.json`, `ids-components-index.json.gz` and `ids-class-conflicts.tsv`; `--check`
reproduces the committed bytes. A description keeps the text its source wrote, so a zi.tools row
keeps its entry notes and stroke chains.
