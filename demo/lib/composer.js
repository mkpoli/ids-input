// The han-compose export the demo draws from. `?composer=`, VITE_COMPOSER_BASE or Preferences point
// the preview elsewhere; the prepared example drawings are made from this export, so a new export
// means a new COMPOSER_BASE and `bun run build:example-drawings`.
import { LOCAL_SANS } from './desktop.js'

export const COMPOSER_BASE = 'https://glyphatlas.org/atlas/composer/bd0829bc6fbf-sans-compose-layout-v4-f5+letters/'
// The Kaisho, Fangsong and Serif exports (han-compose `export-web`) are uploaded beside the sans one.
export const COMPOSER_BASES = {
  sans: COMPOSER_BASE,
  serif: 'https://ids-input-composer.mkpoli.workers.dev/8156f838798c-serif-compose-layout-v4-serif-f6/',
  fangsong: 'https://ids-input-composer.mkpoli.workers.dev/9f797e2322d2-fangsong-compose-layout-v4-fangsong-f6/',
  klee: 'https://glyphatlas.org/atlas/composer/e1e0af4b94e6-kaisho-compose-layout-v4-kaisho-f5/',

}

/** Where this build reads an export from: the desktop app holds a copy of the sans export, and
 *  every other export is read where it is published. @param {string} base */
export const readFrom = base => LOCAL_SANS && base.replace(/\/?$/, '/') === COMPOSER_BASE ? LOCAL_SANS : base
