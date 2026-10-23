import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium,firefox,webkit } from 'playwright';
const root=dirname(fileURLToPath(import.meta.url));
const report={date:new Date().toISOString(),fixtureOnly:true,browsers:[]};
let failed=false;
async function until(check, timeout=15000){const end=Date.now()+timeout;while(!await check()){if(Date.now()>end)throw new Error('Worker state did not settle');await new Promise(resolveWait=>setTimeout(resolveWait,50));}}
for(const [engine,type]of Object.entries({chromium,firefox,webkit})){
  const child=spawn('bun',['--no-env-file',resolve(root,'serve.mjs')],{env:{...process.env,UPDATE_PROOF_PORT:'0'},stdio:['ignore','pipe','inherit'],windowsHide:true});
  const origin=await new Promise((resolveReady,reject)=>{const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);child.once('error',reject);child.stdout.on('data',data=>{const match=data.toString().match(/Update fixture: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolveReady(match[1]);}});});
  const browser=await type.launch({headless:true});const context=await browser.newContext({serviceWorkers:'allow'});
  const result={engine,version:browser.version(),checks:{},errors:[]};report.browsers.push(result);
  const observe=page=>page.on('pageerror',error=>result.errors.push(error.message));
  try{
    const a=await context.newPage();observe(a);await a.goto(origin+'/app');await a.waitForFunction(()=>window.fixtureReady);
    const b=await context.newPage();observe(b);await b.goto(origin+'/app');await b.waitForFunction(()=>window.fixtureReady);
    await a.getByLabel('Unsent draft').fill('Aya absent');await b.getByLabel('Unsent draft').fill('Ilyas late');
    await a.evaluate(async()=>{await(await caches.open('unrelated-fixture')).put('/unrelated',new Response('keep'));await new Promise((resolveDone,reject)=>{const request=indexedDB.open('pending-update-fixture',1);request.onupgradeneeded=()=>request.result.createObjectStore('outbox');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('outbox','readwrite');tx.objectStore('outbox').put({status:'pending',mark:'absent'},'operation-1');tx.oncomplete=()=>{db.close();resolveDone();};};});});
    const control=async(version,broken=false)=>{assert.equal((await a.request.post(origin+'/control',{data:{version,broken}})).status(),200);};
    const waitWaiting=async page=>until(()=>page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();return !!reg.waiting&&!reg.installing;}));
    await control('v2',true);await a.evaluate(()=>window.update());
    await until(()=>a.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();return !reg.installing&&!reg.waiting;}));
    assert.equal(await a.evaluate(()=>window.pwa.getUpdate()),null);
    assert.equal(await a.getByLabel('Unsent draft').inputValue(),'Aya absent');
    result.checks.failedDownloadDoesNotBecomeReady='PASS';
    await control('v2');await a.evaluate(()=>window.update());await waitWaiting(a);
    await until(()=>a.evaluate(async()=>{const update=await window.pwa.getUpdate();return update?.cacheVersion==='v2'&&update.ready;}));
    assert.deepEqual(await a.evaluate(()=>window.pwa.getUpdate()),{cacheVersion:'v2',ready:true});
    assert.equal(await a.locator('h1').innerText(),'Build v1');
    const blocked=await a.evaluate(()=>window.pwa.activateUpdate());assert.equal(blocked.activated,false);
    await a.getByLabel('Unsent draft').fill('');assert.equal((await a.evaluate(()=>window.pwa.activateUpdate())).activated,false);
    result.checks.eachDirtyTabBlocksActivation='PASS';
    await a.evaluate(async()=>{await(await caches.open('najm-pwa:updates-fixture:v2')).delete('/v2.js');});
    assert.equal((await a.evaluate(()=>window.pwa.getUpdate())).ready,false);
    assert.equal((await a.evaluate(()=>window.pwa.activateUpdate())).reason,'assets-unavailable');
    result.checks.evictionRecheckedBeforeActivation='PASS';
    await control('v3');await a.evaluate(()=>window.update());await waitWaiting(a);
    await until(()=>a.evaluate(async()=>{const value=await window.pwa.getUpdate();return value?.cacheVersion==='v3'&&value.ready;}));
    await b.getByLabel('Unsent draft').fill('');
    const unmanaged=await context.newPage();await unmanaged.goto(origin+'/unmanaged');
    assert.equal((await a.evaluate(()=>window.pwa.activateUpdate())).activated,false);await unmanaged.close();
    result.checks.unresponsiveClientBlocksActivation='PASS';
    const before=a.url();assert.equal((await a.evaluate(()=>window.pwa.activateUpdate())).activated,true);
    await until(()=>a.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();return !reg.waiting&&reg.active?.state==='activated';}));
    assert.equal(a.url(),before);assert.equal(await a.locator('h1').innerText(),'Build v1');assert.equal(await b.locator('h1').innerText(),'Build v1');
    await a.getByLabel('Unsent draft').fill('New pending mark survives');
    const cacheNames=await a.evaluate(()=>caches.keys());assert(cacheNames.includes('najm-pwa:updates-fixture:v1'));assert(cacheNames.includes('najm-pwa:updates-fixture:v3'));assert(cacheNames.includes('unrelated-fixture'));
    result.checks.activationDoesNotReloadOrDeleteOldAssets='PASS';
    await new Promise(resolveExit=>{child.once('exit',resolveExit);child.kill();});
    const asset=await a.evaluate(async()=>{const response=await fetch('/v1.js');return{status:response.status,text:await response.text()};});assert.equal(asset.status,200);assert(asset.text.includes('/v1.js'));
    const c=await context.newPage();observe(c);await c.goto(origin+'/app');await c.waitForFunction(()=>window.fixtureReady);assert.equal(await c.locator('h1').innerText(),'Build v3');
    assert.equal(await a.getByLabel('Unsent draft').inputValue(),'New pending mark survives');
    const pending=await a.evaluate(()=>new Promise((resolveDone,reject)=>{const request=indexedDB.open('pending-update-fixture',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('outbox');const read=tx.objectStore('outbox').get('operation-1');read.onsuccess=()=>resolveDone(read.result);tx.oncomplete=()=>db.close();};}));assert.deepEqual(pending,{status:'pending',mark:'absent'});
    result.checks.oldLazyAssetAndNewOfflineShell='PASS';result.checks.indexedDbPendingWorkRetained='PASS';
    assert.deepEqual(result.errors,[]);console.log(`${engine} ${result.version}: staged updates, two-tab consent, asset retention and pending work PASS`);
  }catch(error){failed=true;result.failure=error.stack;console.error(`${engine}: ${error.stack}`);}
  finally{await context.close();await browser.close();if(child.exitCode===null&&child.signalCode===null)await new Promise(resolveExit=>{child.once('exit',resolveExit);child.kill();});}
}
await mkdir(resolve(root,'.output'),{recursive:true});await writeFile(resolve(root,'.output/results.json'),JSON.stringify(report,null,2)+'\n');if(failed)process.exitCode=1;
