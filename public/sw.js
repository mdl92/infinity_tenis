// Service worker de Tenis Infinity (v2).
// Existe para que el navegador permita instalar la web como app (Android: «Instalar aplicación»).
//
// Chrome solo cuenta como instalable una web cuyo service worker atiende de verdad las peticiones:
// uno vacío lo detecta como «sin efecto» y lo ignora. Por eso aquí se responden las peticiones de la
// propia web, pero siempre pidiéndolas a la red: no se guarda nada en caché, así que después de publicar
// cambios se ve siempre la versión nueva.
//
// Las peticiones a otros sitios (Firebase, Google Fonts…) no se tocan: van directas, como sin service worker,
// para no interferir con las conexiones en tiempo real de Firestore.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request));
});
