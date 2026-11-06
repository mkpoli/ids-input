import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Sources from './Sources.svelte'

mount(Sources, { target: /** @type {HTMLElement} */ (document.getElementById('sources')) })
