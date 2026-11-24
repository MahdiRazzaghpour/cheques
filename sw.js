// Offline: the app's own files are cached, so it opens without internet once installed.
// Bump VERSION whenever any file changes, so phones pick up the new version.
const VERSION = 'cheques-v4';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/core.js', './js/store.js', './js/demo.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

// GitHub Pages lets browsers reuse files for 10 minutes. `reload` and `no-cache` go to the server instead, so a new
// version never gets cached with an old file inside it.
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION)
    .then(cache => cache.addAll(FILES.map(file => new Request(file, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

// Network first, so an online phone gets updates straight away; the cache is the fallback when offline.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request.url, { cache: 'no-cache' })
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
