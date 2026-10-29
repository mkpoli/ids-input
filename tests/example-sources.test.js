import { describe, expect, test } from 'bun:test'
import { EXAMPLE_GROUPS } from '../demo/lib/examples.js'
import { EXAMPLE_SOURCES, sourceNumber } from '../demo/lib/example-sources.js'

// Sequences whose origin the repository does not record; they stay uncited until one is found.
const UNRECORDED = new Set(['⿳宀⿰丨⿴⿻冂一一⿹𠃌灬', '⿰言⿱⿰幺幺⿰幺幺'])

const entries = EXAMPLE_GROUPS.flatMap(group => group.examples.map(example => ({ group, example })))

describe('example sources', () => {
  test('ids are unique and numbered records are complete', () => {
    const ids = EXAMPLE_SOURCES.map(source => source.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const source of EXAMPLE_SOURCES) {
      expect(source.title.length).toBeGreaterThan(0)
      expect(source.note.length).toBeGreaterThan(0)
      if (!source.url) expect(source.status).toBe('personal')
    }
  })

  test('every citation number names a record', () => {
    for (const { group, example } of entries) {
      for (const n of [...(group.refs ?? []), ...(example.refs ?? [])]) {
        expect(Number.isInteger(n) && n >= 1 && n <= EXAMPLE_SOURCES.length).toBe(true)
      }
    }
  })

  test('every example is cited or listed as unrecorded', () => {
    const uncited = entries.filter(({ group, example }) => {
      const refs = example.refs ?? group.refs ?? []
      return refs.length === 0 && !UNRECORDED.has(example.sequence)
    })
    expect(uncited.map(({ example }) => example.sequence)).toEqual([])
    const missing = entries.filter(({ example }) => UNRECORDED.has(example.sequence))
    expect(missing.length).toBe(UNRECORDED.size)
  })

  test('source ids resolve to their printed number', () => {
    expect(sourceNumber('babelstone')).toBe(1)
    expect(sourceNumber('ndl-jmtt')).toBe(EXAMPLE_SOURCES.findIndex(source => source.id === 'ndl-jmtt') + 1)
    expect(sourceNumber('missing-id')).toBe(0)
  })
})
