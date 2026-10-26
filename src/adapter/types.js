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
 * @property {string} part
 * @property {number} [uses] How many ideographs use it.
 * @property {number | null} [strokes]
 * @property {0 | 1} [derived] Whether the stroke count was derived, not read from Unihan.
 * @property {'横' | '豎' | '撇' | '點' | '折' | null} [first] The class of its first stroke.
 * @property {'c' | 't' | 'd' | 's'} kind Common, Tangut, difficult (hard to type) or a CJK stroke.
 *
 * @typedef {{ signal?: AbortSignal, limit?: number }} Options
 *
 * @typedef {object} SketchLeaf Where the layout puts one leaf of a sequence, before it is drawn.
 * @property {number} index The leaf's place in reading order.
 * @property {number[]} box [x, y, width, height] in the drawing's 1000-unit box, y down.
 * @property {boolean} empty Whether the leaf is an empty slot (⬚).
 *
 * @typedef {object} DrawingPart One part of a drawing: a piece the composer placed.
 * @property {string} origin What the piece was drawn from, such as `glyph 木` or `learned 村`.
 * @property {number[]} box [x, y, width, height] in the drawing's 1000-unit box, y down.
 * @property {string} d The piece's ink as an SVG path, filled by the nonzero rule.
 * @property {boolean} [cut] Whether the piece is what ㇯ takes away, masked out of the drawing's `d`.
 *
 * @typedef {object} Drawing A sequence drawn as outlines in a 1000-unit box, y down.
 * @property {string} d The SVG path of its ink, filled by the nonzero rule.
 * @property {string} [cut] The path of what ㇯ takes away, masked out of `d`.
 * @property {{ index: number, box: number[] }[]} [slots] Each empty slot (⬚), numbered in reading order, in the box the layout gives it.
 * @property {number[] | null} [stroke] The stroke widths across x and y the drawing is weighted to; placeholders take them.
 * @property {DrawingPart[]} [parts] Each drawn part, in reading order. A part may be several pieces; a cut piece is not ink.
 * @property {(string | null)[]} [transforms] One SVG transform per part in `parts`, as a view adjusted it; null where a part is unchanged. `drawingSvg` writes the parts separately when any is set.
 * @property {string[]} [approximate] Operators drawn by an approximation of their own.
 * @property {boolean} [kanjivg] Whether a part was cut along KanjiVG's groups (its drawing is then shared alike under CC BY-SA 3.0).
 *
 * @typedef {import('../core/search.js').Hit} IdsHit A character a description query found: the description it matched in and the spans matched.
 *
 * @typedef {Options & { onSketch?: (leaves: SketchLeaf[]) => void }} PreviewOptions
 *
 * @typedef {object} IdsAdapter
 * @property {(char: string, options?: Options) => Promise<Sequence[]>} structure A character's descriptions, each with its source regions; [] for one that has no smaller parts.
 * @property {(part: string, options?: Options) => Promise<Swap[]>} [variants] Components that can stand in place of `part`.
 * @property {(query: string, options?: Options) => Promise<Found[]>} [search] Components found by what is typed: a character, a code point, a name, a word or a reading.
 * @property {(sequence: string, options?: Options) => Promise<string[]>} [encoded] The encoded characters a whole description describes exactly.
 * @property {(query: string, options?: Options) => Promise<{ hits: IdsHit[], total: number, problem?: 'empty' | 'extra' | 'terms' }>} [findByIds] Characters a description query finds, closest first (see `createSearch` in the core).
 * @property {(parts: string, options?: Options) => Promise<{ items: string[], more?: boolean }>} [containing] Characters built from every part in `parts` (counted: 木木 asks for two), best first.
 * @property {(options?: Options) => Promise<PalettePart[]>} [parts] The parts palette.
 * @property {(sequence: string, options?: Options) => Promise<string | null>} [drawing] The URL of a final image of a whole description, or null; it is shown in place of the preview.
 * @property {((sequence: string, options?: PreviewOptions) => Promise<Drawing>) & { warm?: (sequence?: string) => void }} [preview] A description drawn, empty slots (⬚) and all; `onSketch` hears where each part goes before the drawing is done. It rejects when it cannot draw, with an Error named `TooLargeError` for a description larger than it draws. `warm` starts the export's manifest and layout before the first drawing; it may be told the sequence being previewed.
 */

export {}
