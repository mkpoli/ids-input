// @ts-check
import catalog from './structure-templates.json' with { type: 'json' }

/** Two- to four-part layouts, ranked by distinct characters in the bundled IDS data. */
export const STRUCTURE_TEMPLATES = catalog.templates

/** Corpus versions, selection threshold, and coverage for the generated template catalogue. */
export const STRUCTURE_TEMPLATE_METADATA = {
  threshold: catalog.threshold,
  method: catalog.method,
  sources: catalog.sources,
  statistics: catalog.statistics,
}
