// @ts-nocheck: the same exported glyph records and source interface as loader.js.
// Tangut outlines ship with the package. Pure Tangut compositions use the composer's geometric
// layout; mixed descriptions also read Han records and layout from the host's export.
import constants from './constants.json' with { type: 'json' }
import { leaves, parse } from '../core/ids.js'
import { unpack } from './loader.js'

export const hasTangut = text => /[\u{17000}-\u{18AFF}\u{18D00}-\u{18DFF}]/u.test(text)
export const onlyTangut = sequence => {
  const result = parse(sequence, { open: true })
  return !result.problem && hasTangut(sequence) && leaves(result.tree).every(({ char }) => char === null || hasTangut(char))
}

const loadOutlines = async () => {
  const response = await fetch(new URL('../../data/tangut-outlines.json.gz', import.meta.url))
  if (!response.ok) throw new Error(`Tangut outlines: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}

export function tangutSource({ load = loadOutlines, fallback = null } = {}) {
  let ready = null, records = null
  const source = {
    manifest: null, layout: null,
    ready() {
      return ready ??= Promise.all([load(), fallback?.ready()]).then(([data]) => {
        records = data.records
        source.manifest = fallback?.manifest ?? { constants, spelled: [] }
        source.layout = fallback?.layout ?? null
      }).catch(error => { ready = null; throw error })
    },
    load: names => fallback ? fallback.load(names) : Promise.resolve(),
    filesOf: keys => fallback ? fallback.filesOf(keys.filter(key => !hasTangut(key))) : new Set(),
    store() {
      const remote = fallback?.store()
      return {
        manifest: source.manifest, layout: source.layout, missing: remote?.missing ?? new Set(),
        rec: key => hasTangut(key) ? records[key] ?? null : remote?.rec(key) ?? null,
        hosts: (key, place) => hasTangut(key) ? [] : remote?.hosts(key, place) ?? [],
        places: key => hasTangut(key) ? [] : remote?.places(key) ?? [],
      }
    },
  }
  return source
}
