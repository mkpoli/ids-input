import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Components from './Components.svelte'

mount(Components, { target: /** @type {HTMLElement} */ (document.getElementById('components')) })
