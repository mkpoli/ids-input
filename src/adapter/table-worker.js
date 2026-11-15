// @ts-check
// What reads the description tables, in a Web Worker: the tables are downloaded, parsed and indexed
// once, off the page's thread. The first message is `{ files }`, the adapter's options that name
// files or carry their contents. Each later message `{ id, method, args }` calls that method of an
// adapter built over those files and answers `{ id, result }` or `{ id, error }`.
import { babelStoneAdapter } from './babelstone.js'
import { turn } from '../core/search.js'

/** @type {Record<string, (...args: any[]) => Promise<unknown>> | null} */
let adapter = null
/** When the last question arrived. */
let asked = -Infinity
/** How long after a question the index build stands aside, in milliseconds. */
const QUIET = 4
/**
 * Between two slices of the search index's build: a turn of the event loop, and then for as long as
 * questions keep arriving. A caller that asks one thing after another, each on the answer before,
 * would otherwise be answered once a slice.
 */
const pause = async () => {
  await turn()
  while (performance.now() - asked < QUIET) await new Promise(resolve => setTimeout(resolve, QUIET))
}

/**
 * The answer to one message, or nothing for the message that names the files.
 * @param {{ files?: Parameters<typeof babelStoneAdapter>[0], id?: number, method?: string, args?: unknown[] }} message
 * @returns {Promise<{ id: number | undefined, result?: unknown, error?: string } | null>}
 */
export async function answer({ files, id, method = '', args = [] }) {
  if (files) {
    adapter = /** @type {any} */ (babelStoneAdapter({ ...files, worker: null, pause }))
    return null
  }
  asked = performance.now()
  try {
    if (!adapter) throw new Error('The table worker was asked before it was given its files.')
    return { id, result: await adapter[method](...args) }
  } catch (error) { return { id, error: String(/** @type {Error} */ (error)?.message ?? error) } }
}

self.onmessage = async ({ data }) => {
  const reply = await answer(data)
  if (reply) self.postMessage(reply)
}
