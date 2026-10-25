// IdsInput as one block inside a host page's form, as a library user would place it.
import { mount } from 'svelte'
import '../fonts/fonts.css'
import './app.css'
import Embed from './Embed.svelte'

mount(Embed, { target: /** @type {HTMLElement} */ (document.getElementById('app')) })
