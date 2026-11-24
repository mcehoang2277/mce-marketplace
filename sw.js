// ========================================================================
// MCE MARKETPLACE — PRODUCTION SERVICE WORKER (PWA OFFLINE & ASSETS CACHE)
// Version: v2.8.0
// ========================================================================

const CACHE_NAME = 'mce-pwa-v2.8.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/mobile.html',
  '/auth.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// 1. INSTALL SERVICE WORKER
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[MCE ServiceWorker] Pre-caching static offline assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[MCE ServiceWorker] Pre-cache non-blocking warning:', err);
      });
    })
  );
});

// 2. ACTIVATE SERVICE WORKER & CLEANUP OLD CACHES
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[MCE ServiceWorker] Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH STRATEGY: NETWORK FIRST WITH CACHE FALLBACK (EXCEPT APIS)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip REST APIs & Webhooks from caching (Always Live)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response to cache if successful
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails (Offline mode)
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.destination === 'document') {
            return caches.match('/mobile.html');
          }
        });
      })
  );
});

// 4. PUSH NOTIFICATIONS EVENT LISTENER
self.addEventListener('push', (event) => {
  let data = { title: 'MCE Việc Làm Mới', body: 'Có ca việc phù hợp gần bạn!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/manifest.json',
    badge: '/manifest.json',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/mobile.html' },
    actions: [
      { action: 'open', title: '⚡ Xem Ca Việc' },
      { action: 'close', title: 'Bỏ qua' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. NOTIFICATION CLICK
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/mobile.html')
    );
  }
});
