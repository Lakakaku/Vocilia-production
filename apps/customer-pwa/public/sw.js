// Development service worker - unregisters itself to prevent caching issues
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Clear all caches
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      // Unregister this service worker
      return self.registration.unregister();
    }).then(function() {
      // Claim all clients to ensure they get the unregistration
      return self.clients.claim();
    })
  );
});

// For any fetch, just pass through to network (no caching in dev)
self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});