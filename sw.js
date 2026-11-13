/* Service Worker — Maestro de Equipos UDE
   Guarda la app en el navegador para que abra sin internet.
   Los datos NO se guardan aquí: eso lo maneja IndexedDB en cada página. */
const CACHE = 'gllr-app-v30';
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
  './config.html',
  './usuarios.html',
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

  // Primero la red (última versión). Con señal débil (obra/mina), a los 5 s se abre la copia
  // guardada DE ESA MISMA PÁGINA. Nunca se reemplaza una página por otra: antes, si config.html
  // o usuarios.html no estaban guardadas, se mostraba index.html dentro de la pestaña (en blanco).
  const esPagina = req.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  const red = fetch(req, esPagina && url.origin === location.origin ? {cache: 'no-cache'} : undefined).then(res => {
    if (res && res.status === 200 && url.origin === location.origin) {
      const copia = res.clone();
      caches.open(CACHE).then(c => c.put(req, copia));
    }
    return res;
  });
  const esInicio = req.mode === 'navigate' && req.destination === 'document' && /\/(index\.html)?$/.test(url.pathname);
  const esCampo = /campo\.html$/.test(url.pathname);
  const guardada = () => caches.match(req, {ignoreSearch: true}).then(r => r ||
    (esInicio ? caches.match('./index.html') : esCampo ? caches.match('./campo.html') : undefined));
  // si la red falla: la copia guardada; si no hay copia, el error de red (no otra página)
  const conRespaldo = red.catch(() => guardada().then(r => r || Response.error()));
  // si la red tarda más de 5 s y HAY copia de esta misma página, se usa la copia
  const conTiempo = new Promise(ok => setTimeout(() => guardada().then(r => { if (r) ok(r); }), 5000));
  ev.respondWith(Promise.race([conRespaldo, conTiempo]));
});
