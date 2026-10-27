// @ts-check
import { isSequence } from './ids.js'
/** Keep variant families adjacent, anchored at their first existing position.
 * The caller supplies one visible group, so stroke counts and filters remain exact.
 * @param {import('../adapter/types.js').PalettePart[]} parts
 */
export function adjacentVariants(parts) {
  /** @type {Map<string, import('../adapter/types.js').PalettePart[]>} */
  const families = new Map()
  for (const part of parts) {
    const key = part.variantGroup ?? part.part
    const family = families.get(key)
    if (family) family.push(part)
    else families.set(key, [part])
  }
  return [...families.values()].flat()
}

/** Find exact parts and descriptions containing a query in one script's catalog.
 * A code-point query asks for exactly one character.
 * @param {string[]} keys
 * @param {string} text
 * @param {boolean} [exact]
 */
export function matchScriptParts(keys, text, exact = false) {
  const chars = new Set([...text]), description = isSequence(text)
  return keys.filter(part => part === text || !exact && (isSequence(part) && part.includes(text) || !description && chars.has(part)))
}
