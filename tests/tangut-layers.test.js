import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { babelStoneAdapter, parseIdsTable, paletteRows } from '../src/adapter/index.js'
import { isNode, parse, write } from '../src/core/ids.js'
import { roots, searchParts, variants } from '../src/core/decompose.js'
import { tangutLayers } from '../scripts/build_tangut_layers.mjs'

const text = gunzipSync(readFileSync(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString()
const table = parseIdsTable(text)
const parts = paletteRows(JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url))))
const layerText = gunzipSync(readFileSync(new URL('../data/tangut-layers.json.gz', import.meta.url))).toString()
const doc = JSON.parse(layerText)

describe('the Tangut character layers', () => {
  it('cover the descriptions that hold another character', () => {
    expect(doc.counts).toEqual({ characters: 6145, parsed: 6137, rejected: 8, layered: 2408, direct: 2190, single: 28, ambiguous: 1 })
    const rebuilt = tangutLayers(table)
    expect(rebuilt.layers.size).toBe(doc.counts.layered)
    expect(Object.fromEntries(rebuilt.layers)).toEqual(doc.characters)
  })

  it('take the largest character-sized subtree first', () => {
    expect(doc.characters['𗀃']).toBe('⿱𘠀𗸡')
    expect(doc.characters['𗀅']).toBe('⿱𘠀𗄯')
    expect(doc.characters['𗀔']).toBe('⿱𘠀⿲𘠨𗢨𘠢')
    // A single-component ideograph is already the smallest part and is not listed.
    expect(doc.characters['𗢨']).toBeUndefined()
    // A description with no character-sized part keeps its BabelStone text and is not listed.
    expect(doc.characters['𗀀']).toBeUndefined()
  })

  it('leaves a description shared by two characters unreplaced', () => {
    const shared = new Map([
      ['𗀀', [{ text: '⿰𘠀𘠁' }]],
      ['𗀁', [{ text: '⿰𘠀𘠁' }]],
      ['𗀂', [{ text: '⿱𘠀⿰𘠀𘠁' }]],
    ])
    const result = tangutLayers(shared)
    expect(result.layers.size).toBe(0)
    expect(result.ambiguous).toEqual({ '⿰𘠀𘠁': ['𗀀', '𗀁'] })
  })

  it('parse, differ from the source, and hold a character', () => {
    const source = new Map([...table].map(([char, sequences]) => [char, sequences[0]?.text]))
    const characters = new Set([...table.keys()].filter(char => /[\u{17000}-\u{187FF}\u{18D00}-\u{18DFF}]/u.test(char)))
    for (const [char, sequence] of Object.entries(doc.characters)) {
      const read = parse(sequence)
      expect([char, read.problem]).toEqual([char, undefined])
      expect(sequence).not.toBe(source.get(char))
      const held = []
      const walk = node => { if (isNode(node)) node.parts.forEach(walk); else if (characters.has(node)) held.push(node) }
      walk(read.tree)
      expect([char, held.length > 0]).toEqual([char, true])
    }
  })

  it('expand back to the source components exactly', () => {
    const source = new Map([...table].map(([char, sequences]) => [char, sequences[0]?.text]))
    const sourceTree = char => {
      const text = /** @type {string} */ (source.get(char))
      return [...text].length === 1 ? text : parse(text).tree
    }
    const expand = node => {
      if (!isNode(node)) return source.has(node) ? expand(sourceTree(node)) : node
      return { op: node.op, parts: node.parts.map(expand) }
    }
    for (const [char, sequence] of Object.entries(doc.characters)) {
      const read = parse(sequence)
      expect([char, write(expand(read.tree))]).toEqual([char, source.get(char)])
    }
  })

  it('never loop through their character parts', () => {
    const layers = new Map(Object.entries(doc.characters))
    const seen = new Set()
    const walk = (char, path) => {
      if (path.has(char)) throw new Error(`Cycle: ${[...path, char].join(' → ')}`)
      if (seen.has(char)) return
      seen.add(char)
      const read = parse(/** @type {string} */ (layers.get(char)))
      if (!read.tree) return
      const next = new Set([...path, char])
      const visit = node => {
        if (isNode(node)) { node.parts.forEach(visit); return }
        if (layers.has(node)) walk(node, next)
      }
      visit(read.tree)
    }
    for (const char of layers.keys()) walk(char, new Set())
    expect(seen.size).toBe(layers.size)
  })
})

describe('an adapter over the layers', () => {
  const adapter = babelStoneAdapter({ table, palette: parts, layersText: layerText })

  it('offers the layered description before BabelStone’s own', async () => {
    const found = await adapter.structure('𗀃')
    expect(found[0]).toEqual({ text: '⿱𘠀𗸡', regions: '', derived: true })
    expect(found[1]).toEqual({ text: '⿱𘠀⿰𘣣𘠐', regions: '' })
    expect(variants({ status: 'ready', sequences: found }).map(found => [found.text, found.derived])).toEqual([
      ['⿱𘠀𗸡', true],
      ['⿱𘠀⿰𘣣𘠐', false],
    ])
  })

  it('finds and encodes a layered description', async () => {
    expect(await adapter.encoded('⿱𘠀𗸡')).toContain('𗀃')
    expect((await adapter.findByIds('⿱𘠀𗸡')).hits.map(hit => hit.char)).toContain('𗀃')
  })

  it('asks the containing search for source components, not character parts', async () => {
    const entry = { status: /** @type {const} */ ('ready'), sequences: await adapter.structure('𗀃') }
    expect(searchParts(roots('𗀃'), { '𗀃': entry })).toBe('𘠀𘣣𘠐')
  })

  it('tries the layer file again after a transient failure', async () => {
    let calls = 0
    const get = async (url) => {
      if (!String(url).endsWith('layers.json.gz')) return new Response('', { status: 404 })
      calls++
      return calls === 1 ? new Response('', { status: 503 }) : new Response(layerText)
    }
    const retrying = babelStoneAdapter({ table, layers: 'layers.json.gz', fetch: get })
    expect(await retrying.structure('𗀃')).toEqual([{ text: '⿱𘠀⿰𘣣𘠐', regions: '' }])
    expect((await retrying.structure('𗀃'))[0]).toEqual({ text: '⿱𘠀𗸡', regions: '', derived: true })
    expect(calls).toBe(2)
  })

  it('rebuilds the search and encoding indexes when layers arrive later', async () => {
    const retrying = () => {
      let calls = 0
      const get = async (url) => {
        if (!String(url).endsWith('layers.json.gz')) return new Response('', { status: 404 })
        calls++
        return calls === 1 ? new Response('', { status: 503 }) : new Response(layerText)
      }
      return babelStoneAdapter({ table, layers: 'layers.json.gz', fetch: get })
    }
    const searching = retrying()
    expect((await searching.findByIds('⿱𘠀𗸡')).hits.map(hit => hit.char)).not.toContain('𗀃')
    expect((await searching.structure('𗀃'))[0].derived).toBe(true)
    expect((await searching.findByIds('⿱𘠀𗸡')).hits.map(hit => hit.char)).toContain('𗀃')

    const encoding = retrying()
    expect(await encoding.encoded('⿱𘠀𗸡')).toEqual([])
    expect((await encoding.structure('𗀃'))[0].derived).toBe(true)
    expect(await encoding.encoded('⿱𘠀𗸡')).toContain('𗀃')
  }, 15000)

  it('keeps source descriptions when the layer file is malformed', async () => {
    const malformed = babelStoneAdapter({ table, layersText: 'not json' })
    expect(await malformed.structure('𗀃')).toEqual([{ text: '⿱𘠀⿰𘣣𘠐', regions: '' }])
  })

  it('leaves characters and other scripts alone', async () => {
    expect(await adapter.structure('𗀀')).toEqual([{ text: '⿱𘠀⿰𘢰𘠆', regions: '' }])
    expect(await adapter.structure('一')).toEqual(await babelStoneAdapter({ table, palette: parts }).structure('一'))
  })
})
