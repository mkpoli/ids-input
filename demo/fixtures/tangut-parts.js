import { mount } from 'svelte'
import IdsParts from '../../src/svelte/IdsParts.svelte'

const adapter = {
  structure: async () => [],
  parts: async () => [{ part: '𒖨', kind: 'd' }, { part: '𘠁', kind: 't', strokes: 42, aliases: ['tangut-alias'] }, { part: '⿰木口', kind: 'd' }, { part: '⿱㇀㇀', kind: 'd', strokes: 2 }],
}
mount(IdsParts, {
  target: document.querySelector('#palette'),
  props: { adapter, recentKey: null, onpick: part => { document.querySelector('#picked').textContent = part } },
})
