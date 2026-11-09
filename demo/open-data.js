import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import OpenData from './OpenData.svelte'

mount(OpenData, { target: /** @type {HTMLElement} */ (document.getElementById('open-data')) })
