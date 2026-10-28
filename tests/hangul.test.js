import { describe, expect, it } from 'bun:test'
import {
  HANGUL_FINALS, HANGUL_INITIALS, HANGUL_MEDIALS, composeHangul, composeJamo, findSyllablesByRomanization, hangulClusterAt, jamoClass,
  normalizeRomanization, romanizeHangul,
} from '../src/core/hangul.js'
import { descriptionEnd, parse, write } from '../src/core/ids.js'

const char = point => String.fromCodePoint(point)
const g = char(0x1100), a = char(0x1161), k = char(0x11a8), oldFinal = char(0x11eb)

describe('Hangul jamo', () => {
  it('sorts conjoining jamo into initials, medials and finals', () => {
    expect([g, a, k, oldFinal, '木', char(0x115f)].map(jamoClass)).toEqual(['L', 'V', 'T', 'T', null, null])
  })
  it('offers modern jamo before the historical ones', () => {
    expect([HANGUL_INITIALS.modern.length, HANGUL_INITIALS.historical.length]).toEqual([19, 105])
    expect([HANGUL_MEDIALS.modern.length, HANGUL_MEDIALS.historical.length]).toEqual([21, 73])
    expect([HANGUL_FINALS.modern.length, HANGUL_FINALS.historical.length]).toEqual([27, 110])
    expect(HANGUL_INITIALS.modern[0]).toBe(g)
    expect(HANGUL_MEDIALS.modern[0]).toBe(a)
    expect(HANGUL_FINALS.modern[0]).toBe(k)
  })
  it('takes the jamo run that forms one syllable', () => {
    expect(hangulClusterAt([g, a, oldFinal], 0)).toEqual({ text: g + a + oldFinal, end: 3 })
    expect(hangulClusterAt([g, g, a], 0)).toEqual({ text: g + g + a, end: 3 })
    expect(hangulClusterAt([a, g], 0)).toBeNull()
    expect(hangulClusterAt([g, g], 0)).toBeNull()
  })
})

describe('composing Hangul', () => {
  it('precomposes modern initials, medials and finals', () => {
    expect(composeHangul(g, a)).toEqual({ text: '가', precomposed: true })
    expect(composeHangul(g, a, k)).toEqual({ text: '각', precomposed: true })
    expect(composeHangul(char(0x1101), a, k)).toEqual({ text: '깍', precomposed: true })
  })
  it('accepts compatibility jamo', () => {
    expect(composeHangul('ㄱ', 'ㅏ')).toEqual({ text: '가', precomposed: true })
    expect(composeHangul('ㄱ', 'ㅏ', 'ㄴ')).toEqual({ text: '간', precomposed: true })
    expect(composeHangul('ㅎ', 'ㅏ', 'ㅂ')).toEqual({ text: '합', precomposed: true })
  })
  it('keeps old Hangul as one conjoining jamo run', () => {
    expect(composeHangul(g, a, oldFinal)).toEqual({ text: g + a + oldFinal, precomposed: false })
    expect(composeHangul(char(0xa960), a)).toEqual({ text: char(0xa960) + a, precomposed: false })
  })
  it('rejects jamo that cannot take the role', () => {
    expect(composeHangul(g, k)).toBeNull()
    expect(composeHangul(a, a)).toBeNull()
    expect(composeHangul('木', a)).toBeNull()
    expect(composeHangul('ㄱ', 'ㅏ', 'ㄴㅎ')).toBeNull()
  })
  it('composes jamo a filter receives', () => {
    expect(composeJamo('ㄱㅏ')).toBe('가')
    expect(composeJamo('ㄱㅏㄴ')).toBe('간')
    expect(composeJamo(g + a)).toBe('가')
    expect(composeJamo(g + a + oldFinal)).toBe(g + a + oldFinal)
    expect(composeJamo('가')).toBeNull()
    expect(composeJamo('ㄱㅏㄴㅎ')).toBeNull()
  })
})

describe('Hangul runs in descriptions', () => {
  it('read and write as one component', () => {
    const cluster = g + a + oldFinal, text = `⿰${cluster}木`, tree = { op: '⿰', parts: [cluster, '木'] }
    expect(parse(text)).toEqual({ tree })
    expect(write(tree)).toBe(text)
    expect(descriptionEnd([...text], 0)).toBe([...text].length)
  })
  it('precomposed and modern runs stay as written', () => {
    expect(parse(`⿰${g}${a}木`)).toEqual({ tree: { op: '⿰', parts: [g + a, '木'] } })
    expect(parse('⿰가木')).toEqual({ tree: { op: '⿰', parts: ['가', '木'] } })
  })
  it('leaves a lone jamo a single component', () => {
    expect(parse(g, { open: true })).toEqual({ tree: g })
    expect(parse(`⿰${g}木`)).toEqual({ tree: { op: '⿰', parts: [g, '木'] } })
  })
})


describe('Romanized syllables', () => {
  it('romanizes a syllable by its Revised Romanization spelling', () => {
    for (const [syllable, roman] of [['가', 'ga'], ['각', 'gak'], ['갃', 'gak'], ['간', 'gan'], ['강', 'gang'],
      ['알', 'al'], ['라', 'ra'], ['의', 'ui'], ['괜', 'gwaen'], ['좋', 'jot']]) expect(romanizeHangul(syllable)).toBe(roman)
    expect(romanizeHangul('木')).toBeNull()
    expect(romanizeHangul('가나')).toBeNull()
  })
  it('finds syllables by Revised Romanization and normalised McCune-Reischauer', () => {
    expect(findSyllablesByRomanization('gan')).toEqual(['간', '갅', '갆'])
    expect(findSyllablesByRomanization('GANG')).toEqual(['강'])
    expect(findSyllablesByRomanization('gak')).toContain('각')
    expect(findSyllablesByRomanization('kak')).toContain('각')
    expect(findSyllablesByRomanization('tchak')).toContain('짝')
    expect(findSyllablesByRomanization('geon')).toContain('건')
    expect(findSyllablesByRomanization('g').length).toBeGreaterThan(500)
    expect(findSyllablesByRomanization('가')).toEqual([])
    expect(findSyllablesByRomanization('zzz')).toEqual([])
    expect(findSyllablesByRomanization('kŏn')).toContain('건')
    expect(normalizeRomanization('KŎN')).toBe('keon')
  })
})
