// @ts-check
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
