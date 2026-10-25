import { mount } from 'svelte'
import '../fonts/fonts.css'
import App from './App.svelte'

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) })
