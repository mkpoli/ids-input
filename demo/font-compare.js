import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import FontCompare from './FontCompare.svelte'

mount(FontCompare, { target: /** @type {HTMLElement} */ (document.getElementById('font-compare')) })
