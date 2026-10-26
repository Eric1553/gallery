const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 if(process.env.BIREN_COOKIES)await context.addCookies(require(process.env.BIREN_COOKIES));
 const page=await context.newPage();await page.route('**/embed.js*',r=>r.abort());
 await page.goto((process.env.BIREN_BASE_URL||'http://127.0.0.1:8771')+'/#forms');
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});
  for(let i=0;i<10;i++){
   await page.locator(`[data-form-index="${i}"]`).click();
   const dialog=page.locator('.finance-form-dialog');await dialog.waitFor({state:'visible'});
   assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,`horizontal overflow ${width}/${i}`);
   assert.equal(await page.locator('#form-fields input').evaluateAll(es=>es.every(e=>e.labels.length===1)),true);
   assert.equal(await page.locator('#form-save').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(47, 143, 255)');
   const heights=await page.locator('.finance-form-actions button,.finance-form-actions .upload-label').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
   assert(heights.every(h=>Math.abs(h-40)<1),'uniform action heights');
   await page.locator('#form-download').scrollIntoViewIfNeeded();
   const downloadPromise=page.waitForEvent('download');await page.locator('#form-download').click();
   assert.match((await downloadPromise).suggestedFilename(),/\.csv$/);
   if(i===0)await page.screenshot({path:`/tmp/biren-form-fix-20261026/form-${width}.png`});
   await page.locator('.finance-form-close').click();
  }
 }
 await browser.close();console.log('PASS: all 10 forms at 1440/768/390, labels, overflow, action alignment, CSV downloads, close.');
})().catch(e=>{console.error(e);process.exit(1)});
