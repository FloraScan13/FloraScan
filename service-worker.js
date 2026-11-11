const CACHE_NAME = 'sugar-bush-shell-v6';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './leaf-icon-v2.svg',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        // Cache each resource independently so one unavailable CDN asset cannot block app installation.
        await Promise.allSettled(APP_SHELL.map(async resource => {
            try {
                const request = new Request(resource, { mode: resource.startsWith('http') ? 'cors' : 'same-origin' });
                const response = await fetch(request);
                if (response && (response.ok || response.type === 'opaque')) {
                    await cache.put(request, response);
                }
            } catch (error) {
                // Continue caching the rest of the shell if a CDN request is temporarily unavailable.
            }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter(key => key.startsWith('sugar-bush-shell-') && key !== CACHE_NAME)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isAppOrigin = url.origin === self.location.origin;
    const isPublicLibrary = [
        'cdn.tailwindcss.com',
        'cdnjs.cloudflare.com',
        'cdn.jsdelivr.net'
    ].includes(url.hostname);

    // Never cache Supabase API/auth/storage responses or other account-specific network data.
    if (!isAppOrigin && !isPublicLibrary) return;

    if (request.mode === 'navigate' || (isAppOrigin && (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')))) {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response && response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                }
                return response;
            } catch (error) {
                return (await caches.match(request)) ||
                    (await caches.match('./index.html')) ||
                    Response.error();
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) {
            // Refresh cached assets in the background while online.
            fetch(request).then(async response => {
                if (response && (response.ok || response.type === 'opaque')) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                }
            }).catch(() => {});
            return cached;
        }
        try {
            const response = await fetch(request);
            if (response && (response.ok || response.type === 'opaque')) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response.clone());
            }
            return response;
        } catch (error) {
            return Response.error();
        }
    })());
});
