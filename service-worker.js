const CACHE_NAME = 'sugar-bush-shell-v1';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './leaf-icon-v2.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    const cacheableExternalAsset =
        url.hostname === 'cdn.tailwindcss.com' ||
        url.hostname === 'cdnjs.cloudflare.com' ||
        url.hostname === 'cdn.jsdelivr.net';
    if (url.origin !== self.location.origin && !cacheableExternalAsset) return;

    // Always prefer the latest app HTML when online, but fall back to the installed copy offline.
    if (request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(async () => (await caches.match(request)) || (await caches.match('./index.html')))
        );
        return;
    }

    // Cache app assets and the app's public CDN libraries for offline rendering.
    // Supabase/API requests are deliberately excluded to avoid serving stale account data.
    event.respondWith(
        caches.match(request).then(cached => {
            const network = fetch(request).then(response => {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            });
            return cached || network;
        })
    );
});
