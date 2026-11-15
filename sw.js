'use strict';
// Registered only by the explicit model opt-in. No service worker on default path.
const SHELL_CACHE = 'proof-offline-shell-v3';
const FILES = [
  './', './index.html', './css/style.css', './js/data.js', './js/photos.js',
  './js/map-data.js', './js/map-explorer.js', './js/i18n.js', './js/charts.js', './js/api.js', './js/app.js',
  './js/model-config.js', './js/evidence.js', './js/model-worker.js', './js/ndvi-data.js',
  './assets/data/landsat-ndvi.json', './manifest.webmanifest', './assets/icon-192.png',
  './assets/icon-512.png', './assets/qr.png',
  './assets/vendor/transformers/transformers.min.js',
  './assets/vendor/transformers/ort-wasm-simd.wasm', './assets/vendor/transformers/ort-wasm.wasm',
  ...['solar','cleanup','afforest','wetland','ev','retrofit'].flatMap(a =>
    ['01','02'].map(n => './assets/photos/' + a + '-' + n + '.jpg'))
];
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if(event.data !== 'prepare-offline') return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(SHELL_CACHE);
      // A warm cache must not require the network to prepare an offline rerun.
      const missing = [];
      for(const file of FILES){
        const url = new URL(file, self.location.href).href;
        if(!await cache.match(url)) missing.push(file);
      }
      if(missing.length) await cache.addAll(missing);
      event.ports[0].postMessage({ ok: true });
    } catch(e) { event.ports[0].postMessage({ ok: false, reason: e.message }); }
  })());
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Ignore the app's version query on local assets. Navigation uses index.html.
    const key = event.request.mode === 'navigate' ? new URL('./index.html', self.location.href).href : event.request;
    const hit = await cache.match(key, { ignoreSearch: true });
    if(hit) return hit;
    try { return await fetch(event.request); }
    catch(error){
      // A service-worker update can arrive before this version is prepared.
      // Retain the previous complete offline app until the next opt-in caches v3.
      for(const name of await caches.keys()){
        if(name !== SHELL_CACHE && name.startsWith('proof-offline-shell-')){
          const previous = await (await caches.open(name)).match(key, { ignoreSearch: true });
          if(previous) return previous;
        }
      }
      throw error;
    }
  })());
});
