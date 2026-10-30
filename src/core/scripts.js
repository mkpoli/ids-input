// Unicode Script grouping shared by the palette and its generated catalog.
import ranges from '../../data/script-ranges.json' with { type: 'json' }
import { isNewKorean, isShuishu, leaves, parse } from './ids.js'

/** @param {string} char @returns {string | null} */
export function characterScript(char) {
  const cp = char.codePointAt(0)
  if (cp === undefined) return null
  if (cp >= 0x3d000 && cp <= 0x3fc3f) return 'seal'
  if (isShuishu(char)) return 'shuishu'
  if (cp >= 0x31c0 && cp <= 0x31ef) return 'strokes'
  if (cp >= 0x30 && cp <= 0x39) return 'latin'
  if (isNewKorean(char)) return 'hangul'
  let lo = 0, hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, [first, last, script] = ranges[mid]
    if (cp < /** @type {number} */ (first)) hi = mid - 1
    else if (cp > /** @type {number} */ (last)) lo = mid + 1
    else {
      if (script === 'Zyyy' || script === 'Zinh') return null
      return /** @type {Record<string, string>} */ ({ Hani: 'han', Latn: 'latin', Cyrl: 'cyrillic', Hang: 'hangul', Bopo: 'bopomofo', Tang: 'tangut' })[/** @type {string} */ (script)] ?? /** @type {string} */ (script)
    }
  }
  return null
}

/** @param {string} part @returns {string | null} */
export function partScript(part) {
  const result = parse(part, { open: true })
  if (result.problem || result.tree === null) return null
  const scripts = new Set(leaves(result.tree).map(leaf => leaf.char && characterScript(leaf.char)).filter(Boolean))
  return scripts.size > 1 ? 'mixed' : /** @type {string | undefined} */ (scripts.values().next().value) ?? 'symbols'
}

/** Group host-supplied parts so they remain available even outside the bundled catalog.
 * @param {import('../adapter/types.js').PalettePart[]} parts
 * @returns {Map<string, import('../adapter/types.js').PalettePart[]>}
 */
export function groupPaletteParts(parts) {
  const groups = new Map()
  for (const part of parts) {
    const group = part.kind === 'seal' ? 'seal' : part.kind === 'shui' ? 'shuishu' : part.kind === 't' ? 'tangut' : part.kind === 's' ? 'strokes' : partScript(part.part)
    if (!group) continue
    const found = groups.get(group)
    if (found) found.push(part)
    else groups.set(group, [part])
  }
  return groups
}

// These groups already have palette views: Han, Latin and Cyrillic tabs, Hangul, Bopomofo, Tangut,
// Small Seal, Shuishu and the one-stroke Components group. Symbols and mixed-script descriptions have
// none, so the Other scripts selector carries them too.
const EXISTING_GROUPS = new Set(['han', 'latin', 'cyrillic', 'hangul', 'bopomofo', 'tangut', 'seal', 'shuishu', 'strokes'])
/** @param {string | null | undefined} group */
export const isOtherScript = group => Boolean(group && !EXISTING_GROUPS.has(group))
