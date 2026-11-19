import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import FontMixer from './FontMixer.svelte'

mount(FontMixer, { target: /** @type {HTMLElement} */ (document.getElementById('font-mixer')) })
