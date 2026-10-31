import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import DesignShowcase from './ui/DesignShowcase.svelte'

mount(DesignShowcase, { target: /** @type {HTMLElement} */ (document.getElementById('design')) })
