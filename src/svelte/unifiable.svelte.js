// @ts-check
// The other forms of the chosen component's UCV entries, for each entry that has one to put in its
// place: a character, a description, or a form no code point names, written with its identifier
// where the adapter draws such forms. The list is read once a component is asked about, the drawings
// once an entry is shown; a form that cannot be written shows only as its drawing.
import { variantOf } from '../core/ids.js'
import { ucvIdentifier } from '../core/forms.js'
import { loadUcvIndex, loadUcvOutlines } from './ucv.js'

/** @param {() => import('./editor.svelte.js').Editor} of the editor @param {() => boolean} [wanted] whether the forms are asked for */
export function createUnifiable(of, wanted = () => true) {
  const component = () => { const picked = of().picked; return wanted() && typeof picked === 'string' ? picked : '' }
  let ucv = $state.raw(/** @type {import('../core/ucv.js').UcvIndex | null} */ (null))
  let outlines = $state.raw(/** @type {Record<string, string> | null} */ (null))
  $effect(() => { if (component() && !ucv) loadUcvIndex().then(index => { ucv = index }, () => {}) })
  const offered = $derived.by(() => {
    const part = component()
    if (!ucv || !part) return []
    // A variant identifier after the component names one of its forms; the entries are the component's.
    const base = variantOf(part).base
    // A component that is the whole text takes no identifier: only a description carries one.
    const editor = of()
    const named = Boolean(editor.adapter.formed) && (editor.chosen?.length ?? 0) > 0
    return ucv.formsOf(base).filter(entry => entry.kind === 'unifiable')
      .map(entry => ({ id: entry.id, forms: entry.forms.map((form, at) => {
        const id = form.text || !named || form.undrawn ? null : ucvIdentifier(entry.id, at + 1, entry.forms.length)
        return { ...form, write: form.text ?? (id ? base + id : null) }
      }).filter(form => form.write !== part) }))
      .filter(entry => entry.forms.some(form => form.write))
  })
  $effect(() => { if (offered.length && !outlines) loadUcvOutlines().then(found => { outlines = found }, () => {}) })
  const entries = $derived(offered.map(entry => ({ id: entry.id, forms: entry.forms.filter(form => form.write || outlines?.[form.glyph]) })))
  return {
    get entries() { return entries },
    get outlines() { return outlines },
  }
}
