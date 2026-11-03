// Smart Lesson Planner — Service Worker (PWA & Offline Support)
const CACHE_NAME = 'smart-planner-v2';
const STATIC_ASSETS = [
  '/',
  '/favicon.ico',
  '/icon.png',
  '/logo.png',
];

// Install: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching non-fatal warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Smart network-first for pages/API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Skip non-GET requests (e.g. POST/PUT to API) — handled by offline queue in frontend
  if (request.method !== 'GET') {
    return;
  }

  // 2. Only intercept same-origin requests
  // Do NOT intercept cross-origin requests (e.g. Google avatars on lh3.googleusercontent.com,
  // Google Sign-In, Cloudflare Turnstile, Vercel scripts). Let the browser fetch them natively.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. API Requests: Network first, never aggressively cache to avoid stale student data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(async () => {
        // Return structured offline JSON response if network fails
        return new Response(
          JSON.stringify({
            message: 'เครือข่ายออฟไลน์ ข้อมูลจะถูกบันทึกในเครื่องชั่วคราว',
            offline: true,
            data: null,
          }),
          {
            status: 503,
            statusText: 'Service Unavailable (Offline)',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }
        );
      })
    );
    return;
  }

  // 4. Static Assets (_next/static, images, fonts): Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.includes('/fonts/')
  ) {
    event.respondWith(
      (async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          // Serve from cache immediately and revalidate in background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseToCache);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, responseToCache);
          }
          return networkResponse;
        } catch {
          // Return a valid Response if network fails and cache is empty
          return new Response('Asset not available offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        }
      })()
    );
    return;
  }

  // 5. HTML Page Navigation: Network First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, responseToCache);
          }
          return networkResponse;
        } catch {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const rootCache = await caches.match('/');
          if (rootCache) {
            return rootCache;
          }
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })()
    );
    return;
  }

  // For any other requests, do not call event.respondWith(); let the browser handle natively.
});

// Listen for skipWaiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
