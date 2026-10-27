// Run against a devrun server: IDS_URL, CHROMIUM_PATH, optional IDS_INFO_SHOTS.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width:1440, height:1000 }, deviceScaleFactor:2, colorScheme:scheme })
    const errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.route('https://glyphatlas.org/**',r=>r.abort())
    await page.goto(`${process.env.IDS_URL ?? 'http://127.0.0.1:5194'}/?lang=en`,{waitUntil:'domcontentloaded'})
    const field=page.locator('.ids-field input'), panel=page.locator('.ids-character-info')
    await field.fill('⿰馬𘥇'); await field.press('Tab')
    const horse=page.locator('.ids-tree [data-character="馬"]'), component=page.locator('.ids-tree [data-character="𘥇"]')
    await component.hover(); await panel.waitFor({state:'visible'})
    await page.getByText('associated with horses',{exact:true}).waitFor()
    assert.match(await panel.innerText(),/馬/); assert.match(await panel.innerText(),/🐎/)
    assert.match(await panel.innerText(),/Examples using this component/)
    // Moving into the card keeps it open; its source details stay within the viewport.
    await panel.hover(); await page.waitForTimeout(300); assert.ok(await panel.isVisible())
    await panel.locator('summary').click()
    await page.waitForTimeout(100)
    assert.ok(await panel.evaluate(el=>el.getBoundingClientRect().bottom <= innerHeight+1))
    await panel.evaluate(el=>{el.scrollTop=100;el.dispatchEvent(new Event('scroll'))})
    assert.ok(await panel.isVisible())
    await panel.locator('summary').click()
    if(process.env.IDS_INFO_SHOTS){mkdirSync(process.env.IDS_INFO_SHOTS,{recursive:true});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${process.env.IDS_INFO_SHOTS}/after-tangut-${scheme}.png`,clip:{x:0,y:0,width:1100,height:1000}})}
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);assert.ok(await panel.isHidden())
    // Focus opens details without changing the editor; F1 enters, Escape restores focus.
    await horse.focus(); await panel.waitFor({state:'visible'}); await panel.getByText('Small Seal forms',{exact:true}).waitFor()
    assert.match(await panel.innerText(),/horse/)
    const before=await field.inputValue()
    await horse.press('F1'); assert.equal(await panel.locator('button').evaluate(el=>el===document.activeElement),true)
    assert.equal(await field.inputValue(),before)
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);assert.ok(await panel.isHidden())
    assert.ok(await horse.evaluate(el=>el===document.activeElement))
    await component.focus(); await horse.focus(); await panel.waitFor({state:'visible'})
    await panel.getByText('Small Seal forms',{exact:true}).waitFor()
    await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(100)
    assert.ok(await panel.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1))
    if(process.env.IDS_INFO_SHOTS)await page.screenshot({path:`${process.env.IDS_INFO_SHOTS}/after-han-${scheme}.png`,clip:{x:0,y:0,width:1100,height:1000}})
    // A changed/detached editor leaf invalidates the old lookup.
    await field.fill('⿰水火'); await panel.waitFor({state:'hidden'})
    // F1 from a painted input character must return focus to the real input.
    const textBox=await page.locator('.sequence-paint [data-character="水"]').boundingBox()
    await page.mouse.move(textBox.x+textBox.width/2,textBox.y+textBox.height/2)
    await panel.waitFor({state:'visible'});await field.press('F1')
    assert.ok(await panel.evaluate(el=>el.contains(document.activeElement)))
    await page.keyboard.press('Escape')
    assert.ok(await field.evaluate(el=>el===document.activeElement));assert.ok(await panel.isHidden())
    // Quick exit and return before opening must restart the delay.
    await page.locator('.ids-tree [data-character="水"]').hover(); await page.waitForTimeout(50)
    await page.mouse.move(0,0); await page.waitForTimeout(50)
    await page.locator('.ids-tree [data-character="水"]').hover(); await panel.waitFor({state:'visible'})
    await panel.getByText('Emoji mnemonic',{exact:true}).waitFor()
    await field.fill('⿰木火'); await panel.waitFor({state:'hidden'})
    assert.match(await page.locator('.ids-tree [data-character="木"]').getAttribute('title'), /木/)
    assert.doesNotMatch(await page.locator('.ids-tree [data-character="木"]').getAttribute('title'), /水/)
    // Component-browser hover uses the same information; clicking still inserts.
    await page.keyboard.press('Escape')
    await page.locator('.parts-tabs [role="tab"]').filter({hasText:'Tangut'}).click()
    const filter=page.locator('.ids-parts input')
    await filter.fill('𘥇')
    const pick=page.locator('.part[data-character="𘥇"]');await pick.hover();await panel.waitFor({state:'visible'})
    await pick.focus();await pick.press('Enter');await page.waitForTimeout(200)
    assert.match(await field.inputValue(),/𘥇/)
    assert.deepEqual(errors,[])
    await page.close();console.log(`PASS ${scheme}: meanings, sources, hover persistence, keyboard, stale targets, insertion`)
  }
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
  await page.route('https://glyphatlas.org/**',r=>r.abort());await page.goto(`${process.env.IDS_URL ?? 'http://127.0.0.1:5194'}/?lang=en`)
  await page.locator('.ids-field input').fill('⿰馬木')
  await page.locator('.ids-tree [data-character="馬"]').focus()
  await page.locator('.ids-character-info').waitFor({state:'visible'})
  assert.ok(await page.locator('.ids-character-info').evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight+1}))
  if(process.env.IDS_INFO_SHOTS)await page.screenshot({path:`${process.env.IDS_INFO_SHOTS}/mobile.png`})
  await page.close();console.log('PASS mobile viewport')
} finally { await browser.close() }
