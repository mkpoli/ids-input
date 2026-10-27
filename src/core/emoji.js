// @ts-check
// Segment emoji sequences without merging adjacent ideographs or other IDS operands.
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u
/** @param {string} text */
export function emojiPrefix(text) {
  const segment = segmenter.segment(text)[Symbol.iterator]().next().value?.segment ?? ''
  return EMOJI.test(segment) ? segment : ''
}
