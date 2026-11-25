const PREFIX='pg-tienda-seguro-';
const CACHE=PREFIX+'20261125-v1';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
 await self.clients.claim();
})());});
// Do not cache Firebase data or API operations. No offline order/payment submission.
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(()=>new Response('Sin conexión. Conectate a internet para consultar o registrar pedidos.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));return;
 }
 if(!/\.(?:css|png|jpe?g|webp|ico|woff2?)$/i.test(url.pathname))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const hit=await cache.match(req);if(hit)return hit;
 const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response;})());
});
