// @ts-nocheck
// A page in each of its languages: `?lang=ja` is an address of its own, with the title, the
// description and the language of that reading, and every reading names the others.

import { LOCALES, appMessages } from '../demo/lib/locales.js'
import { ENGLISH_ONLY, home, pages } from '../demo/lib/pages.js'

/** The language the static pages are written in. A bare address shows the reader's own language,
 *  so it is no language's reading; it stands for readers of any other. */
export const DEFAULT_LOCALE = 'en'
export const LOCALE_CODES = LOCALES.map(([code]) => code)

const ENGLISH = { ...LOCALES[0][2], ...appMessages(DEFAULT_LOCALE) }
/** @param {string} locale */
const translator = locale => {
  const messages = { ...LOCALES.find(([code]) => code === locale)?.[2], ...appMessages(locale) }
  /** @param {string} key */
  return key => messages[key] ?? ENGLISH[key] ?? key
}

/** The paths that have a reading in every language. */
export const LOCALIZED_PATHS = ['/', ...pages(key => key).filter(page => !ENGLISH_ONLY.has(page.id)).map(page => `/${page.id}`)]

/** The address of `path` in `locale`. @param {string} origin @param {string} path @param {string} locale */
export const localeUrl = (origin, path, locale) => `${origin}${path}?lang=${locale}`

/** Every reading of `path` as `[hreflang, address]`, the bare address standing for readers of any
 *  other language. @param {string} origin @param {string} path
 *  @returns {[string, string][]} */
export const alternates = (origin, path) => [
  ...LOCALE_CODES.map(code => /** @type {[string, string]} */ ([code, localeUrl(origin, path, code)])),
  ['x-default', `${origin}${path}`],
]

/** The title and description of `path` in `locale`. @param {string} path @param {string} locale */
export function pageMeta(path, locale) {
  const t = translator(locale)
  if (path === '/') return home(t)
  const page = pages(t).find(entry => `/${entry.id}` === path)
  return page ? { title: `${page.label} — ${t('app.title')}`, description: page.description } : null
}

const escaped = text => text.replace(/[&<>"']/g, mark => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[mark])

/** @param {string} html @param {string} attribute @param {string} value */
const withContent = (html, attribute, value) => html.replace(new RegExp(`(<meta ${attribute} content=")[^"]*"`), (_, head) => `${head}${escaped(value)}"`)

/**
 * A localized page as its address reads it: the tags naming its readings, and where the address
 * names a language, that reading's language and canonical address, with its title and description.
 * @param {string} html The served page. @param {string} path @param {string | null} wanted The `lang` the address carries.
 * @param {string} origin
 */
export function localizedHtml(html, path, wanted, origin) {
  const locale = wanted && LOCALE_CODES.includes(wanted) ? wanted : null
  const links = alternates(origin, path).map(([code, href]) => `<link rel="alternate" hreflang="${code}" href="${escaped(href)}">`).join('\n  ')
  let out = html
  if (locale) {
    const address = localeUrl(origin, path, locale)
    out = out.replace(/<html lang="[^"]*"/, () => `<html lang="${locale}"`)
      .replace(/<link rel="canonical"[^>]*>/, () => `<link rel="canonical" href="${escaped(address)}">`)
    out = withContent(out, 'property="og:url"', address)
    // The static page is the English reading already.
    const meta = locale === DEFAULT_LOCALE ? null : pageMeta(path, locale)
    if (meta) {
      out = out.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escaped(meta.title)}</title>`)
      for (const attribute of ['property="og:title"', 'name="twitter:title"']) out = withContent(out, attribute, meta.title)
      for (const attribute of ['name="description"', 'property="og:description"', 'name="twitter:description"']) out = withContent(out, attribute, meta.description)
    }
  }
  return out.replace(/(<link rel="canonical"[^>]*>)/, (_, canonical) => `${canonical}\n  ${links}`)
}
