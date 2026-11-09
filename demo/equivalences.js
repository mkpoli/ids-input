import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Equivalences from './Equivalences.svelte'

mount(Equivalences, { target: /** @type {HTMLElement} */ (document.getElementById('equivalences')) })
