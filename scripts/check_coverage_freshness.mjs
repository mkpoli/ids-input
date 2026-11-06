// Fail when a committed coverage report was rendered from a different tree.
// bun scripts/check_coverage_freshness.mjs
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { coverageSources } from './lib/coverage-sources.mjs'

const root = new URL('../', import.meta.url)
const styles = ['sans', 'serif', 'fangsong', 'klee']
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

const names = await coverageSources(root)
const current = Object.fromEntries(await Promise.all(
  names.map(async name => [name, digest(await readFile(new URL(name, root)))]),
))

let stale = 0
for (const style of styles) {
  const report = JSON.parse(await readFile(new URL(`docs/coverage/${style}.json`, root)))
  const recorded = report.implementationHashes ?? {}
  const changed = names.filter(name => recorded[name] !== current[name])
  const dropped = Object.keys(recorded).filter(name => !(name in current))
  if (!changed.length && !dropped.length) continue
  stale++
  console.error(`${style}: docs/coverage/${style}.json describes an older tree`)
  for (const name of changed) console.error(`  ${recorded[name] ? 'changed' : 'unrecorded'}  ${name}`)
  for (const name of dropped) console.error(`  dropped    ${name}`)
}

if (stale) {
  console.error(`\n${stale} of ${styles.length} reports are stale. Re-render each style:`)
  console.error('  bun scripts/audit_render_coverage.mjs CACHE_DIR docs/coverage/sans.json sans')
  console.error('  bun scripts/audit_render_coverage.mjs CACHE_DIR docs/coverage/serif.json serif')
  console.error('  bun scripts/audit_render_coverage.mjs CACHE_DIR docs/coverage/fangsong.json fangsong')
  console.error('  bun scripts/audit_render_coverage.mjs CACHE_DIR docs/coverage/klee.json klee')
  process.exit(1)
}
console.log(`coverage reports describe this tree (${styles.length} styles, ${names.length} sources)`)
