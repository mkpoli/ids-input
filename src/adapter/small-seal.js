// @ts-check
import { babelStoneAdapter } from './babelstone.js'
export { isSmallSeal } from './seal-data.js'

/**
 * CHISE Jiguge Small Seal data over the default adapter. All descriptions share one index,
 * so a mixed-script description can expand each component through its own structure.
 * `data` is the URL of `data/small-seal.json.gz` or its decoded JSON document.
 * The remaining options are the same as `babelStoneAdapter` (ids, parts, names, etc.).
 * @param {Omit<NonNullable<Parameters<typeof babelStoneAdapter>[0]>, 'smallSeal'> & { data: string | URL | import('./seal-data.js').SmallSealData }} options
 */
export function smallSealAdapter({ data, ...options }) {
  return babelStoneAdapter({ ...options, smallSeal: data })
}
