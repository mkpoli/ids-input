// The index a share card names its character from: an IDS to the character it describes.

/**
 * BabelStone's table first, then the editorial descriptions of the scripts it leaves out. A row such
 * as `鎶\t⿰釒哥(GTJV)` is 鎶 under ⿰釒哥; it may list several descriptions, each followed by the regions
 * that record it, and the first character listed for a description stays its own.
 * @param {string} table
 * @param {{ parts: { part: string, ids?: string | null }[] }[]} editorial
 * @returns {{ index: Record<string, string>, rows: number }}
 */
export function buildIdsIndex(table, editorial = []) {
  /** @type {Record<string, string>} */
  const index = {}
  let rows = 0
  for (const line of table.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const [char, written] = line.split('\t')
    if (!char || !written) continue
    rows++
    for (const listed of written.split(' ')) {
      const ids = listed.replace(/\([A-Z]+\)$/, '')
      if (ids) index[ids] ??= char
    }
  }
  for (const { parts } of editorial) for (const { part, ids } of parts) if (ids) index[ids] ??= part
  return { index, rows }
}
