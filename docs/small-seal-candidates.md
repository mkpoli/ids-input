# Small Seal provider audit

Run `node scripts/check_small_seal.mjs OUTPUT_DIRECTORY` from a checkout. The script
writes a standalone `index.html` gallery, a `report.json` evidence file, and a local
copy of the reference font with its licence. Serve the output folder locally.
The app has no audit interface or candidate API.

The report covers every mapped seal form, records SHA-256 hashes of its inputs,
and checks generated IDS syntax and direct self-reference. A nonzero structural
error count makes the command fail. Incomplete candidates remain visible.

Gallery groups:

- `source-match`: at least one fully mapped candidate exactly matches a recorded IDS.
- `source-different`: fully mapped candidates exist, but none exactly matches a recorded IDS.
- `source-only`: a recorded IDS exists without a fully mapped candidate.
- `inferred`: fully mapped candidates exist without a complete recorded IDS.
- `incomplete`: candidates exist, but every one has unmapped slots.
- `no-candidate`: no supported modern decomposition is available.

These groups describe evidence coverage among enumerated candidates, not approval. String differences can arise
from mixed modern/seal notation; an exact match does not verify other alternatives.
The glyph font is the Chen Changzhi edition, while source IDS comes from Jiguge.
Schematics show rough component placement, not a reconstructed historical glyph.

## Generation

For each parseable modern IDS, the generator substitutes directly mapped seal
components. Where a direct mapping is absent, it tries the existing radical and
positional-form equivalences. Multiple possible seal components produce alternative
candidates; repeated occurrences of one modern component share an assignment.
Each mapping records its modern component, available alternatives, selected seal
component, and whether it used a radical-form equivalence.

When neither mapping exists, the generator recursively expands the component's
modern IDS. For example, `𤇾 → ⿱炏冖 → ⿱⿰火火冖` provides smaller components
with seal mappings. Directly mapped components stay whole. Each candidate's
`expansions` records the intermediate component, original IDS, and region tags.
One decomposition choice is reused wherever that component occurs, including
occurrences introduced by later expansions.

Cycles stop at an unresolved component. Each root description allows at most eight
component expansions on a path and 512 expansion attempts, with a bounded pending
queue. Expanded IDS must fit the parser's 64-code-point limit. `truncated` also
marks expansion limits; candidates retain unresolved slots when a limit prevents
completion. The generator version is `cjk-to-seal/2`.

Remaining unmapped components become `⬚` slots. Self-referencing substitutions are excluded.
Generation preserves modern source-region tags and descriptions, including
unsupported descriptions for inspection. Candidate enumeration is capped at 64 per
seal form and alternates between root modern descriptions before taking further
nested alternatives or mapping combinations. `truncated` identifies a capped result; component option lists retain
the additional choices.

Inference preserves the modern structure. Historical changes can make that structure
unsuitable for the seal form, so generated descriptions remain estimates.
Generation writes only the requested audit folder and does not modify the shipped dataset.

When the audit combines modern IDS tables, `modernSource` lists all supplied tables. This is table-level provenance; it does not assign individual descriptions to one source.

## Curated supplementary mappings

`scripts/data/small-seal/supplements.json` records provider crosswalks for seal
glyphs outside the bundled app palette. Each entry pairs one Unicode SealSources
`kSEAL_MCJK` value with a single CHISE ShuoWen record that lists the modern
characters together. The entry names the record and carries checksums for the
Unicode table, the CHISE archive and a pinned Kaiyuan SVG.

`python3 scripts/build_seal_supplements.py REPORT_JSON` adds a seal form when its
Unicode mapping reaches a modern component that the report lists as unmapped,
for example U+3DB6E for 爭 and 争 or U+3DDAF for 其. The audit includes the
aliases; supplementary mappings stay outside the source-backed decomposition
table. A source IDS with no resolved seal head remains unresolved.

The checksums are verified during generation and by every entry in
`python3 -m unittest discover -s scripts -p test_small_seal.py`. Supplementary
glyphs are reference evidence for the audit and remain separate from the app
font.
