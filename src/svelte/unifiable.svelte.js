// @ts-check
// The other forms of the chosen component's UCV entries, for each entry that has one to put in its
// place: a character, a description, or a form no code point names, written with its identifier
// where the adapter draws such forms. The list is read once a component is asked about, the drawings
// once an entry is shown; a form that cannot be written shows only as its drawing.
import { marksOf } from '../core/marks.js'
import { occurrenceChoices } from '../core/ucv-choice.js'
import { loadUcvIndex, loadUcvOutlines } from './ucv.js'

/** @param {import('./editor.svelte.js').Editor} editor */
export function decompositionChoices(editor) {
  const search = editor.alternatives
  if (search.loading) return editor.splits
  const marks = marksOf(editor.picked ?? null)
  // Recursive expansions already carry the host's trailing marks. The chooser
  // restores them once after replacing the selected component.
  const expanded = search.found.filter(item => item.operation === 'expand').map(item =>
    marks && marksOf(item.tree).endsWith(marks) ? item.text.slice(0, -marks.length) : item.text)
  return [...editor.splits, ...expanded]
}

/** @param {() => import('./editor.svelte.js').Editor} of the editor @param {() => boolean} [wanted] whether the forms are asked for */
export function createUnifiable(of, wanted = () => true) {
  const component = () => wanted() ? of().picked : null
  let ucv = $state.raw(/** @type {import('../core/ucv.js').UcvIndex | null} */ (null))
  let outlines = $state.raw(/** @type {Record<string, string> | null} */ (null))
  $effect(() => { if (component() && !ucv) loadUcvIndex().then(index => { ucv = index }, () => {}) })
  const offered = $derived(ucv ? occurrenceChoices(ucv, component(), decompositionChoices(of())) : [])
  $effect(() => { if (offered.length && !outlines) loadUcvOutlines().then(found => { outlines = found }, () => {}) })
  return {
    get entries() { return offered },
    get outlines() { return outlines },
  }
}
