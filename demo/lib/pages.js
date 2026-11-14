// The workshop's pages beside the editor, each named by its title. The about dialog lists them,
// and each page's title opens them.
/** @param {(key: string) => string} t */
export const pages = t => [
  { id: 'sources', label: t('sources.title') },
  { id: 'unencoded', label: t('appendix.title') },
  { id: 'component-atlas', label: t('app.atlas') },
  { id: 'ucv', label: t('ucv.title') },
  { id: 'normalization', label: t('normalization.title') },
  { id: 'open-data', label: t('app.openData') },
  { id: 'compare', label: t('app.compare') },
  { id: 'engines', label: t('app.engines') },
]
