// @ts-check
// What the components ask of the host application. Every method is optional but `structure`; a
// component leaves out what its adapter cannot answer.

/**
 * @typedef {import('../core/decompose.js').Sequence} Sequence
 *
 * @typedef {object} Swap A component that can stand in place of another (コ for 龴).
 * @property {string} char
 * @property {number} [count] How often the two are found in place of each other, shown as a hint.
 *
 * @typedef {object} Found A character a search found.
 * @property {string} char
 * @property {string} [label] What to show beside it (a reading, a name, a code point).
 *
 * @typedef {object} PalettePart A part of the parts palette.
 * @property {string} [variantGroup] Shared identity for adjacent palette variants; selection keeps the literal form.
 * @property {string[]} [aliases] Exact IDS spellings normalized to this encoded part.
 * @property {'basic' | 'compound' | 'other'} [sealGroup] Small Seal palette group.
 * @property {'selected' | 'seal-ids' | 'cjk-ids' | 'crosswalk' | 'unknown'} [sealBasis] Evidence for the palette grouping.
 * @property {string[]} [modern] Modern CJK correspondences for palette filtering.
 * @property {string[]} [modernIds] Modern IDS used for provisional grouping, never seal decompositions.
 * @property {string} part
 * @property {string} [display] What the palette shows in the cell when it is not `part` itself, such as a combining mark over a dotted circle.
 * @property {number} [uses] How many ideographs use it.
 * @property {number | null} [strokes]
 * @property {0 | 1} [derived] Whether the stroke count was derived, not read from Unihan.
 * @property {'横' | '豎' | '撇' | '點' | '折' | null} [first] The class of its first stroke.
 * @property {'c' | 't' | 'seal' | 'd' | 's' | 'extra'} kind Common (including frequent compound IDS), Tangut, Small Seal, difficult (hard to type) or a CJK stroke.
 *
 * @typedef {{ signal?: AbortSignal, limit?: number }} Options
 *
 * @typedef {import('../core/sketch-data.js').SketchTemplate} SketchTemplate A palette part as a drawing search sees it.
 *
 * @typedef {object} SketchLeaf Where the layout puts one leaf of a sequence, before it is drawn.
 * @property {number} index The leaf's place in reading order.
 * @property {number[]} box [x, y, width, height] in the drawing's 1000-unit box, y down.
 * @property {boolean} empty Whether the leaf is an empty slot (⬚).
 *
 * @typedef {object} DrawingPart One part of a drawing: a piece the composer placed.
 * @property {number} [leaf] Original IDS leaf index when the composer can preserve ownership through a rewrite.
 * @property {string} origin What the piece was drawn from, such as `glyph 木`, `learned 村`, `cells 木` or `mark ˊ` for a loose mark.
 * @property {number[]} box [x, y, width, height] in the drawing's 1000-unit box, y down.
 * @property {string} d The piece's ink as an SVG path, filled by the nonzero rule.
 * @property {boolean} [cut] Whether the piece is what ㇯ takes away, masked out of the drawing's `d`.
 *
 * @typedef {object} Drawing A sequence drawn as outlines in a 1000-unit box, y down.
 * @property {string} d The SVG path of its ink, filled by the nonzero rule.
 * @property {string} [cut] The path of what ㇯ takes away, masked out of `d`.
 * @property {{ index: number, box: number[] }[]} [slots] Each empty slot (⬚), numbered in reading order, in the box the layout gives it.
 * @property {{ text: string, box: number[], leaf?: number, part?: number, flip?: [boolean, boolean], cut?: boolean, restored?: boolean }[]} [emoji] Emoji positioned as text in the drawing; `cut` ones mask ink instead, `restored` ones are put back by a nested subtraction and take no mask.
 * @property {number[] | null} [stroke] The stroke widths across x and y the drawing is weighted to; placeholders take them.
 * @property {DrawingPart[]} [parts] Each drawn part, in reading order. A part may be several pieces; a cut piece is not ink.
 * @property {(string | null)[]} [transforms] One SVG transform per part in `parts`, as a view adjusted it; null where a part is unchanged. `drawingSvg` writes the parts separately when any is set.
 * @property {string[]} [approximate] Operators drawn by an approximation of their own.
 * @property {boolean} [cells] Whether the parts are drawn apart, one in each cell, instead of composed.
 * @property {boolean} [kanjivg] Whether a part was cut along KanjiVG's groups (its drawing is then shared alike under CC BY-SA 3.0).
 * @property {string[]} [missing] Characters the export has no glyph for, drawn from their sequences instead.
 *
 * @typedef {import('../core/search.js').Hit} IdsHit A character a description query found: the description it matched in and the spans matched.
 *
 * @typedef {Options & { onSketch?: (leaves: SketchLeaf[]) => void }} PreviewOptions
 *
 * @typedef {object} IdsAdapter
 * @property {(char: string, options?: Options) => Promise<import('./character-info.js').CharacterInfo | null>} [characterInfo] Sourced meanings and explicit correspondences for one character.
 * @property {'sans' | 'serif' | 'kaisho'} [fontStyle] Style for bundled component outlines.
 * @property {(char: string, options?: Options) => Promise<Sequence[]>} structure A character's descriptions, each with its source regions; a derived Tangut character-first description replaces its source description and is marked `derived`. A description may be a single distinct component; [] means no smaller parts are recorded.
 * @property {(part: string, options?: Options) => Promise<Swap[]>} [variants] Components that can stand in place of `part`.
 * @property {(query: string, options?: Options) => Promise<Found[]>} [search] Components and characters found by what is typed: a character, a code point, a name, a word or a reading.
 * @property {(sequence: string, options?: Options & { exact?: boolean }) => Promise<string[]>} [encoded] The encoded characters a whole description describes exactly; with `exact`, only the description with its operator modifiers, without the same description's modifiers dropped.
 * @property {(sequence: string, options?: Options) => Promise<string[]>} [overwrite] The encoded characters a whole description draws as, for a context-adapted variant (⿰𦚏𳳳 as 龍).

 * @property {(query: string, options?: Options & { componentLookup?: boolean }) => Promise<{ hits: IdsHit[], total: number, problem?: 'empty' | 'extra' | 'terms' }>} [findByIds] Characters a description query finds, closest first (see `createSearch` in the core); `componentLookup: false` searches a wildcard subtraction structurally.
 * @property {(text: string, options?: Options) => Promise<string | null>} [chainCharacter] The character a zi.tools description carrying a stroke chain names, when the host supplies that table.
 * @property {(query: string, options?: Options) => Promise<{ hits: IdsHit[], total: number }>} [findSimilar] Characters whose description shares the query's top-level shape with one operand free.
 * @property {(query: string, options?: Options) => Promise<{ hits: IdsHit[], total: number, characters: string, problem?: 'empty' | 'pattern' }>} [findByStructure] Whole-character IDS patterns; repeated A–Z letters bind equal components, ⬚ matches any part, | separates alternatives.
 * @property {(parts: string, options?: Options) => Promise<{ items: string[], more?: boolean }>} [containing] Characters built from every part in `parts` (counted: 木木 asks for two), best first.
 * @property {(options?: Options) => Promise<PalettePart[]>} [parts] The parts palette.
 * @property {(options?: Options) => Promise<SketchTemplate[]>} [sketchTemplates] The palette's glyph shapes for drawing search, prepared or built from the page's fonts.
 * @property {(sequence: string, options?: Options) => Promise<Drawing | null>} [icon] A compound palette icon. Must support concurrent requests independently of the editor preview; null leaves a font-based layout.
 * @property {(sequence: string, options?: Options) => Promise<string | null>} [drawing] The URL of a final image of a whole description, or null; it is shown in place of the preview.
 * @property {((sequence: string, options?: PreviewOptions) => Promise<Drawing>) & { warm?: (sequence?: string) => void }} [preview] A description drawn, empty slots (⬚) and all; `onSketch` hears where each part goes before the drawing is done. It rejects when it cannot draw, with an Error named `TooLargeError` for a description larger than it draws. `warm` starts the export's manifest and layout before the first drawing; it may be told the sequence being previewed.
 */

export {}
