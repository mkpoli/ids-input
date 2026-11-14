import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Baishi from './Baishi.svelte'

mount(Baishi, { target: /** @type {HTMLElement} */ (document.getElementById('baishi')) })
