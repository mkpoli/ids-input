import { describe, expect, it } from 'bun:test'
import { LIMITS, shareLink } from '../demo/lib/report.js'

describe('the share link a report carries', () => {
  it('passes a short one through', () => {
    expect(shareLink('https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3?ids=%E2%BF%B0%E6%9C%A8%E5%8F%A3&doc=abc'))
      .toBe('https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3?ids=%E2%BF%B0%E6%9C%A8%E5%8F%A3&doc=abc')
  })
  it('drops a document too long rather than cutting into it', () => {
    const long = `https://ids.mkpo.li/x?ids=abc&doc=${'z'.repeat(LIMITS.link)}`
    const link = shareLink(long)
    expect(link).toStartWith('https://ids.mkpo.li/x?ids=abc')
    expect(link).not.toContain('doc=')
    expect(link.length).toBeLessThanOrEqual(LIMITS.link)
  })
  it('drops a link that is still over once its document is gone', () => {
    // A cut link would open a different sequence, so a `link` over the field's size is no link.
    expect(shareLink(`https://ids.mkpo.li/x?ids=${'a'.repeat(LIMITS.link * 2)}`)).toBe('')
  })
})
