import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url))
const record = JSON.parse(read('fonts/unicode.json'))
const css = read('fonts/unicode.css').toString()

const shard = name => JSON.parse(gunzipSync(read(`data/unicode-outlines/${name}.json.gz`)).toString())
const expand = ranges => ranges.split(',').flatMap(part => {
  const [, from, to] = part.trim().match(/^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/)
  return Array.from({ length: parseInt(to ?? from, 16) - parseInt(from, 16) + 1 }, (_, k) => parseInt(from, 16) + k)
})
const faces = new Map([...css.matchAll(/@font-face\{[^}]*url\("\.\/unicode\/([0-9a-f]{3})\.woff2"\)[^}]*unicode-range:([^}]*)\}/g)]
  .map(([, name, ranges]) => [name, expand(ranges).sort((a, b) => a - b)]))

describe('the fallback webfont', () => {
  it('has a shard for every outline file, and no other', () => {
    const shipped = readdirSync(new URL('../fonts/unicode/', import.meta.url)).sort()
    expect(shipped).toEqual(Object.keys(record.files).map(name => `${name}.woff2`).sort())
    for (const name of shipped) expect([...read(`fonts/unicode/${name}`).subarray(0, 4)].map(byte => String.fromCharCode(byte)).join('')).toBe('wOF2')
  })

  it('records the files it ships', () => {
    for (const [name, entry] of Object.entries(record.files)) {
      const bytes = read(`fonts/unicode/${name}.woff2`)
      expect(bytes.length).toBe(entry.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)
    }
  })

  it('declares each file for exactly the characters it holds', () => {
    expect([...faces.keys()].sort()).toEqual(Object.keys(record.files).sort())
    for (const [name, points] of faces) {
      const characters = Object.keys(shard(name)).map(char => char.codePointAt(0)).sort((a, b) => a - b)
      expect(points).toEqual(characters)
      expect(points.length).toBe(record.files[name].count)
    }
  })

  it('is offered by the stylesheet the package documents', () => {
    expect(read('fonts/fonts.css').toString()).toContain('@import url("./unicode.css")')
    expect(css).toContain('font-family:"IDS Fallback"')
  })
})
