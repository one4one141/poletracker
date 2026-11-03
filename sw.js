// Pole Test Tracker service worker: always tries the network first so updates arrive,
// and falls back to the saved copy when the phone is offline.
const CACHE = 'pole-tracker-v2';
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll([new Request('./', { cache: 'reload' }), new Request('./index.html', { cache: 'reload' })]))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || req.destination === 'document';
  e.respondWith(
    // for the page itself, skip the browser's cache entirely so a new release is picked up on the next launch
    fetch(isPage ? new Request(req.url, { cache: 'no-store' }) : req)
      .then(r => { if (isPage && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
