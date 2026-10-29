import { describe, expect, test } from 'bun:test'
import { EXAMPLE_GROUPS } from '../demo/lib/examples.js'
import { EXAMPLE_SOURCES, sourceNumber } from '../demo/lib/example-sources.js'

// The sequence whose origin the repository does not record; it stays uncited until one is found.
const UNRECORDED = new Set(['⿰言⿱⿰幺幺⿰幺幺'])

const entries = EXAMPLE_GROUPS.flatMap(group => group.examples.map(example => ({ group, example })))
/** @param {number} n */
const idAt = n => EXAMPLE_SOURCES[n - 1]?.id
/** @param {{ refs?: number[] }} group @param {{ refs?: number[] }} example */
const refsOf = (group, example) => example.refs ?? group.refs ?? []
/** @param {string} key */
const groupRefs = key => EXAMPLE_GROUPS.find(group => group.key === key).refs.map(idAt)

describe('example sources', () => {
  test('ids are unique and records are complete', () => {
    const ids = EXAMPLE_SOURCES.map(source => source.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const source of EXAMPLE_SOURCES) {
      expect(source.title.length).toBeGreaterThan(0)
      expect(source.note.length).toBeGreaterThan(0)
      if (!source.url) expect(['personal', 'reported']).toContain(source.status)
    }
  })

  test('every citation number resolves to a record', () => {
    for (const { group, example } of entries) {
      for (const n of refsOf(group, example)) expect(typeof idAt(n)).toBe('string')
    }
  })

  test('numbers point at the record each example means', () => {
    const ids = new Map(entries.map(({ group, example }) => [example.sequence, refsOf(group, example).map(idAt)]))
    expect(ids.get('⿱龹幸')).toEqual(['personal'])
    expect(ids.get('⿳宀⿰丨⿴⿻冂一一⿹𠃌灬')).toEqual(['jyutnet'])
    expect(ids.get('⿰舟ラ')).toEqual(['script-hybrid', 'l2-24-201', 'ndl-jmtt'])
    expect(ids.get('⿵门T')).toEqual(['l2-24-201', 'irg-n2744'])
    expect(ids.get('⿴口도')).toEqual(['script-hybrid', 'x-hado'])
    expect(ids.get('⿱艹堀')).toEqual(['x-sarasvati'])
    expect(ids.get('⿱投石')).toEqual(['x-uteta-toushi'])
    expect(ids.get('⿲𠂤日千')).toEqual(['x-kadisco'])
    expect(ids.get('⿱一心')).toEqual(['x-jianhuazi'])
    expect(ids.get('⿰忄実')).toEqual(['x-umihotarus', 'x-dodan'])
    expect(ids.get('⿴囗⿱エン')).toEqual(['x-kygna', 'x-kechilee', 'x-ryakjiten', 'x-kingko', 'x-sc2rm', 'x-vivanon', 'x-privjj'])
    expect(ids.get('⿰言ギ')).toEqual(['geba-wp', 'x-miho'])
    expect(ids.get('⿱月朋')).toEqual(['x-uteta'])
    expect(ids.get('⿱天𭑈')).toEqual(['babelstone', 'x-uteta-pinzi-ten-chi'])
    expect(ids.get('⿱地⿰地地')).toEqual(['x-uteta-pinzi-ten-chi'])
    expect(ids.get('⿱里⿰里里')).toEqual(['x-uteta-pinzi-ri-mo'])
    expect(ids.get('⿱莫⿰莫莫')).toEqual(['x-uteta-pinzi-ri-mo'])
    expect(groupRefs('seal')).toEqual(['small-seal'])
    expect(groupRefs('tangut')).toEqual(['tangut-ids'])
    expect(groupRefs('geba')).toEqual(['geba-wp'])
  })

  test('every example is cited or listed as unrecorded', () => {
    const uncited = entries.filter(({ group, example }) => refsOf(group, example).length === 0 && !UNRECORDED.has(example.sequence))
    expect(uncited.map(({ example }) => example.sequence)).toEqual([])
    const missing = entries.filter(({ example }) => UNRECORDED.has(example.sequence))
    expect(missing.length).toBe(UNRECORDED.size)
  })

  test('a source id resolves to its printed number', () => {
    expect(EXAMPLE_SOURCES[sourceNumber('ndl-jmtt') - 1].id).toBe('ndl-jmtt')
    expect(sourceNumber('missing-id')).toBe(0)
  })
})
