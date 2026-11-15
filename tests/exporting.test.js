import { describe, expect, it } from 'bun:test'
import { DEFAULTS, backgroundOf, keepSettings, scopedSvgOf, storedSettings } from '../demo/lib/exporting.js'
import { withStorage } from './fixtures/storage.js'

const scopes = { root: { kind: 'slot', node: 'slot' }, complete: true, issues: [] }

describe('export settings', () => {
  it('starts as a PNG on white', () => {
    expect(DEFAULTS.format).toBe('png')
    expect(DEFAULTS.background).toBe('white')
    expect(backgroundOf(DEFAULTS)).toBe('#ffffff')
    expect(scopedSvgOf(scopes, DEFAULTS, 256)).toContain('fill="#ffffff"')
  })

  it('keeps the viewer’s own settings over the defaults', () => withStorage({}, () => {
    keepSettings({ ...DEFAULTS, format: 'svg', background: 'none' })
    expect(storedSettings()).toEqual({ ...DEFAULTS, format: 'svg', background: 'none' })
  }))

  it('takes the new defaults where a legacy record kept the old ones', () => withStorage({
    'ids-input:export': JSON.stringify({ ...DEFAULTS, format: 'svg', background: 'none', size: 2048 }),
  }, () => {
    expect(storedSettings()).toEqual({ ...DEFAULTS, size: 2048 })
  }))

  it('keeps a legacy record’s chosen values', () => withStorage({
    'ids-input:export': JSON.stringify({ ...DEFAULTS, format: 'svg', background: 'black', padding: 0.12 }),
  }, () => {
    expect(storedSettings()).toEqual({ ...DEFAULTS, background: 'black', padding: 0.12 })
  }))

  it('fills a partial record from the defaults', () => withStorage({
    'ids-input:export': JSON.stringify({ size: 512 }),
  }, () => {
    expect(storedSettings()).toEqual({ ...DEFAULTS, size: 512 })
  }))

  it('leaves a record from a newer build alone', () => withStorage({
    'ids-input:export': JSON.stringify({ ...DEFAULTS, version: 3, format: 'svg', background: 'none' }),
  }, () => {
    expect(storedSettings()).toEqual({ ...DEFAULTS, format: 'svg', background: 'none' })
  }))
})

describe('scoped export', () => {
  it('draws empty slots only when the setting is on', () => {
    const on = scopedSvgOf(scopes, { ...DEFAULTS, placeholders: true }, 512, [[100, 100, 300, 500]])
    const off = scopedSvgOf(scopes, { ...DEFAULTS, placeholders: false }, 512, [[100, 100, 300, 500]])
    expect(on).toContain('stroke-dasharray="12 8"')
    expect(on).toContain('width="512" height="512"')
    expect(off).not.toContain('stroke-dasharray="12 8"')
  })
})
