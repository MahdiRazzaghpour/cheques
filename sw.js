// Offline: the app's own files are cached, so it opens without internet once installed.
// Bump VERSION whenever any file changes, so phones pick up the new version.
const VERSION = 'cheques-v7';
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

// Cache first, so the app opens at once even when the server never answers: from Iran, GitHub Pages can hang without
// a VPN, and waiting for it (network first, up to v6) kept the screen blank. A new version arrives as a new sw.js,
// which the phone checks in the background each time the app opens; js/app.js then reloads the page.
// On this computer the files always come from the server, so edits show without bumping VERSION.
const LOCAL = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('fetch', event => {
  if (LOCAL || event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(VERSION)
    .then(cache => cache.match(event.request, { ignoreSearch: true }))
    .then(hit => hit || fetch(event.request)));
});
