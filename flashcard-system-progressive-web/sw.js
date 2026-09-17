// Polyglot Flashcard PWA Service Worker
const CACHE_NAME = 'flashcard-pwa-v17';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css?v=17',
  './js/app.js?v=17',
  './js/leitner.js',
  './js/storage.js',
  './js/gdrive.js',
  './js/gemini.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching static offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Clearing legacy cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip caching external Google APIs dynamically to ensure live auth/drive sync
  if (url.origin.includes('googleapis.com') || url.origin.includes('accounts.google.com')) {
    return;
  }

  // Network-first with cache fallback: always fetch fresh changes, fall back to offline cache when disconnected
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate' || event.request.destination === 'document') {
            return caches.match('./index.html');
          }
          return null;
        });
      })
  );
});
