import { mount } from 'svelte'
import IdsParts from '../../src/svelte/IdsParts.svelte'

// One curated part, one-stroke Han and CJK stroke parts, a part only a stroke count finds, and one
// whose count was never recorded, so the chip row shows every kind of group at once.
const adapter = {
  structure: async () => [],
  parts: async () => [
    { part: '木', kind: 'c', strokes: 4, first: '横' },
    { part: '艹', kind: 'd', strokes: 4, first: '豎' },
    { part: '一', kind: 'd', strokes: 1, first: '横' },
    { part: '㇐', kind: 's', strokes: 1, first: '横' },
    { part: '㇣', kind: 's', strokes: 1 },
    { part: '𒖨', kind: 'd' },
  ],
}
mount(IdsParts, {
  target: document.querySelector('#palette'),
  props: { adapter, recentKey: null, onpick: part => { document.querySelector('#picked').textContent = part } },
})
