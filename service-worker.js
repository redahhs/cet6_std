const CACHE_NAME = 'cet6-immersive-v2';
const OFFLINE_URL = '/offline.html';

// Core assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/vocab.html',
  '/quote.html',
  '/reading.html',
  '/notebook.html',
  '/settings.html',
  '/offline.html',
  '/css/theme.css',
  '/css/utilities.css',
  '/css/animation.css',
  '/js/app.js',
  '/js/storage.js',
  '/manifest.json'
];

// 1. Install: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// 2. Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 3. Fetch: Smart Routing Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const url = new URL(event.request.url);

      // Strategy A: Network-first for HTML navigation (with offline fallback)
      if (event.request.mode === 'navigate') {
        try {
          const networkResponse = await fetch(event.request);
          // Update cache with fresh copy
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        } catch (error) {
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) return cachedResponse;
          // Final fallback
          return cache.match(OFFLINE_URL);
        }
      }

      // Strategy B: Stale-while-revalidate for JSON data (Words, Quotes, Articles)
      if (url.pathname.startsWith('/data/')) {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => cachedResponse);
        
        return cachedResponse || fetchPromise;
      }

      // Strategy C: Cache-first for static assets (CSS, JS, Fonts, Images)
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) return cachedResponse;

      try {
        const networkResponse = await fetch(event.request);
        // Cache successful responses
        if (networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // If it's an image, return a placeholder or fail silently
        if (event.request.destination === 'image') {
          return new Response('', { status: 404 });
        }
        throw error;
      }
    })()
  );
});