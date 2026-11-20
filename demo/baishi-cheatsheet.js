import { mount, tick } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import BaishiCheatsheet from './BaishiCheatsheet.svelte'

const serif = new URLSearchParams(location.search).get('face') === 'serif'
  ? await import('./lib/baishi-serif.js') : null
mount(BaishiCheatsheet, { props: { serif }, target: /** @type {HTMLElement} */ (document.getElementById('baishi-cheatsheet')) })
// The document fragment can be resolved before the lazy Serif sheet mounts.
if (location.hash) {
  await tick()
  document.getElementById(location.hash.slice(1))?.scrollIntoView()
}
