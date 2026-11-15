import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Strokes from './Strokes.svelte'

mount(Strokes, { target: /** @type {HTMLElement} */ (document.getElementById('strokes')) })
