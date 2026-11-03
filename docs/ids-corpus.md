# Unencoded components

A design for one merged catalogue of components and descriptions, fusing BabelStone IDS, CHISE, the
zi.tools forms and this project's own rows, so that a character can be built from parts that no
Unicode block names.

Status: design only. Nothing here is built yet; the artifact, the build script and the adapter
option described below do not exist.

## Why

Three gaps motivate it.

- **5,319 ideographs have no description.** BabelStone describes 97,680 of the 102,999 assigned in
  Unicode 18.0. CHISE supplies a real decomposition for 4,379 of the remainder; 940 stay unaddressed.
- **Some sources name parts that have no code point.** CHISE writes `⿸虍&GT-K01666;`: the field over
  男 is a glyph of the CHISE ontology, not a character. Nothing in the current data can hold it.
- **Scripts with whole characters and no named parts.** Small Seal and Shuishu have outlines for
  their characters but no component vocabulary, so they cannot be composed from parts at all.

## Licence, first

The merged artifact would be **GPL-2.0-or-later**, because CHISE's IDS files and its ontology are
GPL and their rows would be inside it. The package stays MIT: the corpus is an optional artifact a
host loads the way it already loads `small-seal.json.gz`, and a host that cannot take GPL does not
pass it. Every row carries provenance, so a GPL row is never mistaken for an editorial one.

This is a real consequence, not a formality. It is the decision that gates the rest.

## Identity

Three levels.

- **Form.** One Unicode scalar. IDS trees, the document model and the composer already hold this.
- **Identity (`cid`).** One component form under every name the sources give it: `ucs:F936`,
  `chise:GT-K01666`, `gwx:u7537-01`, `bsp:22`, `ids:<fingerprint>`.
- **Equivalence.** Distinct cids that may substitute for one another in search and glyph fallback.
  Equivalence never rewrites a description; the tree keeps the component the source named.

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
uses: `components`, `aliases`, `equivalences`, `merges`, `descriptions`, `glyphs`, plus `sources`,
`provenance`, `pua` and `counts`.

Every description row carries `subject` (a cid), the source's `text`, a `resolved` form in which
unencoded leaves are `&cid;`, the provenance indexes of every attestation, region tags, a `role`
(source, alternative, apparent, derived, editorial) and a `status` (ready, unresolved, unsupported,
empty). A row is never invented: an unresolved designator stays unresolved rather than becoming `？`.

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

A second case shows alignment: BabelStone's `⿹{22}一` for 与 and CHISE's `⿹&CDP-8BBF;一` differ in
one leaf, which unites `bsp:22`, `chise:CDP-8BBF` and `chise:GT-K00125` under one cid.

## First increment

A build script limited to the Basic and Compatibility CHISE files (about 21,000 descriptions), the
artifact, the ledger and equivalence inputs, a pinned-source manifest, this note, and tests that
every `ready` row parses and that a rebuild reproduces the committed bytes.

Out of scope for it: outlines, the webfont, the palette and adapter wiring.
