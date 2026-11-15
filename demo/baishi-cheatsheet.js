import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import BaishiCheatsheet from './BaishiCheatsheet.svelte'

mount(BaishiCheatsheet, { target: /** @type {HTMLElement} */ (document.getElementById('baishi-cheatsheet')) })
