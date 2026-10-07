/* Mis gastos: funciona sin conexión y se actualiza sola.
   Cuando cambies archivos, subí también este con un número de versión nuevo. */
const CACHE = 'mis-gastos-v31';
const CORE = [
  './', './index.html', './manifest.json',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './cards/amex-blue.webp', './cards/economia.webp', './cards/bct-cashback.webp',
  './cards/premia-travel.webp', './cards/bac-la-roja.webp', './cards/gane-premios.jpg', './cards/sinpe-movil.jpg', './cards/paypal.jpg'
];
const LIVE = ['api.hacienda.go.cr', 'open.er-api.com', 'api.exchangerate-api.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // tipo de cambio: siempre en vivo, nunca desde la caché
  if (LIVE.includes(url.hostname)) return;
  // la app: primero la red para recibir actualizaciones; sin conexión, la copia guardada
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('/index.html'))) {
    e.respondWith(
      fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  // íconos, fotos de tarjetas y fuentes: copia guardada y se refresca en segundo plano
  if (url.origin === location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});

// logos de comercios (favicons): primero la copia guardada
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'GET' && url.hostname === 'www.google.com' && url.pathname === '/s2/favicons') {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; }))));
  }
});
