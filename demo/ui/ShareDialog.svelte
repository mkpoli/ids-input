<script>
  // A link that opens the sequence, to copy, and the same link as a QR code.
  import qrcode from 'qrcode-generator'
  import Dialog from './Dialog.svelte'
  import Icon from './Icon.svelte'
  /** @type {{ open: boolean, link: string, sequence: string, t: (key: string, params?: Record<string, string | number>) => string, onnote: (text: string) => void }} */
  let { open = $bindable(false), link, sequence, t, onnote } = $props()
  // The QR code as SVG cells, made only while the dialog is open; the link is ASCII once
  // percent-encoded, so byte mode reads it exactly. A link too long for a QR code gets none.
  const code = $derived.by(() => {
    if (!open) return null
    try {
      const qr = qrcode(0, 'M')
      qr.addData(link, 'Byte')
      qr.make()
      const n = qr.getModuleCount(), cells = []
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) cells.push(`M${x} ${y}h1v1h-1z`)
      return { n, d: cells.join('') }
    } catch { return null }
  })
  async function copy() {
    try { await navigator.clipboard.writeText(link); onnote(t('app.share.copied')) } catch { onnote(t('app.copyFailed')) }
  }
</script>

<Dialog bind:open title={t('app.share.title')} closeLabel={t('app.close')}>
  <div class="share">
    <p class="seq" lang="ja">{sequence}</p>
    <div class="link">
      <input class="ui-input" data-mono readonly value={link} aria-label={t('app.share.link')} onfocus={event => event.currentTarget.select()} />
      <button type="button" class="ui-button" onclick={copy}><Icon name="copy" size={16} />{t('app.copy')}</button>
    </div>
    {#if code}
      <svg class="qr" viewBox="-2 -2 {code.n + 4} {code.n + 4}" role="img" aria-label={t('app.share.qr')}>
        <rect x="-2" y="-2" width={code.n + 4} height={code.n + 4} fill="#fff" /><path d={code.d} fill="#000" />
      </svg>
    {:else if open}<p class="ui-hint">{t('app.share.tooLong')}</p>{/if}
  </div>
</Dialog>

<style>
  .share{display:flex;flex-direction:column;align-items:center;gap:var(--ui-space-lg)}
  .seq{margin:0;font-family:var(--cjk);font-size:var(--ui-text-2xl)}
  .link{display:flex;gap:var(--ui-space-xs);width:100%}
  .link input{flex:1;min-width:0}
  .qr{width:min(240px,70vw);height:auto;border-radius:var(--ui-radius-xl);box-shadow:0 0 0 1px var(--ui-color-border)}
</style>
