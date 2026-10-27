// Shapes, not pitch assignments: conventions differ between musical traditions.
export const NOTES = [...'合四一上尺工凡六五乙']
export const REGIONAL_NOTES = [...'士反乂']
export const MODIFIERS = ['', '亻', '彳', '⿱𰀪亻', '氵', '⿰氵氵']
// Exact root decompositions in the pinned BabelStone corpus. A shape match
// identifies an encoded character; it does not attest its use as a musical note.
export const ENCODED = {
  '⿰亻乙':'亿', '⿰亻士':'仕', '⿰亻工':'仜', '⿰亻上':'仩', '⿰亻反':'仮', '⿰亻五':'伍',
  '⿰亻尺':'伬', '⿰亻四':'伵', '⿰亻合':'佮', '⿰氵凡':'汎', '⿰氵工':'江', '⿰氵反':'汳',
  '⿰氵尺':'沢', '⿰氵四':'泗', '⿰氵合':'洽', '⿰彳尺':'鿈', '⿰彳五':'鿉', '⿰彳合':'㣛',
  '⿰氵乙':'㲸', '⿰氵乂':'㲼', '⿰亻凡':'𠆩', '⿰亻六':'𠆾', '⿰彳乙':'𢒼', '⿰彳工':'𢓁',
  '⿰彳反':'𢓉', '⿰彳六':'𢓌', '⿰亻乂':'𪜧', '⿰亻一':'𫢅', '⿰氵上':'𰛈',
  '⿰彳上':'𱝫', '⿰彳凡':'𱝬',
}
export function notation(note, modifier = '') {
  if (![...NOTES, ...REGIONAL_NOTES].includes(note) || !MODIFIERS.includes(modifier)) return null
  const sequence = modifier ? `⿰${modifier}${note}` : note
  const char = modifier ? ENCODED[sequence] ?? '' : note
  return { note, modifier, sequence, char, codepoint: char ? `U+${char.codePointAt(0).toString(16).toUpperCase()}` : '' }
}
export function selectionFrom(search) {
  const params = new URLSearchParams(search)
  return notation(params.get('note'), params.get('part') ?? '') ?? notation('工', '⿰氵氵')
}
export function selectionUrl(selection, href) {
  const url = new URL(href)
  url.searchParams.set('note', selection.note)
  url.searchParams.set('part', selection.modifier)
  url.hash = ''
  return url.href
}
