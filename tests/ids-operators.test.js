import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url))
const css = read('fonts/fonts.css').toString()

describe('the IDS operators webfont', () => {
  it('ships the twelve description characters under one face', () => {
    const bytes = read('fonts/NotoSansCJKjp-ids-operators.woff2')
    expect([...bytes.subarray(0, 4)].map(byte => String.fromCharCode(byte)).join('')).toBe('wOF2')
    expect(css).toContain('font-family:"IDS Operators"')
    expect(css).toMatch(/IDS Operators[^}]*unicode-range:U\+2FF0-2FFB/)
  })
  it('sits in the text stacks before the installed fonts', () => {
    for (const path of ['src/svelte/IdsSequence.svelte', 'src/svelte/IdsTree.svelte', 'src/svelte/IdsSearch.svelte', 'src/svelte/IdsCharacterInfo.svelte', 'demo/app.css', 'demo/ui/ReportDialog.svelte'])
      expect([path, read(path).toString().includes('"IDS Operators"') || read(path).toString().includes("'IDS Operators'")]).toEqual([path, true])
  })
})
