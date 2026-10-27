// @ts-check
// The default adapter: BabelStone IDS from a compact table, and the parts palette, read from URLs the
// host serves (all ship in this package's `data/`). Nothing is asked of a server beyond those files.
import { createRelationSearch } from './character-relations.js'
import { createCharacterInfo, componentExamples, tangutGlossSource } from './character-info.js'
import { sealTable, sealNames, sealForms, isSmallSeal } from './seal-data.js'
import { componentIndex } from './containing.js'
import { createSearch, readForms, readStructuralForms } from '../core/search.js'
import { createNameSearch, readFolds, readNames } from '../core/names.js'
import { unicodeProperty } from '../core/unicode.js'
import { isComponent, isSequence, parse, write } from '../core/ids.js'

/**
 * @typedef {import('./types.js').IdsAdapter} IdsAdapter
 * @typedef {import('./types.js').PalettePart} PalettePart
 * @typedef {import('../core/decompose.js').Sequence} Sequence
 */

const REGIONS = /\(([^)]*)\)$/
/** A CJK or Tangut character, the characters a mixed query may name as components. */
const IDEOGRAPH = /[\p{Ideographic}\p{Radical}\u2E80-\u2FFF\u31C0-\u31EF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u{17000}-\u{18DFF}\u{20000}-\u{3FFFD}]/u
const KANA = /[\u3041-\u30FF\u31F0-\u31FF\uFF66-\uFF9F\u{1AFF0}-\u{1AFFF}\u{1B000}-\u{1B12F}\u{1B132}\u{1B150}-\u{1B152}\u{1B155}\u{1B164}-\u{1B168}]/u
/** The scripts a mixed query may name as components: ideographs, kana and Bopomofo. */
const SCRIPT = /[\p{Ideographic}\p{Radical}\u2E80-\u2FFF\u3041-\u30FF\u3100-\u312F\u31A0-\u31BF\u31C0-\u31EF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F\u{17000}-\u{18DFF}\u{1AFF0}-\u{1AFFF}\u{1B000}-\u{1B12F}\u{1B132}\u{1B150}-\u{1B152}\u{1B155}\u{1B164}-\u{1B168}\u{20000}-\u{3FFFD}]/u

/**
 * The table `data/babelstone-ids.tsv.gz` holds, once decompressed: char → its descriptions with
 * their source regions. Lines starting with `#` are its header.
 * @param {string} text
 * @returns {Map<string, Sequence[]>}
 */
export function parseIdsTable(text) {
  /** @type {Map<string, Sequence[]>} */
  const table = new Map()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    table.set(line.slice(0, tab), line.slice(tab + 1).split(' ').filter(Boolean).map(written => {
      const match = REGIONS.exec(written)
      return match ? { text: written.slice(0, match.index), regions: match[1] } : { text: written, regions: '' }
    }))
  }
  return table
}

/** Combine descriptions without changing either source's region tags.
 * @param {Map<string, Sequence[]>} base @param {Map<string, Sequence[]>} extra */
export function mergeIdsTables(base, extra) {
  const merged = new Map(base)
  for (const [char, descriptions] of extra) {
    const first = base.get(char) ?? []
    const seen = new Set(first.map(item => `${item.text}\0${item.regions ?? ''}`))
    const texts = new Set(first.map(item => item.text))
    const added = descriptions.filter(item => {
      const key = `${item.text}\0${item.regions ?? ''}`
      if (seen.has(key) || (!item.regions && texts.has(item.text))) return false
      seen.add(key); texts.add(item.text); return true
    })
    if (added.length) merged.set(char, [...first, ...added])
  }
  return merged
}

/**
 * The palette file's rows as objects.
 * @param {{ columns: string[], parts: unknown[][], subtrees?: { encoded?: Record<string, string>, sourceAliases?: Record<string, string[]> } }} document
 * @returns {PalettePart[]}
 */
export const paletteRows = ({ columns, parts, subtrees }) => parts.map(row => {
  const part = /** @type {PalettePart} */ (Object.fromEntries(columns.map((name, i) => [name, row[i]])))
  const aliases = [...new Set([
    ...Object.entries(subtrees?.encoded ?? {}).filter(([, encoded]) => encoded === part.part).map(([ids]) => ids),
    ...(subtrees?.sourceAliases?.[part.part] ?? []),
  ])]
  if (aliases.length) part.aliases = aliases
  return part
})

/**
 * A response's text, gunzipped when it is a gzip file served as it is (as GitHub Pages serves a
 * `.gz`); a server that sent it with `Content-Encoding: gzip` has already decoded it.
 * @param {Response} response
 */
export async function readText(response) {
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/** Components the forms table folds that the names keep apart. */
const SEPARATE = new Set(['斗', '鬥'])
// Contextual search substitutions do not make these independent characters
// palette variants (田/由/甲/申/电, 己/已/巳, 用/甩, 手/才, 刀/刁, 幺/乡).
const PALETTE_SEPARATE = new Set([...SEPARATE, ...'由甲申电甴己已巳甩才刁乡'])

/** @param {string} char */
const codePoint = char => `U+${/** @type {number} */ (char.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`

/**
 * An adapter over BabelStone IDS. `ids` is the URL of `data/babelstone-ids.tsv.gz` (or of the same
 * table uncompressed), `parts` of `data/ids-parts.json`; each is fetched once, when first needed.
 * `additionalIds` is an optional second table in the same format; new descriptions follow the first
 * table's descriptions. Duplicate untagged descriptions are omitted; distinct region tags are kept.
 * `table` and `palette` hand the data over directly instead. `forms` is the URL of
 * `data/component-forms.tsv` (or `formsText` its text), which the description search folds
 * components by and the component search opens the names of a component's other forms with.
 * `names` is the URL of `data/component-names.tsv` (or `namesText` its text), the names, words and
 * readings the component search knows (絞絲, ノ文, のぎ, 宝盖, water, shui, mizu); without it the
 * search still takes characters and code points. `folds` is the URL of
 * `data/component-name-folds.tsv` (or `foldsText` its text), which folds Chinese scripts and
 * component forms together before a name is compared. The description search (`findByIds`) runs in
 * a Web Worker made by `worker` where there is one, its index built there once; elsewhere it runs
 * on the caller's thread. `smallSeal` adds the compiled CHISE Small Seal document to the
 * same table and palette; its modern correspondences supply search labels and character information.
 * @param {{ ids?: string | URL, additionalIds?: string | URL, parts?: string | URL, forms?: string | URL, formsText?: string, names?: string | URL, namesText?: string,
 *   folds?: string | URL, foldsText?: string, characters?: string | URL, charactersText?: string,
 *   charactersRare?: string | URL, charactersRareText?: string, characterInfo?: string | URL | import('./character-info.js').CharacterInfoData,
 *   table?: Map<string, Sequence[]>, palette?: PalettePart[], fetch?: typeof fetch,
 *   smallSeal?: string | URL | import('./seal-data.js').SmallSealData,
 *   worker?: (() => Worker) | null }} options
 * @returns {IdsAdapter & { table: () => Promise<Map<string, Sequence[]>> }}
 */
export function babelStoneAdapter({ ids, additionalIds, parts, forms, formsText, names, namesText, folds, foldsText, characters, charactersText, charactersRare, charactersRareText, characterInfo, smallSeal, table: given, palette: givenPalette, fetch: get = globalThis.fetch.bind(globalThis),
  worker = typeof Worker === 'undefined' || !ids ? null : () => new Worker(new URL('./search-worker.js', import.meta.url), { type: 'module' }) } = {}) {
  /** @type {Promise<Map<string, Sequence[]>> | null} */
  let table = null
  /** @type {Promise<PalettePart[]> | null} */
  let palette = null
  /** @type {ReturnType<typeof componentIndex> | null} */
  let index = null
  /** @type {Promise<{by: Map<string, string[]>, prefixes: Set<string>}> | null} */
  let described = null
  /** @type {Promise<ReturnType<typeof createSearch>> | null} */
  let local = null
  /** @type {Worker | null} */
  let searcher = null
  /** @type {Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>} */
  const asked = new Map()
  let asks = 0
  /** The description search on this thread, over the table and the forms. */
  const localSearch = () => local ??= Promise.all([read(), formsText !== undefined ? formsText : forms ? load(forms).then(r => r.text()) : '', readSeal()]).then(([found, text, doc]) =>
    createSearch(new Map([...found].map(([char, sequences]) => [char, sequences.map(s => s.text)])), { forms: sealForms(text, doc), structuralForms: readStructuralForms(text) })).catch(error => { local = null; throw error })
  /** The description search in the worker, which loads the files itself. @param {string} query @param {number} limit @param {'ids' | 'structure'} [mode] @param {boolean} [componentLookup] */
  function inWorker(query, limit, mode = 'ids', componentLookup = true) {
    if (!searcher && worker) {
      searcher = worker()
      searcher.onmessage = ({ data }) => {
        const waiting = asked.get(data.id)
        asked.delete(data.id)
        if (data.error === undefined) waiting?.resolve(data.result); else waiting?.reject(new Error(data.error))
      }
      // A worker that cannot start or answer fails everything asked of it, and the next ask starts another.
      /** @param {Event} event */
      const failed = event => {
        event.preventDefault()
        searcher?.terminate()
        searcher = null
        for (const waiting of asked.values()) waiting.reject(new Error('The search worker failed.'))
        asked.clear()
      }
      searcher.onerror = failed
      searcher.onmessageerror = failed
    }
    const id = ++asks, base = globalThis.location?.href
    return new Promise((resolve, reject) => {
      asked.set(id, { resolve, reject })
      searcher?.postMessage({ id, query, limit, mode, componentLookup, ids: new URL(String(ids), base).href, additionalIds: additionalIds ? new URL(String(additionalIds), base).href : undefined, forms: forms ? new URL(String(forms), base).href : undefined, formsText, smallSeal: smallSeal instanceof URL || typeof smallSeal === 'string' ? new URL(String(smallSeal), base).href : smallSeal })
    })
  }

  /** @param {string | URL} url */
  const load = async url => {
    const response = await get(url)
    if (!response.ok) throw new Error(`${url}: ${response.status}`)
    return response
  }
  /** @type {Promise<import('./seal-data.js').SmallSealData | null> | null} */
  let seal = null
  const readSeal = () => seal ??= (async () => {
    if (!smallSeal) return null
    const doc = typeof smallSeal === 'string' || smallSeal instanceof URL
      ? /** @type {import('./seal-data.js').SmallSealData} */ (JSON.parse(await readText(await load(smallSeal)))) : smallSeal
    sealTable(doc) // Validate the format before exposing any of its data.
    return doc
  })().catch(error => { seal = null; throw error })

  const read = () => table ??= Promise.all([
    given ? Promise.resolve(given) : ids ? load(ids).then(readText).then(parseIdsTable)
      : smallSeal ? /** @type {Map<string, Sequence[]>} */ (new Map()) : Promise.reject(new Error('babelStoneAdapter: no `ids` URL or `table` given')),
    additionalIds ? load(additionalIds).then(readText).then(parseIdsTable) : Promise.resolve(new Map()),
    readSeal(),
  ]).then(([base, extra, doc]) => {
    const merged = mergeIdsTables(base, extra)
    return doc ? new Map([...merged, ...sealTable(doc)]) : merged
  })
    .catch(error => { table = null; throw error })

  const readPalette = () => palette ??= Promise.all([
    givenPalette ? Promise.resolve(givenPalette) : parts ? load(parts).then(response => response.json()).then(paletteRows)
      : smallSeal ? [] : Promise.reject(new Error('babelStoneAdapter: no `parts` URL or `palette` given')),
    readSeal(),
    formsText !== undefined ? formsText : forms ? load(forms).then(response => response.text()).catch(() => '') : '',
  ]).then(([base, doc, text]) => {
    const rows = doc ? [...new Map([...base, ...doc.parts].map(p => [p.part, p])).values()] : base
    // Keep reviewed contextual search substitutions out of palette families.
    const safe = text.split('\n').filter(line => !line.split('\t').slice(0, 2).some(char => PALETTE_SEPARATE.has(char))).join('\n')
    const variants = readForms(safe)
    for (const root of variants.values()) variants.set(root, root)
    return rows.map(part => {
      if (part.kind !== 'c' && part.kind !== 'd' || isSequence(part.part) || PALETTE_SEPARATE.has(part.part)) return part
      const variantGroup = variants.get(part.part)
      return variantGroup ? { ...part, variantGroup } : part
    })
  })
    .catch(error => { palette = null; throw error })

  // The names the component search knows, and the forms table that opens a name's component into
  // the forms that stand for it, loaded together once.
  /** @type {Promise<{ search: ReturnType<typeof createNameSearch>['search'], forms: Map<string, string>, reverse: Map<string, Set<string>> }> | null} */
  let named = null
  /** @type {Promise<ReturnType<typeof createNameSearch>> | null} */
  let characterNames = null
  const characterIndex = () => characterNames ??= Promise.all([
    charactersText !== undefined ? charactersText : characters ? load(characters).then(readText) : '',
    foldsText !== undefined ? foldsText : folds ? load(folds).then(response => response.text()).catch(() => '') : '',
  ]).then(([text, foldText]) => {
    let folds = new Map()
    try { folds = readFolds(foldText) } catch { /* names as they are written */ }
    return createNameSearch(readNames(text), { folds })
  }).catch(error => { characterNames = null; throw error })

  /** @type {Promise<ReturnType<typeof createNameSearch>> | null} */
  let rareCharacterNames = null
  const rareCharacterIndex = () => rareCharacterNames ??= Promise.all([
    charactersRareText !== undefined ? charactersRareText : charactersRare ? load(charactersRare).then(readText) : '',
    foldsText !== undefined ? foldsText : folds ? load(folds).then(response => response.text()).catch(() => '') : '',
  ]).then(([text, foldText]) => {
    let folds = new Map()
    try { folds = readFolds(foldText) } catch { /* names as they are written */ }
    return createNameSearch(readNames(text), { folds })
  }).catch(error => { rareCharacterNames = null; throw error })

  const nameIndex = () => named ??= Promise.all([
    namesText !== undefined ? namesText : names ? load(names).then(response => response.text()) : '',
    // A names table without the forms or folds tables still finds the component the name records.
    formsText !== undefined ? formsText : forms ? load(forms).then(response => response.text()).catch(() => '') : '',
    foldsText !== undefined ? foldsText : folds ? load(folds).then(response => response.text()).catch(() => '') : '',
  ]).then(([nameText, formText, foldText]) => {
    // A broken forms or folds table costs the search those forms or folds, not its names.
    let byForm = new Map()
    try { byForm = readForms(formText) } catch { /* names as they are written */ }
    let folds = new Map()
    try { folds = readFolds(foldText) } catch { /* names as they are written */ }
    const { search } = createNameSearch(readNames(nameText), { folds })
    /** @type {Map<string, Set<string>>} */
    const reverse = new Map()
    for (const [form, canonical] of byForm) {
      let classForms = reverse.get(canonical)
      if (!classForms) reverse.set(canonical, classForms = new Set([canonical]))
      classForms.add(form)
    }
    return { search, forms: byForm, reverse }
  }).catch(error => { named = null; throw error })

  // The palette's parts, as the set a named component's other forms must belong to, and how often
  // each is used, to put the forms people meet first. Without a palette every component form is offered.
  /** @type {Promise<{ parts: Set<string>, uses: Map<string, number>, rank: Map<string, number> } | null> | null} */
  let namePalette = null
  const paletteForNames = () => {
    if (!parts && !givenPalette) return Promise.resolve(null)
    return namePalette ??= readPalette().then(rows => {
      /** @type {Set<string>} */
      const held = new Set()
      /** @type {Map<string, number>} */
      const uses = new Map()
      /** @type {Map<string, number>} */
      const rank = new Map()
      for (const row of rows) {
        held.add(row.part)
        uses.set(row.part, row.uses ?? 0)
        rank.set(row.part, row.kind === 'c' ? 2 : row.kind === 's' ? 1 : 0)
      }
      return { parts: held, uses, rank }
    }).catch(() => { namePalette = null; return null })
  }

  /**
   * The forms of `char` a component search offers: the component itself first, then the forms that
   * stand for the same component, the ones people meet most first. A form outside the palette is
   * left out when there is one; the component itself always stays.
   * @param {string} char
   * @param {{ parts: Set<string>, uses: Map<string, number> } | null} palette
   * @param {{ forms: Map<string, string>, reverse: Map<string, Set<string>> }} index
   */
  function formsOf(char, palette, index) {
    // 斗 (radical 68) and 鬥 (radical 191) are different radicals; the forms table folds them for
    // the description search, but a name that finds one should not offer the other.
    if (SEPARATE.has(char)) return [char]
    const canonical = index.forms.get(char) ?? char
    const members = new Set([char, canonical, ...(index.reverse.get(canonical) ?? [])])
    /** @type {string[]} */
    const forms = [char]
    for (const form of members) {
      if (form === char || SEPARATE.has(form) || !isComponent(form)) continue
      const point = /** @type {number} */ (form.codePointAt(0))
      // The Kangxi Radicals block is a compatibility spelling of the unified ideograph: ⽔ for 水.
      if (point >= 0x2F00 && point <= 0x2FD5) continue
      if (palette) {
        if (!palette.parts.has(form)) continue
        // A form used once or twice is a rare spelling; the palette's own grid is the place for it.
        if ((palette.uses.get(form) ?? 0) < 5) continue
      }
      forms.push(form)
    }
    forms.sort((a, b) => a === char ? -1 : b === char ? 1
      : (palette?.uses.get(b) ?? 0) - (palette?.uses.get(a) ?? 0) || /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0)))
    return forms
  }

  /** The characters typed, or the code points written. @param {string} text */
  function typed(text) {
    /** @type {string[]} */
    const chars = []
    // A code point written U+4E00, or as bare hex (with a digit) when that is all there is.
    const hex = /^(?=.*\d)[0-9A-Fa-f]{4,6}$/.test(text) ? [text] : [...text.matchAll(/[Uu]\+([0-9A-Fa-f]{4,6})/g)].map(match => match[1])
    for (const value of hex) { const code = parseInt(value, 16); if (code <= 0x10FFFF) chars.push(String.fromCodePoint(code)) }
    // An ASCII letter or digit counts only alone: a word or a code point's digits names none.
    const rest = [...text.replace(/[Uu]\+[0-9A-Fa-f]{4,6}/g, '')]
    for (const char of rest) {
      if (!isComponent(char)) continue
      // A Latin letter or Hangul syllable in a longer query is part of a word; scripts that
      // components use (ideographs, kana, Bopomofo) still count.
      if (rest.length > 1 && !(SCRIPT.test(char) || unicodeProperty('ideographic', char))) continue
      chars.push(char)
    }
    return [...new Set(chars)].filter(isComponent).map(char => ({ char, label: codePoint(char) }))
  }

  /** @type {Promise<{ doc: import('./character-info.js').CharacterInfoData, seal: import('./seal-data.js').SmallSealData | null, lookup: ReturnType<typeof createCharacterInfo> }> | null} */
  let information = null
  const readInformation = () => information ??= Promise.all([
    typeof characterInfo === 'string' || characterInfo instanceof URL
      ? load(characterInfo).then(readText).then(JSON.parse) : characterInfo,
    readSeal(),
  ]).then(([doc, seal]) => ({ doc, seal, lookup: createCharacterInfo(doc, seal) }))
    .catch(error => { information = null; throw error })

  /** Existing form and lookup mappings, retained as labelled search links.
   * @param {string} text @param {{char: string, label: string}[]} direct */
  async function relatedSeeds(text, direct) {
    const hits = [...direct]
    if (formsText !== undefined || forms) {
      try {
        const index = await nameIndex()
        for (const hit of direct) for (const char of formsOf(hit.char, null, index)) {
          if (char !== hit.char) hits.push({ char, label: `form of ${hit.char}` })
        }
      } catch { /* Literal characters and meaning data remain searchable. */ }
    }
    const doc = await readSeal()
    if (doc) {
      const drawable = new Set([...Object.keys(doc.table), ...doc.parts.map(p => p.part)])
      const query = direct.length === 1 ? direct[0].char : text
      for (const hit of sealNames(doc, query)) {
        if (isSmallSeal(hit.char) && !drawable.has(hit.char)) continue
        const old = isSmallSeal(query) ? query : hit.char
        const modern = isSmallSeal(query) ? hit.char : query
        const alias = modern === '口' && doc.modern[old]?.includes('𠙵')
        hits.push({ ...hit, label: alias ? `lookup · ${hit.label}` : hit.label })
      }
    }
    return hits
  }

  /** @param {{ char: string, label: string }[]} hits @param {number} limit */
  function uniqueHits(hits, limit) {
    const seen = new Set(), result = []
    for (const hit of hits) {
      if (seen.has(hit.char)) continue
      seen.add(hit.char); result.push(hit)
      if (result.length >= limit) break
    }
    return result
  }

  /** @type {Promise<ReturnType<typeof createRelationSearch>> | null} */
  let relations = null
  const relationIndex = () => relations ??= Promise.all([readInformation(), given || ids || smallSeal ? read() : new Map()])
    .then(([{ doc, seal }, table]) => createRelationSearch(doc, seal, table))
    .catch(error => { relations = null; throw error })

  return {
    table: read,
    ...(characterInfo ? { async characterInfo(/** @type {string} */ char, /** @type {import('./types.js').Options} */ { signal } = {}) {
      signal?.throwIfAborted()
      const { doc, lookup } = await readInformation()
      const info = lookup(char)
      if (info?.script === 'component' && (given || ids || smallSeal)) {
        info.relations.push(...componentExamples(char, doc, await read()))
        for (const row of info.relations.filter(r => r.kind === 'usage')) info.sources.push(tangutGlossSource(row.char))
        if (info.relations.some(r => r.kind === 'usage')) info.sources.push({ label: 'Andrew West · Tangut IDS', url: 'https://www.babelstone.co.uk/Tangut/TangutIDS.txt' })
      }
      signal?.throwIfAborted()
      return info
    } } : {}),
    async structure(char, { signal } = {}) {
      const found = (await read()).get(char) ?? []
      signal?.throwIfAborted()
      // A sequence with no operator names the character itself: it has no smaller parts.
      return found.filter(sequence => isSequence(sequence.text))
    },
    async search(query, { limit = 24, signal } = {}) {
      if (limit <= 0) return []
      signal?.throwIfAborted()
      const text = query.trim()
      if (!text) return []
      const direct = typed(text)
      // One ideograph typed on its own is that component; names are for what is longer than one.
      // A lone letter or syllable (수, の) also searches names, so Korean and kana readings work.
      const single = [...text].length === 1 && isComponent(text)
      const singleIdeograph = single && (unicodeProperty('ideographic', text) || IDEOGRAPH.test(text) || KANA.test(text))
      /** @type {{ char: string, label: string }[]} */
      let hits = direct
      if (!singleIdeograph && (namesText !== undefined || names)) {
        try {
          const index = await nameIndex()
          const found = index.search(text, { limit })
          if (found.length) {
            const palette = await paletteForNames()
            // The closest names first; among names that fit equally, the components people meet most.
            const ordered = found.map((hit, at) => ({ hit, at })).sort((a, b) =>
              a.hit.score - b.hit.score
              || (a.hit.score === 0 ? (palette?.rank.get(b.hit.char) ?? 0) - (palette?.rank.get(a.hit.char) ?? 0) : 0)
              || (a.hit.score === 0 ? (palette?.uses.get(b.hit.char) ?? 0) - (palette?.uses.get(a.hit.char) ?? 0) : 0)
              || a.at - b.at).map(({ hit }) => hit)
            /** @type {{ char: string, label: string }[]} */
            const named = []
            for (const hit of ordered) for (const char of formsOf(hit.char, palette, index)) named.push({ char, label: hit.label })
            hits = [...named, ...direct]
          }
        } catch { /* The names are a convenience; the characters typed still stand. */ }
      }
      if (characterInfo) hits = [...await relatedSeeds(text, direct), ...hits]
      else if (smallSeal) {
        const doc = await readSeal()
        if (doc) hits = [...hits, ...sealNames(doc, direct.length === 1 ? direct[0].char : text)]
      }
      if (characterInfo) {
        try { hits = (await relationIndex()).search(text, { limit, seeds: hits }) }
        catch (error) { signal?.throwIfAborted(); if (!hits.length) throw error }
      }
      signal?.throwIfAborted()
      return uniqueHits(hits, limit)
    },
    async encoded(sequence) {
      // Built once from the table; a failed load is tried again on the next call.
      described ??= read().then(found => {
        /** @type {Map<string, string[]>} */
        const by = new Map()
        const prefixes = new Set()
        for (const [char, sequences] of found) for (const { text } of sequences) {
          if (!isSequence(text)) continue
          let prefix = ''
          for (const point of text) { prefix += point; prefixes.add(prefix) }
          const chars = by.get(text)
          if (chars) { if (!chars.includes(char)) chars.push(char) } else by.set(text, [char])
        }
        return { by, prefixes }
      }).catch(error => { described = null; throw error })
      const { by, prefixes } = await described
      const tree = parse(sequence.trim()).tree
      if (!tree || typeof tree === 'string') return []
      // Each subtree can be written out or replaced by any character it describes. Resolve from
      // the leaves upward so nested expansions work without expanding the entire character table.
      /** @param {import('../core/ids.js').Part} part @returns {string[]} */
      const descriptions = part => {
        if (typeof part === 'string') return [part]
        if (!part) return []
        let written = [part.op]
        for (const child of part.parts) {
          const choices = descriptions(child)
          written = written.flatMap(prefix => choices.map(choice => prefix + choice).filter(text => prefixes.has(text)))
        }
        return [...new Set([write(part), ...written.flatMap(text => by.get(text) ?? [])])]
      }
      let written = [tree.op]
      for (const child of tree.parts) {
        const choices = descriptions(child)
        written = written.flatMap(prefix => choices.map(choice => prefix + choice).filter(text => prefixes.has(text)))
      }
      return [...new Set(written.flatMap(text => by.get(text) ?? []))]
    },
    async findByStructure(query, { limit = 60, signal } = {}) {
      signal?.throwIfAborted()
      const result = worker && !given ? await inWorker(query, limit, 'structure') : (await localSearch()).structure(query, { limit })
      signal?.throwIfAborted()
      return result
    },
    async findByIds(query, { limit = 60, signal, componentLookup = true } = {}) {
      const result = worker && !given ? await inWorker(query, limit, 'ids', componentLookup) : (await localSearch()).search(query, { limit, componentLookup })
      signal?.throwIfAborted()
      return result
    },
    ...(characters !== undefined || charactersText !== undefined || characterInfo ? {
      /** @param {string} query @param {import('./types.js').Options & { rare?: boolean }} [options] */
      async searchCharacters(query, { limit = 24, signal, rare = false } = {}) {
        if (limit <= 0) return []
        const text = query.trim()
        if (!text) return []
        signal?.throwIfAborted()
        /** @type {{ char: string, label: string }[]} */ let hits = []
        try {
          const common = (await characterIndex()).search(text, { limit })
          hits = common.map(({ char, label }) => ({ char, label }))
          if (rare && (charactersRare !== undefined || charactersRareText !== undefined)) {
            try {
              const extra = (await rareCharacterIndex()).search(text, { limit })
              // Keep the common result first at each rank, then its rare counterpart; a long list
              // of common hits must not hide every rare one before the limit.
              hits = []
              for (let at = 0; at < Math.max(common.length, extra.length); at++) {
                if (common[at]) hits.push({ char: common[at].char, label: common[at].label })
                if (extra[at]) hits.push({ char: extra[at].char, label: extra[at].label })
              }
            } catch (error) { signal?.throwIfAborted(); if (!hits.length) throw error }
          }
        } catch (error) { if (!characterInfo) throw error }
        if (characterInfo) {
          hits = [...await relatedSeeds(text, typed(text)), ...hits]
          try { hits = (await relationIndex()).search(text, { limit, seeds: hits }) }
          catch (error) { signal?.throwIfAborted(); if (!hits.length) throw error }
        }
        signal?.throwIfAborted()
        return uniqueHits(hits, limit)
      },
    } : {}),
    ...(charactersRare !== undefined || charactersRareText !== undefined ? { rareCharacters: true } : {}),
    async containing(asked, { limit = 24 } = {}) {
      if (!index) {
        const [found, search] = await Promise.all([read(), smallSeal ? localSearch() : null])
        index = componentIndex(new Map([...found].map(([char, sequences]) => [char, sequences.map(s => s.text)])), { fold: search?.fold })
      }
      return index.search(asked, limit)
    },
    parts: readPalette,
  }
}
