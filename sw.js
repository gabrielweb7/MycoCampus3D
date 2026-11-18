/**
 * MycoCampus3D — Service Worker (PWA & Offline Cache)
 * Permite que o jogo seja instalado no Android/iOS como aplicativo nativo,
 * execute em tela cheia sem barra de navegador e carregue instantaneamente.
 */

const CACHE_NAME = 'mycocampus-v0.9.78';
const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tailwind.min.css?v=0.8.3',
  'css/game.css?v=0.9.78',
  'js/vendor/three.min.js?v=r128',
  'js/vendor/OrbitControls.js?v=r128',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/favicon-32.png',
  'assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[PWA] Aviso no pré-cache de ativos:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não intercepta chamadas de API dinâmica (login, ranking, multiplayer, etc.)
  if (url.pathname.includes('/api/') || event.request.method !== 'GET') {
    return;
  }

  // Estratégia Stale-While-Revalidate para ativos estáticos e páginas
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
