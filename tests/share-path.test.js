import { describe, expect, it } from 'bun:test'
import { linkTo, sequenceFrom } from '../demo/lib/share.js'
import { fromSequence } from '../src/document/index.js'

describe('a share link', () => {
  it('carries the sequence in the path, and reads it back', () => {
    const where = new URL('https://ids.mkpo.li/')
    const link = linkTo('⿰釒哥', where)
    expect(link).toBe('https://ids.mkpo.li/s/%E2%BF%B0%E9%87%92%E5%93%A5')
    expect(sequenceFrom(new URL(link))).toBe('⿰釒哥')
  })
  it('keeps what the sequence cannot carry, and drops the old hash', () => {
    const document = fromSequence('⿰木子')
    document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 12, 0] }]
    const link = linkTo('⿰木子', new URL('https://ids.mkpo.li/s/%E2%BF%B0%E6%9C%A8%E5%AD%90#%E2%BF%B0%E6%9C%A8%E5%AD%90'), document)
    expect(link).toStartWith('https://ids.mkpo.li/s/%E2%BF%B0%E6%9C%A8%E5%AD%90?doc=')
    expect(link).not.toContain('#')
  })
  it('goes back to the root for an empty sequence', () => {
    expect(linkTo('', new URL('https://ids.mkpo.li/s/%E2%BF%B0%E6%9C%A8%E5%AD%90'))).toBe('https://ids.mkpo.li/')
  })
  it('still reads a hash or a query from an older link', () => {
    expect(sequenceFrom(new URL('https://ids.mkpo.li/#%E2%BF%B0%E6%9C%A8%E5%AD%90'))).toBe('⿰木子')
    expect(sequenceFrom(new URL('https://ids.mkpo.li/?ids=%E2%BF%B0%E6%9C%A8%E5%AD%90'))).toBe('⿰木子')
    expect(sequenceFrom(new URL('https://ids.mkpo.li/'))).toBe('')
  })
})
