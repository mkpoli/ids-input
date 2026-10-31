#!/usr/bin/env bun
// `dist/sitemap.xml` from the pages the worker serves: the workshop, its two comparison pages, and
// every starter sequence at the path a share link uses. Run from `build:site` after `build:demo`.
//
//   bun scripts/build-sitemap.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXAMPLES } from '../demo/lib/examples.js'
import { pathOf } from '../worker/page.js'

const ORIGIN = 'https://ids.mkpo.li'
const PAGES = ['/', '/compare', '/engines']

/** @param {string} path */
const loc = path => `<url>\n    <loc>${ORIGIN}${path.replace(/&/g, '&amp;')}</loc>\n  </url>`

const paths = [...new Set([...PAGES, ...EXAMPLES.map(example => pathOf(example.sequence))])]
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${paths.map(loc).join('\n  ')}
</urlset>
`
mkdirSync(join(import.meta.dirname, '../dist'), { recursive: true })
writeFileSync(join(import.meta.dirname, '../dist/sitemap.xml'), xml)
console.log(`sitemap: ${paths.length} pages`)
