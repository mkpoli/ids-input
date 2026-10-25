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
 * @property {'c' | 'd' | 's'} kind Common, difficult (hard to type) or a CJK stroke.
 *
 * @typedef {{ signal?: AbortSignal, limit?: number }} Options
 *
 * @typedef {object} IdsAdapter
 * @property {(char: string, options?: Options) => Promise<Sequence[]>} structure A character's descriptions, each with its source regions; [] for one that has no smaller parts.
 * @property {(part: string, options?: Options) => Promise<Swap[]>} [variants] Components that can stand in place of `part`.
 * @property {(query: string, options?: Options) => Promise<Found[]>} [search] Components found by what is typed: a character, a code point, a name or a reading.
 * @property {(parts: string, options?: Options) => Promise<{ items: string[], more?: boolean }>} [containing] Characters built from every part in `parts` (counted: 木木 asks for two), best first.
 * @property {(options?: Options) => Promise<PalettePart[]>} [parts] The parts palette.
 * @property {(sequence: string, options?: Options) => Promise<string | null>} [drawing] The URL of an image of a whole description, or null.
 * @property {(sequence: string, options?: Options) => Promise<string | null>} [preview] SVG markup drawing a whole description, or null. The markup is inserted as given, so it must come from a source the host trusts.
 */

export {}
