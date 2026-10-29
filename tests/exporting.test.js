import { describe, expect, it } from 'bun:test'
import { DEFAULTS, scopedSvgOf } from '../demo/lib/exporting.js'

const scopes = { root: { kind: 'slot', node: 'slot' }, complete: true, issues: [] }

describe('scoped export', () => {
  it('draws empty slots only when the setting is on', () => {
    const on = scopedSvgOf(scopes, { ...DEFAULTS, placeholders: true }, 512, [[100, 100, 300, 500]])
    const off = scopedSvgOf(scopes, { ...DEFAULTS, placeholders: false }, 512, [[100, 100, 300, 500]])
    expect(on).toContain('stroke-dasharray="12 8"')
    expect(on).toContain('width="512" height="512"')
    expect(off).not.toContain('stroke-dasharray="12 8"')
  })
})
