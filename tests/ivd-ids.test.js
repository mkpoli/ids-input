// The IDS of the Ideographic Variation Database's sequences, as data/open-data/ivd holds them.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parse } from '../src/core/index.js'

const file = name => new URL(`../data/open-data/ivd/${name}`, import.meta.url)
const table = name => {
  const [head, ...lines] = gunzipSync(readFileSync(file(name))).toString('utf8').trimEnd().split('\n')
  const columns = head.split('\t')
  return lines.map(line => Object.fromEntries(line.split('\t').map((value, at) => [columns[at], value])))
}
const manifest = JSON.parse(readFileSync(file('manifest.json'), 'utf8'))
const sequences = table('sequences.tsv.gz')
const readings = table('readings.tsv.gz')
const relations = table('relations.tsv.gz')
const bySequence = new Map(sequences.map(row => [row.sequence, row]))

describe('the IVD descriptions', () => {
  it('hold every registered sequence once, with every registration', () => {
    expect(manifest.format).toBe('ids-input/ivd-ids')
    expect(manifest.licence).toEqual({ descriptions: 'CC0-1.0', registrations: 'Unicode-3.0' })
    expect(sequences.length).toBe(manifest.sequences)
    expect(bySequence.size).toBe(sequences.length)
    expect(sequences.reduce((sum, row) => sum + row.registrations.split(' ').length, 0)).toBe(manifest.registrations)
  })

  it('count each status, and give an IDS exactly where one is agreed or single', () => {
    const counts = {}
    for (const row of sequences) counts[row.status] = (counts[row.status] ?? 0) + 1
    expect(counts).toEqual(manifest.status)
    for (const row of sequences) expect(Boolean(row.ids)).toBe(row.status === 'agreed' || row.status === 'single')
  })

  it('write descriptions the parser reads', () => {
    for (const row of sequences) for (const text of [row.ids, row.finer].filter(Boolean)) expect(parse(text).problem).toBeUndefined()
  })

  it('name only sequences of the same base as undistinguished', () => {
    for (const row of sequences) {
      for (const other of row.undistinguished ? row.undistinguished.split(';') : []) {
        expect(bySequence.has(other)).toBe(true)
        expect(other.split(' ')[0]).toBe(row.sequence.split(' ')[0])
      }
    }
  })

  it('tell the forms of 臭 apart', () => {
    expect(['E0100', 'E0101', 'E0102', 'E0103'].map(selector => bySequence.get(`81ED ${selector}`).ids))
      .toEqual(['⿱自大', '⿱自犬', '⿱自大', '⿱自犬'])
    expect(bySequence.get('81ED E0102').status).toBe('agreed')
    expect(bySequence.get('81ED E0103').registrations).toBe('Hanyo-Denshi:JC9056 Moji_Joho:MJ030291')
  })

  it('rest a same-glyph reading on the encoded character a font draws with that glyph', () => {
    const korean = readings.find(row => row.sequence === '81ED E0101' && row.witness === 'noto' && row.anchor === 'U+81ED(K)')
    expect(korean?.ids).toBe('⿱自犬')
    const ipamj = relations.filter(row => row.sequence === '81ED E0103' && row.witness === 'ipamj').map(row => row.other)
    expect(ipamj).toContain('U+FA5C(J)')
    expect(relations.some(row => row.sequence === '81ED E0102' && row.other === 'U+26900' && row.witness === 'glyphwiki')).toBe(true)
  })
})

describe('the IVD readings', () => {
  it('relate every pair a witness draws with one glyph', () => {
    const related = new Set(relations.filter(row => row.witness === 'glyphwiki').map(row => `${row.sequence}|${row.other}`))
    expect(related.has('4E2D E0100|4E2D E0103')).toBe(true)
  })

  it('keep a component that is a variation sequence, and the operator of the part around another', () => {
    expect(bySequence.get('807E E0103').ids).toBe('⿱龍󠄂耳')
    expect(bySequence.get('518B E0100').ids).toBe('⿵冂口')
    expect(bySequence.get('530B E0100').ids).toBe('⿹勹缶')
  })

  it('read stacked and nested descriptions alike', () => {
    expect(bySequence.get('5BDA E0100')).toMatchObject({ ids: '⿳宀王缶', status: 'agreed' })
    expect(bySequence.get('8190 E0100')).toMatchObject({ ids: '⿱旅肉', finer: '⿱旅󠄁肉', status: 'agreed' })
  })

  it('tell siblings apart by their finer description', () => {
    expect(bySequence.get('3E02 E0100').undistinguished).not.toContain('3E02 E0101')
  })
})

describe('the forms of components', () => {
  it('write a component as the sequence GlyphWiki draws it with, to tell siblings apart', () => {
    expect(bySequence.get('589C E0100').finer).toBe('⿱隊󠄀土')
    expect(bySequence.get('589C E0101').finer).toBe('⿱隊󠄁土')
    expect(bySequence.get('589C E0101').undistinguished).toBe('')
  })

  it('give a finer description only where it names more than the description', () => {
    for (const row of sequences.filter(row => row.finer)) {
      expect(row.finer).not.toBe(row.ids)
      expect([...row.finer].some(char => char.codePointAt(0) >= 0xE0100 && char.codePointAt(0) <= 0xE01EF)).toBe(true)
    }
  })
})
