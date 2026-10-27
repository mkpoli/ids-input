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

Unmapped components become `⬚` slots. Self-referencing substitutions are excluded.
Generation preserves modern source-region tags and descriptions, including
unsupported descriptions for inspection. Candidate enumeration is capped at 64 per
seal form and alternates between modern descriptions before taking further mapping
combinations. `truncated` identifies a capped result; component option lists retain
the additional choices.

Inference preserves the modern structure. Historical changes can make that structure
unsuitable for the seal form, so generated descriptions remain estimates.
Generation writes only the requested audit folder and does not modify the shipped dataset.

When the audit combines modern IDS tables, `modernSource` lists all supplied tables. This is table-level provenance; it does not assign individual descriptions to one source.
