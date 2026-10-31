<script>
  // A note at the foot of the page that goes by itself: what was just done, with an Undo button when
  // it threw something away. A newer note replaces it.
  import { fly } from 'svelte/transition'
  import { onMount } from 'svelte'
  let hovered = $state(false)
  let focused = $state(false)
  let reducedMotion = $state(false)
  onMount(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { reducedMotion = media.matches }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  })
  /** @type {{ toast: { id: number, text: string, action?: string, run?: () => void, duration?: number } | null, ondone: () => void }} */
  let { toast, ondone } = $props()
  $effect(() => {
    if (!toast || hovered || focused) return
    const timer = setTimeout(ondone, toast.run ? (toast.duration ?? 6000) : 2400)
    return () => clearTimeout(timer)
  })
</script>

<div class="toasts" aria-live="polite"
  onpointerenter={() => hovered = true} onpointerleave={() => hovered = false}
  onfocusin={() => focused = true}
  onfocusout={event => { focused = event.currentTarget.contains(/** @type {Node | null} */ (event.relatedTarget)) }}>
  {#if toast}
    {#key toast.id}
      <div class="toast" role="status" transition:fly={{ y: reducedMotion ? 0 : 12, duration: reducedMotion ? 0 : 160 }}>
        <span>{toast.text}</span>
        {#if toast.run && toast.action}<button type="button" onclick={() => { toast?.run?.(); ondone() }}>{toast.action}</button>{/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .toasts{position:fixed;z-index:60;left:50%;bottom:20px;transform:translateX(-50%);display:grid;pointer-events:none;max-width:calc(100vw - 32px)}
  .toast{grid-area:1/1;display:flex;align-items:center;gap:14px;padding:10px 12px 10px 16px;border-radius:var(--ui-radius-xl);pointer-events:auto;
    background:var(--ui-color-toast-surface);color:var(--ui-color-toast-ink);box-shadow:var(--ui-shadow-2);font-size:13.5px}
  button{padding:5px 10px;border:0;border-radius:var(--ui-radius-sm);background:color-mix(in srgb,var(--ui-color-toast-ink) 16%,transparent);color:inherit;font:inherit;font-weight:600;cursor:pointer}
  button:hover{background:color-mix(in srgb,var(--ui-color-toast-ink) 26%,transparent)}
  button:focus-visible{outline:2px solid var(--ui-color-toast-ink);outline-offset:1px}
</style>
