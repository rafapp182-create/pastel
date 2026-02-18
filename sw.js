
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Apenas passa as requisições, necessário para o manifesto ser válido
  e.respondWith(fetch(e.request));
});
