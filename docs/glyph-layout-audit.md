# Glyph layout audit

The audit inventories the bundled BabelStone and Yi Bai IDS tables and demo examples. It renders descriptions containing an overlay or at least eight leaves, then compares them with glyphs from the selected composer export. Each result retains its source descriptions, region tags and input hashes.

## Run

From the repository root, with Bun and Chromium installed:

```sh
export CHROMIUM_PATH="$HOME/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome"
systemd-run --user --unit "glyph-layout-audit-$(date +%s)" \
  --slice=batch.slice -p MemoryMax=2G -p MemorySwapMax=0 \
  --same-dir --wait --pipe -- \
  env PATH="$PATH" CHROMIUM_PATH="$CHROMIUM_PATH" \
  bun scripts/audit_glyph_layout.mjs /tmp/glyph-layout-audit
bun scripts/render_glyph_audit.mjs /tmp/glyph-layout-audit 60
```

The scan uses four concurrent export requests and caches downloaded shards. `--limit 25` selects the first 25 candidates, dense descriptions first. `--style serif` selects the Serif export. Interrupted runs retain a partial report; rerunning starts at the beginning and reuses cached downloads. The download budget is a soft 512 MiB cap; in-flight responses can exceed it.

Browser evidence for selected enclosing descriptions can be collected separately for Sans reports. Append `basic-overlays` after the count to inspect low-overlap descriptions in the basic CJK block:

```sh
CHROMIUM_PATH="$HOME/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome" \
  bun scripts/check_glyph_audit_preview.mjs \
  /tmp/glyph-layout-audit https://ids.mkpo.li/ 6
```

## Reading the results

- **Automatic-cell enclosure:** a known enclosing description has been split into cells. This is a strong review candidate.
- **Placement flags:** unusually small, out-of-frame or separated operand boxes. These boxes describe placement; weighting and contour outlines can extend beyond them.
- **Raster differences:** low overlap or unusual ink area against a selected-export reference. Regional forms, alternative decompositions and fallback fonts can explain differences.

The report counts eligible root-overlay comparisons and skipped reasons. Ownership must come from explicit leaf indices or two literal operands with exactly matching ordered glyph origins. Nested overlays and untraceable parts are excluded from this placement check.

This is a direct-composer scan. The demo can substitute an encoded glyph for modifiers or approximation operators, and other faces can fall back to Sans. Confidence fields identify these possible overrides and ambiguous character mappings. Browser screenshots require visual inspection before a case is classified as a visible failure.

Coverage excludes recursive decomposition expansion, Kaisho, script-specific worker sources and document transforms. A complete report means the selected structural-risk pool was exhausted; unflagged glyphs remain unverified.

## Browser-confirmed examples, 2026-10-31

The Sans run inventoried 184,577 records and evaluated all 3,252 selected descriptions. It found 931 review candidates and five composition errors; 2,969 descriptions had native references. Twelve descriptions were checked in the live workshop in both themes.

Six reproduce broken enclosure placement:

| Character | Description | Visible symptom |
|---|---|---|
| 𰻝 U+30EDD | `⿺辶⿳穴⿰月⿰⿲⿱幺长⿱言马⿱幺长刂心` | 辶 occupies a separate left column. |
| 𭛕 U+2D6D5 | `⿱⿲彡丨⿳乀乀乀⿵冂⿰〢〢` | The lower enclosure sits beside its inner strokes. |
| 𰻞 U+30EDE | `⿺辶⿳穴⿲月⿱𮘎⿰長𮪉刂心` | This alternate description still separates 辶 and crowds the centre. |
| 𤅌 U+2414C | `⿰氵⿱⿴𦥑囟⿸厂⿱一⿷⿱丅𠃊㇈` | Enclosing parts are separated from their contents. |
| 𠕲 U+20572 | `⿵冂⿲⿱三丅⿱三丅⿰⿱三丅⿱三丅` | The outer frame ends above the inner strokes. |
| 𪈵 U+2A235 | `⿰⿹勹⿲⿱个个⿱个个⿱个个鳥` | 勹 is placed above the repeated parts rather than enclosing them. |

Six overlay descriptions also show displaced or disconnected strokes:

| Character | Description | Visible symptom |
|---|---|---|
| 五 | `⿻工𠃍` | The bent stroke joins the top and bottom bars instead of the middle. |
| 廿 | `⿻凵一` | The crossbar is too low and disconnected. |
| 九 | `⿻丿㇈` | The hook begins above the crossing stroke. |
| 龵 | `⿻𰀪二` | The diagonal strokes remain separate. |
| 廾 | `⿻一⿰丿丨` | The crossbar sits near the top of the vertical strokes. |
| 冘 | `⿻⿸丿乚冖` | The hook is shifted into the middle of the character. |

These observations apply to the listed descriptions. Other descriptions of the same character can render differently. The previously corrected descriptions of 爽, 头 and 𰻞 received no flags in this run.

## Sources

- Andrew West, [BabelStone IDS](https://www.babelstone.co.uk/CJK/IDS.TXT), file date 2025-06-27; bundled source digest `cc2a0a97e6a51ed6ebe59870ef2af66e83f3c3c27387d79b4441bb2d791d78b1`. Region-tagged descriptions can differ from the reference font.
- Yi Bai, [IDS level 1](https://github.com/yi-bai/ids/tree/da1e9f8a09e2ec8faaf176bac99203f978282041), revision `da1e9f8a09e2ec8faaf176bac99203f978282041`, MIT. Modifier notation may follow a separate preview route.
- Demo examples retain their individual citations from the [source catalogue](../demo/lib/example-sources.js).
- Reference outlines: the pinned [Sans composer export](https://glyphatlas.org/atlas/composer/bd0829bc6fbf-sans-compose-layout-v4-f5+letters/manifest.json). The report records hashes of every loaded shard; font form differences alone do not establish a rendering error.
- Browser observations: [IDS workshop](https://ids.mkpo.li/), 2026-10-31. The audit bundle contains timestamped screenshots and exact sequences; the live site can change.
