<script>
  import { onMount } from 'svelte'
  import IdsParts from '../../src/svelte/IdsParts.svelte'
  import IdsCharacterInfo from '../../src/svelte/IdsCharacterInfo.svelte'

  let { adapter } = $props()
  let root = $state(null), picked = $state(''), override = $state(null)
  const informationAdapter = $derived(override ?? adapter)
  let resolveOld, aborted = false, requested = false
  onMount(() => {
    window.identityFixture = {
      delay() {
        aborted = false; requested = false
        override = { ...adapter, characterInfo: (char, { signal }) => new Promise(resolve => {
          requested = true
          signal.addEventListener('abort', () => { aborted = true })
          resolveOld = () => resolve({ char, script: 'han', glosses: ['OLD GLOSS'], emoji: [], relations: [], sources: [] })
        }) }
      },
      replace() { override = { ...adapter, characterInfo: async () => null } },
      resolve() { resolveOld?.() },
      get aborted() { return aborted },
      get requested() { return requested },
    }
    return () => { delete window.identityFixture }
  })
</script>

<div id="palette" bind:this={root}><IdsParts {adapter} recentKey={null} onpick={part => picked = part} /></div>
<output id="picked">{picked}</output>
<IdsCharacterInfo {root} adapter={informationAdapter} onpick={part => picked = part} />
