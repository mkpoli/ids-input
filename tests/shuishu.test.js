import { describe, expect, it } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { isComponent, isLetter, isShuishu, parse, write } from '../src/core/ids.js'
import { characterScript, partScript } from '../src/core/scripts.js'
import { compose } from '../src/composer/loader.js'
import { onlyBundled } from '../src/composer/local.js'
import { hasShuishu, shuishuSource } from '../src/composer/shuishu.js'
import { babelStoneAdapter } from '../src/adapter/babelstone.js'
import { shuishuAdapter } from '../src/adapter/shuishu.js'
import { shuishuLabel, shuishuNames } from '../src/adapter/shuishu-data.js'
import { searchParts } from '../src/core/decompose.js'
import { load as loadSearchWorker } from '../src/adapter/search-worker.js'

const data = JSON.parse(gunzipSync(readFileSync(new URL('../data/shuishu.json.gz', import.meta.url))))
const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/shuishu-outlines.json.gz', import.meta.url))))
const chars = data.parts.map(part => part.part)
const OPS = ['⿰', '⿱', '⿴', '⿵', '⿶']

describe('Shuishu', () => {
  it('ships the whole proposed block, once each', () => {
    expect(data.format).toBe(1)
    expect(chars).toHaveLength(533)
    expect(new Set(chars).size).toBe(533)
    const groups = { dictionary: 0, logogram: 0, radical: 0 }
    for (const part of data.parts) {
      const cp = /** @type {number} */ (part.part.codePointAt(0))
      expect(part.kind).toBe('shui')
      expect(cp >= 0x1b300 && cp <= 0x1b4e5 || cp >= 0x1b500 && cp <= 0x1b52e).toBe(true)
      expect(part.strokes).toBeNull()
      expect(part.shuiName.length).toBeGreaterThan(0)
      expect(part.shuiGroup === 'radical' || part.shuiMeaning || part.shuiGloss).toBeTruthy()
      groups[part.shuiGroup] += 1
    }
    // Characters with a WSF dictionary number, the rest, and the radicals the spreadsheet omits.
    expect(groups).toEqual({ dictionary: 207, logogram: 279, radical: 47 })
    const radicalNames = data.parts.filter(part => part.shuiGroup === 'radical').map(part => part.shuiName)
    expect(radicalNames.every(name => /^\d\d(-A)?$/.test(name))).toBe(true)
    expect(new Set(radicalNames).size).toBe(47)
  })

  it('accepts the tentative code points as components', () => {
    for (const char of [chars[0], chars[486], chars.at(-1)]) {
      expect(isComponent(char)).toBe(true)
      // A logogram or radical, not a letter: the README has `isLetter` exclude both.
      expect(isLetter(char)).toBe(false)
      expect(characterScript(char)).toBe('shuishu')
      expect(isShuishu(char)).toBe(true)
      expect(write(parse(`⿰${char}木`).tree)).toBe(`⿰${char}木`)
    }
    expect(partScript(`⿰${chars[0]}${chars[1]}`)).toBe('shuishu')
    expect(partScript(`⿰${chars[0]}木`)).toBe('mixed')
    // The gap between the two ranges is not part of the block.
    expect(isShuishu(String.fromCodePoint(0x1b4e6))).toBe(false)
    expect(isComponent(String.fromCodePoint(0x1b4e6))).toBe(false)
  })

  it('ships an outline for every part and the font it came from', () => {
    expect(Object.keys(outlines.records).sort()).toEqual([...chars].sort())
    expect(outlines.font).toBe('IDS Shuishu')
    const font = readFileSync(new URL('../fonts/IDSShuishu.woff2', import.meta.url))
    expect(font.subarray(0, 4).toString()).toBe('wOF2')
    expect(outlines.fontSha256).toBe(createHash('sha256').update(font).digest('hex'))
    for (const char of chars) {
      expect(outlines.records[char].G.p.length).toBeGreaterThan(0)
      expect(hasShuishu(`⿰${char}木`)).toBe(true)
      expect(onlyBundled(`⿰${char}⬚`)).toBe(true)
    }
  })

  it('draws them from the bundled outlines', async () => {
    const source = shuishuSource({ load: async () => outlines })
    for (const char of chars.slice(0, 8)) {
      const drawn = await compose(source, `⿰${char}${chars[0]}`, { separate: true })
      expect(drawn.origins).toContain(`glyph ${char}`)
      expect(drawn.d.length).toBeGreaterThan(10)
    }
  })

  it('offers the parts in the palette, named and grouped', async () => {
    const adapter = babelStoneAdapter({ palette: [], shuishu: data })
    const parts = await adapter.parts()
    expect(parts).toHaveLength(533)
    expect(parts.find(part => part.part === chars[0])?.shuiGroup).toBe('dictionary')
    const labelled = shuishuLabel(data.parts[0])
    expect(labelled).toContain('水書')
    expect(labelled).toContain('U+1B300')
    const viaAdapter = await shuishuAdapter({ data, palette: [] }).parts()
    expect(viaAdapter).toHaveLength(533)
    // The table stands on its own, without an ids table behind it.
    expect(await adapter.table()).toBeInstanceOf(Map)
  })

  it('reads the decompositions as descriptions', async () => {
    const adapter = shuishuAdapter({ data, palette: [] })
    const table = await adapter.table()
    const built = data.parts.find(part => part.ids === `⿱${String.fromCodePoint(0x1b501)}${String.fromCodePoint(0x1b500)}`)
    expect(table.get(built.part)).toEqual([{ text: built.ids, regions: '' }])
    // A part finds the characters written with it, and the character finds its own parts.
    const holding = await adapter.containing(String.fromCodePoint(0x1b501) + String.fromCodePoint(0x1b500))
    expect(holding.items).toContain(built.part)
    // The description search and the parts a containing query asks for read it too.
    const found = await adapter.findByIds(String.fromCodePoint(0x1b500))
    expect(found.hits.map(hit => hit.char)).toContain(built.part)
  })

  it("asks for a Shuishu character's parts", async () => {
    const adapter = shuishuAdapter({ data, palette: [] })
    const built = data.parts.find(part => part.ids)
    const known = { [built.part]: { status: 'ready', sequences: await adapter.structure(built.part) } }
    expect(searchParts([{ kind: 'char', char: built.part }], known)).toBe(built.ids.slice(1))
  })

  it('carries the decompositions into the search worker', async () => {
    const gibberish = { format: 1, parts: [{ part: '𛌘', ids: '⿱𛔁𛔀' }, { part: '𛔀', ids: null }, { part: '𛔁', ids: null }] }
    const search = await loadSearchWorker('data:text/plain,', undefined, undefined, '', undefined, '', undefined, '', undefined, gibberish)
    expect(search.search('𛔀', { limit: 3 }).hits.map(hit => hit.char)).toEqual(['𛌘'])
  })

  it('keeps the worker search standing without a readable decomposition file', async () => {
    const broken = Buffer.from('{oops').toString('base64')
    const unreadable = await loadSearchWorker('data:text/plain,', undefined, undefined, '', undefined, '', undefined, '', undefined, `data:application/json;base64,${broken}`)
    expect(unreadable.search('𛔀', { limit: 3 }).hits).toEqual([])
    const other = await loadSearchWorker('data:text/plain,', undefined, undefined, '', undefined, '', undefined, '', undefined, { format: 2, parts: [] })
    expect(other.search('𛔀', { limit: 3 }).hits).toEqual([])
  })

  it('finds the parts by name, reading, meaning and character', () => {
    const one = data.parts.find(part => part.shuiMeaning === '一')
    const two = data.parts.find(part => part.shuiMeaning === '二')
    expect(shuishuNames(data, one.part)[0].char).toBe(one.part)
    expect(shuishuNames(data, one.shuiName)[0].char).toBe(one.part)
    expect(shuishuNames(data, one.shuiReading)[0].char).toBe(one.part)
    expect(shuishuNames(data, '一')[0].char).toBe(one.part)
    expect(shuishuNames(data, '二')[0].char).toBe(two.part)
    expect(shuishuNames(data, '')).toEqual([])
    expect(shuishuNames(data, 'zzzz')).toEqual([])
    // A reading or a meaning ranks below the vocabulary; a typed character or name does not.
    expect(shuishuNames(data, '一')[0].rank).toBe(5)
    expect(shuishuNames(data, one.part)[0].rank).toBeUndefined()
    // A whole sense, not a fragment of one.
    const glossed = data.parts.find(part => part.shuiGloss?.includes(' ') && part.shuiGloss?.includes('('))
    expect(shuishuNames(data, glossed.shuiGloss.split(' ')[0]).length).toBeLessThanOrEqual(12)
    // One of 一's gloss senses is "one", which the whole-sense match finds.
    expect(shuishuNames(data, 'one')[0].char).toBe(one.part)
  })

  it('carries the editorial decompositions it can build', async () => {
    const built = data.parts.filter(part => part.ids)
    expect(built).toHaveLength(data.ids.count)
    expect(data.ids.note.length).toBeGreaterThan(0)
    const known = new Set(chars)
    for (const part of built) {
      // Exactly one operator and two parts of the block, neither of them the character itself.
      expect([...part.ids]).toHaveLength(3)
      expect(OPS).toContain(part.ids[0])
      expect([...part.ids.slice(1)].every(char => known.has(char))).toBe(true)
      expect(part.ids.slice(1)).not.toContain(part.part)
    }
    expect(new Set(built.map(part => part.ids[0])).size).toBeGreaterThan(1)
    // The chart's radical cross references name one of the parts where they exist.
    const one = built.find(part => part.part === '\u{1B318}')
    expect(one.ids).toBe(`⿱${String.fromCodePoint(0x1b501)}${String.fromCodePoint(0x1b500)}`)
    // A description names the character built that way before its components do.
    expect(shuishuNames(data, one.ids)[0]).toMatchObject({ char: one.part })
    expect(shuishuNames(data, one.ids)[0].label).toContain(one.ids)
    expect(shuishuNames(data, String.fromCodePoint(0x1b501))[0].char).toBe(String.fromCodePoint(0x1b501))
    // The same holds in the search the editor uses, past the typed parts, and a description nothing
    // is built from leaves the parts where they were.
    const [first] = await shuishuAdapter({ data, palette: [] }).search(one.ids)
    expect(first.char).toBe(one.part)
    const unbuilt = `⿰${String.fromCodePoint(0x1b500)}${String.fromCodePoint(0x1b30a)}`
    const [typed] = await shuishuAdapter({ data, palette: [] }).search(unbuilt)
    expect(typed.char).toBe(String.fromCodePoint(0x1b500))
  })

  it('refuses a decomposition the build cannot use', () => {
    // The build validates `ids.json`; a bad entry has to stop it, not reach the palette.
    const tree = mkdtempSync(join(tmpdir(), 'ids-shuishu-'))
    cpSync(new URL('../data', import.meta.url), join(tree, 'data'), { recursive: true })
    cpSync(new URL('../fonts', import.meta.url), join(tree, 'fonts'), { recursive: true })
    cpSync(new URL('../scripts', import.meta.url), join(tree, 'scripts'), { recursive: true })
    const file = join(tree, 'data/shuishu/ids.json')
    const entries = JSON.parse(readFileSync(file, 'utf8')).entries
    const bad = {
      'two operators': ['⿱⿰' + String.fromCodePoint(0x1b501) + String.fromCodePoint(0x1b500)],
      'a part outside the block': ['⿱' + String.fromCodePoint(0x1b501) + '口'],
      'its own character': ['⿱' + String.fromCodePoint(0x1b318) + String.fromCodePoint(0x1b500)],
      'an empty value': [''],
    }
    for (const [name, [value]] of Object.entries(bad)) {
      writeFileSync(file, JSON.stringify({ note: 'x', entries: { ...entries, '1B318': value } }))
      const build = spawnSync('uv', ['run', '--python', '3.12', 'scripts/build_shuishu.py'], { cwd: tree, encoding: 'utf8' })
      expect({ name, status: build.status }).toEqual({ name, status: 1 })
      expect(build.stderr).toMatch(/ValueError/)
    }
    rmSync(tree, { recursive: true, force: true })
  }, 120000)

  it('names a decomposition where a part has one', () => {
    const part = data.parts.find(entry => entry.ids)
    expect(shuishuLabel(part)).toContain(part.ids)
    const plain = data.parts.find(entry => !entry.ids)
    expect([...plain.part].some(char => OPS.includes(char))).toBe(false)
    expect(shuishuLabel(plain)).toBe(shuishuLabel({ ...plain, ids: null }))
  })

  it('keeps the pinned sources in step with their digests', () => {
    const sources = JSON.parse(readFileSync(new URL('../data/shuishu/sources.json', import.meta.url)))
    expect(sources.documents.map(document => document.file).sort()).toEqual(['Shuishu.xlsx', 'Uni1B300Shuishu-subset.ttf', 'cid-map.json', 'radical-names.json'])
    for (const document of sources.documents) {
      expect(document.note.length).toBeGreaterThan(0)
      const file = readFileSync(new URL(`../data/shuishu/${document.file}`, import.meta.url))
      expect(createHash('sha256').update(file).digest('hex')).toBe(document.sha256)
    }
    expect(sources.roadmap).toContain('unicode.org/roadmaps')
  })
})
