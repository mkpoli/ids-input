// @ts-check
import { babelStoneAdapter } from './babelstone.js'
export { isJurchen, jurchenLabel, jurchenMatches, jurchenNames, jurchenSequences, jurchenTable } from './jurchen-data.js'

/**
 * Jurchen characters over the default adapter: Unicode's block as palette parts, findable by stroke
 * code, reading, numeric value and code point. `data` is the URL of `data/jurchen.json.gz` or its
 * decoded contents.
 * @param {Omit<NonNullable<Parameters<typeof babelStoneAdapter>[0]>, 'jurchen'> & { data: string | URL | import('./jurchen-data.js').JurchenData }} options
 */
export function jurchenAdapter({ data, ...options }) {
  return babelStoneAdapter({ ...options, jurchen: data })
}
