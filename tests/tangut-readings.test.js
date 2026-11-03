import { describe, expect, test } from 'bun:test'
import { foldReading, indexReadings, loosenReading, searchReadings } from '../src/core/tangut-readings.js'

describe('Tangut reading search', () => {
  test('folds diacritics, IPA letters and a final tone', () => {
    expect(foldReading('do1')).toEqual({ folded: 'do', tone: '1' })
    expect(foldReading('do̱1')).toEqual({ folded: 'do', tone: '1' })
    expect(foldReading('ndɔɦ1')).toEqual({ folded: 'ndo', tone: '1' })
    expect(foldReading('lhjwo')).toEqual({ folded: 'lhjwo', tone: '' })
    expect(loosenReading('ndo')).toBe('do')
  })

  test('an exact reading comes before a beginning and a near spelling', () => {
    const readings = indexReadings({
      '𗀀': { readings: { li_fanwen: 'do1', gong_xun_202411: 'do̱1' } },
      '𗀁': { readings: { li_fanwen: 'ndo1' } },
      '𗀂': { readings: { li_fanwen: 'do' } },
    })
    const exact = searchReadings(readings, 'do1')
    expect(exact.find(hit => hit.char === '𗀀')?.tier).toBe(0)
    expect(exact.find(hit => hit.char === '𗀁')?.tier).toBe(3)
    expect(searchReadings(readings, 'do̱1').find(hit => hit.char === '𗀀')?.tier).toBe(0)
    expect(searchReadings(readings, 'ndo1').find(hit => hit.char === '𗀁')?.tier).toBe(0)
    expect(searchReadings(readings, 'ndo').find(hit => hit.char === '𗀀')?.tier).toBe(3)
    const begins = searchReadings(readings, 'd')
    expect(begins.length).toBeGreaterThan(0)
    expect(begins.every(hit => hit.tier === 2)).toBe(true)
  })

  test('a tone keeps to that tone, and a query without one accepts every tone', () => {
    const readings = indexReadings({
      '𗀀': { readings: { li_fanwen: 'do1' } },
      '𗀁': { readings: { li_fanwen: 'do2' } },
    })
    expect(searchReadings(readings, 'do1').map(hit => hit.char)).toEqual(['𗀀'])
    expect(searchReadings(readings, 'do').map(hit => hit.char)).toEqual(['𗀀', '𗀁'])
  })

  test('reads every system in a record and skips an empty one', () => {
    const readings = indexReadings({ '𗀀': { readings: { li_fanwen: 'do1', miyake: '', nishida: 'ndɔɦ1' } } })
    expect(readings.map(reading => reading.system)).toEqual(['li_fanwen', 'nishida'])
  })

  test('keeps every spelling that is exactly the query, whatever its limit', () => {
    const readings = indexReadings({
      '𗀀': { readings: { li_fanwen: 'ke' } },
      '𗀁': { readings: { li_fanwen: 'ke' } },
      '𗀂': { readings: { li_fanwen: 'kiej' } },
    })
    const hits = searchReadings(readings, 'ke', { limit: 1 })
    expect(hits.filter(hit => hit.tier === 0).map(hit => hit.char)).toEqual(['𗀀', '𗀁'])
  })

  test('does not index a reading with an unknown segment', () => {
    const readings = indexReadings({ '𗀀': { readings: { li_fanwen: 'do1', miyake: '0j??' } } })
    expect(readings.map(reading => reading.raw)).toEqual(['do1'])
    expect(searchReadings(readings, 'j')).toEqual([])
  })
})
