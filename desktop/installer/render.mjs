// Draws the installers' artwork from the workshop's own tokens and drawings: the Windows wizard's
// sidebar and header bitmaps, and the macOS disk image's window background at 1x and 2x.
//
//   CHROMIUM_PATH=/path/to/chrome bun desktop/installer/render.mjs
//
// The text is set in Noto Sans and Noto Sans CJK JP, which the machine must have; the IDCs come from
// the workshop's own operator font. ImageMagick (`magick`) writes the BMP and TIFF files.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const HERE = import.meta.dirname
const ROOT = join(HERE, '..', '..')
// design/tokens.css: accent, canvas, surface, ink, ink-muted, border (light scheme).
const C = { accent: '#2944c7', accentDeep: '#1a2d8c', canvas: '#f3f3f6', surface: '#ffffff', ink: '#1c1c22', muted: '#686874', border: '#e1e1e8' }
const SEQUENCE = '⿰宁字'
// 𡨸, the Nôm character for writing, as the workshop draws it (demo/lib/example-drawings.json).
const DRAWING = JSON.parse(readFileSync(join(ROOT, 'demo/lib/example-drawings.json'), 'utf8')).drawings[SEQUENCE].drawn.d
const OPERATORS = join(ROOT, 'fonts/NotoSansCJKjp-ids-operators.woff2')

const glyph = (size, fill) => `<svg width="${size}" height="${size}" viewBox="0 0 1000 1000"><path d="${DRAWING}" fill="${fill}"/></svg>`
// The favicon's mark: a rounded square holding one tall and two short blocks.
const mark = (size, square, blocks) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="${square}"/><path d="M7 7h4v10H7zM13 7h4v4h-4zM13 13h4v4h-4z" fill="${blocks}"/></svg>`

const page = (width, height, body) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "IDS Operators"; src: url("file://${OPERATORS}") format("woff2"); unicode-range: U+2FF0-2FFF, U+31EF; }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
body { font-family: "Noto Sans", "IDS Operators", "Noto Sans CJK JP", sans-serif; -webkit-font-smoothing: antialiased; }
.seq { font-family: "IDS Operators", "Noto Sans CJK JP", sans-serif; }
</style></head><body>${body}</body></html>`

// Windows wizard, welcome and finish pages: 164×314 beside the text.
const sidebar = page(164, 314, `
<div style="height:100%;background:linear-gradient(170deg, ${C.accent} 0%, ${C.accentDeep} 100%);color:#fff;display:flex;flex-direction:column;padding:18px 16px">
  <div style="display:flex;align-items:center;gap:7px">${mark(22, '#fff', C.accent)}<span style="font-weight:600;font-size:13px;letter-spacing:.01em">IDS Workshop</span></div>
  <div style="flex:1;display:grid;place-items:center">
    <div style="display:grid;justify-items:center;gap:12px">
      <div style="width:104px;height:104px;border-radius:16px;background:rgb(255 255 255 / .1);display:grid;place-items:center">${glyph(84, '#fff')}</div>
      <div class="seq" style="font-size:21px;letter-spacing:.08em;color:#fff">${SEQUENCE}</div>
    </div>
  </div>
</div>`)

// Windows wizard, inner pages: 150×57 at the right of the white title band.
const header = page(150, 57, `
<div style="height:100%;background:#fff;display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-right:14px">
  ${glyph(30, C.ink)}${mark(30, C.accent, '#fff')}
</div>`)

// macOS disk image window. Finder treats a window with a background picture as light, so its file
// names stay black whatever the system's appearance; the picture is light for them. The two icons
// sit at (180, 190) and (480, 190), tauri.conf.json's appPosition and applicationFolderPosition.
const dmg = page(660, 400, `
<div style="height:100%;background:${C.canvas};position:relative">
  <div style="position:absolute;left:0;right:0;top:34px;display:flex;justify-content:center;align-items:center;gap:9px;color:${C.ink}">
    ${mark(24, C.accent, '#fff')}<span style="font-weight:600;font-size:17px">IDS Workshop</span>
  </div>
  <svg style="position:absolute;left:0;top:0" width="660" height="400" viewBox="0 0 660 400">
    <path d="M262 190 H 384" stroke="${C.accent}" stroke-width="3" stroke-linecap="round" fill="none" stroke-dasharray="1 9"/>
    <path d="M378 180 L 392 190 L 378 200" stroke="${C.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>
</div>`)

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
async function shoot(html, width, height, scale, out) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale })
  const tab = await context.newPage()
  await tab.setContent(html)
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: out })
  await context.close()
}
const tmp = join(HERE, '.render')
await Bun.$`mkdir -p ${tmp}`
await shoot(sidebar, 164, 314, 1, join(tmp, 'sidebar.png'))
await shoot(header, 150, 57, 1, join(tmp, 'header.png'))
await shoot(dmg, 660, 400, 1, join(tmp, 'dmg.png'))
await shoot(dmg, 660, 400, 2, join(tmp, 'dmg@2x.png'))
await browser.close()

// NSIS reads 24-bit BMPs. The TIFF holds both sizes, 72 and 144 dpi, as `tiffutil -cathidpicheck`
// writes it, so Finder draws the sharper one on a Retina screen.
await Bun.$`magick ${join(tmp, 'sidebar.png')} -alpha off -type TrueColor BMP3:${join(HERE, 'sidebar.bmp')}`
await Bun.$`magick ${join(tmp, 'header.png')} -alpha off -type TrueColor BMP3:${join(HERE, 'header.bmp')}`
const pages = ['-units', 'PixelsPerInch', '(', join(tmp, 'dmg.png'), '-density', '72', ')', '(', join(tmp, 'dmg@2x.png'), '-density', '144', ')', '-alpha', 'off', '-compress', 'lzw', join(HERE, 'dmg-background.tiff')]
await Bun.$`magick ${pages}`
await Bun.$`rm -rf ${tmp}`
console.log('sidebar.bmp header.bmp dmg-background.tiff')
