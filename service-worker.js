const CACHE_NAME = 'cet6-immersive-v6';
const OFFLINE_URL = './offline.html';

// 预缓存核心资源
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './vocab.html',
  './quote.html',
  './reading.html',
  './notebook.html',
  './settings.html',
  './offline.html',
  './css/theme.css',
  './css/utilities.css',
  './css/animation.css',
  './css/index.css',
  './js/app.js',
  './js/storage.js',
  './js/vocab.js',
  './js/settings.js',
  './js/index.js',
  './data/words.json',
  './data/reading.json',
  './data/quotes.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const url = new URL(event.request.url);

      // HTML: Network First, fallback to cache
      if (event.request.mode === 'navigate') {
        try {
          const networkResponse = await fetch(event.request);
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        } catch (error) {
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) return cachedResponse;
          return cache.match(OFFLINE_URL);
        }
      }

      // JSON Data: Stale-while-revalidate
      if (url.pathname.includes('/data/')) {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      }

      // Assets (CSS, JS, Fonts): Cache First
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) return cachedResponse;

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
        return networkResponse;
      } catch (error) {
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});