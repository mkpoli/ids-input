# Serif contours torn at a repeated point

The serif and Kaisho exports stored broken outlines until han-compose#46: in most glyphs one contour started on a point that had moved away from the one it repeats, and interpolating toward the heavy weight tore the stroke open along the closing chord. This records the finding, how it was measured, and the two repairs ids-input carries so that its own drawings stay whole whichever export is loaded.

## The cause

A font writes a contour's closing return as a copy of its first point, and writes a sharp corner as two copies of one point. Both copies are a single vertex. han-compose's heavy weight is stored as a move from the light one, and the growth it applies — moving each point along the corner it sits on — treated the two copies as two separate points. The edge between them has no direction, so one of the two corner normals is zero, the bisector leans onto the other side, and the `cos_half` cap of 0.35 sends one copy 2.857 times too far while its twin stays put.

The font's own heavy outline closes exactly. The tear appears only in the export, which stores the grown outline as `light` and `delta`.

Two symptoms, one cause:

- **Seam.** The last copy no longer coincides with the first, so the contour starts off the outline and `Z` chords back through the ink. Nonzero winding cancels the overlap into a white wedge.
- **Corner.** An interior point written twice splits, one copy pinned where it was and the other thrown out. This shows as a spike or a notch, and the closing-point snap alone could not reach it.

## What was measured

Counts from `bun scripts/audit_open_contours.mjs`, the scanner added here: it reads an export's own records and reports every point the light master writes twice whose copies the heavy master puts apart.

| Export | Keys scanned | Written twice | Torn | Largest tear | Worst key |
|---|---|---|---|---|---|
| Serif `62af8c26f961` | 12,679 | 35,613 | 29,862 | 146 units | 𛀛 |
| Sans `bd0829bc6fbf` | 141 | 146 | 0 | 0 | — |

29,599 of the serif tears are on a contour's closing return; the rest are corners. The serif figure covers every letter and digit the export records (`web_export.letters`), not only the characters a viewer types. Kaisho's tear came from the same growth on a static face.

`o` and `6`, the two shapes where the seam shows:

| Glyph | Contour | Seam in the export | After the fix | In `ids-input` before this fix |
|---|---|---|---|---|
| `6` | 0 | 39.08u | 0 | 5.90u in a 1000-unit drawing |
| `o` | 0 | 39.08u | 0 | 20.10u |
| `o` | 1 | 39.08u | 0 | 20.10u |
| `日` | 3 | 33.05u, corner | 0 | — |

The `ids-input` column is what the workshop drew from the published `6` record, in drawing units of a 1000 × 1000 box; the export column is in font units (~1/4 unit steps, so a few hundredths of a unit are rounding). `日`'s third contour has no closing duplicate, only an interior one, which is why the closing-point snap never fixed it.

## The repairs

- **han-compose#46**, merged as `8156f83`: `_grown` collapses repeated points, grows each vertex once, and gives every point the grown place of the vertex it copies. This closes the seam and the corners at the source, for every client.
- **`partOf`**, `src/composer/geometry.js`: records read before an export is rebuilt still carry the tear. Each repeated copy takes the point before it, then a contour's last point takes its first. Contours that close on an implied point keep their control point.

Both are safe for records that are already whole: every assignment is a no-op where the points agree.

## Running the scan

```sh
bun scripts/audit_open_contours.mjs EXPORT_DIR_OR_URL KEYS_FILE [SUFFIX]
```

`KEYS_FILE` is a JSON list of keys. For a serif export, write it from han-compose with `json.dump(sorted(web_export.letters(serif_font)))`. The script exits non-zero when a contour is torn, so it can gate an upload. Run it against a local export before publishing it, and against the published one to see what readers still get.

```sh
bun scripts/audit_open_contours.mjs \
  https://glyphatlas.org/atlas/composer/62af8c26f961-serif-compose-layout-v4-serif-f5 \
  serif-keys.json
```

## Sources

- han-compose issue [mkpoli/han-compose#45](https://github.com/mkpoli/han-compose/issues/45) and pull request [#46](https://github.com/mkpoli/han-compose/pull/46), which record the measurements above against the source and the fix.
- ids-input pull requests [#382](https://github.com/mkpoli/ids-input/pull/382) (closing the seam) and [#389](https://github.com/mkpoli/ids-input/pull/389) (dropping the stroke that had hidden the seams).
- Serif export [`62af8c26f961-serif-compose-layout-v4-serif-f5`](https://glyphatlas.org/atlas/composer/62af8c26f961-serif-compose-layout-v4-serif-f5/manifest.json), whose `manifest.json` lists the fonts and their terms.
- Glyph counts were read from the export as it was published on 2026-10-31; a rebuilt export supersedes them.
