// The colour theme: the system's, or light or dark whatever it says. It is kept per viewer and set
// on the root as data-theme before the page paints (the script in index.html), so no other theme
// flashes first.
import { load, save } from './storage.js'

/** @typedef {'system' | 'light' | 'dark'} Theme */
export const THEMES = /** @type {Theme[]} */ (['system', 'light', 'dark'])

/** @returns {Theme} */
export function storedTheme() {
  const theme = load('theme', 'system')
  return THEMES.includes(theme) ? theme : 'system'
}

/** @param {Theme} theme */
export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  save('theme', theme === 'system' ? undefined : theme)
}
