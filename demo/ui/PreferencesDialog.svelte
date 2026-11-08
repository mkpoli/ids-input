<script>
  // The viewer's settings: the theme, the key hints on buttons, and where the preview's drawings come from.
  import Dialog from './Dialog.svelte'
  import Switch from './controls/Switch.svelte'
  import TextField from './controls/TextField.svelte'
  import ThemeSwitch from './ThemeSwitch.svelte'
  /** @type {{ open: boolean, anchor?: HTMLElement | null, theme: import('../lib/theme.js').Theme, keyHints: boolean, tintMode: import('../../src/svelte/editor.svelte.js').TintMode, composer: string, defaultComposer: string,
   *   sans?: boolean, t: (key: string, params?: Record<string, string | number>) => string, ontheme: (theme: import('../lib/theme.js').Theme) => void,
   *   fonts?: import('../lib/user-fonts.js').UserFont[], onaddfont?: (file: File, name: string, licence: string) => Promise<void>, onremovefont?: (id: string) => Promise<void> }} */
  let { open = $bindable(false), anchor = null, theme, keyHints = $bindable(true), tintMode = $bindable('hover'), composer = $bindable(''), defaultComposer, t, ontheme, fonts = [], onaddfont, onremovefont } = $props()
  /** @type {HTMLInputElement | null} */
  let fontInput = $state(null)
  let fontName = $state('')
  let fontLicence = $state('')
  let fontBusy = $state(false)
  /** @param {Event} event */
  async function chosenFont(event) {
    const file = /** @type {HTMLInputElement} */ (event.currentTarget).files?.[0]
    if (!file) return
    fontName = file.name.replace(/\.[^.]+$/, '')
    fontLicence = ''
    fontInput = /** @type {HTMLInputElement} */ (event.currentTarget)
  }
  async function addFont() {
    const file = fontInput?.files?.[0]
    if (!file || !fontName.trim() || !fontLicence.trim() || !onaddfont) return
    fontBusy = true
    try {
      await onaddfont(file, fontName.trim(), fontLicence.trim())
      if (fontInput) fontInput.value = ''
      fontName = ''
      fontLicence = ''
    } finally {
      fontBusy = false
    }
  }
</script>

<Dialog bind:open {anchor} popover title={t('app.prefs.title')} closeLabel={t('app.close')}>
  <div class="prefs">
    <div class="pref">
      <span>{t('app.prefs.theme')}</span>
      <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={{ system: t('app.theme.system'), light: t('app.theme.light'), dark: t('app.theme.dark') }} onchange={ontheme} />
    </div>
    <div class="pref switch">
      <Switch bind:checked={keyHints} label={t('app.prefs.keyHints')} />
    </div>
    <label class="pref">
      <span>{t('app.prefs.tint.label')}</span>
      <span class="ui-select-wrap compact">
        <select class="ui-select" bind:value={tintMode}>
          <option value="hover">{t('app.prefs.tint.hover')}</option>
          <option value="on">{t('app.prefs.tint.on')}</option>
          <option value="off">{t('app.prefs.tint.off')}</option>
        </select>
      </span>
    </label>
    <div class="pref column">
      <TextField label={t('app.prefs.composer')} value={composer} placeholder={defaultComposer} type="url" mono spellcheck={false}
        hint={t('app.prefs.composerHint')}
        onchange={event => { composer = /** @type {HTMLInputElement} */ (event.currentTarget).value }}
        onkeydown={event => { if (event.key === 'Enter') composer = /** @type {HTMLInputElement} */ (event.currentTarget).value }} />
    </div>
    <div class="pref column fonts">
      <span>{t('app.prefs.fonts')}</span>
      <p class="hint">{t('app.prefs.fontsHint')}</p>
      {#if fonts.length}
        <ul class="font-list">
          {#each fonts as font (font.id)}
            <li>
              <span class="font-name">{font.name}</span>
              <span class="font-licence">{font.licence}</span>
              <button type="button" class="font-remove" aria-label={t('app.prefs.fontRemove', { name: font.name })} title={t('app.prefs.fontRemove', { name: font.name })} onclick={() => onremovefont?.(font.id)}>×</button>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="font-add">
        <input bind:this={fontInput} type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" aria-label={t('app.prefs.fontFile')} onchange={chosenFont} />
        <input type="text" bind:value={fontName} placeholder={t('app.prefs.fontName')} aria-label={t('app.prefs.fontName')} />
        <input type="text" bind:value={fontLicence} placeholder={t('app.prefs.fontLicence')} aria-label={t('app.prefs.fontLicence')} />
        <button type="button" class="font-add-button" disabled={fontBusy || !fontName.trim() || !fontLicence.trim() || !fontInput?.files?.length} onclick={addFont}>{t('app.prefs.fontAdd')}</button>
      </div>
    </div>
  </div>
</Dialog>

<style>
  .prefs{display:flex;flex-direction:column;gap:2px}
  .pref{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-xl);padding-block:var(--ui-space-sm);border-bottom:1px solid var(--ui-color-border);font-size:var(--ui-text-md)}
  .pref:last-child{border-bottom:0}
  .switch{padding-block:2px}
  .column{flex-direction:column;align-items:stretch;gap:var(--ui-space-xs)}
  .compact{inline-size:auto;min-inline-size:132px}
  .fonts{gap:var(--ui-space-sm)}
  .hint{margin:0;font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft)}
  .font-list{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
  .font-list li{display:flex;align-items:center;gap:var(--ui-space-sm);font-size:var(--ui-text-sm)}
  .font-name{font-weight:500}
  .font-licence{color:var(--ui-color-ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .font-remove{margin-inline-start:auto;padding:0 var(--ui-space-xs);font-size:var(--ui-text-md);line-height:1;background:none;border:0;color:var(--ui-color-ink-soft);cursor:pointer}
  .font-add{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs);align-items:center}
  .font-add input[type=file]{max-inline-size:100%;font-size:var(--ui-text-sm)}
  .font-add input[type=text]{flex:1 1 8em;min-inline-size:0;padding:4px 6px;border:1px solid var(--ui-color-border);border-radius:6px;background:var(--ui-color-surface);color:inherit;font:inherit;font-size:var(--ui-text-sm)}
  .font-add-button{padding:4px 10px;border:1px solid var(--ui-color-border);border-radius:6px;background:var(--ui-color-surface);color:inherit;font:inherit;font-size:var(--ui-text-sm);cursor:pointer}
  .font-add-button:disabled{cursor:default;opacity:.55}
</style>
