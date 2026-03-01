// JARVIS Service Worker v4 — PWA install + always-fresh assets
const CACHE_NAME = 'jarvis-v5';
const SHELL_ASSETS = [
  './',
  './index.html',
  './base.css',
  './style.css',
  './js/brain.js',
  './js/app.js',
  './js/cinematic.js',
  './icon-192.png',
  './icon-512.png',
];

// Install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up ALL old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: NETWORK-FIRST for everything (guarantees fresh code)
// Falls back to cache only when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Always network for API calls
  if (url.pathname.includes('cgi-bin') || url.pathname.includes('api.py')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for all assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the fresh response for offline use
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: fall back to cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Last resort for navigation
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
