// Run against a devrun server: IDS_URL=http://localhost:5173 bun demo/check-ids-operators.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 400 } })
  page.setDefaultNavigationTimeout(120000)
  await page.goto(new URL('/fixtures/ids-operators.html', process.env.IDS_URL ?? 'http://localhost:5173').href)
  const result = await page.evaluate(async () => {
    await document.fonts.ready
    const faces = [...document.fonts].filter(face => face.family.replace(/"/g, '') === 'IDS Operators')
    return { faces: faces.length, loaded: faces.every(face => face.status === 'loaded') }
  })
  assert.equal(result.faces, 2, 'fonts.css registers a face for each range, Noto for U+2FF0-2FFB and Jigmo for the four above')
  assert.ok(result.loaded, 'the face loads for the operators on the page')
  console.log('PASS the IDS operators render from the bundled face')
} finally { await browser.close() }
