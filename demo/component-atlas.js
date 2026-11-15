import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import ComponentAtlas from './ComponentAtlas.svelte'

mount(ComponentAtlas, { target: /** @type {HTMLElement} */ (document.getElementById('component-atlas')) })
