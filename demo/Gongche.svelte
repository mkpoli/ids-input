<script>
  import { IdsPreview } from '../src/svelte/index.js'
  import { parse, drawingSvg } from '../src/core/index.js'
  import { composerPreview } from '../src/composer/index.js'
  import { componentDrawing } from '../src/composer/component-forms.js'
  import { COMPOSER_BASES } from './lib/composer.js'
  import { NOTES, REGIONAL_NOTES, MODIFIERS, notation, selectionFrom, selectionUrl } from './lib/gongche.js'
  import { applyTheme, storedTheme } from './lib/theme.js'
  import { download, fileName } from './lib/files.js'
  import ThemeSwitch from './ui/ThemeSwitch.svelte'
  import messages from '../messages/zh-Hant.json'

  const initial = selectionFrom(location.search)
  let note = $state(initial.note), modifier = $state(initial.modifier)
  let style = $state('sans'), theme = $state(storedTheme()), status = $state('')
  let drawing = $state(null)
  const selection = $derived(notation(note, modifier))
  const tree = $derived(parse(selection.sequence, { open: true }).tree)
  const previews = {
    sans: composerPreview({ base: COMPOSER_BASES.sans, fontStyle: 'sans' }),
    serif: composerPreview({ base: COMPOSER_BASES.serif, fontStyle: 'serif' }),
  }
  const adapter = $derived({ structure: async () => [], preview: previews[style] })
  $effect(() => { document.documentElement.dataset.font = style })
  $effect(() => {
    history.replaceState(null, '', selectionUrl(selection, location.href))
    status = ''
  })
  function restore() {
    const selected = selectionFrom(location.search)
    note = selected.note; modifier = selected.modifier
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); status = '已複製' }
    catch { status = '無法複製，請選取下方文字。' }
  }
  function exportSvg() {
    if (!drawing) return
    try { download(new Blob([drawingSvg(drawing, { size: 1024, padding: 0.06 })], { type: 'image/svg+xml' }), fileName(selection.sequence, 'svg')) }
    catch { status = '匯出失敗，請重試。' }
  }
</script>

<svelte:window onpopstate={restore} />

<div class="gongche-page">
  <header>
    <a class="brand" href="../">IDS Workshop</a>
    <ThemeSwitch {theme} label="外觀" labels={{ system: '跟隨系統', light: '淺色', dark: '深色' }} onchange={value => { theme = value; applyTheme(value) }} />
  </header>
  <main>
    <div class="intro"><span class="eyebrow">GONGCHE NOTATION</span><h1>工尺譜組字</h1><p>選譜字、配偏旁，組合需要的字形。</p></div>
    <div class="workspace">
      <section class="choices" aria-label="組字選項">
        <fieldset><legend><span>01</span> 譜字</legend>
          <div class="note-grid">{#each NOTES as value}<button class="glyph" class:selected={note === value} aria-pressed={note === value} onclick={() => note = value}>{value}</button>{/each}</div>
          <div class="regional"><span>其他譜字</span>{#each REGIONAL_NOTES as value}<button class="glyph" class:selected={note === value} aria-pressed={note === value} onclick={() => note = value}>{value}</button>{/each}</div>
        </fieldset>
        <fieldset><legend><span>02</span> 偏旁</legend>
          <div class="modifier-grid">{#each MODIFIERS as value}
            {@const shape = componentDrawing(value, style)}
            <button class="modifier" class:selected={modifier === value} aria-pressed={modifier === value} aria-label={value || '不加偏旁'} title={value || '不加偏旁'} onclick={() => modifier = value}>
              {#if shape}<svg viewBox="0 0 1000 1000" aria-hidden="true"><path d={shape.d} /></svg><small>IDS</small>
              {:else}<span class="glyph">{value || '—'}</span>{/if}
              <span class="modifier-label">{value || '不加偏旁'}</span>
            </button>
          {/each}</div>
        </fieldset>
        <p class="context">譜字及偏旁的用法因樂種而異；請依所用曲譜選擇。</p>
      </section>
      <section class="result" aria-label="組字結果">
        <div class="result-top"><h2>字形預覽</h2><div class="style-switch" role="group" aria-label="字體">
          <button aria-pressed={style === 'sans'} onclick={() => style = 'sans'}>黑體</button><button aria-pressed={style === 'serif'} onclick={() => style = 'serif'}>宋體</button>
        </div></div>
        {#key selection.sequence + style}
          <IdsPreview {adapter} {tree} {messages} locale="zh-Hant" small={false} bind:drawing />
        {/key}
        <div class="identity">
          {#if selection.char}<span class="encoded glyph">{selection.char}</span><span class="codepoint">{selection.codepoint}</span>{:else}<span class="tag">IDS 組字</span>{/if}
          <code>{selection.sequence}</code>
        </div>
        <div class="actions">
          <button class="primary" onclick={() => copy(selection.char || selection.sequence)}>{selection.char ? '複製字符' : '複製 IDS'}</button>
          {#if selection.char && selection.sequence !== selection.char}<button onclick={() => copy(selection.sequence)}>複製 IDS</button>{/if}
          <button disabled={!drawing} onclick={exportSvg}>匯出 SVG</button>
          <a href={'../#' + encodeURIComponent(selection.sequence)}>在完整編輯器開啟 ↗</a>
          <button onclick={() => copy(selectionUrl(selection, location.href))}>複製連結</button>
        </div>
        <p class="status" role="status">{status}</p>
      </section>
    </div>
    <section class="references" aria-labelledby="reference-heading">
      <h2 id="reference-heading">譜例與參考</h2>
      <div class="reference-grid">
        <a href="https://www.th.gov.tw/EpaperSend/113/239/"><span>北管</span><strong>工尺譜中的譜字與高低音記法 ↗</strong><small>國史館臺灣文獻館 · 第230期</small></a>
        <a href="https://www.ccli.gov.hk/doc/wgcliac2022-03.pdf"><span>粵曲</span><strong>工尺譜字符與譜例 ↗</strong><small>中文界面諮詢委員會 · 2022/03，附件二</small></a>
      </div>
      <p>碼位對應依 BabelStone IDS 字形分解；各組合的音樂用法請參照曲譜。</p>
    </section>
  </main>
  <footer>部件建議：<a href="https://x.com/zoenshiueh_lieu">परवद💙💛 @zoenshiueh_lieu</a><a href="https://github.com/mkpoli/ids-input">原始碼</a></footer>
</div>

<style>
  .gongche-page{max-width:1180px;margin:auto;padding:0 32px}header{display:flex;align-items:center;justify-content:space-between;padding:24px 0;border-bottom:1px solid var(--line)}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.brand{font-weight:650;color:var(--ink)}.intro{padding:38px 0 28px}.eyebrow{font-size:11px;letter-spacing:.16em;color:var(--muted)}h1{font-size:34px;letter-spacing:.08em;margin:8px 0}p{color:var(--muted)}.intro p{margin:0;font-size:16px}.workspace{display:grid;grid-template-columns:1.05fr 1fr;gap:28px}.choices,.result{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:26px}fieldset{border:0;padding:0;margin:0 0 30px;min-width:0}legend{font-size:16px;font-weight:650;margin-bottom:18px}legend span{font-size:11px;color:var(--muted);margin-right:12px;font-variant-numeric:tabular-nums}.note-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}button{color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;cursor:pointer;font:inherit}button:hover{background:var(--hover)}button.selected,button[aria-pressed="true"]{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}button:focus-visible,a:focus-visible{outline:2px solid var(--focus);outline-offset:3px}.glyph{font-family:var(--cjk);font-size:32px}.note-grid button{height:64px}.regional{display:flex;gap:9px;align-items:center;margin-top:16px}.regional>span{font-size:12px;color:var(--muted);margin-right:auto}.regional button{font-size:24px;width:48px;height:44px}.modifier-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.modifier{position:relative;min-height:108px;padding:10px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px}.modifier svg{width:48px;height:48px;fill:currentColor}.modifier>.glyph{height:48px;line-height:48px}.modifier-label{font-family:var(--cjk);font-size:12px;overflow-wrap:anywhere}.modifier small{position:absolute;top:5px;right:5px;font-size:8px;color:var(--muted)}.context{font-size:12px;margin:0;line-height:1.8}.result-top{display:flex;justify-content:space-between;align-items:center}.result h2{font-size:14px;margin:0}.style-switch{display:flex;gap:4px}.style-switch button{padding:5px 10px;font-size:12px}.result :global(.ids-preview){--ids-preview-size:310px;margin:22px auto;max-width:310px}.identity{display:flex;flex-wrap:wrap;align-items:center;gap:10px;border-top:1px solid var(--line);padding-top:18px}.encoded{font-size:28px}.codepoint,.tag{font-size:11px;color:var(--muted)}code{font-family:var(--cjk);font-size:18px;overflow-wrap:anywhere}.identity code{flex-basis:100%}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.actions button,.actions a{padding:8px 12px;font-size:12px}.actions .primary{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}button:disabled{opacity:.4;cursor:default}.status{min-height:20px;font-size:12px;margin:10px 0 0}.references{margin:36px 0}.references h2{font-size:16px}.reference-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.reference-grid a{display:flex;flex-direction:column;gap:8px;padding:18px;border:1px solid var(--line);border-radius:10px;color:var(--ink)}.reference-grid span,.reference-grid small{font-size:11px;color:var(--muted)}.reference-grid strong{font-size:14px;font-weight:500}.references p{font-size:12px}footer{display:flex;flex-wrap:wrap;gap:8px;padding:22px 0;border-top:1px solid var(--line);font-size:11px;color:var(--muted)}footer a:last-child{margin-left:auto}@media(max-width:740px){.gongche-page{padding:0 16px}.intro{padding:24px 0}.workspace{grid-template-columns:1fr;gap:16px}.choices,.result{padding:20px}.reference-grid{grid-template-columns:1fr}h1{font-size:28px}.result :global(.ids-preview){max-width:260px}}
</style>
