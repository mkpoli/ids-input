import { describe, expect, it } from 'bun:test'
import { isPreviewHost } from '../demo/lib/report.js'

describe('a pull request’s preview', () => {
  it('is named by its own Workers address', () => {
    expect(isPreviewHost('pr-414-ids-input-workshop.mkpoli.workers.dev')).toBe(true)
    expect(isPreviewHost('feat-x-ids-input-workshop.mkpoli.workers.dev')).toBe(true)
    expect(isPreviewHost('ids-input-workshop.mkpoli.workers.dev')).toBe(true)
  })
  it('leaves every other page alone', () => {
    expect(isPreviewHost('ids.mkpo.li')).toBe(false)
    expect(isPreviewHost('localhost')).toBe(false)
    // The same account's other Workers addresses are not this site's previews.
    expect(isPreviewHost('example.mkpoli.workers.dev')).toBe(false)
  })
})
