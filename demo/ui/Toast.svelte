<script>
  // A note at the foot of the page that goes by itself: what was just done, with an Undo button when
  // it threw something away. A newer note replaces it.
  import { fly } from 'svelte/transition'
  /** @type {{ toast: { id: number, text: string, action?: string, run?: () => void } | null, ondone: () => void }} */
  let { toast, ondone } = $props()
  $effect(() => {
    if (!toast) return
    const timer = setTimeout(ondone, toast.run ? 6000 : 2400)
    return () => clearTimeout(timer)
  })
</script>

<div class="toasts" aria-live="polite">
  {#if toast}
    {#key toast.id}
      <div class="toast" role="status" transition:fly={{ y: 12, duration: 160 }}>
        <span>{toast.text}</span>
        {#if toast.run && toast.action}<button type="button" onclick={() => { toast?.run?.(); ondone() }}>{toast.action}</button>{/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .toasts{position:fixed;z-index:60;left:50%;bottom:20px;transform:translateX(-50%);display:grid;pointer-events:none;max-width:calc(100vw - 32px)}
  .toast{grid-area:1/1;display:flex;align-items:center;gap:14px;padding:10px 12px 10px 16px;border-radius:12px;pointer-events:auto;
    background:var(--toast-bg);color:var(--toast-ink);box-shadow:var(--shadow-pop);font-size:13.5px}
  button{padding:5px 10px;border:0;border-radius:7px;background:color-mix(in srgb,var(--toast-ink) 16%,transparent);color:inherit;font:inherit;font-weight:600;cursor:pointer}
  button:hover{background:color-mix(in srgb,var(--toast-ink) 26%,transparent)}
  button:focus-visible{outline:2px solid var(--toast-ink);outline-offset:1px}
</style>
