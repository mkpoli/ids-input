// The workshop's pages beside the editor, each named by its title and marked by an icon. The
// about dialog lists them, and each page's title opens them.
/** @param {(key: string) => string} t */
export const pages = t => [
  { id: 'sources', icon: 'book', label: t('sources.title') },
  { id: 'unencoded', icon: 'unencoded', label: t('appendix.title') },
  { id: 'component-atlas', icon: 'grid', label: t('app.atlas') },
  { id: 'ucv', icon: 'variants', label: t('ucv.title') },
  { id: 'normalization', icon: 'funnel', label: t('normalization.title') },
  { id: 'open-data', icon: 'download', label: t('app.openData') },
  { id: 'compare', icon: 'scales', label: t('app.compare') },
  { id: 'engines', icon: 'table', label: t('app.engines') },
]
