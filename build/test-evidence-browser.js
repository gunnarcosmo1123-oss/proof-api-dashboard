'use strict';
// Optional browser tests. Playwright is a test tool, not an app dependency.
// Serve the repo first. MODEL_TEST=1 includes a real ~150 MB model download.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const URL_BASE = process.env.PROOF_TEST_URL || 'http://127.0.0.1:8000';
const SOLAR = path.join(ROOT, 'assets/photos/solar-01.jpg');
const launch = { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox'] };
const results = [];
const pass = message => { results.push(message); console.log('PASS:',message); };

async function submit(page){
  await page.locator('#tab-submit input[type=file]').first().setInputFiles(SOLAR);
  await page.evaluate(() => { SUBMIT.action='solar'; window.__submitFile(SUBMIT.file); });
  await page.locator('#run-real-model').waitFor({timeout:15000});
}
async function waitForModel(page){
  await page.waitForFunction(() => {
    const panel=document.querySelector('.model-panel');
    return panel.querySelector('meter') || panel.querySelector('.evidence-failure');
  },null,{timeout:300000});
  assert.equal(await page.locator('.model-panel .evidence-failure').count(),0,
    await page.locator('.model-panel .evidence-status').innerText());
}
async function main(){
  const browser=await chromium.launch(launch);
  const context=await browser.newContext({viewport:{width:1280,height:1000}});
  const page=await context.newPage(),requests=[],errors=[];
  page.on('request',r=>requests.push(r));page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL_BASE+'/?lang=en&tab=submit&nosplash');
  await submit(page);
  assert.equal(requests.filter(r=>/huggingface|model-worker|vendor\/transformers/.test(r.url())).length,0);
  assert.equal((await page.evaluate(()=>navigator.serviceWorker.getRegistrations())).length,0);
  pass('default submission loads no model, runtime, WASM or service worker');
  assert.ok(await page.getByText('a single photo proves an action happened, not that it worked',{exact:true}).count());
  assert.equal(await page.locator('.satellite-panel .evidence-chart circle').count(),8);
  await page.getByLabel('Landsat reference site', {exact:true}).selectOption('xixi');
  assert.equal(await page.locator('.satellite-panel .evidence-chart circle').count(),7);
  assert.ok((await page.locator('.satellite-panel').innerText()).includes('Uncertainty:'));
  pass('bundled real Landsat sites render offline-ready observations and uncertainty');

  await page.locator('.pair-cell input[type=file]').first().setInputFiles(SOLAR);
  await page.locator('.pair-cell input[type=date]').first().fill('2024-01-01');
  await page.getByRole('button',{name:'Compare evidence pair',exact:true}).click();
  assert.match(await page.locator('.pair-panel > .evidence-status').innerText(),/Confirm the same viewpoint/);
  await page.locator('.pair-confirm input').check();
  await page.getByRole('button',{name:'Compare evidence pair',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.pair-output .evidence-metric'));
  assert.match(await page.locator('.pair-panel > .evidence-status').innerText(),/Identical file/);
  assert.match(await page.locator('.pair-output').innerText(),/100.0\/100/);
  assert.match(await page.locator('.pair-output').innerText(),/\+0.0 pp/);
  pass('same-viewpoint confirmation and identical-file pair measurements');

  const verdict=await page.locator('.verdict-banner').innerText();
  await context.route('https://huggingface.co/**',r=>r.abort('failed'));
  await page.locator('#run-real-model').click();
  await page.locator('.model-panel .evidence-failure').waitFor({timeout:30000});
  assert.match(await page.locator('.model-panel .evidence-status').innerText(),/Using the offline heuristic engine/);
  assert.equal(await page.locator('.verdict-banner').innerText(),verdict);
  pass('network/model failure shows a reason and preserves the heuristic verdict');
  await context.close();

  const fileContext=await browser.newContext();const filePage=await fileContext.newPage();
  try{
    await filePage.goto('file://'+path.join(ROOT,'index.html')+'?lang=en&tab=submit&nosplash');
    await submit(filePage);await filePage.locator('#run-real-model').click();
    await filePage.locator('.model-panel .evidence-failure').waitFor();
    assert.match(await filePage.locator('.model-panel .evidence-status').innerText(),/HTTPS or localhost/);
    assert.equal(await filePage.locator('.satellite-panel .evidence-chart circle').count(),8);
    pass('double-click file:// demo retains heuristics, bundled NDVI and a visible model limitation');
  }catch(e){
    if(!e.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR'))throw e;
    console.log('SKIP: file:// navigation blocked by this test browser’s administrator policy');
    results.push('SKIP: file:// browser check (administrator policy blocks local-file navigation)');
  }
  await fileContext.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844}});
  const mobilePage=await mobile.newPage();
  await mobilePage.goto(URL_BASE+'/?lang=zh&tab=submit&nosplash');await submit(mobilePage);
  assert.ok((await mobilePage.locator('.model-panel').innerText()).includes('运行真实模型'));
  for(const selector of ['.model-panel','.pair-panel']){
    const bounds=await mobilePage.locator(selector).boundingBox();
    assert.ok(bounds.x>=0 && bounds.x+bounds.width<=390,selector+' fits mobile viewport');
  }
  pass('Chinese evidence panels fit a 390px mobile viewport');
  await mobile.close();await browser.close();assert.deepEqual(errors,[]);

  if(process.env.MODEL_TEST==='1') await realModel();
  if(process.env.PROOF_TEST_REPORT) fs.writeFileSync(process.env.PROOF_TEST_REPORT,JSON.stringify(results,null,2));
}

async function realModel(){
  const profile=process.env.PROOF_TEST_PROFILE || fs.mkdtempSync(path.join(os.tmpdir(),'proof-model-test-'));
  const context=await chromium.launchPersistentContext(profile,{...launch,viewport:{width:1280,height:1000}});
  let offline=false;const external=[];
  // Optional managed-network adapter. The mirror must TLS-verify upstream.
  // A redirect streams real bytes rather than buffering a huge model over CDP.
  if(process.env.PROOF_TEST_MIRROR) await context.route('https://huggingface.co/**',r=>{
    if(offline) return r.abort('internetdisconnected');
    return r.fulfill({status:307,headers:{location:process.env.PROOF_TEST_MIRROR+new URL(r.request().url()).pathname,'access-control-allow-origin':'*'}});
  });
  context.on('request',r=>{if(!r.url().startsWith(URL_BASE) && /^https?:/.test(r.url()))external.push({url:r.url(),method:r.method(),body:r.postData()});});
  const page=await context.newPage();
  try{
    await page.goto(URL_BASE+'/?lang=en&tab=submit&nosplash');
    // Update the shell for repeat development runs, retaining the real model cache.
    await page.evaluate(async()=>{
      for(const name of await caches.keys())if(name.startsWith('proof-offline-shell-'))await caches.delete(name);
    });await page.reload();
    await submit(page);const verdict=await page.locator('.verdict-banner').innerText();
    await page.locator('#run-real-model').click();await waitForModel(page);
    await page.locator('.model-output select').selectOption('6');
    const predictions=await page.locator('.model-probabilities li').evaluateAll(nodes=>nodes.map(n=>({label:n.querySelector('span').textContent,probability:Number(n.dataset.probability)})));
    assert.equal(predictions.length,6);
    assert.ok(Math.abs(predictions.reduce((s,p)=>s+p.probability,0)-1)<.00001);
    assert.ok(predictions.every((p,i)=>!i||p.probability<=predictions[i-1].probability));
    assert.equal(await page.locator('.verdict-banner').innerText(),verdict);
    pass('real pinned CLIP inference: six genuine probabilities sum to one and preserve verdict');
    console.log('Measured model panel:',await page.locator('.model-panel .evidence-metrics').innerText());
    const requestCount=external.length;
    await page.getByRole('button',{name:'↻ Verify cache-only rerun',exact:true}).click();await waitForModel(page);
    assert.match(await page.locator('.model-panel .evidence-status').innerText(),/Offline readiness verified/);
    assert.equal(external.length,requestCount);
    pass('fresh-worker cache-only rerun makes zero external requests');

    offline=true;await context.setOffline(true);await page.reload();
    await page.locator('#tab-submit .feed-row').first().getByRole('button',{name:'View receipt',exact:true}).click();
    await page.locator('#run-real-model').click();
    assert.match(await page.locator('.model-panel .evidence-status').innerText(),/Reattach/);
    // Reject the wrong file, then prove the original matches the full registry SHA.
    await page.locator('.model-panel input[type=file]').setInputFiles(path.join(ROOT,'assets/photos/cleanup-01.jpg'));
    await page.waitForFunction(()=>document.querySelector('.model-panel .evidence-status').textContent.includes('does not match'));
    await page.locator('.model-panel input[type=file]').setInputFiles(SOLAR);
    await page.waitForFunction(()=>document.querySelector('.model-panel .evidence-status').textContent.includes('Original reattached'));
    await page.locator('#run-real-model').click();await waitForModel(page);
    assert.match(await page.locator('.model-panel .evidence-status').innerText(),/completed offline/);
    assert.equal(external.length,requestCount);
    pass('offline reload, SHA-checked original reattachment and real inference with zero external requests');

    await page.evaluate(async()=>{
      const cache=await caches.open(PROOF_MODEL.cache);
      for(const key of await cache.keys())if(key.url.endsWith('/onnx/model_quantized.onnx'))await cache.delete(key);
    });
    await page.getByRole('button',{name:'↻ Verify cache-only rerun',exact:true}).click();
    await page.locator('.model-panel .evidence-failure').waitFor({timeout:30000});
    assert.match(await page.locator('.model-panel .evidence-status').innerText(),/not found locally|incomplete/);
    pass('evicted weights degrade visibly to heuristics while offline');
    assert.ok(external.every(r=>r.method==='GET' && !r.body),'model network only reads files; no photo is uploaded');
    pass('all external model requests are GETs without a request body');
  }finally{await context.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
