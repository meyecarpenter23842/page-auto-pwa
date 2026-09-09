const CACHE='page-auto-pwa-v7';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/'])));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))]))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.pathname.startsWith('/api/')){event.respondWith(fetch(event.request));return}event.respondWith(fetch(event.request).catch(()=>caches.match(event.request).then(response=>response||caches.match('/'))))});
