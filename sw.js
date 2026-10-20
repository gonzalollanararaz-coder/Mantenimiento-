/* Service Worker — Maestro de Equipos UDE
   Guarda la app en el navegador para que abra sin internet.
   Los datos NO se guardan aquí: eso lo maneja IndexedDB en cada página. */
const CACHE = 'gllr-app-v19';
const ARCHIVOS = [
  './',
  './index.html',
  './pms.html',
  './combustible.html',
  './partes.html',
  './sos.html',
  './neumaticos.html',
  './pendientes.html',
  './supabase.js',
  './desfase.js',
  './campo.html',
  './campo.webmanifest',
  './campo-192.png',
  './campo-512.png',
  './campo-180.png',
  './campo-32.png',
  './pdm.html',
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
  // con señal débil (obra/mina) no se espera más de 5 s a la red: se abre la copia guardada
  const red = fetch(req).then(res => {
    if (res && res.status === 200) {
      const copia = res.clone();
      caches.open(CACHE).then(c => c.put(req, copia));
    }
    return res;
  });
  const respaldo = () => caches.match(req, {ignoreSearch: true}).then(r => r ||
    caches.match(url.pathname.endsWith('campo.html') ? './campo.html' : './index.html'));
  const conTiempo = new Promise(ok => setTimeout(() => respaldo().then(r => r && ok(r)), 5000));
  ev.respondWith(Promise.race([red.catch(() => respaldo()), conTiempo]));
});
