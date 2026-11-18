// Pole Test Tracker service worker.
// The app opens instantly from the copy saved on the phone (works with no signal or a very weak one),
// and checks for a newer version quietly in the background. If one is found, the app shows its "new version" bar.
const CACHE = 'pole-tracker-v3';
const keyOf = u => { const x = new URL(u, self.location.href); return x.origin + x.pathname; };
const HOME = keyOf('./'), INDEX = keyOf('./index.html');

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all([HOME, INDEX].map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (r.ok) return c.put(u, r); }))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// download the newest page, save it for next time, and tell the open app which version it is
async function refresh(url) {
  const r = await fetch(new Request(url, { cache: 'no-store' }));
  if (!r.ok) throw new Error('bad response');
  const c = await caches.open(CACHE), k = keyOf(url);
  const targets = (k === HOME || k === INDEX) ? [HOME, INDEX] : [k];
  await Promise.all(targets.map(t => c.put(t, r.clone())));
  try {
    const m = (await r.clone().text()).match(/APP_VERSION\s*=\s*'([^']+)'/);
    if (m) (await self.clients.matchAll()).forEach(cl => cl.postMessage({ type: 'latest', version: m[1] }));
  } catch (e) {}
  return r;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || req.destination === 'document';
  if (isPage) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(keyOf(req.url)) || await cache.match(HOME);
      const fresh = refresh(req.url);
      if (cached) { e.waitUntil(fresh.catch(() => {})); return cached; }   // instant, even on a bad signal
      try { return await fresh; } catch (err) { return new Response('Offline. Open the app once with a signal so it can be saved.', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
    })());
    return;
  }
  e.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || Response.error())));
});
