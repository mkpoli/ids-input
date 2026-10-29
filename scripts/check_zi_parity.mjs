// How our answer for a published description compares with zi.tools' own.
//
//   bun scripts/check_zi_parity.mjs              a summary by notation
//   bun scripts/check_zi_parity.mjs --json       the same numbers as JSON
//   bun scripts/check_zi_parity.mjs --sample 4   four descriptions of each notation
//
// The table is the one `build_yi_bai_ids.mjs` compiles, at the same revision and hash-checked.
// Each sampled description is resolved the way the workshop resolves it: a stroke chain through
// `data/zi-tools-chains.tsv.gz`, anything else through the adapter's `encoded`, which reads the
// bundled BabelStone and Yi Bai tables. zi.tools is asked for the character its `lookupidsasync`
// names. A description the service answers nothing for — its endpoint returns no level-1 entry for
// note-bearing text — is counted apart from a disagreement. The exit code is 1 when an answered
// description disagrees.
//
// The check needs the network; the offline measurement is `bun scripts/audit_zi_ids.mjs`.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { babelStoneAdapter, parseIdsTable } from '../src/adapter/index.js'
import { chainCharacter, readChainEntries } from '../src/core/chain-entries.js'
import { notation, sequences } from './lib/ids-notation.mjs'

const revision = 'da1e9f8a09e2ec8faaf176bac99203f978282041'
const expected = '51f78d7d84f52fd73e5bc155c2239b737c58ce627d446894a809f1a36547ae18'
const api = 'https://zi.tools/api/ids/lookupidsasync/'
const asked = process.argv.indexOf('--sample')
const sample = asked > 0 ? Number(process.argv[asked + 1]) : 6
if (!Number.isInteger(sample) || sample <= 0) throw new Error('--sample takes a positive count')

const response = await fetch(`https://raw.githubusercontent.com/yi-bai/ids/${revision}/ids_lv1.txt`)
if (!response.ok) throw new Error(`Yi Bai IDS: HTTP ${response.status}`)
const bytes = Buffer.from(await response.arrayBuffer())
if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Yi Bai IDS: unexpected source hash')

const read = file => gunzipSync(readFileSync(new URL(`../data/${file}`, import.meta.url))).toString()
const table = new Map([...parseIdsTable(read('babelstone-ids.tsv.gz')), ...parseIdsTable(read('yi-bai-ids.tsv.gz'))])
const adapter = babelStoneAdapter({ table, worker: null })
const chains = readChainEntries(read('zi-tools-chains.tsv.gz'))

/** @param {string} text @returns {Promise<string[]>} */
const ours = async text => text.includes('#(')
  ? [chainCharacter(chains, text)].filter(char => char !== null)
  : adapter.encoded(text)

/** The characters the service names for a description, or null when it answers none.
 *  @param {string} text @returns {Promise<string[] | null>} */
const theirs = async text => {
  const response = await fetch(api + encodeURIComponent(text) + '?replace_token', { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!response.ok) return null
  const value = (await response.json())[text]
  const level = value?.lv1
  if (!level) return null
  return [level.id, ...(level.match_u_list ?? level.match_list ?? [])].filter(Boolean)
}

/** Every `sample`-th description of a notation, so one run compares the same texts each time.
 *  @param {string[]} list @param {number} count @returns {string[]} */
const evenly = (list, count) => Array.from({ length: Math.min(count, list.length) },
  (_, index) => /** @type {string} */ (list[Math.floor((index + 0.5) * list.length / count)]))

/** @type {Map<string, string[]>} */
const byNotation = new Map()
for (const text of new Set(sequences(bytes.toString('utf8')))) {
  const key = notation(text)
  byNotation.set(key, [...(byNotation.get(key) ?? []), text])
}
const order = ['plain', 'note', 'modifier', 'chain', 'note+modifier', 'note+chain', 'modifier+chain', 'note+modifier+chain']
const picked = order.flatMap(key => evenly(byNotation.get(key) ?? [], sample).map(text => ({ text, key })))

/** @type {{ notation: string, text: string, ours: string[], theirs: string[] | null, agree: boolean }[]} */
const results = []
for (const { text, key } of picked) {
  const mine = await ours(text)
  const theirAnswers = await theirs(text)
  await new Promise(resolve => setTimeout(resolve, 300))
  results.push({ notation: key, text, ours: mine, theirs: theirAnswers,
    agree: theirAnswers !== null && theirAnswers[0] === mine[0] })
}

const summary = order.filter(key => results.some(result => result.notation === key)).map(key => {
  const rows = results.filter(result => result.notation === key)
  return { notation: key, compared: rows.filter(row => row.theirs !== null).length,
    agree: rows.filter(row => row.agree).length, unanswered: rows.filter(row => row.theirs === null).length,
    disagree: rows.filter(row => row.theirs !== null && !row.agree) }
})
const compared = results.filter(result => result.theirs !== null)
const agree = compared.filter(result => result.agree).length
const unanswered = results.length - compared.length
const mismatches = compared.filter(result => !result.agree)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ revision, sample, compared: compared.length, agree, unanswered, byNotation: summary, mismatches }, null, 2))
} else {
  console.log(`zi.tools parity, ${revision}, up to ${sample} descriptions per notation`)
  for (const row of summary) {
    console.log(`  ${row.notation.padEnd(20)} ${String(row.agree).padStart(3)} / ${String(row.compared).padStart(3)} agree, ${row.unanswered} unanswered`)
  }
  console.log(`${agree} of ${compared.length} answered descriptions agree; ${unanswered} the service did not answer.`)
  for (const row of mismatches) console.log(`  ${row.text}: ours ${row.ours.join(' ')} · zi.tools ${(row.theirs ?? []).join(' ')}`)
}
if (mismatches.length) process.exit(1)
