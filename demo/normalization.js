import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Normalization from './Normalization.svelte'

mount(Normalization, { target: /** @type {HTMLElement} */ (document.getElementById('normalization')) })
