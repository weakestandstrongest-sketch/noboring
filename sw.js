// Offline support: always try the network first so updates show up right away,
// and fall back to the cache only when offline.
const VERSION = 'quint-v4';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/main.js', 'js/ui.js', 'js/calculator.js', 'js/weather.js', 'js/timer.js',
  'js/habits.js', 'js/journey.js', 'js/camera.js', 'js/wx3d.js',
  'vendor/three.module.min.js', 'vendor/digits.typeface.json',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the HTTP cache so a new version never stores stale files
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // weather API: always live; the app keeps its own cache of the last response
  if (url.hostname.endsWith('open-meteo.com')) return;

  if (url.origin === location.origin) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  // fonts and other cross-origin assets: network first, fall back to cache
  e.respondWith(fetch(req).then((res) => {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
    return res;
  }).catch(() => caches.match(req)));
});
