import { readFile } from 'node:fs/promises';
import { createNajmServiceWorker } from '../../dist/pwa.js';
const clientSource = await readFile(new URL('../../dist/pwaClient.js', import.meta.url), 'utf8');
let version = 'v1';
let broken = false;
const hits = {};
const driver = `import {connectNajmPwaClient} from '/pwa-client.js';
const build=document.documentElement.dataset.build;
const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
await navigator.serviceWorker.ready;
if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
window.pwa=connectNajmPwaClient({registration,cacheId:'updates-fixture',cacheVersion:build,canActivate:()=>!document.querySelector('#draft').value});
window.update=()=>registration.update();window.fixtureReady=true;`;
const html = () => `<!doctype html><html data-build="${version}"><h1>Build ${version}</h1><input id="draft" aria-label="Unsent draft"><script type="module" src="/client.js"></script></html>`;
const server = Bun.serve({ hostname:'127.0.0.1',port:Number(process.env.UPDATE_PROOF_PORT??0),idleTimeout:0,async fetch(request){
  const url=new URL(request.url);
  hits[url.pathname]=(hits[url.pathname]??0)+1;
  if(url.pathname==='/stats')return Response.json(hits,{headers:{'Cache-Control':'no-store'}});
  if(url.pathname==='/control'&&request.method==='POST'){const input=await request.json();if(!['v1','v2','v3','v4','v5'].includes(input.version))return new Response('bad',{status:400});version=input.version;broken=!!input.broken;return Response.json({version,broken});}
  if(url.pathname==='/sw.js')return createNajmServiceWorker({cacheId:'updates-fixture',cacheVersion:version,offlineUrl:'/shell.html',precache:['/client.js','/pwa-client.js',`/${version}.js`],updatePolicy:'staged',installBudget:{attempts:3,windowMs:60000},navigationFallback:{paths:['/app'],timeoutMs:500}})();
  if(url.pathname==='/client.js')return new Response(driver,{headers:{'Content-Type':'application/javascript','Cache-Control':'no-store'}});
  if(url.pathname==='/pwa-client.js')return new Response(clientSource,{headers:{'Content-Type':'application/javascript','Cache-Control':'no-store'}});
  if(/^\/v[1-5]\.js$/.test(url.pathname))return broken&&url.pathname===`/${version}.js`?new Response('missing',{status:503}):new Response(`export const version=${JSON.stringify(url.pathname)};`,{headers:{'Content-Type':'application/javascript','Cache-Control':'no-store'}});
  if(url.pathname==='/app'||url.pathname==='/shell.html')return new Response(html(),{headers:{'Content-Type':'text/html','Cache-Control':'no-store'}});
  if(url.pathname==='/unmanaged')return new Response('<!doctype html><h1>No update integration</h1>',{headers:{'Content-Type':'text/html'}});
  return new Response('not found',{status:404});
}});
console.log(`Update fixture: ${server.url}`);
