// Offline support: use the network when it's available (so updates show up right
// away) and fall back to the saved copy when offline.
// Bump VERSION whenever app files change so phones pick up the update.
const VERSION = 'latter-day-notebook-v9';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './schema.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Use the network, but don't wait more than a few seconds on weak signal.
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  const fromCache = () =>
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'));

  const fromNetwork = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(VERSION).then((cache) => cache.put(req, copy));
    }
    return res;
  });

  e.respondWith(new Promise((resolve) => {
    let done = false;
    const finish = (res) => { if (!done && res) { done = true; resolve(res); } };
    const timer = setTimeout(() => fromCache().then(finish), NETWORK_TIMEOUT_MS);
    fromNetwork
      .then((res) => { clearTimeout(timer); finish(res); })
      .catch(() => { clearTimeout(timer); fromCache().then((hit) => finish(hit || Response.error())); });
  }));
});
