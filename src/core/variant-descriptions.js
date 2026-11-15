// @ts-check
// The description of each variation sequence of an ideograph, as `data/variant-descriptions.tsv.gz`
// holds them once decompressed: the sequences of the Ideographic Variation Database and the
// standardized ones of the CJK compatibility ideographs, each described from the glyph GlyphWiki
// registers for it.

/**
 * @typedef {object} VariantDescription
 * @property {string} description The sequence's description. A component's form is written as
 *   another character (⻌ for the 辶 of one dot), a variation sequence, a UCV form (曽q1874), a
 *   source letter after the component (曷J) or a reference to a GlyphWiki glyph (`&GW-…;`).
 * @property {'named' | 'composed' | 'placed' | 'drawn'} how `named`: GlyphWiki names the glyph by
 *   the description. `composed`: the glyph's components are the parts of a description the tables
 *   give the character. `placed`: they stand where such parts stand and differ from them. `drawn`:
 *   the glyph is drawn from strokes or its components fit no description, and the description is
 *   the character's, not the sequence's own.
 * @property {string} glyph The GlyphWiki glyph the description was read from.
 */

/**
 * @param {string} text The table: `sequence<TAB>description<TAB>how<TAB>glyph`, `#` lines its header.
 * @returns {Map<string, VariantDescription>} By sequence: the character and its selector.
 */
export function readVariantDescriptions(text) {
  /** @type {Map<string, VariantDescription>} */
  const table = new Map()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const [sequence, description, how, glyph] = line.split('\t')
    if (description) table.set(sequence, { description, how: /** @type {VariantDescription['how']} */ (how), glyph })
  }
  return table
}

/** Whether a description tells the sequence from its character: one read from the glyph's own
 * components. @param {VariantDescription | undefined} found */
export const isOwnDescription = found => Boolean(found) && found?.how !== 'drawn'
