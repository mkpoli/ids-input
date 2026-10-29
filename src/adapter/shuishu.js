// @ts-check
import { babelStoneAdapter } from './babelstone.js'
export { isShuishu, shuishuLabel, shuishuNames } from './shuishu-data.js'

/**
 * Shuishu characters over the default adapter: the proposed block as palette parts, findable by
 * their names, readings and meanings. `data` is the URL of `data/shuishu.json.gz` or its decoded
 * JSON document. The remaining options are the same as `babelStoneAdapter` (ids, parts, names, etc.).
 * @param {Omit<NonNullable<Parameters<typeof babelStoneAdapter>[0]>, 'shuishu'> & { data: string | URL | import('./shuishu-data.js').ShuishuData }} options
 */
export function shuishuAdapter({ data, ...options }) {
  return babelStoneAdapter({ ...options, shuishu: data })
}
