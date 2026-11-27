// Unicode StandardizedVariants.txt, CJK compatibility ideographs. Preserve the
// glyph before NFC folds the character in a stored IDS.
import sequences from '../../data/compatibility-sequences.json' with { type: 'json' }

/** @param {string} text */
export const compatibilitySequences = text => text.replace(/[\uF900-\uFAFF\u{2F800}-\u{2FA1F}]/gu,
  char => /** @type {Record<string, string>} */ (sequences)[char] ?? char)
