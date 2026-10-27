# Small Seal candidate inference

`adapter.sealCandidates(query)` returns `{ items, total }`. Each item contains its seal
character, modern equivalents, source records, source-backed descriptions, modern
descriptions, candidates, source metadata, and the generator version `cjk-to-seal/1`.
Lookup returns at most 24 matching seal forms; a specific seal code point selects
that form directly.

For each parseable modern IDS, the generator substitutes directly mapped seal
components. Where a direct mapping is absent, it tries the existing radical and
positional-form equivalences. Multiple possible seal components produce alternative
candidates; repeated occurrences of one modern component share an assignment.
Each mapping records its modern component, available alternatives, selected seal
component, and whether it used a radical-form equivalence.

Unmapped components become `⬚` slots. Self-referencing substitutions are excluded.
Generation preserves modern source-region tags and descriptions, including
unsupported descriptions for inspection. Candidate enumeration is capped at 64 per
seal form and alternates between modern descriptions before taking further mapping
combinations. `truncated` identifies a capped result; component option lists retain
the additional choices.

Inference preserves the modern structure. Historical changes can make that structure
unsuitable for the seal form, so generated descriptions remain estimates.
Generation leaves `structure()`, `encoded()`, and the search index unchanged.

When the adapter combines modern IDS tables, `modernSource` lists all supplied tables. This is table-level provenance; it does not assign individual descriptions to one source.
