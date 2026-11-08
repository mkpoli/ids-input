# Linear IDS scopes

The sequence field uses native input selection, caret and composition. A text overlay keeps each IDS token in the configured font. SVG scope lines sit below that text and follow the input's horizontal scroll.

Scope geometry uses the paths and UTF-16 subtree ranges from [tokens.js](../src/svelte/tokens.js). Rendered token bounds supply widths, including operator notes, variation selectors and emoji. Each operator sends a butt-capped curved lead from its left edge, stopping one gap before its first operand; adjacent operand segments keep the same gap. Subtree height assigns compact lanes, with the root below its descendants. Invalid drafts have no structural lines; unfinished slots contribute no width.

Lines use the workshop's inherited muted, accent and tint tokens. Their neutral stroke remains visible with tint disabled. Under tint, each segment takes its operand's branch tint, so sibling operands keep the hues their text has. Hovering or choosing a leaf highlights its segment and the lead of the scope above it. Forced-colors mode draws neutral strokes in `CanvasText` and active strokes in `Highlight`. Resize observation and font-loading events refresh measurements; teardown disconnects observers, listeners and animation frames.

## Source

mkpoli, [ids-visualiser: src/main.ts](https://github.com/mkpoli/ids-visualiser/blob/master/src/main.ts) and [src/style.css](https://github.com/mkpoli/ids-visualiser/blob/master/src/style.css), accessed 2026-11-07. The nested text underlines inform this representation. That implementation excludes the root underline; this geometry includes root scopes, segments immediate operands and curves the leading IDC into its scope. The source links track a mutable branch.
