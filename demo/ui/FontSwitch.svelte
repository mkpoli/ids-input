<script lang="ts" generics="Face extends { key: string, label: string }">
  import type { Snippet } from 'svelte'

  let { faces, face, label, t, onchange, sample, children }: {
    faces: readonly Face[]
    face: string
    label: string
    t: (key: string) => string
    onchange: (key: Face['key']) => void
    sample?: Snippet<[Face]>
    children?: Snippet
  } = $props()
</script>

<div class="font-switch" role="group" aria-label={label}>
  {#each faces as option (option.key)}
    <button type="button" class="font-choice" aria-pressed={face === option.key}
      aria-label={t(option.label)} title={t(option.label)} onclick={() => onchange(option.key)}>
      <span class="aa {option.key}" aria-hidden="true">
        {#if sample}{@render sample(option)}{:else}<span class="specimen">Aa</span>{/if}
      </span>
      <span class="wide {option.key}">{t(option.label)}</span>
    </button>
  {/each}
  {@render children?.()}
</div>
