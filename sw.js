/* Service Worker — Maestro de Equipos UDE
   Guarda la app en el navegador para que abra sin internet.
   Los datos NO se guardan aquí: eso lo maneja IndexedDB en cada página. */
const CACHE = 'gllr-app-v2';
const ARCHIVOS = [
  './',
  './index.html',
  './pms.html',
  './combustible.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ARCHIVOS.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;                       // nunca cachear escrituras
  const url = new URL(req.url);
  if (url.hostname.endsWith('.supabase.co')) return;      // la API siempre va a la red

  // La app: primero la red (para traer la última versión), si no hay, la copia guardada
  ev.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
