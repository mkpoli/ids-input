// The han-compose export the demo draws from. `?composer=`, VITE_COMPOSER_BASE or Preferences point
// the preview elsewhere; the prepared example drawings are made from this export, so a new export
// means a new COMPOSER_BASE and `bun run build:example-drawings`.
export const COMPOSER_BASE = 'https://glyphatlas.org/atlas/composer/bd0829bc6fbf-sans-compose-layout-v4-f5+letters/'
// The Kaisho and Serif exports (han-compose `export-web`) are uploaded beside the sans one.
export const COMPOSER_BASES = {
  sans: COMPOSER_BASE,
  serif: 'https://glyphatlas.org/atlas/composer/62af8c26f961-serif-compose-layout-v4-serif-f5/',
  klee: 'https://glyphatlas.org/atlas/composer/e1e0af4b94e6-kaisho-compose-layout-v4-kaisho-f5/',
}
