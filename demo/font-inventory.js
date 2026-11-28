import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import FontInventory from './FontInventory.svelte'

mount(FontInventory, { target: /** @type {HTMLElement} */ (document.getElementById('font-inventory')) })
