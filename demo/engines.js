import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Engines from './Engines.svelte'

mount(Engines, { target: /** @type {HTMLElement} */ (document.getElementById('engines')) })
