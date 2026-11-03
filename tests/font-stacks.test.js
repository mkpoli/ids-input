import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** @param {string} css */
const stacks = css => Object.fromEntries([...css.matchAll(/--cjk-(sans|serif|klee):\s*([^;]+);/g)].map(([, name, value]) => [name, value]))
/** @param {string} css */
const labelStacks = css => Object.fromEntries([...css.matchAll(/--cjk-label-(sans|serif|klee):\s*([^;]+);/g)].map(([, name, value]) => [name, value]))

// The installed fonts draw the common characters; Jigmo and the bundled shards fill only what they
// lack. A stack that names the fallback first draws a serif Jigmo in the Sans face.
describe('the workshop font stacks', () => {
  for (const path of ['demo/app.css', 'demo/donor-review.css']) {
    it(`${path} puts the chosen face before the fallback`, () => {
      const face = stacks(read(path))
      for (const [name, stack] of Object.entries(face)) {
        const installed = name === 'serif' ? 'Noto Serif CJK JP' : 'Noto Sans CJK JP'
        expect([path, name, stack.includes(installed)]).toEqual([path, name, true])
        expect([path, name, stack.split('--ids-glyph-fallback').length - 1]).toEqual([path, name, 1])
        expect([path, name, stack.indexOf(installed) < stack.indexOf('--ids-glyph-fallback')]).toEqual([path, name, true])
      }
    })
  }
})

// The switch names each face on its own label, so the label stacks are separate from the glyph
// stacks: the fallback outlines would draw a common character before the named face.
describe('the font switch label stacks', () => {
  const face = labelStacks(read('demo/app.css'))
  it('covers the three faces', () => {
    expect(Object.keys(face).sort()).toEqual(['klee', 'sans', 'serif'])
  })
  for (const [name, installed] of [['sans', 'Noto Sans CJK JP'], ['serif', 'Noto Serif CJK JP'], ['klee', 'Kureedo Label']]) {
    it(`${name} starts from its own face`, () => {
      const stack = face[name]
      expect(stack.includes(installed)).toBe(true)
      expect(stack.indexOf(installed) < stack.indexOf('--ids-glyph-fallback')).toBe(true)
    })
  }
  it('keeps the Kaisho name in one face where Kureedo lacks its glyphs', () => {
    const app = read('demo/App.svelte')
    expect(app).toContain('.font-choice .wide.klee:lang(zh-Hans)')
    expect(app).toContain('.font-choice .wide.klee:lang(vi)')
  })
})

describe('the Kaisho label subset', () => {
  const css = read('fonts/fonts.css')
  it('registers the subset for the name and the Aa sample', () => {
    const face = css.match(/@font-face\{font-family:"Kureedo Label";src:url\("\.\/Kureedo-label\.woff2"\)[^}]*unicode-range:([^}]*)\}/)
    expect(face).not.toBeNull()
    for (const range of ['U+0020-007E', 'U+66F8', 'U+6977']) expect(face[1]).toContain(range)
  })
  it('ships the file whose digest the README records', () => {
    const bytes = readFileSync(new URL('../fonts/Kureedo-label.woff2', import.meta.url))
    const digest = createHash('sha256').update(bytes).digest('hex')
    expect(read('fonts/README.md')).toContain(digest)
  })
})
