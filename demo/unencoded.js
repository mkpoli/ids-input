import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Unencoded from './Unencoded.svelte'

mount(Unencoded, { target: /** @type {HTMLElement} */ (document.getElementById('unencoded')) })
