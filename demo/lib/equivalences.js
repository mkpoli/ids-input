// The two sides a reader types in the equivalence appendix. A number can be written `{7}`, `7` or
// `bsp:7`; an entity `CDP-8BD0`, `&CDP-8BD0;` or `chise:CDP-8BD0`; a character as itself or `ucs:53C0`.
// The page accepts a reader's own pairs even where the corpus records none.

/** @param {string} text @returns {string | null} The cid the text names, or null. */
export function parseSide(text) {
  const value = text.trim()
  if (!value) return null
  const braced = /^\{(\d+)\}$/.exec(value)
  if (braced) return `bsp:${Number(braced[1])}`
  if (/^\d+$/.test(value)) return `bsp:${Number(value)}`
  const entity = /^&([A-Za-z0-9_.+-]+);$/.exec(value)
  if (entity) return `chise:${entity[1]}`
  const cid = /^(bsp|chise|ucs):(.+)$/i.exec(value)
  if (cid) {
    const [scheme, rest] = [cid[1].toLowerCase(), cid[2].trim()]
    if (scheme === 'bsp' && /^\d+$/.test(rest)) return `bsp:${Number(rest)}`
    if (scheme === 'chise' && /^[A-Za-z0-9_.+-]+$/.test(rest)) return `chise:${rest}`
    if (scheme === 'ucs' && /^[0-9A-Fa-f]{1,6}$/.test(rest)) {
      const point = Number.parseInt(rest, 16)
      if (point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)) return `ucs:${rest.toUpperCase()}`
    }
    return null
  }
  if (/^(?=.*[-_.+])[A-Za-z][A-Za-z0-9_.+-]*$/.test(value)) return `chise:${value}`
  const chars = [...value]
  return chars.length === 1 ? `ucs:${(chars[0].codePointAt(0) ?? 0).toString(16).toUpperCase()}` : null
}

/** A pair in the order the table stores it. @param {string} a @param {string} b @returns {[string, string] | null} */
export function parsePair(a, b) {
  const one = parseSide(a), two = parseSide(b)
  return one && two && one !== two ? [one, two].sort() : null
}

/** The pairs in an exported file: an array, or an object with `rows`; each row an object or an
 * array. `@param {any} parsed @returns {{ a: string, b: string, note: string }[]}` */
export function importPairs(parsed) {
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : null
  if (!list) throw new Error('no rows')
  /** @type {{ a: string, b: string, note: string }[]} */
  const rows = []
  for (const item of list) {
    const [a, b, note] = Array.isArray(item)
      ? [item[0], item[1], item[2]]
      : [item?.a, item?.b, item?.note]
    const pair = parsePair(String(a ?? ''), String(b ?? ''))
    if (!pair) continue
    const [one, two] = pair
    if (!rows.some(row => row.a === one && row.b === two)) rows.push({ a: one, b: two, note: String(note ?? '') })
  }
  return rows
}
