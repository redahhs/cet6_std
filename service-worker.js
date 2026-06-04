const CACHE_NAME = 'cet6-immersive-v16';

// 修复 7: 只缓存实际存在的文件
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './css/index.css',
    './js/index.js',
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
    './data/words.json',
    './data/reading.json',
    './data/quotes.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // 使用 Promise.allSettled 避免单个文件 404 导致整个缓存安装失败
            return Promise.allSettled(
                PRECACHE_ASSETS.map(url =>
                    cache.add(url).catch(err => {
                        console.warn(`[SW] Failed to cache ${url}:`, err.message);
                    })
                )
            );
        })
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
                    // 尝试 offline page
                    const offline = await cache.match(OFFLINE_URL);
                    if (offline) return offline;
                    return new Response('Offline', {
                        status: 503,
                        headers: { 'Content-Type': 'text/html' }
                    });
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

            // Assets (CSS, JS): Cache First
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
