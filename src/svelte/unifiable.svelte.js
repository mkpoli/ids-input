// @ts-check
// The other forms of a component's UCV entries, for each entry that has one to put in its place: a
// character or a description. The list is read once a component is asked about, the drawings once an
// entry is shown; a form with no text shows only as its drawing.
import { variantOf } from '../core/ids.js'
import { loadUcvIndex, loadUcvOutlines } from './ucv.js'

/** @param {() => string} component the component, or '' for none */
export function createUnifiable(component) {
  let ucv = $state.raw(/** @type {import('../core/ucv.js').UcvIndex | null} */ (null))
  let outlines = $state.raw(/** @type {Record<string, string> | null} */ (null))
  $effect(() => { if (component() && !ucv) loadUcvIndex().then(index => { ucv = index }, () => {}) })
  const offered = $derived.by(() => {
    const part = component()
    if (!ucv || !part) return []
    // A variant identifier after the component names one of its forms; the entries are the component's.
    const base = variantOf(part).base
    return ucv.formsOf(base).filter(entry => entry.kind === 'unifiable')
      .map(entry => ({ id: entry.id, forms: entry.forms.filter(form => form.text !== base) }))
      .filter(entry => entry.forms.some(form => form.text))
  })
  $effect(() => { if (offered.length && !outlines) loadUcvOutlines().then(found => { outlines = found }, () => {}) })
  const entries = $derived(offered.map(entry => ({ id: entry.id, forms: entry.forms.filter(form => form.text || outlines?.[form.glyph]) })))
  return {
    get entries() { return entries },
    get outlines() { return outlines },
  }
}
