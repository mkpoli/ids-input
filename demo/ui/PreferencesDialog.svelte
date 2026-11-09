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
  let chosenName = $state('')
  /** @param {Event} event */
  async function chosenFont(event) {
    const file = /** @type {HTMLInputElement} */ (event.currentTarget).files?.[0]
    if (!file) return
    fontName = file.name.replace(/\.[^.]+$/, '')
    fontLicence = ''
    chosenName = file.name
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
      chosenName = ''
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
    <div class="ui-field fonts">
      <span class="ui-label">{t('app.prefs.fonts')}</span>
      <p class="ui-hint">{t('app.prefs.fontsHint')}</p>
      {#if fonts.length}
        <ul class="font-list">
          {#each fonts as font (font.id)}
            <li class="font-row">
              <span class="font-name">{font.name}</span>
              <span class="font-licence">{font.licence}</span>
              <button type="button" class="ui-button" data-variant="quiet" data-size="xs" aria-label={t('app.prefs.fontRemove', { name: font.name })} onclick={() => onremovefont?.(font.id)}>{t('app.prefs.fontRemoveShort')}</button>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="font-add">
        <label class="ui-field">
          <span class="ui-label">{t('app.prefs.fontFile')}</span>
          <span class="font-file-row">
            <button type="button" class="ui-button" data-size="sm" onclick={() => fontInput?.click()}>{chosenName || t('app.prefs.fontChoose')}</button>
            <input class="ui-visually-hidden" bind:this={fontInput} type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" onchange={chosenFont} />
          </span>
        </label>
        <label class="ui-field">
          <span class="ui-label">{t('app.prefs.fontName')}</span>
          <input class="ui-input" type="text" bind:value={fontName} />
        </label>
        <label class="ui-field">
          <span class="ui-label">{t('app.prefs.fontLicence')}</span>
          <input class="ui-input" type="text" bind:value={fontLicence} />
        </label>
        <button type="button" class="ui-button font-add-button" data-variant="primary" data-size="sm" disabled={fontBusy || !fontName.trim() || !fontLicence.trim() || !fontInput?.files?.length} onclick={addFont}>{t('app.prefs.fontAdd')}</button>
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
  .fonts{flex:1 1 100%;gap:var(--ui-space-sm);padding-block:var(--ui-space-sm)}
  .font-list{display:flex;flex-direction:column;gap:var(--ui-space-xs);margin:0;padding:0;list-style:none}
  .font-row{display:flex;align-items:center;gap:var(--ui-space-sm);font-size:var(--ui-text-sm)}
  .font-name{font-weight:var(--ui-weight-semibold)}
  .font-licence{color:var(--ui-color-ink-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .font-row .ui-button{margin-inline-start:auto}
  .font-add{display:flex;flex-direction:column;gap:var(--ui-space-sm)}
  .font-file-row{display:flex;gap:var(--ui-space-xs)}
  .font-add-button{align-self:flex-start}
</style>
