<script>
  import { isSelector, partAt } from '../core/ids.js'
  import { codePoints } from '../core/variation.js'
  import { rateFormText, readRateForm } from '../core/rate-forms.js'
  const drawings = import('@han-compose/composer/rate-drawing')

  /** @type {{
   * editor: import('./editor.svelte.js').Editor,
   * path: import('../core/ids.js').Path,
   * forms: ReturnType<typeof import('../core/rate-forms.js').rateFormsOfPart>,
   * menu?: boolean, onchoose?: () => void
   * }} */
  let { editor, path, forms, menu = false, onchoose } = $props()
  const part = $derived(partAt(editor.tree, path))
  const current = $derived(rateFormText(part))
  const host = $derived(forms[0]?.host)
  /** Spell out invisible selectors, including those inside a compound IDS. @param {string} text */
  const spelling = text => [...text].map(char => isSelector(char) ? ' ' + codePoints(char) + ' ' : char).join('').trim()
  /** @param {string} value */
  function choose(value) {
    if (!editor.currentTree) return
    const replacement = readRateForm(part, value)
    if (replacement !== null && editor.put(replacement, path)) onchoose?.()
  }
</script>

{#if host}
  <div class="rate-options" role="group" aria-label={editor.t('ids.variants.label', { part: host })}>
    <div class="rate-heading">
      <span>{editor.t('ids.variants.label', { part: host })}</span>
      <button type="button" class="rate-original" role={menu ? 'menuitemradio' : undefined}
        aria-checked={menu ? current === host : undefined} aria-pressed={menu ? undefined : current === host}
        disabled={editor.disabled || !editor.currentTree} title={host} onclick={() => choose(host)}>{host}</button>
    </div>
    <div class="rate-grid">
      {#each forms as form (form.id)}
        {@const label = spelling(form.text)}
        <button type="button" data-rate-form={form.id} role={menu ? 'menuitemradio' : undefined}
          aria-checked={menu ? current === form.text : undefined} aria-pressed={menu ? undefined : current === form.text}
          disabled={editor.disabled || !editor.currentTree} title={label} aria-label={label} onclick={() => choose(form.text)}>
          <svg viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
            {#await drawings then module}<path d={module.rateDrawing(form.text, editor.adapter.fontStyle ?? 'sans') ?? ''} />{/await}
          </svg>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .rate-options{display:grid;gap:4px;min-width:0}
  .rate-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--_muted);font-size:.8em}
  button{font:inherit;color:var(--_ink);cursor:pointer;background:var(--_surface);border:1px solid var(--_line);border-radius:5px}
  button:is([aria-pressed="true"],[aria-checked="true"]){border-color:var(--_accent);color:var(--_accent)}
  button:focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .rate-original{font-family:var(--_font);padding:1px 5px}
  .rate-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}
  .rate-grid button{display:flex;align-items:center;justify-content:center;min-height:52px;padding:3px 6px}
  .rate-grid svg{width:44px;height:44px;fill:currentColor}
</style>
