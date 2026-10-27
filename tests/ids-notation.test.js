import { describe, expect, it } from 'bun:test'
import { notation, sequences } from '../scripts/lib/ids-notation.mjs'

describe('what a description writes', () => {
  it('names plain descriptions, notes, modifiers, chains and their combinations', () => {
    expect(notation('⿰木木')).toBe('plain')
    expect(notation('⿻乚一(.,T)')).toBe('note')
    expect(notation('{士}⿱十一')).toBe('note')
    expect(notation('{?0丗}⿻⿺𠃊〢一(P)')).toBe('note')
    expect(notation('⿻[1:]丨日')).toBe('modifier')
    expect(notation('⿴[1]囗人')).toBe('modifier')
    expect(notation('㇯[2]王一')).toBe('modifier')
    expect(notation('⿱丿⿹#(-𠃌㇉)一')).toBe('chain')
    expect(notation('#(H)(.)')).toBe('note+chain')
    expect(notation('⿻[1:]⿰丿丨#(一-𠃍丨b一)')).toBe('modifier+chain')
    expect(notation('⿻[1:]亅⿱#(丿𠃊)八(.)')).toBe('note+modifier+chain')
    // A bracket after an operator that takes none is plain text, and a bracket-less digit is not a modifier.
    expect(notation('⿲[1]')).toBe('plain')
    expect(notation('⿸[1]厂人')).toBe('plain')
    expect(notation('⿰木[1]木')).toBe('plain')
  })
  it('splits a table into its sequences, both description columns and every variant', () => {
    const table = '# comment\n木\t⿰木木\t⿻十八\n口\t口;⿴囗一(.)\n'
    expect(sequences(table)).toEqual(['⿰木木', '⿻十八', '口', '⿴囗一(.)'])
    expect(sequences('')).toEqual([])
  })
})
