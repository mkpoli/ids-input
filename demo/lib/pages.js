// The workshop's pages beside the editor, each named by its title, marked by an icon and described
// in a sentence. The about dialog lists them, each page's title opens them, and the worker writes
// the title and the description into the page a `?lang=` address answers with.
/** @param {(key: string) => string} t */
export const pages = t => [
  { id: 'sources', icon: 'book', label: t('sources.title'), description: t('page.sources.description') },
  { id: 'components', icon: 'layers', label: t('library.title'), description: t('page.components.description') },
  { id: 'unencoded', icon: 'unencoded', label: t('appendix.title'), description: t('page.unencoded.description') },
  { id: 'component-atlas', icon: 'grid', label: t('app.atlas'), description: t('page.component-atlas.description') },
  { id: 'ucv', icon: 'variants', label: t('ucv.title'), description: t('page.ucv.description') },
  { id: 'normalization', icon: 'funnel', label: t('normalization.title'), description: t('page.normalization.description') },
  { id: 'history', icon: 'clock', label: t('history.title'), description: t('page.history.description') },
  { id: 'baishi', icon: 'document', label: t('baishi.title'), description: t('page.baishi.description') },
  { id: 'baishi-railroad', icon: 'railroad', label: t('railroad.title'), description: t('page.baishi-railroad.description') },
  { id: 'baishi-cheatsheet', icon: 'list', label: t('cheatsheet.title'), description: t('page.baishi-cheatsheet.description') },
  { id: 'open-data', icon: 'download', label: t('app.openData'), description: t('page.open-data.description') },
  { id: 'compare', icon: 'scales', label: t('app.compare'), description: t('page.compare.description') },
  { id: 'font-compare', icon: 'variants', label: t('fontCompare.title'), description: t('page.font-compare.description') },
  { id: 'font-inventory', icon: 'table', label: t('app.fontInventory'), description: t('page.font-inventory.description') },
  { id: 'font-mixer', icon: 'blend', label: t('fontMixer.title'), description: t('page.font-mixer.description') },
  { id: 'engines', icon: 'table', label: t('app.engines'), description: t('page.engines.description') },
]

/** The pages written in English alone, which have one address each. */
export const ENGLISH_ONLY = new Set(['open-data', 'engines', 'font-inventory'])

/** The editor's own title and description. @param {(key: string) => string} t */
export const home = t => ({ title: `${t('app.title')} — ${t('ids.label')}`, description: t('page.home.description') })
