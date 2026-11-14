// The workshop as one editor inside a host page's frame: `editor.html?ids=…` opens a sequence, and
// each change is posted to the host as `{ type: 'ids-input:sequence', sequence, whole }`.
import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import App from './App.svelte'

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')), props: { embed: true } })
