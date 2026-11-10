// Service worker de Tenis Infinity.
// Solo existe para que el navegador permita instalar la web como app (Android: «Instalar app»).
// No guarda nada en caché a propósito: todas las peticiones van directas a la red, así que después de
// publicar cambios siempre se ve la versión nueva y los datos de Firebase siempre están al día.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Sin respondWith: el navegador hace la petición normal, como si no hubiera service worker.
});
