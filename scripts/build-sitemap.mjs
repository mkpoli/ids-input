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
import { LOCALE_CODES, LOCALIZED_PATHS, alternates, localeUrl } from '../worker/locale.js'

const ORIGIN = 'https://ids.mkpo.li'
const PAGES = ['/', '/compare', '/font-compare', '/font-mixer', '/engines', '/sources', '/open-data', '/unencoded', '/component-atlas', '/ucv', '/normalization', '/baishi', '/baishi-cheatsheet', '/baishi-railroad', '/components', '/history']

/** @param {string} loc @param {[string, string][]} readings */
const url = (loc, readings = []) => `<url>\n    <loc>${loc}</loc>${readings.map(([code, href]) => `\n    <xhtml:link rel="alternate" hreflang="${code}" href="${href}"/>`).join('')}\n  </url>`

/** The sitemap, which lists each shared page once: a page with a reading in every language at
 *  each reading's address, every one naming the others. */
export function sitemapXml() {
  const paths = [...new Set([...PAGES, ...EXAMPLES.map(example => pathOf(example.sequence))])]
  const urls = paths.flatMap(path => LOCALIZED_PATHS.includes(path)
    ? [`${ORIGIN}${path}`, ...LOCALE_CODES.map(code => localeUrl(ORIGIN, path, code))].map(loc => url(loc, alternates(ORIGIN, path)))
    : [url(`${ORIGIN}${path}`)])
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${urls.join('\n  ')}
</urlset>
`
}

if (import.meta.main) {
  const xml = sitemapXml()
  mkdirSync(join(import.meta.dirname, '../dist'), { recursive: true })
  writeFileSync(join(import.meta.dirname, '../dist/sitemap.xml'), xml)
  console.log(`sitemap: ${xml.split('<url>').length - 1} pages`)
}
