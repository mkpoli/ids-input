<script>
  import { isSelector } from '../core/ids.js'
  import { exactRateForm } from '@han-compose/composer/rate-forms'
  import IdsPartIcon from './IdsPartIcon.svelte'
  import { codePoints } from '../core/variation.js'
  import { formSpelling, chooseVariation, readFormSpelling } from '../core/variation-families.js'
  const drawings = import('@han-compose/composer/rate-drawing')

  /** @type {{
   * adapter: import('../adapter/types.js').IdsAdapter,
   * part: import('../core/ids.js').Part | undefined,
   * t: import('./i18n.js').Translate,
   * family: import('../adapter/types.js').VariationFamily,
   * disabled?: boolean, menu?: boolean,
   * onreplace: (part: import('../core/ids.js').Part) => void
   * }} */
  let { adapter, part, t, family, disabled = false, menu = false, onreplace } = $props()
  const current = $derived(formSpelling(part))
  const knownHost = $derived(exactRateForm(family.forms[0]?.text)?.host)
  const original = $derived(family.subjects.length === 1 ? family.subjects[0] : knownHost && family.subjects.includes(knownHost) ? knownHost : null)
  const host = $derived(original ?? family.subjects[0] ?? current)
  const reference = $derived(/^(UCV|NUCV|IVD)\/[a-z0-9.-]+$/i.test(family.id) ? family.id.replace('/', ' ') : '')
  const heading = $derived(reference || t('ids.variants.label', { part: host }) + (family.occurrence && family.occurrence.count > 1 ? ' · ' + (family.occurrence.index + 1) + '/' + family.occurrence.count : ''))
  /** Spell out invisible selectors, including those inside a compound IDS. @param {string} text */
  const spelling = text => [...text].map(char => isSelector(char) ? ' ' + codePoints(char) + ' ' : char).join('').trim()
  /** @param {string | null} id */
  function choose(id) {
    if (disabled) return
    const replacement = id === null && original && !family.occurrence ? readFormSpelling(part, original) : chooseVariation(part, family, id)
    if (replacement !== null) onreplace(replacement)
  }
</script>

{#if host}
  <div class="rate-options" role="group" data-variation-family={family.id} aria-label={heading}>
    <div class="rate-heading">
      <span>{heading}</span>
      {#if original && !family.forms.some(form => form.text === original)}
        <button type="button" class="rate-original" role={menu ? 'menuitemradio' : undefined}
          aria-checked={menu ? (family.occurrence ? family.occurrence.form === null : current === host) : undefined} aria-pressed={menu ? undefined : (family.occurrence ? family.occurrence.form === null : current === host)}
          {disabled} title={host} onclick={() => choose(null)}>{host}</button>
      {/if}
    </div>
    <div class="rate-grid" class:three={family.occurrence}>
      {#each family.forms as form (form.id)}
        {@const label = spelling(form.text)}
        <button type="button" data-form-id={form.id} data-rate-form={exactRateForm(form.text)?.id} role={menu ? 'menuitemradio' : undefined}
          aria-checked={menu ? (family.occurrence ? family.occurrence.form === form.id : current === form.text) : undefined} aria-pressed={menu ? undefined : (family.occurrence ? family.occurrence.form === form.id : current === form.text)}
          {disabled} title={label} aria-label={label} onclick={() => choose(form.id)}>
          {#if form.outline}
            <svg viewBox={form.outline.viewBox ?? '0 0 1000 1000'} aria-hidden="true" focusable="false"><path d={form.outline.d} /></svg>
          {:else if exactRateForm(form.text)}
            <svg viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
              {#await drawings then module}<path d={module.rateDrawing(form.text, adapter.fontStyle ?? 'sans') ?? ''} />{/await}
            </svg>
          {:else}
            <IdsPartIcon sequence={form.text} {adapter} />
          {/if}
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
  .rate-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
  .rate-grid button{display:flex;align-items:center;justify-content:center;font-size:44px;min-height:52px;padding:3px 6px}
  .rate-grid svg{width:44px;height:44px;fill:currentColor}
</style>
