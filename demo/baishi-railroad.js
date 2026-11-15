import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import BaishiRailroad from './BaishiRailroad.svelte'

mount(BaishiRailroad, { target: /** @type {HTMLElement} */ (document.getElementById('baishi-railroad')) })
