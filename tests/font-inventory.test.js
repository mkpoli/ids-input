import { describe, expect, test } from 'bun:test'
import inventory from '../demo/lib/font-inventory.json' with { type: 'json' }
import { summarizeOutlineFonts } from '../scripts/build-font-inventory.mjs'

describe('font-inventory source font derivation', () => {
  test('summarizes Sans as Noto Sans CJK JP + Plangothic P1/P2 without Jigmo', () => {
    const res = summarizeOutlineFonts({
      licences: {
        outlines: {
          fonts: [
            { name: 'Noto Sans CJK JP' },
            { name: 'Plangothic P1' },
            { name: 'Plangothic P2' },
          ],
        },
      },
    })
    expect(res.font).toBe('Noto Sans CJK JP + Plangothic P1/P2')
    expect(res.fallback).toBe('Plangothic P1/P2')
  })

  test('collapses Jigmo planes and strips preview qualifiers', () => {
    const res = summarizeOutlineFonts({
      licences: {
        outlines: {
          fonts: [
            { name: 'Zhuque Fangsong (technical preview)' },
            { name: 'Jigmo2' },
            { name: 'Jigmo3' },
            { name: 'Jigmo' },
          ],
        },
      },
    })
    expect(res.font).toBe('Zhuque Fangsong + Jigmo')
    expect(res.fallback).toBe('Jigmo')
  })

  test('collapses TW-Kai extensions and preserves Nôm Na Tống diacritics', () => {
    expect(summarizeOutlineFonts({
      licences: {
        outlines: {
          fonts: [{ name: 'TW-Kai' }, { name: 'TW-Kai-Ext-B' }, { name: 'TW-Kai-Ext-G' }],
        },
      },
    })).toMatchObject({ font: 'TW-Kai + Ext-B/G', fallback: 'Ext-B/G' })

    expect(summarizeOutlineFonts({
      licences: {
        outlines: {
          fonts: [{ name: 'Nom Na Tong' }],
        },
      },
    })).toMatchObject({ font: 'Nôm Na Tống', fallback: 'None (native only)' })
  })

  test('checked-in font-inventory.json lists Plangothic (not Jigmo) for Sans', () => {
    const byKey = Object.fromEntries(inventory.faces.map(f => [f.key, f]))
    expect(byKey.sans.font).toBe('Noto Sans CJK JP + Plangothic P1/P2')
    expect(byKey.sans.fallback).toBe('Plangothic P1/P2')
    expect(byKey.sans.font).not.toContain('Jigmo')
    expect(byKey.serif.font).toBe('Noto Serif CJK JP + Jigmo')
    expect(byKey.woodblock.font).toBe('Nôm Na Tống')
    expect(byKey.fangsong.font).toBe('Zhuque Fangsong + Jigmo')
    expect(byKey.regular.font).toBe('TW-Kai + Ext-B/G')
    expect(byKey['pen-writing'].font).toBe('Kureedo Full + GenZui Sans')
  })
})
