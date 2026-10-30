import { describe, expect, it } from 'bun:test'
import { metaFor, pathOf, shareHtml } from '../worker/page.js'

describe('the tags a share link answers with', () => {
  const share = { sequence: '⿰釒哥', char: '鎶', origin: 'https://ids.mkpo.li' }
  it('names the sequence and its character, with the card image', () => {
    const { title, tags } = metaFor(share)
    expect(title).toBe('⿰釒哥 = 鎶 — IDS Workshop')
    expect(tags).toContain('content="https://ids.mkpo.li/og/%E2%BF%B0%E9%87%92%E5%93%A5.png"')
    expect(tags).toContain('U+93B6')
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image">')
  })
  it('says nothing of a code point where the sequence describes no character', () => {
    const { title, tags } = metaFor({ ...share, char: null })
    expect(title).toBe('⿰釒哥 — IDS Workshop')
    expect(tags).not.toContain('U+')
  })
  it('escapes what markup would read', () => {
    const { tags } = metaFor({ ...share, sequence: '⿰"<木>' })
    expect(tags).toContain('&quot;&lt;木&gt;')
  })
  it('replaces the home page\'s own tags instead of adding to them', () => {
    const html = '<head><title>Home</title><meta property="og:image" content="old"><meta name="twitter:card" content="summary"></head>'
    const page = shareHtml(html, share)
    expect(page).toContain('<title>⿰釒哥 = 鎶 — IDS Workshop</title>')
    expect(page).not.toContain('content="old"')
    expect(page.match(/og:image"/g)?.length).toBe(1)
    expect(page).not.toContain('content="summary"')
  })
  it('gives the path of the link', () => {
    expect(pathOf('⿰釒哥')).toBe('/s/%E2%BF%B0%E9%87%92%E5%93%A5')
  })
})
