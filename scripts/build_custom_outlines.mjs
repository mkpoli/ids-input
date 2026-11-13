// Build data/custom-outlines.json.gz: the glyph GlyphWiki draws for each CHISE entity, as one SVG
// path in a 200-unit square, so a form no code point names can be shown where nothing composes it.
//
//   bun scripts/build_custom_outlines.mjs
//
// Each glyph is fetched once from glyphwiki.org and kept under cache/custom-outlines; a rebuild
// from a full cache asks for nothing. An entity GlyphWiki has no glyph for is left out.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'

const data = name => new URL(`../data/${name}`, import.meta.url)
const cache = new URL('../cache/custom-outlines/', import.meta.url)
await mkdir(cache, { recursive: true })

/**
 * The GlyphWiki name of a CHISE entity, or null where the two share no naming. CHISE writes a
 * variant as a prefix (`U-i001+864D`, `CDP-v005-88CB`), GlyphWiki as a suffix (`u864d-itaiji-001`,
 * `cdp-88cb-var-005`); an `A-` before a CHISE name marks the same glyph taken abstractly.
 * @param {string} entity The name without & and ;. @returns {string | null}
 */
export function glyphWikiName(entity) {
  const name = entity.replace(/^(?:A-|o-|g2-)/, '')
  let found
  if ((found = /^CDP-([0-9A-F]{4})$/.exec(name))) return `cdp-${found[1].toLowerCase()}`
  if ((found = /^CDP-([iv])(\d{3})-([0-9A-F]{4})$/.exec(name))) return `cdp-${found[3].toLowerCase()}-${found[1] === 'i' ? 'itaiji' : 'var'}-${found[2]}`
  if ((found = /^U-([iv])(\d{3})\+([0-9A-F]{4,6})$/.exec(name))) return `u${found[3].toLowerCase()}-${found[1] === 'i' ? 'itaiji' : 'var'}-${found[2]}`
  if ((found = /^(?:UU|IWDSU|compU|hanaJU)\+([0-9A-F]{4,6})$/.exec(name))) return `u${found[1].toLowerCase()}`
  if ((found = /^U-0*([0-9A-F]{4,6})$/.exec(name))) return `u${found[1].toLowerCase()}`
  if ((found = /^AJ1-(\d{5})$/.exec(name))) return `aj1-${found[1]}`
  if ((found = /^MJ(\d{6})$/.exec(name))) return `jmj-${found[1]}`
  if ((found = /^GT-(K?\d{5})$/.exec(name))) return `gt-${found[1].toLowerCase()}`
  if ((found = /^M-(\d{5})$/.exec(name))) return `dkw-${found[1]}`
  if ((found = /^CB(\d{5})$/.exec(name))) return `cbeta-${found[1]}`
  return null
}

/** An outline in a 200-unit square, as one path; '' where the glyph is empty. @param {string} svg */
function outline(svg) {
  const paths = []
  for (const match of svg.matchAll(/<polygon points="([^"]+)"/g)) {
    const numbers = match[1].trim().split(/[\s,]+/).map(Number)
    let d = ''
    for (let i = 0; i + 1 < numbers.length; i += 2) d += `${i ? 'L' : 'M'}${+numbers[i].toFixed(1)} ${+numbers[i + 1].toFixed(1)}`
    paths.push(d + 'Z')
  }
  for (const match of svg.matchAll(/<path d="([^"]+)"/g)) {
    paths.push(match[1].trim().replace(/-?\d+(?:\.\d+)?/g, number => String(+Number(number).toFixed(1))).replace(/\s*([MLZ])\s*/g, '$1'))
  }
  return paths.join('')
}

if (import.meta.main) {
  const doc = JSON.parse(gunzipSync(await readFile(data('custom-components.json.gz'))).toString('utf8'))
  /** @type {Record<string, string>} */ const names = {}
  /** @type {Record<string, string>} */ const outlines = {}
  let fetched = 0, missing = 0, unnamed = 0
  for (const row of doc.components) {
    if (row.kind !== 'entity') continue
    const name = glyphWikiName(row.text.slice(1, -1))
    if (name === null) { unnamed++; continue }
    const path = new URL(`${name}.svg`, cache)
    let svg = await readFile(path, 'utf8').catch(() => null)
    if (svg === null) {
      const response = await fetch(`https://glyphwiki.org/glyph/${name}.svg`, { headers: { 'user-agent': 'ids-outline-build' } })
      // A name GlyphWiki does not have is remembered as empty, so it is not asked for again.
      svg = response.ok ? await response.text() : response.status === 404 ? '' : null
      if (svg === null) throw new Error(`${name}: HTTP ${response.status}`)
      await writeFile(path, svg)
      fetched++
      await new Promise(done => setTimeout(done, 150))
    }
    const d = outline(svg)
    if (!d) { missing++; continue }
    names[row.text] = name
    outlines[name] ??= d
  }
  const stamp = new URL('fetched.txt', cache)
  if (fetched) await writeFile(stamp, new Date().toISOString().slice(0, 10))
  const date = (await readFile(stamp, 'utf8').catch(() => '')).trim()
  const out = {
    format: 'ids-input/custom-outlines', version: 1,
    source: {
      title: 'GlyphWiki', url: 'https://glyphwiki.org/', fetched: date,
      licence: 'GlyphWiki data and article license', licenceUrl: 'https://glyphwiki.org/wiki/GlyphWiki:データ・記事のライセンス',
      note: 'One glyph per CHISE entity, by the name the two share; GlyphWiki glyphs are edited by its users and may differ from the form CHISE means.',
    },
    counts: { entities: Object.keys(names).length, outlines: Object.keys(outlines).length, withoutGlyph: missing, withoutName: unnamed },
    names, outlines,
  }
  await writeFile(data('custom-outlines.json.gz'), gzipSync(JSON.stringify(out), { level: 9 }))
  console.log(JSON.stringify(out.counts), `fetched ${fetched}`)
}
