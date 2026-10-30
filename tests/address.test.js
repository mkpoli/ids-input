import { describe, expect, it } from 'bun:test'
import { sequenceOfPath } from '../src/core/address.js'

describe('sequence paths', () => {
  it('takes one segment with no dot', () => {
    expect(sequenceOfPath('/%E2%BF%B0%E6%9C%A8')).toBe('⿰木')
    expect(sequenceOfPath('/%E2%BF%B0%E6%9C%A8/')).toBe('⿰木')
    expect(sequenceOfPath('/abc')).toBe('abc')
  })
  it('leaves the root, files and assets alone', () => {
    for (const path of ['/', '/embed.html', '/robots.txt', '/assets/index-3fa2.js', '/fixtures/x.html', '/a.b'])
      expect(sequenceOfPath(path)).toBeNull()
  })
  it('reads a malformed escape as no sequence', () => {
    expect(sequenceOfPath('/%E2%ZZ')).toBeNull()
    expect(sequenceOfPath('no-slash')).toBeNull()
  })
})
