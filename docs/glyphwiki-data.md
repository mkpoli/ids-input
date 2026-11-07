# GlyphWiki component data

The [offline importer](../scripts/import_glyphwiki_components.mjs) extracts named glyphs and their recursive source components into a deterministic JSON graph. It preserves stroke records, placement coordinates and stretch fields for a downstream renderer. It has no network access, outline rendering or KAGE engine dependency.

## Available dump

[GlyphWiki's official dump](https://glyphwiki.org/dump.tar.gz) is a gzip-compressed tar archive. On 2026-11-07, a HEAD request reported **114,379,731 bytes** (109.1 MiB), `Last-Modified: Fri, 06 Nov 2026 17:01:36 GMT` and ETag `"6d14bd3-65f9e90a659e3"`. A **65,536-byte range response** (`206`, bytes `0-65535`) exposed the first tar member, `dump_newest_only.txt`, whose tar header declared **302,254,017 bytes** (288.3 MiB).

The sampled member is UTF-8 text with a padded `name | related | data` table, a header and a dashed separator. Records contain `$`-separated strokes and `:`-separated fields; component names can carry `@revision`. The archive's remainder was not downloaded or inspected.

[ge9's dump notes](https://raw.githubusercontent.com/ge9/kage-afdko-toolkit/master/README.md) describe a second member, `dump_all_versions.txt`, with historical revisions excluding blanked records. They warn that the historical dump alone cannot identify a blanked latest revision, while the newest-only dump cannot satisfy old component revisions. This is third-party documentation at a mutable URL; the historical member's current size and contents remain unverified. Guessed standalone URLs for either text file, and `dump_all_versions.tar.gz`, must not be assumed to exist.

## Import a local dump

Unpack a user-supplied archive outside this utility. Pass the extracted UTF-8 table:

```sh
bun scripts/import_glyphwiki_components.mjs \
  --input /path/to/dump_newest_only.txt \
  --glyph twedu-a00836-011 \
  --source-url https://glyphwiki.org/dump.tar.gz \
  --source-date 2026-11-07 \
  --out /tmp/glyphwiki-components.json
```

Use the actual source snapshot date. Repeat `--glyph` for multiple roots; `--glyph name@9` requires that exact revision. Output must not already exist. Archives, URLs and standard input are unsupported as inputs: the importer reopens the local file for each dependency frontier, retaining only selected records.

Bare dump names have an unknown revision. An unversioned reference requires a bare-name row; the importer never chooses the highest historical revision. A pinned reference requires a matching `name@revision` row. If a closure needs both kinds, provide a local table containing the needed bare and versioned rows, with a provenance URL identifying that source collection.

## Frozen target

The [API capture fixture](../tests/fixtures/glyphwiki-target.api.jsonl) contains seven responses fetched on 2026-11-07, totaling 940 response-body bytes. Its [source graph](../tests/fixtures/glyphwiki-target.components.json) includes the license terms, source URLs, retrieval times, response hashes and revision limitations.

| Reference | Observed revision | Reference status |
| --- | ---: | --- |
| [`twedu-a00836-011@9`](https://glyphwiki.org/json?name=twedu-a00836-011%409) | 9 | Explicit root revision |
| [`u20120-t`](https://glyphwiki.org/json?name=u20120-t) | 2 | Unversioned dependency |
| [`u4e5b-k`](https://glyphwiki.org/json?name=u4e5b-k) | 1 | Unversioned dependency |
| [`u4e04-07`](https://glyphwiki.org/json?name=u4e04-07) | 1 | Unversioned dependency |
| [`u4e37-jr`](https://glyphwiki.org/json?name=u4e37-jr) | 2 | Unversioned dependency |
| [`u540b-t04`](https://glyphwiki.org/json?name=u540b-t04) | 2 | Unversioned dependency |
| [`u53e3-t01`](https://glyphwiki.org/json?name=u53e3-t01) | 7 | Unversioned dependency of `u540b-t04` |

These observed dependency revisions freeze a retrieval snapshot. They do not reconstruct the dependencies in effect when root revision 9 was saved. The root's `related: U+2D260` identifies a related character, 𭉠; it does not establish an identical glyph or preserve the target's hook.

Reproduce the graph offline:

```sh
bun scripts/import_glyphwiki_components.mjs \
  --input tests/fixtures/glyphwiki-target.api.jsonl --format api-jsonl \
  --glyph twedu-a00836-011@9 \
  --source-url 'https://glyphwiki.org/json?name=twedu-a00836-011%409' \
  --source-date 2026-11-07 \
  --out /tmp/glyphwiki-target.components.json
```

`api-jsonl` accepts one capture per line: `{ "requested", "url", "retrievedAt", "body" }`. `body` is the exact JSON response text; `url` is the canonical HTTPS GlyphWiki JSON URL for `requested`, and `retrievedAt` is a UTC timestamp. The importer validates returned names and revisions. A capture can satisfy its requested reference or the exact revision reported in its response; it cannot establish a different current or historical revision. Capture metadata is supplied by the input owner, not authenticated by the importer.

## Source graph

- `nodes` are sorted by requested reference. Each includes raw `data`, its SHA-256, `related`, revision evidence, source URL and ordered `records`.
- Each record retains `raw` and every colon-separated field as strings. Rejoining fields with `:` and records with `$` recovers the input data exactly. Dump table padding is excluded; the full input-byte SHA-256 covers the original file.
- Type `99` records expose `component.reference`, `placement.{x1,y1,x2,y2}` and `stretch.{fields1And2,fields8Onward}`. Field indexes are zero-based. Eight-field records retain an empty tail; eleven-field records retain all three tail fields. Numeric spelling, negative/out-of-range coordinates and zero values are preserved without defaults, clipping or interpretation.
- `edges` retain each component occurrence and its record index. `resolution` is `explicit-revision` or `snapshot-unversioned`; repeated references at different placements remain separate edges.
- Other stroke types remain opaque. Referenced components, including aliases, stay as graph nodes; stroke expansion, stretches, outlines and geometry require downstream interpretation.

The component field count and stretch-field identification follow [くろごま's validator notes](https://ku6goma.appspot.com/gwv/data.html), fetched 2026-11-07. Those notes carry a 2017-05-10 warning that descriptions may be outdated. All trailing fields remain available to downstream consumers without imposing rendering semantics.

## Bounds and failures

| Flag | Default |
| --- | ---: |
| `--max-input-bytes` | 536870912 (512 MiB per scan) |
| `--max-scan-bytes` | 2147483648 (2 GiB across scans) |
| `--max-line-bytes` | 65536 |
| `--max-glyphs` | 256, including roots |
| `--max-depth` | 16; roots are depth 0, hard ceiling 256 |
| `--max-records` | 8192 across selected glyphs |
| `--max-data-bytes` | 1048576 across selected raw data |
| `--max-output-bytes` | 16777216 |

Missing references, duplicate selected rows, cycles, malformed components, invalid UTF-8, changed input hashes and exceeded limits fail the import before output is created. Depth checks include the longest path through shared components. Limits can be lowered or raised explicitly; a large dump may need more scan budget even for a small closure. Tests perform no network requests.

```sh
bun test tests/glyphwiki-data.test.js
```

## Data license

The fixture uses GlyphWiki's data-and-article license. The Japanese terms reproduced in [Debian's archived license file](https://sources.debian.org/src/thunderbird/1%3A78.8.0-1~deb10u1/layout/reftests/fonts/glyphwiki-license.txt/) permit free use, copying and modification, with no specific author-display restriction; quoted material in articles remains subject to its own source license. Its English translation identifies the Japanese original dated 2008-10-08 as authoritative.

The [official Japanese license page](https://glyphwiki.org/wiki/GlyphWiki:データ・記事のライセンス) returned HTTP 403 on 2026-11-07, including browser verification. Current official-page text could not be checked. The artifact embeds the reproduced Japanese terms and this evidence limitation; no SPDX equivalence or relicensing of glyph data is asserted.
