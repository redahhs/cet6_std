/**
 * Service Worker v27 - PWA + 离线优化
 * - Network First for HTML (with offline fallback)
 * - Stale-while-revalidate for data
 * - Cache First for assets
 * - 预缓存关键资源
 * - 后台同步支持
 */

const CACHE_VERSION = 'v27';
const CACHE_NAME = `cet6-immersive-${CACHE_VERSION}`;
const DATA_CACHE = `cet6-data-${CACHE_VERSION}`;
const OFFLINE_URL = './offline.html';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './vocab.html',
  './quote.html',
  './settings.html',
  './offline.html',
  './manifest.json',
  './css/index.css',
  './js/audio.js',
  './js/env.js',
  './js/app.js',
  './js/migrate.js',
  './js/srs.js',
  './js/toast.js',
  './js/achievements.js',
  './js/heatmap.js',
  './js/dictionary.js',
  './js/listening.js',
  './js/spelling.js',
  './js/difficulty.js',
  './js/reading-extras.js',
  './js/vocab-test.js',
  './js/goals.js',
  './js/index.js',
  './js/vocab.js',
  './js/reading.js',
  './js/quote.js',
  './js/settings.js',
  './js/notebook.js',
  './js/router.js',
  './js/haptics.js',
  './data/words.json',
  './data/reading.json',
  './data/quotes.json'
];

// ---------- Install: 预缓存关键资源 ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(err => {
            console.warn(`[SW] Failed to cache ${url}:`, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ---------- Activate: 清理旧缓存 ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== DATA_CACHE && k !== OFFLINE_URL)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- Fetch: 多策略 ----------
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 跨域请求直接走网络
  if (url.origin !== self.location.origin) return;

  event.respondWith(handleFetch(event.request, url));
});

async function handleFetch(request, url) {
  // 1. HTML/导航: Network First
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (e) {
      // 离线 - 尝试缓存
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      // 最后 fallback 到 offline 页
      const offline = await cache.match(OFFLINE_URL);
      if (offline) return offline;
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
    }
  }

  // 2. JSON 数据: Stale-while-revalidate
  if (url.pathname.includes('/data/')) {
    const cache = await caches.open(DATA_CACHE);
    const cached = await cache.match(request);
    const networkPromise = fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => cached);
    return cached || networkPromise;
  }

  // 3. CSS/JS/字体: Cache First with background update
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    // 后台更新
    fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
    }).catch(() => {});
    return cached;
  }

  // 4. 图片: Cache First, then network
  if (request.destination === 'image') {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) cache.put(request, networkResponse.clone());
      return networkResponse;
    } catch (e) {
      return new Response('', { status: 503 });
    }
  }

  // 5. 其他: Network First
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

// ---------- 后台同步 ----------
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    console.log('[SW] Background sync: progress');
  }
});

// ---------- 消息处理 ----------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
