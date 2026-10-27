import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Gongche from './Gongche.svelte'
mount(Gongche, { target: /** @type {HTMLElement} */ (document.getElementById('app')) })
