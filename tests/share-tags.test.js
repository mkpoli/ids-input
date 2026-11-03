import { describe, expect, it } from 'bun:test'
import { metaFor, pathOf, shareHtml } from '../worker/page.js'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../demo/index.html', import.meta.url), 'utf8')

describe('the tags a share link answers with', () => {
  const share = { sequence: '⿰釒哥', char: '鎶', origin: 'https://ids.mkpo.li' }
  it('names the sequence and its character, with the card image', () => {
    const { title, tags } = metaFor(share)
    expect(title).toBe('⿰釒哥 = 鎶 (U+93B6) — IDS Workshop')
    expect(tags).toContain('content="https://ids.mkpo.li/og/%E2%BF%B0%E9%87%92%E5%93%A5.png"')
    expect(tags).toContain('U+93B6')
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image">')
  })
  it('names the character the card draws, so the page and its image agree', () => {
    // The card draws the example's character where the table names another one, such as the 講 the
    // sign writes with 设 for 讠; the page takes that same character.
    const { title, tags } = metaFor({ ...share, sequence: '⿰设冓', char: '講' })
    expect(title).toBe('⿰设冓 = 講 (U+8B1B) — IDS Workshop')
    expect(tags).toContain('content="The sequence ⿰设冓 composed as 講 (U+8B1B)"')
    expect(tags).not.toContain('U+8BC1')
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
    const html = shareHtml(page, share)
    expect(html).toContain('<title>⿰釒哥 = 鎶 (U+93B6) — IDS Workshop</title>')
    expect(html).not.toContain('IDS Workshop — Ideographic Description Sequence Editor')
    expect(html.match(/og:image"/g)?.length).toBe(1)
    expect(html.match(/<title>/g)?.length).toBe(1)
    expect(html).not.toContain('application/ld+json')
    expect(html).toContain('</head>')
  })
  it('keeps a dollar sign in the sequence out of the replacement pattern', () => {
    const html = shareHtml(page, { ...share, sequence: 'A$&B' })
    expect(html.match(/<\/head>/g)?.length).toBe(1)
    expect(html).toContain('<title>A$&amp;B = 鎶 (U+93B6) — IDS Workshop</title>')
  })
  it('gives the path of the link', () => {
    expect(pathOf('⿰釒哥')).toBe('/%E2%BF%B0%E9%87%92%E5%93%A5')
  })
})
