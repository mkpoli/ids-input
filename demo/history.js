import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import History from './History.svelte'

mount(History, { target: /** @type {HTMLElement} */ (document.getElementById('history')) })
