import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url))
const css = read('fonts/fonts.css').toString()
const woff2 = path => [...read(path).subarray(0, 4)].map(byte => String.fromCharCode(byte)).join('')

describe('the IDS operators webfont', () => {
  it('ships the twelve description characters from Noto under one face', () => {
    expect(woff2('fonts/NotoSansCJKjp-ids-operators.woff2')).toBe('wOF2')
    expect(css).toContain('font-family:"IDS Operators"')
    expect(css).toMatch(/IDS Operators[^}]*unicode-range:U\+2FF0-2FFB/)
  })
  it('ships the four newer description characters from Jigmo under the same face', () => {
    const bytes = read('fonts/Jigmo-ids-operators.woff2')
    expect(woff2('fonts/Jigmo-ids-operators.woff2')).toBe('wOF2')
    expect(css).toMatch(/Jigmo-ids-operators\.woff2[^}]*unicode-range:U\+2FFC-2FFF/)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('6d0b56a57d435cfc59c1dda56cbeb123ec081f0b586898bfe5b2c0d31399ef50')
  })
  it('sits in the text stacks before the installed fonts', () => {
    for (const path of ['src/svelte/IdsSequence.svelte', 'src/svelte/IdsTree.svelte', 'src/svelte/IdsSearch.svelte', 'src/svelte/IdsCharacterInfo.svelte', 'demo/app.css', 'demo/ui/ReportDialog.svelte'])
      expect([path, read(path).toString().includes('"IDS Operators"') || read(path).toString().includes("'IDS Operators'")]).toEqual([path, true])
  })
})
