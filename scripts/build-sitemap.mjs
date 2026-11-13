#!/usr/bin/env bun
// `dist/sitemap.xml` from the pages the worker serves: the workshop, its comparison pages, its
// source catalogue, and every starter sequence at the path a share link uses. Run from
// `build:site` after `build:demo`.
//
//   bun scripts/build-sitemap.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXAMPLES } from '../demo/lib/examples.js'
import { pathOf } from '../worker/page.js'

const ORIGIN = 'https://ids.mkpo.li'
const PAGES = ['/', '/compare', '/engines', '/sources', '/open-data', '/unencoded', '/ucv', '/normalization', '/components']

/** @param {string} path */
const url = path => `<url>\n    <loc>${ORIGIN}${path}</loc>\n  </url>`

/** The sitemap, which lists each shared page once. */
export function sitemapXml() {
  const paths = [...new Set([...PAGES, ...EXAMPLES.map(example => pathOf(example.sequence))])]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${paths.map(url).join('\n  ')}
</urlset>
`
}

if (import.meta.main) {
  const xml = sitemapXml()
  mkdirSync(join(import.meta.dirname, '../dist'), { recursive: true })
  writeFileSync(join(import.meta.dirname, '../dist/sitemap.xml'), xml)
  console.log(`sitemap: ${xml.split('<url>').length - 1} pages`)
}
