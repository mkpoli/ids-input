import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import App from './App.svelte'
import { watchConsole } from './lib/report.js'

// The console ring starts before anything else runs, so a report carries what the page said first.
watchConsole()

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) })
