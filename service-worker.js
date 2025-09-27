const CACHE_NAME = 'gestion-raya-cache-v4';
const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Mensajes desde la página para aplicar el SW inmediatamente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Estrategia de caché:
// - HTML/Docs: Network-first (para evitar páginas obsoletas)
// - Otros assets: Cache-first con actualización en segundo plano
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // No cachear métodos que no sean GET
  if (req.method !== 'GET') return;

  const isDocument = req.mode === 'navigate' || req.destination === 'document' || req.headers.get('accept')?.includes('text/html');

  if (isDocument) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(req);
          return cached || caches.match('./');
        }
      })()
    );
    return;
  }

  // Cache-first para assets
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) {
        // Actualizar en segundo plano
        fetch(req).then(async (res) => {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
        }).catch(() => {});
        return cached;
      }
      const res = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
      return res;
    })()
  );
});
