# Small Seal candidate review

In **Parts → Small Seal**, choose **Review Small Seal IDS**. Enter a seal character,
a modern CJK equivalent, or a code point such as `U+3D035`. The comparison shows the
reference glyph, complete source-backed IDS, original source records, modern CJK
IDS, and inferred candidates. Original records remain visible when their component
identifiers cannot yet be resolved.

The schematic lays out component glyphs according to the IDS operators. It is a
geometric aid; the reference glyph comes from the bundled Chen Changzhi font.
The source IDS describes the Jiguge edition. Missing reference or component glyphs
are identified explicitly.

## Generation

`adapter.sealReview(query)` returns `{ items, total }`. Each item contains its seal
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
unsuitable for the seal form, so every generated description requires review.
Generation leaves `structure()`, `encoded()`, and the search index unchanged.

## Decisions and export

Choose a candidate, edit its IDS if needed, and add a note or correction source.
**Accept locally** requires a complete IDS with no unknown component or reference to
the head character. **Reject locally** can record an incomplete candidate.
**Use in editor** opens the current correction without changing the source dataset.

Decisions persist in this browser under `ids-input.seal-reviews.v1`. A later decision
for the same candidate replaces its earlier decision. Newer decisions take precedence
when merging another tab's changes. If storage fails, the session keeps the decision
in memory and reports the failure so it can be exported before the page closes.
Unsaved text edits remain available while the dialog is open or reopened in the same
page; use an acceptance or rejection action to persist them across reloads.

**Export reviews** downloads `small-seal-reviews.json`:

```json
{
  "format": 1,
  "kind": "small-seal-editorial-reviews",
  "reviews": []
}
```

Each review contains an opaque `id`, seal `char`, `decision` (`accepted` or
`rejected`), reviewed `text`, `note`, UTC `reviewedAt`, the original `candidate`,
and an `evidence` snapshot. Evidence includes the generator version, modern
correspondences, attested IDS, original source records, mapping sources, and the
modern IDS source. The candidate retains the exact modern IDS, region tags,
component choices, unmapped components, and unavailable glyphs.

These files are editorial decisions. Publishing them as source-backed IDS requires
separate source checking and dataset maintenance.
