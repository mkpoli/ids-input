import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export async function checkSealReview({open,shots,assert,pass}) {
  for(const scheme of ['light','dark']) {
    const page=await open('?composer=http%3A%2F%2F%5B',{scheme,height:1050})
    const launch=async()=>{
      await page.getByRole('tab',{name:'Parts',exact:true}).click()
      await page.getByRole('tab',{name:'Small Seal',exact:true}).click()
      await page.locator('.seal-review-link').click()
      await page.locator('.seal-review .correction').waitFor({timeout:30000})
    }
    try {
      await launch()
      const panel=page.locator('.seal-review'), query=panel.locator('input[type=search]'), correction=panel.locator('.correction')
      const initial=await correction.inputValue()
      assert(!initial.includes('⬚'),'default candidate has mapped components')
      await page.evaluate(()=>document.fonts.ready)
      await page.screenshot({path:join(shots,`seal-review-${scheme}.png`)})
      if(scheme==='light') {
        await correction.fill('⿰木⬚')
        assert(await panel.getByRole('button',{name:'Accept locally',exact:true}).isDisabled(),'incomplete IDS cannot be accepted')
        await panel.getByRole('button',{name:'Reject locally',exact:true}).click()
        await panel.getByText('Rejected locally',{exact:true}).waitFor()
        const corrected=initial.replace('⿰','⿱')
        await correction.fill(corrected)
        await panel.locator('textarea').fill('Compared with the source; corrected arrangement.')
        await panel.getByRole('button',{name:'Accept locally',exact:true}).click()
        await panel.getByText('Accepted locally',{exact:true}).waitFor()
        await page.reload()
        await launch()
        assert(await correction.inputValue()===corrected,'correction survives reload')
        await panel.getByText('Accepted locally',{exact:true}).waitFor()
        const [download]=await Promise.all([page.waitForEvent('download'),panel.getByRole('button',{name:'Export reviews (1)',exact:true}).click()])
        const doc=JSON.parse(readFileSync(await download.path(),'utf8'))
        assert(doc.reviews[0].text===corrected && doc.reviews[0].candidate.text===initial,'export separates correction from generated candidate')
        assert(doc.reviews[0].evidence.records.length && doc.reviews[0].evidence.sources.length,'export retains source provenance')
        await panel.getByRole('button',{name:'Use in editor',exact:true}).click()
        await page.waitForFunction(text=>document.querySelector('.ids-field input').value===text,corrected)
        await launch()
        await query.fill('U+3D06C')
        await panel.getByText('No bundled reference glyph. Use an external source before judging the shape.',{exact:true}).waitFor()
        await query.fill('玨')
        await page.waitForFunction(()=>document.querySelector('.seal-review .seal-glyph')?.textContent===String.fromCodePoint(0x3D10C))
        await query.fill('祖')
        await panel.getByText('Accepted locally',{exact:true}).waitFor()
        await page.evaluate(()=>{
          const set=Storage.prototype.setItem
          Storage.prototype.setItem=function(key,value){if(key==='ids-input.seal-reviews.v1')throw new Error('quota');return set.call(this,key,value)}
        })
        await panel.locator('textarea').fill('Newer decision retained in memory')
        await panel.getByRole('button',{name:'Reject locally',exact:true}).click()
        await panel.getByRole('alert').filter({hasText:'Local storage'}).waitFor()
        const [memory]=await Promise.all([page.waitForEvent('download'),panel.getByRole('button',{name:'Export reviews (1)',exact:true}).click()])
        assert(JSON.parse(readFileSync(await memory.path(),'utf8')).reviews[0].note==='Newer decision retained in memory','failed storage write remains exportable')
      }
      assert(!page.errors.length,page.errors.join('; '))
    } finally {await page.context().close()}
  }
  const phone=await open('?lang=ja&composer=http%3A%2F%2F%5B',{width:390,height:844,locale:'ja'})
  try {
    await phone.getByRole('tab',{name:'部品',exact:true}).click()
    await phone.getByRole('tab',{name:'小篆',exact:true}).click()
    await phone.locator('.seal-review-link').click()
    await phone.locator('.seal-review .correction').waitFor({timeout:30000})
    assert(await phone.evaluate(()=>document.querySelector('dialog[open]').scrollWidth<=document.querySelector('dialog[open]').clientWidth),'review dialog fits phone width')
    await phone.screenshot({path:join(shots,'seal-review-phone-ja.png')})
    assert(!phone.errors.length,phone.errors.join('; '))
  } finally {await phone.context().close()}
  pass('Seal candidates, correction, local decisions, provenance export, reload, storage failure, missing glyphs and Japanese phone layout')
}
