// IDS_URL, CHROMIUM_PATH, optional IDS_SEARCH_SHOTS and IDS_SEARCH_BEFORE.
import {chromium} from 'playwright-core'
import {strict as assert} from 'node:assert'
import {readFileSync,mkdirSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
const seal=JSON.parse(gunzipSync(readFileSync(new URL('../data/small-seal.json.gz',import.meta.url))))
const horseSeal=Object.keys(seal.modern).find(c=>seal.modern[c].includes('馬')&&(seal.table[c]||seal.parts.some(p=>p.part===c)))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH})
try{
 for(const scheme of ['light','dark']){
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2,colorScheme:scheme})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.route('https://glyphatlas.org/**',r=>r.abort())
  await page.goto(`${process.env.IDS_URL}/?lang=en`,{waitUntil:'domcontentloaded'})
  const field=page.locator('.ids-field input'),tabs=page.locator('.ids-pick-tabs')
  await field.fill('⿰⬚⬚');await page.locator('.ids-tree .ids-part.empty').first().click()
  await tabs.getByRole('tab',{name:'Find',exact:true}).click()
  const active=page.locator('.ids-pick-panel:not([hidden])'),input=active.locator('input'),hits=active.locator('.ids-hit')
  await input.fill('horse');await active.locator('.ids-hit[data-character="馬"]').waitFor()
  if(!process.env.IDS_SEARCH_BEFORE)for(const char of ['𘆽','🐎',horseSeal])await active.locator(`[data-character="${char}"]`).waitFor()
  await page.evaluate(()=>document.fonts.ready)
  if(process.env.IDS_SEARCH_SHOTS){mkdirSync(process.env.IDS_SEARCH_SHOTS,{recursive:true});await page.screenshot({path:`${process.env.IDS_SEARCH_SHOTS}/${process.env.IDS_SEARCH_BEFORE?'before':'after'}-${scheme}.png`,clip:{x:0,y:0,width:1100,height:1000}})}
  if(process.env.IDS_SEARCH_BEFORE){await page.close();continue}
  for(const query of ['horse','🐎','𘆽',horseSeal]){
   await input.fill(query)
   for(const char of ['馬','𘆽','🐎',horseSeal])await active.locator(`[data-character="${char}"]`).waitFor()
  }
  await input.fill('𘆽');await active.locator('[data-character="𘆽"]').waitFor()
  await page.waitForFunction(()=>document.querySelector('.ids-pick-panel:not([hidden]) .ids-hit')?.getAttribute('data-character')==='𘆽')
  await input.fill('die');const die=active.locator('[data-character="𗆮"]');await die.waitFor()
  assert.match(await die.innerText(),/\(of a monarch\) to die/)
  await input.fill('horse');await input.fill('water')
  for(const char of ['水','💧','𗋽'])await active.locator(`[data-character="${char}"]`).waitFor()
  assert.equal(await active.locator('[data-character="🐎"]').count(),0)
  await input.fill('🐎');await active.locator('[data-character="𘆽"]').click()
  assert.equal(await field.inputValue(),'⿰𘆽⬚')
  assert.deepEqual(errors,[])
  await page.close();console.log(`PASS ${scheme}: reciprocal relations, qualifiers, stale queries, insertion`)
 }
 if(!process.env.IDS_SEARCH_BEFORE){
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
 await page.route('https://glyphatlas.org/**',r=>r.abort());await page.goto(`${process.env.IDS_URL}/?lang=en`,{waitUntil:'domcontentloaded'})
 await page.locator('.ids-pick-tabs').getByRole('tab',{name:'Find',exact:true}).click()
 await page.locator('.ids-pick-panel:not([hidden]) input').fill('horse')
 await page.locator('.ids-hit[data-character="𘆽"]').waitFor()
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
 await page.close();console.log('PASS mobile search layout')
 }
}finally{await browser.close()}
