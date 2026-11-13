import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Ucv from './Ucv.svelte'

mount(Ucv, { target: /** @type {HTMLElement} */ (document.getElementById('ucv')) })
