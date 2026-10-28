import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Compare from './Compare.svelte'

mount(Compare, { target: /** @type {HTMLElement} */ (document.getElementById('compare')) })
