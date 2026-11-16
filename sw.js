'use strict';
// Registered by explicit model or offline-app opt-in. No worker on default path.
const SHELL_CACHE = 'proof-offline-shell-v4';
const FILES = [
  './', './index.html', './css/style.css', './css/experience.css', './js/data.js', './js/photos.js',
  './js/community-data.js', './js/experience.js',
  './css/field-tools.css', './js/insights.js', './js/field-tools.js', './js/capture.js', './js/regions.js',
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
  if(event.data !== 'prepare-offline' && event.data?.type !== 'prepare-offline') return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(SHELL_CACHE);
      // A warm cache must not require the network to prepare an offline rerun.
      const missing = [];
      const files = event.data?.appOnly ? FILES.filter(file => !file.startsWith('./assets/vendor/')) : FILES;
      for(const file of files){
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
      // Retain the previous complete offline app until this version is prepared.
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
