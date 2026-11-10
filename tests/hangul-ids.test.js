import { describe, expect, it } from 'bun:test'
import { COMPAT_FINALS, COMPAT_INITIALS, COMPAT_MEDIALS, HANGUL_CONSONANTS, HANGUL_VOWELS, hangulIdsOf, hangulLetters, hangulOfIds, jamoKind } from '@han-compose/composer/hangul-ids'

describe('Hangul letters as description sequences', () => {
  it('classifies every jamo as a consonant or a vowel', () => {
    for (const letter of COMPAT_INITIALS) expect(jamoKind(letter)).toBe('consonant')
    for (const letter of COMPAT_FINALS) expect(jamoKind(letter)).toBe('consonant')
    for (const letter of COMPAT_MEDIALS) expect(jamoKind(letter)).toBe('vowel')
    // Nineteen initials and eleven clusters that only a final uses: 30 consonants, 21 vowels.
    expect(HANGUL_CONSONANTS).toHaveLength(30)
    expect(HANGUL_VOWELS).toHaveLength(21)
    expect(jamoKind('A')).toBeNull()
    expect(jamoKind('⿰')).toBeNull()
  })

  it('sets a syllable by its 配置', () => {
    // A vertical vowel stands at the right, a horizontal one below; a final follows below.
    expect(hangulIdsOf('가')).toBe('⿰ㄱㅏ')
    expect(hangulIdsOf('공')).toBe('⿳ㄱㅗㅇ')
    expect(hangulIdsOf('않')).toBe('⿱⿰ㅇㅏ⿰ㄴㅎ')
    // A compound vowel and a double final are two letters of their own.
    expect(hangulIdsOf('과')).toBe('⿰ㄱ⿰ㅗㅏ')
    expect(hangulIdsOf('값')).toBe('⿱⿰ㄱㅏ⿰ㅂㅅ')
    expect(hangulIdsOf('몫')).toBe('⿳ㅁㅗ⿰ㄱㅅ')
    expect(hangulIdsOf('의')).toBe('⿰ㅇ⿰ㅡㅣ')
    expect(hangulIdsOf('한')).toBe('⿱⿰ㅎㅏㄴ')
    expect(hangulIdsOf('A')).toBeNull()
    expect(hangulIdsOf('가')).toBeNull()
  })

  it('composes a description back to its syllable', () => {
    expect(hangulOfIds('⿰ㄱㅏ')).toBe('가')
    expect(hangulOfIds('⿳ㄱㅗㅇ')).toBe('공')
    expect(hangulOfIds('⿱⿰ㅇㅏ⿰ㄴㅎ')).toBe('않')
    // The same letters read as the same syllable however they are grouped.
    expect(hangulOfIds('⿱⿰ㅇㅏㄶ')).toBe('않')
    expect(hangulOfIds('⿱아ㄶ')).toBe('않')
    // A description that sets its letters another way is not that syllable.
    expect(hangulOfIds('⿰ㅏㄱ')).toBeNull()
    expect(hangulOfIds('⿰ㄱㅏㄴ')).toBeNull()
    expect(hangulOfIds('⿰亻木')).toBeNull()
  })

  it('round-trips all 11,172 precomposed syllables', () => {
    let counted = 0
    for (let cp = 0xac00; cp <= 0xd7a3; cp++) {
      const syllable = String.fromCodePoint(cp), ids = hangulIdsOf(syllable)
      if (!ids) continue
      expect(hangulOfIds(ids)).toBe(syllable)
      counted++
    }
    expect(counted).toBe(11172)
  })

  it('reads the letters of a syllable', () => {
    expect(hangulLetters('않')).toEqual({ initial: 'ㅇ', medial: 'ㅏ', final: 'ㄶ' })
    expect(hangulLetters('가')).toEqual({ initial: 'ㄱ', medial: 'ㅏ', final: '' })
    expect(hangulLetters('A')).toBeNull()
  })
})

describe('a description with an empty slot', () => {
  it('draws as written instead of reading as a syllable', () => {
    expect(hangulOfIds('⿰⬚⿰ㄱㅏ')).toBeNull()
    expect(hangulOfIds('⿰ㄱㅏ')).toBe('가')
  })
})
