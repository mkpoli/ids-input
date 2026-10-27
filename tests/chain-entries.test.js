import { describe, expect, it } from 'bun:test'
import { chainCharacter, readChainEntries } from '../src/core/chain-entries.js'

const table = `# zi.tools descriptions carrying a stroke chain
#(H)\t一
⿱丿⿹#(-𠃌㇉)一\t乌
#(S)(.)\t丨
#(S)\t丨
`

describe('the chain description table', () => {
  it('reads one description and character per line, comments aside', () => {
    const entries = readChainEntries(table)
    expect(entries.size).toBe(4)
    expect(entries.get('⿱丿⿹#(-𠃌㇉)一')).toBe('乌')
    expect(readChainEntries('')).toEqual(new Map())
    expect(readChainEntries('broken line')).toEqual(new Map())
  })
  it('names the character a description with a stroke chain describes, with or without its note', () => {
    const entries = readChainEntries(table)
    expect(chainCharacter(entries, '⿱丿⿹#(-𠃌㇉)一')).toBe('乌')
    expect(chainCharacter(entries, '#(S)(.)')).toBe('丨')
    expect(chainCharacter(entries, '#(S)')).toBe('丨')
    expect(chainCharacter(entries, '  #(H)  ')).toBe('一')
    // Without a chain, or with one the table does not name, nothing resolves.
    expect(chainCharacter(entries, '⿱木口')).toBeNull()
    expect(chainCharacter(entries, '⿱丿⿹#(ZZZ)一')).toBeNull()
    // A pure chain the table does not name stays unknown: dropping its parentheses would leave
    // `#`, which is no description.
    expect(chainCharacter(entries, '#(ZZZ)')).toBeNull()
    expect(chainCharacter(entries, '#')).toBeNull()
    expect(chainCharacter(entries, '')).toBeNull()
  })
})
