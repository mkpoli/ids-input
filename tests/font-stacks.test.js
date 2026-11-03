import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** @param {string} css */
const stacks = css => Object.fromEntries([...css.matchAll(/--cjk-(sans|serif|klee):\s*([^;]+);/g)].map(([, name, value]) => [name, value]))

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
