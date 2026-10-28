// Offline support: try the network first so updates show up right away,
// and fall back to the cache only when offline.
const VERSION = 'quint-v8';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/main.js', 'js/ui.js', 'js/calculator.js', 'js/weather.js', 'js/timer.js',
  'js/habits.js', 'js/journey.js', 'js/camera.js', 'js/wx3d.js',
  'vendor/three.module.min.js', 'vendor/digits.typeface.json',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the HTTP cache so a new version never stores stale files.
  // A failed precache must not block the update, so errors are swallowed.
  e.waitUntil(caches.open(VERSION)
    .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Safari refuses to show a page whose service-worker response was redirected,
// so redirected responses are copied into a fresh Response.
function clean(res) {
  if (!res.redirected) return res;
  return res.blob().then((body) => new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers }));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // weather and place APIs stay live; fonts are cached for offline use
    if (!/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req)));
    return;
  }

  e.respondWith(fetch(req).then((res) => {
    if (res.ok && !res.redirected) {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return clean(res);
  }).catch(async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await caches.match('./')) || (await caches.match('index.html')) || Response.error();
    return Response.error();
  }));
});
