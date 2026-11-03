// The files whose bytes decide what the preview renders. `audit_render_coverage.mjs` records their
// hashes in each report, and `check_coverage_freshness.mjs` compares those against the tree, so a
// report that describes an older build fails instead of being read as current. This file is listed
// among them: editing the list changes what a report says about its inputs. The drawing itself is
// the engine package's, so its sources are read where the package is installed.
import { readdir } from 'node:fs/promises'

export const COVERAGE_SOURCES = [
  'scripts/lib/coverage-sources.mjs',
  'scripts/audit_render_coverage.mjs',
  'src/core/ids.js',
  'src/core/unicode.js',
  'demo/lib/composer.js',
  'data/unicode-properties.json',
  'data/unicode-coverage.json',
  'data/bundled-coverage.json',
  'data/palette-fallback-characters.json',
]

/** Where the engine's own files are read, as the installed package holds them. */
const ENGINE = 'node_modules/@han-compose/composer/'

/** Every file whose bytes decide a drawing, sorted. @param {URL} root */
export async function coverageSources(root) {
  const composed = (await readdir(new URL(`${ENGINE}src/`, root)))
    .filter(name => /\.(js|json)$/.test(name))
    .map(name => `${ENGINE}src/${name}`)
  const tables = ['data/unicode/coverage.json', 'data/palette/bundled-coverage.json', 'data/palette/fallback-characters.json']
    .map(name => `${ENGINE}${name}`)
  return [...COVERAGE_SOURCES, ...composed, ...tables].sort()
}
